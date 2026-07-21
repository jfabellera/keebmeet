/// <reference types="jest" />
import { type Request, type Response } from 'express';

// ---- Mocks -----------------------------------------------------------------

jest.mock('../Server', () => ({ socket: { emit: jest.fn() } }));

jest.mock('../entity/GalleryRecord', () => ({
  GalleryRecord: { create: jest.fn(), find: jest.fn(), findOne: jest.fn() },
}));
jest.mock('../entity/Ticket', () => ({
  Ticket: { findOne: jest.fn() },
}));
jest.mock('../entity/User', () => ({
  User: { findOneBy: jest.fn() },
}));
// Scraping is exercised in linkPreview.test.ts; here we only assert the
// controller maps whatever the util returns onto the response.
jest.mock('../util/linkPreview', () => ({ fetchLinkPreview: jest.fn() }));

jest.mock('../util/objectStorage', () => ({
  IMAGE_EXT_BY_MIME: { 'image/jpeg': 'jpg', 'image/png': 'png' },
  buildTempImageKey: (category: string) => `${category}/tmp/new.jpg`,
  deleteObject: jest.fn().mockResolvedValue(undefined),
  isManagedKey: (v: string) => v !== '' && !/^https?:\/\//.test(v),
  promoteImage: jest.fn(async (k: string) => k.replace('tmp/', '')),
  publicUrl: (k: string) => `https://cdn.test/${k}`,
  toStoredKey: (v: string) => v,
  upload: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../util/imageProcessing', () => ({
  normalizeImage: jest.fn(async (buf: Buffer) => buf),
}));

import {
  createGallery,
  deleteGallery,
  deleteGalleryById,
  deleteGalleryForUser,
  editGallery,
  getMeetupGalleryPreviews,
  getMeetupGallery,
  transferGallery,
} from './gallery';
import { socket } from '../Server';
import { GalleryRecord } from '../entity/GalleryRecord';
import { Ticket } from '../entity/Ticket';
import { fetchLinkPreview } from '../util/linkPreview';
import { deleteObject, promoteImage } from '../util/objectStorage';
import { User } from '../entity/User';

const mockedGalleryRecord = jest.mocked(GalleryRecord);
const mockedTicket = jest.mocked(Ticket);
const mockedUser = jest.mocked(User);
const mockedSocket = jest.mocked(socket);
const mockedFetchLinkPreview = jest.mocked(fetchLinkPreview);
const mockedPromoteImage = jest.mocked(promoteImage);
const mockedDeleteObject = jest.mocked(deleteObject);

// ---- Helpers ---------------------------------------------------------------

type MockResponse = Response & { statusCode?: number; body?: unknown };

const mockResponse = (): MockResponse => {
  const res: any = {};
  res.status = jest.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn().mockImplementation((body: unknown) => {
    res.body = body;
    return res;
  });
  res.end = jest.fn().mockImplementation(() => res);
  res.locals = {};
  return res as MockResponse;
};

const mockRequest = (
  body: unknown = {},
  params: Record<string, string> = {}
): Request => ({ body, params }) as unknown as Request;

const VALID_LINK = 'https://photos.example.com/album/1';
// A meetup that has already started vs one still in the future.
const STARTED_DATE = '2020-01-01T00:00:00.000Z';
const FUTURE_DATE = '2999-01-01T00:00:00.000Z';

/** A meetup (already started) where user `1` is neither organizer nor lead. */
const meetupWithoutUser = (): any => ({
  id: '10',
  date: STARTED_DATE,
  lead_organizer: { id: '99' },
  organizers: [{ id: '98' }],
});

beforeEach(() => {
  jest.clearAllMocks();
  mockedGalleryRecord.create.mockImplementation((attrs: any) => ({
    id: 'p1',
    ...attrs,
    save: jest.fn().mockResolvedValue(undefined),
  }));
});

// ---- createGallery -------------------------------------------------------

