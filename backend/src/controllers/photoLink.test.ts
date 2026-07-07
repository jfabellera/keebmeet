/// <reference types="jest" />
import { type Request, type Response } from 'express';

// ---- Mocks -----------------------------------------------------------------

jest.mock('../Server', () => ({ socket: { emit: jest.fn() } }));

jest.mock('../entity/PhotoLinkRecord', () => ({
  PhotoLinkRecord: { create: jest.fn(), find: jest.fn(), findOne: jest.fn() },
}));
jest.mock('../entity/Ticket', () => ({
  Ticket: { findOne: jest.fn() },
}));

import {
  createPhotoLink,
  deletePhotoLink,
  deletePhotoLinkForUser,
  getMeetupPhotoLinks,
} from './photoLink';
import { socket } from '../Server';
import { PhotoLinkRecord } from '../entity/PhotoLinkRecord';
import { Ticket } from '../entity/Ticket';

const mockedPhotoLinkRecord = jest.mocked(PhotoLinkRecord);
const mockedTicket = jest.mocked(Ticket);
const mockedSocket = jest.mocked(socket);

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
  mockedPhotoLinkRecord.create.mockImplementation((attrs: any) => ({
    ...attrs,
    save: jest.fn().mockResolvedValue(undefined),
  }));
});

// ---- createPhotoLink -------------------------------------------------------

describe('createPhotoLink', () => {
  it('returns 400 when the meetup or requestor is missing', async () => {
    const res = mockResponse();

    await createPhotoLink(mockRequest({ photo_link: VALID_LINK }), res);

    expect(res.statusCode).toBe(400);
    expect(mockedPhotoLinkRecord.create).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid (non-URL) photo_link', async () => {
    const res = mockResponse();
    res.locals.meetup = meetupWithoutUser();
    res.locals.requestor = { id: '1', nick_name: 'jane' };

    await createPhotoLink(mockRequest({ photo_link: 'not-a-url' }), res);

    expect(res.statusCode).toBe(400);
  });

  // Requirement: only attendees or organizers of the meetup can create a link.
  it('returns 403 when the requestor is neither an attendee nor an organizer', async () => {
    mockedTicket.findOne.mockResolvedValue(null); // no ticket for this meetup
    const res = mockResponse();
    res.locals.meetup = meetupWithoutUser();
    res.locals.requestor = { id: '1', nick_name: 'jane' };

    await createPhotoLink(mockRequest({ photo_link: VALID_LINK }), res);

    expect(res.statusCode).toBe(403);
    expect(mockedPhotoLinkRecord.create).not.toHaveBeenCalled();
  });

  it('creates a link (201) for an attendee holding a ticket', async () => {
    mockedTicket.findOne.mockResolvedValue({ id: '5' } as any);
    mockedPhotoLinkRecord.findOne.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.meetup = meetupWithoutUser();
    res.locals.requestor = { id: '1', nick_name: 'jane' };

    await createPhotoLink(mockRequest({ photo_link: VALID_LINK }), res);

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      user_id: '1',
      display_name: 'jane',
      photo_link: VALID_LINK,
    });
    expect(mockedSocket.emit).toHaveBeenCalledWith('meetup:update', {
      meetupId: '10',
    });
  });

  it('creates a link (201) for the lead organizer without needing a ticket', async () => {
    mockedPhotoLinkRecord.findOne.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.meetup = {
      id: '10',
      date: STARTED_DATE,
      lead_organizer: { id: '1' },
      organizers: [],
    };
    res.locals.requestor = { id: '1', nick_name: 'lead' };

    await createPhotoLink(mockRequest({ photo_link: VALID_LINK }), res);

    expect(res.statusCode).toBe(201);
    expect(mockedTicket.findOne).not.toHaveBeenCalled();
  });

  it('creates a link (201) for a co-organizer without needing a ticket', async () => {
    mockedPhotoLinkRecord.findOne.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.meetup = {
      id: '10',
      date: STARTED_DATE,
      lead_organizer: { id: '99' },
      organizers: [{ id: '1' }],
    };
    res.locals.requestor = { id: '1', nick_name: 'co' };

    await createPhotoLink(mockRequest({ photo_link: VALID_LINK }), res);

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

    await createPhotoLink(mockRequest({ photo_link: VALID_LINK }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ message: 'Meetup has not started yet.' });
    expect(mockedPhotoLinkRecord.create).not.toHaveBeenCalled();
  });

  // Requirement: each attendee/organizer may hold at most one link per meetup.
  it('returns 409 when the requestor already has a link for the meetup', async () => {
    mockedTicket.findOne.mockResolvedValue({ id: '5' } as any);
    mockedPhotoLinkRecord.findOne.mockResolvedValue({
      meetup_id: '10',
      user_id: '1',
      photo_link: 'https://old.example.com',
    } as any);
    const res = mockResponse();
    res.locals.meetup = meetupWithoutUser();
    res.locals.requestor = { id: '1', nick_name: 'jane' };

    await createPhotoLink(mockRequest({ photo_link: VALID_LINK }), res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ message: 'Photo link already exists.' });
    expect(mockedPhotoLinkRecord.create).not.toHaveBeenCalled();
  });
});