describe('createGallery', () => {
  it('returns 400 when the meetup or requestor is missing', async () => {
    const res = mockResponse();

    await createGallery(mockRequest({ gallery: VALID_LINK }), res);

    expect(res.statusCode).toBe(400);
    expect(mockedGalleryRecord.create).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid (non-URL) gallery', async () => {
    const res = mockResponse();
    res.locals.meetup = meetupWithoutUser();
    res.locals.requestor = { id: '1', nick_name: 'jane' };

    await createGallery(mockRequest({ gallery: 'not-a-url' }), res);

    expect(res.statusCode).toBe(400);
  });

  // Requirement: only attendees or organizers of the meetup can create a link.
  it('returns 403 when the requestor is neither an attendee nor an organizer', async () => {
    mockedTicket.findOne.mockResolvedValue(null); // no ticket for this meetup
    const res = mockResponse();
    res.locals.meetup = meetupWithoutUser();
    res.locals.requestor = { id: '1', nick_name: 'jane' };

    await createGallery(mockRequest({ gallery: VALID_LINK }), res);

    expect(res.statusCode).toBe(403);
    expect(mockedGalleryRecord.create).not.toHaveBeenCalled();
  });

  it('creates a link (201) for an attendee holding a ticket', async () => {
    mockedTicket.findOne.mockResolvedValue({ id: '5' } as any);
    mockedGalleryRecord.findOne.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.meetup = meetupWithoutUser();
    res.locals.requestor = { id: '1', nick_name: 'jane' };

    await createGallery(mockRequest({ gallery: VALID_LINK }), res);

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      id: 'p1',
      user_id: '1',
      display_name: 'jane',
      gallery: VALID_LINK,
      title: null,
      cover_image_url: null,
    });
    expect(mockedSocket.emit).toHaveBeenCalledWith('meetup:update', {
      meetupId: '10',
    });
  });

  it('creates a link (201) for the lead organizer without needing a ticket', async () => {
    mockedGalleryRecord.findOne.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.meetup = {
      id: '10',
      date: STARTED_DATE,
      lead_organizer: { id: '1' },
      organizers: [],
    };
    res.locals.requestor = { id: '1', nick_name: 'lead' };

    await createGallery(mockRequest({ gallery: VALID_LINK }), res);

    expect(res.statusCode).toBe(201);
    expect(mockedTicket.findOne).not.toHaveBeenCalled();
  });

  it('creates a link (201) for a co-organizer without needing a ticket', async () => {
    mockedGalleryRecord.findOne.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.meetup = {
      id: '10',
      date: STARTED_DATE,
      lead_organizer: { id: '99' },
      organizers: [{ id: '1' }],
    };
    res.locals.requestor = { id: '1', nick_name: 'co' };

    await createGallery(mockRequest({ gallery: VALID_LINK }), res);

    expect(res.statusCode).toBe(201);
    expect(mockedTicket.findOne).not.toHaveBeenCalled();
  });

  // Requirement: links can only be added once the meetup has started.
  it('returns 400 when the meetup has not started yet', async () => {
    const res = mockResponse();
    res.locals.meetup = {
      id: '10',
      date: FUTURE_DATE,
      lead_organizer: { id: '1' },
      organizers: [],
    };
    res.locals.requestor = { id: '1', nick_name: 'lead' };

    await createGallery(mockRequest({ gallery: VALID_LINK }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ message: 'Meetup has not started yet.' });
    expect(mockedGalleryRecord.create).not.toHaveBeenCalled();
  });

  // Requirement: each attendee/organizer may hold at most one link per meetup.
  it('returns 409 when the requestor already has a link for the meetup', async () => {
    mockedTicket.findOne.mockResolvedValue({ id: '5' } as any);
    mockedGalleryRecord.findOne.mockResolvedValue({
      meetup_id: '10',
      user_id: '1',
      gallery: 'https://old.example.com',
    } as any);
    const res = mockResponse();
    res.locals.meetup = meetupWithoutUser();
    res.locals.requestor = { id: '1', nick_name: 'jane' };

    await createGallery(mockRequest({ gallery: VALID_LINK }), res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ message: 'Gallery already exists.' });
    expect(mockedGalleryRecord.create).not.toHaveBeenCalled();
  });

  // ---- archive meetups ----
  // The organizer curates the gallery: account-less links credited by name, no
  // ticket gate and no one-per-person limit.
  const archiveMeetup = (): any => ({
    id: '10',
    date: STARTED_DATE,
    is_archive: true,
    lead_organizer: { id: '1' },
    organizers: [],
  });

  it('archives a link (201) credited to a free-text contributor name', async () => {
    const res = mockResponse();
    res.locals.meetup = archiveMeetup();
    res.locals.requestor = { id: '1', nick_name: 'lead' };

    await createGallery(
      mockRequest({ gallery: VALID_LINK, contributor_name: 'Old Timer' }),
      res
    );

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      id: 'p1',
      user_id: null,
      display_name: 'Old Timer',
      gallery: VALID_LINK,
      title: null,
      cover_image_url: null,
    });
    // No ticket check and no per-person duplicate lookup for archives.
    expect(mockedTicket.findOne).not.toHaveBeenCalled();
    expect(mockedGalleryRecord.findOne).not.toHaveBeenCalled();
  });

  it('returns 403 when a non-organizer tries to add to an archive', async () => {
    const res = mockResponse();
    res.locals.meetup = archiveMeetup();
    res.locals.requestor = { id: '2', nick_name: 'rando' };

    await createGallery(
      mockRequest({ gallery: VALID_LINK, contributor_name: 'x' }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(mockedGalleryRecord.create).not.toHaveBeenCalled();
  });

  // No contributor name = "I took these": tie the link to the organizer's own
  // account, credited by their nick_name.
  it('links the organizer\'s own account when no contributor name is given', async () => {
    mockedGalleryRecord.findOne.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.meetup = archiveMeetup();
    res.locals.requestor = { id: '1', nick_name: 'lead' };

    await createGallery(mockRequest({ gallery: VALID_LINK }), res);

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      id: 'p1',
      user_id: '1',
      display_name: 'lead',
      gallery: VALID_LINK,
      title: null,
      cover_image_url: null,
    });
  });

  // The organizer's own account-linked archive photo is still one-per-person.
  it('returns 409 when the organizer already has their own archive link', async () => {
    mockedGalleryRecord.findOne.mockResolvedValue({ id: 'existing' } as any);
    const res = mockResponse();
    res.locals.meetup = archiveMeetup();
    res.locals.requestor = { id: '1', nick_name: 'lead' };

    await createGallery(mockRequest({ gallery: VALID_LINK }), res);

    expect(res.statusCode).toBe(409);
    expect(mockedGalleryRecord.create).not.toHaveBeenCalled();
  });

  // ---- crediting others on a live (non-archive) meetup ----
  // Organizers can credit an account-less contributor (e.g. a photographer) on
  // any of their meetups, not just archives.
  it('lets an organizer credit an account-less contributor on a live meetup', async () => {
    const res = mockResponse();
    res.locals.meetup = {
      id: '10',
      date: STARTED_DATE,
      lead_organizer: { id: '1' },
      organizers: [],
    };
    res.locals.requestor = { id: '1', nick_name: 'lead' };

    await createGallery(
      mockRequest({ gallery: VALID_LINK, contributor_name: 'Photog' }),
      res
    );

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      id: 'p1',
      user_id: null,
      display_name: 'Photog',
      gallery: VALID_LINK,
      title: null,
      cover_image_url: null,
    });
    // Credited links are account-less: no ticket gate, no per-person lookup.
    expect(mockedTicket.findOne).not.toHaveBeenCalled();
    expect(mockedGalleryRecord.findOne).not.toHaveBeenCalled();
  });

  it('returns 403 when a non-organizer tries to credit someone else', async () => {
    // Even a ticket-holding attendee may not post on another person's behalf.
    mockedTicket.findOne.mockResolvedValue({ id: '5' } as any);
    const res = mockResponse();
    res.locals.meetup = meetupWithoutUser();
    res.locals.requestor = { id: '1', nick_name: 'jane' };

    await createGallery(
      mockRequest({ gallery: VALID_LINK, contributor_name: 'Photog' }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(mockedGalleryRecord.create).not.toHaveBeenCalled();
  });
});

// ---- deleteGallery (self-service) ----------------------------------------

describe('deleteGallery', () => {
  it('returns 400 when the meetup or requestor is missing', async () => {
    const res = mockResponse();

    await deleteGallery(mockRequest(), res);

    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when the requestor has no link for the meetup', async () => {
    mockedGalleryRecord.findOne.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.meetup = { id: '10' };
    res.locals.requestor = { id: '1' };

    await deleteGallery(mockRequest(), res);

    expect(res.statusCode).toBe(404);
  });

  // Requirement: the owner may delete their own link. The lookup is keyed by the
  // requestor's id, so a user can only ever remove their own record this way.
  it('removes the requestor\'s own link (204) and emits an update', async () => {
    const record = { remove: jest.fn().mockResolvedValue(undefined) };
    mockedGalleryRecord.findOne.mockResolvedValue(record as any);
    const res = mockResponse();
    res.locals.meetup = { id: '10' };
    res.locals.requestor = { id: '1' };

    await deleteGallery(mockRequest(), res);

    const whereArg = (mockedGalleryRecord.findOne.mock.calls[0][0] as any)
      .where;
    expect(whereArg).toEqual({ meetup: { id: '10' }, user: { id: '1' } });
    expect(record.remove).toHaveBeenCalled();
    expect(mockedSocket.emit).toHaveBeenCalledWith('meetup:update', {
      meetupId: '10',
    });
    expect(res.statusCode).toBe(204);
  });
});