// ---- deletePhotoLink (self-service) ----------------------------------------

describe('deletePhotoLink', () => {
  it('returns 400 when the meetup or requestor is missing', async () => {
    const res = mockResponse();

    await deletePhotoLink(mockRequest(), res);

    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when the requestor has no link for the meetup', async () => {
    mockedPhotoLinkRecord.findOne.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.meetup = { id: '10' };
    res.locals.requestor = { id: '1' };

    await deletePhotoLink(mockRequest(), res);

    expect(res.statusCode).toBe(404);
  });

  // Requirement: the owner may delete their own link. The lookup is keyed by the
  // requestor's id, so a user can only ever remove their own record this way.
  it('removes the requestor\'s own link (204) and emits an update', async () => {
    const record = { remove: jest.fn().mockResolvedValue(undefined) };
    mockedPhotoLinkRecord.findOne.mockResolvedValue(record as any);
    const res = mockResponse();
    res.locals.meetup = { id: '10' };
    res.locals.requestor = { id: '1' };

    await deletePhotoLink(mockRequest(), res);

    const whereArg = (mockedPhotoLinkRecord.findOne.mock.calls[0][0] as any)
      .where;
    expect(whereArg).toEqual({ meetup: { id: '10' }, user: { id: '1' } });
    expect(record.remove).toHaveBeenCalled();
    expect(mockedSocket.emit).toHaveBeenCalledWith('meetup:update', {
      meetupId: '10',
    });
    expect(res.statusCode).toBe(204);
  });
});

// ---- deletePhotoLinkForUser (organizer moderation) -------------------------

describe('deletePhotoLinkForUser', () => {
  it('returns 400 when the meetup is missing', async () => {
    const res = mockResponse();

    await deletePhotoLinkForUser(mockRequest({}, { target_user_id: '2' }), res);

    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when the target user has no link for the meetup', async () => {
    mockedPhotoLinkRecord.findOne.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.meetup = { id: '10' };

    await deletePhotoLinkForUser(mockRequest({}, { target_user_id: '2' }), res);

    expect(res.statusCode).toBe(404);
  });

  // Requirement: an organizer (authorized by authChecker on :meetup_id) may
  // remove another attendee's link, addressed by :target_user_id.
  it("removes the target user's link (204) and emits an update", async () => {
    const record = { remove: jest.fn().mockResolvedValue(undefined) };
    mockedPhotoLinkRecord.findOne.mockResolvedValue(record as any);
    const res = mockResponse();
    res.locals.meetup = { id: '10' };

    await deletePhotoLinkForUser(mockRequest({}, { target_user_id: '2' }), res);

    const whereArg = (mockedPhotoLinkRecord.findOne.mock.calls[0][0] as any)
      .where;
    expect(whereArg).toEqual({ meetup: { id: '10' }, user: { id: '2' } });
    expect(record.remove).toHaveBeenCalled();
    expect(mockedSocket.emit).toHaveBeenCalledWith('meetup:update', {
      meetupId: '10',
    });
    expect(res.statusCode).toBe(204);
  });
});

// ---- getMeetupPhotoLinks ---------------------------------------------------

describe('getMeetupPhotoLinks', () => {
  it('maps every link for the meetup to the response shape', async () => {
    mockedPhotoLinkRecord.find.mockResolvedValue([
      {
        user: { id: '1', nick_name: 'jane' },
        photo_link: 'https://a.example.com',
      },
      {
        user: { id: '2', nick_name: 'bob' },
        photo_link: 'https://b.example.com',
      },
    ] as any);
    const res = mockResponse();

    await getMeetupPhotoLinks(mockRequest({}, { meetup_id: '10' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([
      { user_id: '1', display_name: 'jane', photo_link: 'https://a.example.com' },
      { user_id: '2', display_name: 'bob', photo_link: 'https://b.example.com' },
    ]);
  });

  // Records are returned oldest-first (contribution order) for a stable list.
  it('requests the links ordered by created_at ascending', async () => {
    mockedPhotoLinkRecord.find.mockResolvedValue([]);
    const res = mockResponse();

    await getMeetupPhotoLinks(mockRequest({}, { meetup_id: '10' }), res);

    const findArg = mockedPhotoLinkRecord.find.mock.calls[0][0] as any;
    expect(findArg.order).toEqual({ created_at: 'ASC' });
  });

  it('returns an empty list when the meetup has no photo links', async () => {
    mockedPhotoLinkRecord.find.mockResolvedValue([]);
    const res = mockResponse();

    await getMeetupPhotoLinks(mockRequest({}, { meetup_id: '10' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });
});