// ---- deleteGalleryForUser (organizer moderation) -------------------------

describe('deleteGalleryForUser', () => {
  it('returns 400 when the meetup is missing', async () => {
    const res = mockResponse();

    await deleteGalleryForUser(mockRequest({}, { target_user_id: '2' }), res);

    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when the target user has no link for the meetup', async () => {
    mockedGalleryRecord.findOne.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.meetup = { id: '10' };

    await deleteGalleryForUser(mockRequest({}, { target_user_id: '2' }), res);

    expect(res.statusCode).toBe(404);
  });

  // Requirement: an organizer (authorized by authChecker on :meetup_id) may
  // remove another attendee's link, addressed by :target_user_id.
  it("removes the target user's link (204) and emits an update", async () => {
    const record = { remove: jest.fn().mockResolvedValue(undefined) };
    mockedGalleryRecord.findOne.mockResolvedValue(record as any);
    const res = mockResponse();
    res.locals.meetup = { id: '10' };

    await deleteGalleryForUser(mockRequest({}, { target_user_id: '2' }), res);

    const whereArg = (mockedGalleryRecord.findOne.mock.calls[0][0] as any)
      .where;
    expect(whereArg).toEqual({ meetup: { id: '10' }, user: { id: '2' } });
    expect(record.remove).toHaveBeenCalled();
    expect(mockedSocket.emit).toHaveBeenCalledWith('meetup:update', {
      meetupId: '10',
    });
    expect(res.statusCode).toBe(204);
  });
});

// ---- getMeetupGallery ---------------------------------------------------

describe('getMeetupGallery', () => {
  it('maps every link for the meetup to the response shape', async () => {
    mockedGalleryRecord.find.mockResolvedValue([
      {
        id: 'p1',
        user_id: '1',
        user: { id: '1', nick_name: 'jane' },
        gallery: 'https://a.example.com',
      },
      {
        id: 'p2',
        user_id: '2',
        user: { id: '2', nick_name: 'bob' },
        gallery: 'https://b.example.com',
      },
    ] as any);
    const res = mockResponse();

    await getMeetupGallery(mockRequest({}, { meetup_id: '10' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([
      {
        id: 'p1',
        user_id: '1',
        display_name: 'jane',
        gallery: 'https://a.example.com',
        title: null,
        cover_image_url: null,
      },
      {
        id: 'p2',
        user_id: '2',
        display_name: 'bob',
        gallery: 'https://b.example.com',
        title: null,
        cover_image_url: null,
      },
    ]);
  });

  // Archive links have no user; the free-text contributor_name is the credit.
  it('credits an account-less archive link by its contributor_name', async () => {
    mockedGalleryRecord.find.mockResolvedValue([
      {
        id: 'p9',
        user_id: null,
        user: null,
        contributor_name: 'Old Timer',
        gallery: 'https://c.example.com',
      },
    ] as any);
    const res = mockResponse();

    await getMeetupGallery(mockRequest({}, { meetup_id: '10' }), res);

    expect(res.body).toEqual([
      {
        id: 'p9',
        user_id: null,
        display_name: 'Old Timer',
        gallery: 'https://c.example.com',
        title: null,
        cover_image_url: null,
      },
    ]);
  });

  // Records are returned oldest-first (contribution order) for a stable list.
  it('requests the links ordered by created_at ascending', async () => {
    mockedGalleryRecord.find.mockResolvedValue([]);
    const res = mockResponse();

    await getMeetupGallery(mockRequest({}, { meetup_id: '10' }), res);

    const findArg = mockedGalleryRecord.find.mock.calls[0][0] as any;
    expect(findArg.order).toEqual({ created_at: 'ASC' });
  });

  it('returns an empty list when the meetup has no galleries', async () => {
    mockedGalleryRecord.find.mockResolvedValue([]);
    const res = mockResponse();

    await getMeetupGallery(mockRequest({}, { meetup_id: '10' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ---- getMeetupGalleryPreviews --------------------------------------------

describe('getMeetupGalleryPreviews', () => {
  it('maps the util preview onto each link, keyed by record id', async () => {
    mockedGalleryRecord.find.mockResolvedValue([
      { id: 'p1', gallery: 'https://album.example.com/1' },
      { id: 'p2', gallery: 'https://img.example.com/photo.jpg' },
    ] as any);
    mockedFetchLinkPreview.mockImplementation(async (url: string) =>
      url === 'https://album.example.com/1'
        ? {
            title: 'Meetup album',
            image: 'https://album.example.com/cover.jpg',
            siteName: 'Example Photos',
          }
        : { title: null, image: url, siteName: null }
    );
    const res = mockResponse();

    await getMeetupGalleryPreviews(mockRequest({}, { meetup_id: '10' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([
      {
        id: 'p1',
        title: 'Meetup album',
        image: 'https://album.example.com/cover.jpg',
        siteName: 'Example Photos',
      },
      {
        id: 'p2',
        title: null,
        image: 'https://img.example.com/photo.jpg',
        siteName: null,
      },
    ]);
  });

  it('returns null fields when the util yields no preview', async () => {
    mockedGalleryRecord.find.mockResolvedValue([
      { id: 'p3', gallery: 'https://broken.example.com/1' },
    ] as any);
    mockedFetchLinkPreview.mockResolvedValue({
      title: null,
      image: null,
      siteName: null,
    });
    const res = mockResponse();

    await getMeetupGalleryPreviews(mockRequest({}, { meetup_id: '10' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([
      { id: 'p3', title: null, image: null, siteName: null },
    ]);
  });

  it('uses stored overrides and skips the fetch when both are set', async () => {
    mockedGalleryRecord.find.mockResolvedValue([
      {
        id: 'p1',
        gallery: 'https://imgur.com/a/x',
        title: 'My album',
        cover_image_key: 'galleries/cover.jpg',
      },
    ] as any);
    const res = mockResponse();

    await getMeetupGalleryPreviews(mockRequest({}, { meetup_id: '10' }), res);

    expect(mockedFetchLinkPreview).not.toHaveBeenCalled();
    expect(res.body).toEqual([
      {
        id: 'p1',
        title: 'My album',
        image: 'https://cdn.test/galleries/cover.jpg',
        siteName: null,
      },
    ]);
  });

  it('falls back to the fetched field the override is missing', async () => {
    mockedGalleryRecord.find.mockResolvedValue([
      { id: 'p1', gallery: 'https://imgur.com/a/x', title: 'My album' },
    ] as any);
    mockedFetchLinkPreview.mockResolvedValue({
      title: 'ignored',
      image: 'https://fetched.example.com/i.jpg',
      siteName: 'Imgur',
    });
    const res = mockResponse();

    await getMeetupGalleryPreviews(mockRequest({}, { meetup_id: '10' }), res);

    expect(res.body).toEqual([
      {
        id: 'p1',
        title: 'My album',
        image: 'https://fetched.example.com/i.jpg',
        siteName: 'Imgur',
      },
    ]);
  });
});

// ---- editGallery ---------------------------------------------------------

describe('editGallery', () => {
  const editable = (): any => ({
    id: 'p1',
    user_id: '1',
    user: { id: '1', nick_name: 'jane' },
    gallery: 'https://old.example.com',
    title: null,
    cover_image_key: null,
    save: jest.fn().mockResolvedValue(undefined),
  });

  it('returns 404 when no link with that id exists for the meetup', async () => {
    mockedGalleryRecord.findOne.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.meetup = meetupWithoutUser();
    res.locals.requestor = { id: '1' };

    await editGallery(
      mockRequest({ gallery: VALID_LINK }, { gallery_id: 'p1' }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('returns 403 when requestor is neither the owner nor an organizer', async () => {
    mockedGalleryRecord.findOne.mockResolvedValue(editable());
    const res = mockResponse();
    res.locals.meetup = meetupWithoutUser(); // organizers 98/99
    res.locals.requestor = { id: '2' }; // not owner (1), not organizer

    await editGallery(
      mockRequest({ gallery: VALID_LINK }, { gallery_id: 'p1' }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('lets the owner edit their own link (200) and sets title + gallery', async () => {
    const record = editable();
    mockedGalleryRecord.findOne.mockResolvedValue(record);
    const res = mockResponse();
    res.locals.meetup = meetupWithoutUser();
    res.locals.requestor = { id: '1' }; // owner

    await editGallery(
      mockRequest(
        { gallery: VALID_LINK, title: '  My album  ' },
        { gallery_id: 'p1' }
      ),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(record.gallery).toBe(VALID_LINK);
    expect(record.title).toBe('My album');
    expect(record.save).toHaveBeenCalled();
    expect(res.body).toMatchObject({ id: 'p1', title: 'My album' });
  });

  it('lets an organizer edit a link they do not own', async () => {
    const record = editable();
    record.user_id = '2'; // owned by someone else
    mockedGalleryRecord.findOne.mockResolvedValue(record);
    const res = mockResponse();
    res.locals.meetup = { id: '10', lead_organizer: { id: '1' }, organizers: [] };
    res.locals.requestor = { id: '1' }; // organizer, not owner

    await editGallery(
      mockRequest({ gallery: VALID_LINK }, { gallery_id: 'p1' }),
      res
    );

    expect(res.statusCode).toBe(200);
  });

  it('promotes a new cover and deletes the previous one', async () => {
    const record = editable();
    record.cover_image_key = 'galleries/old.jpg';
    mockedGalleryRecord.findOne.mockResolvedValue(record);
    const res = mockResponse();
    res.locals.meetup = meetupWithoutUser();
    res.locals.requestor = { id: '1' };

    await editGallery(
      mockRequest(
        { gallery: VALID_LINK, cover_image_key: 'galleries/tmp/new.jpg' },
        { gallery_id: 'p1' }
      ),
      res
    );

    expect(mockedPromoteImage).toHaveBeenCalledWith('galleries/tmp/new.jpg');
    expect(record.cover_image_key).toBe('galleries/new.jpg');
    expect(mockedDeleteObject).toHaveBeenCalledWith('galleries/old.jpg');
    expect((res.body as any).cover_image_url).toBe('https://cdn.test/galleries/new.jpg');
  });

  it('clears the cover when an empty string is sent', async () => {
    const record = editable();
    record.cover_image_key = 'galleries/old.jpg';
    mockedGalleryRecord.findOne.mockResolvedValue(record);
    const res = mockResponse();
    res.locals.meetup = meetupWithoutUser();
    res.locals.requestor = { id: '1' };

    await editGallery(
      mockRequest(
        { gallery: VALID_LINK, cover_image_key: '' },
        { gallery_id: 'p1' }
      ),
      res
    );

    expect(record.cover_image_key).toBeNull();
    expect(mockedDeleteObject).toHaveBeenCalledWith('galleries/old.jpg');
    expect((res.body as any).cover_image_url).toBeNull();
  });
});

// ---- deleteGalleryById (organizer, by record id) -------------------------

describe('deleteGalleryById', () => {
  it('returns 400 when the meetup is missing', async () => {
    const res = mockResponse();

    await deleteGalleryById(mockRequest({}, { gallery_id: 'p1' }), res);

    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when no link with that id exists for the meetup', async () => {
    mockedGalleryRecord.findOne.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.meetup = { id: '10' };

    await deleteGalleryById(mockRequest({}, { gallery_id: 'p1' }), res);

    expect(res.statusCode).toBe(404);
  });

  // Requirement: an organizer (authorized by authChecker on :meetup_id) removes
  // an account-less archive link addressed by its record id, scoped to the meetup.
  it('removes the link (204) and emits an update', async () => {
    const record = { remove: jest.fn().mockResolvedValue(undefined) };
    mockedGalleryRecord.findOne.mockResolvedValue(record as any);
    const res = mockResponse();
    res.locals.meetup = { id: '10' };

    await deleteGalleryById(mockRequest({}, { gallery_id: 'p1' }), res);

    const whereArg = (mockedGalleryRecord.findOne.mock.calls[0][0] as any)
      .where;
    expect(whereArg).toEqual({ id: 'p1', meetup: { id: '10' } });
    expect(record.remove).toHaveBeenCalled();
    expect(mockedSocket.emit).toHaveBeenCalledWith('meetup:update', {
      meetupId: '10',
    });
    expect(res.statusCode).toBe(204);
  });
});

// ---- transferGallery -----------------------------------------------------

describe('transferGallery', () => {
  const credited = (): any => ({
    id: 'p1',
    user_id: null,
    contributor_name: 'Old Timer',
    gallery: 'https://c.example.com',
    title: null,
    cover_image_key: null,
    save: jest.fn().mockResolvedValue(undefined),
  });

  it('returns 404 when no link with that id exists for the meetup', async () => {
    mockedGalleryRecord.findOne.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.meetup = { id: '10' };

    await transferGallery(
      mockRequest({ username: 'jane' }, { gallery_id: 'p1' }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when the link already belongs to a user', async () => {
    mockedGalleryRecord.findOne.mockResolvedValue({
      id: 'p1',
      user_id: '2',
    } as any);
    const res = mockResponse();
    res.locals.meetup = { id: '10' };

    await transferGallery(
      mockRequest({ username: 'jane' }, { gallery_id: 'p1' }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when the username matches no user', async () => {
    mockedGalleryRecord.findOne.mockResolvedValue(credited());
    mockedUser.findOneBy.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.meetup = { id: '10' };

    await transferGallery(
      mockRequest({ username: 'ghost' }, { gallery_id: 'p1' }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('returns 409 when the target already has a gallery for the meetup', async () => {
    mockedGalleryRecord.findOne
      .mockResolvedValueOnce(credited())
      .mockResolvedValueOnce({ id: 'p2' } as any);
    mockedUser.findOneBy.mockResolvedValue({ id: '5', nick_name: 'jane' } as any);
    const res = mockResponse();
    res.locals.meetup = { id: '10' };

    await transferGallery(
      mockRequest({ username: 'jane' }, { gallery_id: 'p1' }),
      res
    );

    expect(res.statusCode).toBe(409);
  });

  it('transfers the link (200), setting the user and clearing the credit', async () => {
    const record = credited();
    mockedGalleryRecord.findOne
      .mockResolvedValueOnce(record)
      .mockResolvedValueOnce(null);
    mockedUser.findOneBy.mockResolvedValue({ id: '5', nick_name: 'jane' } as any);
    const res = mockResponse();
    res.locals.meetup = { id: '10' };

    await transferGallery(
      mockRequest({ username: 'jane' }, { gallery_id: 'p1' }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(record.user_id).toBe('5');
    expect(record.contributor_name).toBeNull();
    expect(record.save).toHaveBeenCalled();
    expect(res.body).toMatchObject({
      id: 'p1',
      user_id: '5',
      display_name: 'jane',
    });
    expect(mockedSocket.emit).toHaveBeenCalledWith('meetup:update', {
      meetupId: '10',
    });
  });
});
