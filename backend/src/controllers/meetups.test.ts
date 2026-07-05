/// <reference types="jest" />
import { type Request, type Response } from 'express';

// ---- Mocks -----------------------------------------------------------------

jest.mock('../Server', () => ({ socket: { emit: jest.fn() } }));

jest.mock('../config', () => ({
  __esModule: true,
  default: { apiUrl: 'http://api.test', r2PublicBaseUrl: 'https://cdn.test' },
}));

jest.mock('../entity/Meetup', () => ({
  Meetup: {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
}));
jest.mock('../entity/EventbriteRecord', () => ({
  EventbriteRecord: { create: jest.fn() },
}));
jest.mock('../entity/MeetupDisplayRecord', () => ({
  MeetupDisplayRecord: { create: jest.fn() },
}));
jest.mock('../entity/Ticket', () => ({
  Ticket: { count: jest.fn() },
}));

jest.mock('../util/eventbriteApi', () => ({
  createEventbriteWebhook: jest.fn(),
  getEventbriteAttendees: jest.fn(),
  getEventbriteEvent: jest.fn(),
  getEventbriteTicket: jest.fn(),
  getEventbriteVenue: jest.fn(),
}));
jest.mock('../util/externalApis', () => ({
  geocode: jest.fn(),
  getUtcOffset: jest.fn(),
}));
jest.mock('../util/security', () => ({
  decrypt: jest.fn((value: string) => `decrypted(${value})`),
}));
jest.mock('./tickets', () => ({
  syncEventbriteAttendee: jest.fn(),
}));
jest.mock('../util/meetupDiscordMessage', () => ({
  refreshMeetupDiscordMessage: jest.fn(),
}));
// The added-organizer email side effect is covered separately in
// organizerAddedNotification.test.ts; here we only stub it out.
jest.mock('../util/organizerAddedNotification', () => ({
  notifyAddedOrganizers: jest.fn(),
}));
// Run the delete transaction callback against a no-op manager.
jest.mock('../datasource', () => {
  // A single shared relation builder so tests can assert on addAndRemove.
  const relationBuilder = {
    relation: jest.fn().mockReturnThis(),
    of: jest.fn().mockReturnThis(),
    addAndRemove: jest.fn().mockResolvedValue(undefined),
  };
  return {
    AppDataSource: {
      transaction: jest.fn(async (cb: (manager: unknown) => Promise<unknown>) =>
        cb({
          remove: jest.fn().mockResolvedValue(undefined),
          delete: jest.fn().mockResolvedValue(undefined),
          createQueryBuilder: jest.fn(() => ({
            delete: jest.fn().mockReturnThis(),
            from: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            execute: jest.fn().mockResolvedValue(undefined),
          })),
        })
      ),
      // Relation query builder used to update a meetup's organizers join table.
      createQueryBuilder: jest.fn(() => relationBuilder),
    },
  };
});

jest.mock('../entity/User', () => ({
  User: {
    findBy: jest.fn(),
  },
}));
// Keep the real pure helpers (isManagedKey/publicUrl); stub the calls that hit R2.
jest.mock('../util/objectStorage', () => {
  const actual = jest.requireActual('../util/objectStorage');
  return {
    __esModule: true,
    ...actual,
    upload: jest.fn(),
    deleteObject: jest.fn(async () => undefined),
    // Default: promotion is a passthrough (returns the key unchanged).
    promoteImage: jest.fn(async (key: string) => key),
  };
});

import {
  createMeetup,
  createMeetupFromEventbrite,
  deleteMeetup,
  getAllMeetups,
  getMeetup,
  getMeetupAttendees,
  getMeetupDisplayAssets,
  syncEventbriteAttendees,
  updateMeetup,
} from './meetups';
import { socket } from '../Server';
import { In } from 'typeorm';
import { AppDataSource } from '../datasource';
import { Meetup } from '../entity/Meetup';
import { User } from '../entity/User';
import { EventbriteRecord } from '../entity/EventbriteRecord';
import { MeetupDisplayRecord } from '../entity/MeetupDisplayRecord';
import { Ticket } from '../entity/Ticket';
import {
  createEventbriteWebhook,
  getEventbriteAttendees,
  getEventbriteEvent,
  getEventbriteTicket,
  getEventbriteVenue,
} from '../util/eventbriteApi';
import { geocode, getUtcOffset } from '../util/externalApis';
import { refreshMeetupDiscordMessage } from '../util/meetupDiscordMessage';
import { deleteObject, promoteImage } from '../util/objectStorage';

const mockedMeetup = jest.mocked(Meetup);
const mockedUser = jest.mocked(User);
const mockedDataSource = jest.mocked(AppDataSource);
// The shared relation builder returned by createQueryBuilder (see the mock).
const organizerRelation = mockedDataSource.createQueryBuilder() as unknown as {
  addAndRemove: jest.Mock;
};
const mockedRefresh = jest.mocked(refreshMeetupDiscordMessage);
const mockedDeleteObject = jest.mocked(deleteObject);
const mockedPromoteImage = jest.mocked(promoteImage);
const mockedDisplayRecord = jest.mocked(MeetupDisplayRecord);
const mockedEventbriteRecord = jest.mocked(EventbriteRecord);
const mockedTicket = jest.mocked(Ticket);
const mockedSocket = jest.mocked(socket);
const mockedGeocode = jest.mocked(geocode);
const mockedGetUtcOffset = jest.mocked(getUtcOffset);
const mockedGetEvent = jest.mocked(getEventbriteEvent);
const mockedGetVenue = jest.mocked(getEventbriteVenue);
const mockedGetTicket = jest.mocked(getEventbriteTicket);
const mockedGetAttendees = jest.mocked(getEventbriteAttendees);
const mockedCreateWebhook = jest.mocked(createEventbriteWebhook);

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
  params: Record<string, string> = {},
  query: Record<string, unknown> = {}
): Request => ({ body, params, query }) as unknown as Request;

const fakeMeetupRow = (overrides = {}): any => ({
  id: '10',
  name: 'Tex Mechs',
  date: '2026-07-01T18:00:00.000Z',
  utc_offset: -5,
  duration_hours: 3,
  city: 'Austin',
  state: 'TX',
  country: 'US',
  address: '123 Main St',
  description: 'A meetup',
  capacity: 100,
  image_key: 'http://img',
  organizers: [{ id: '1', nick_name: 'jane' }],
  lead_organizer: { id: '1', nick_name: 'jane' },
  eventbriteRecord: null,
  ...overrides,
});

const geocodeResult = {
  fullAddress: '123 Main St, Austin, TX',
  city: 'Austin',
  state: 'TX',
  country: 'US',
  latitude: 30.26,
  longitude: -97.74,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedMeetup.create.mockImplementation((attrs: any) => ({
    organizers: [],
    ...attrs,
    save: jest.fn().mockResolvedValue(undefined),
  }));
  mockedEventbriteRecord.create.mockImplementation((attrs: any) => ({
    ...attrs,
    save: jest.fn().mockResolvedValue(undefined),
  }));
});

// ---- getAllMeetups ---------------------------------------------------------

describe('getAllMeetups', () => {
  it('returns the simple shape by default (no ticket counts)', async () => {
    mockedMeetup.find.mockResolvedValue([fakeMeetupRow()]);
    const res = mockResponse();

    await getAllMeetups(mockRequest(), res);

    const body = res.body as any[];
    expect(body).toHaveLength(1);
    expect(body[0].location.city).toBe('Austin');
    expect(body[0].tickets).toBeUndefined();
    expect(mockedTicket.count).not.toHaveBeenCalled();
  });

  it('includes ticket availability when detailed', async () => {
    mockedMeetup.find.mockResolvedValue([fakeMeetupRow({ capacity: 100 })]);
    mockedTicket.count.mockResolvedValue(30);
    const res = mockResponse();

    await getAllMeetups(mockRequest({}, {}, { detail_level: 'detailed' }), res);

    const body = res.body as any[];
    expect(body[0].tickets).toEqual({ total: 100, available: 70 });
    expect(body[0].organizers).toEqual([{ id: '1', display_name: 'jane' }]);
    expect(body[0].lead_organizer).toEqual({ id: '1', display_name: 'jane' });
  });
});

// ---- getMeetup -------------------------------------------------------------

describe('getMeetup', () => {
  it('returns 404 when the meetup does not exist', async () => {
    mockedMeetup.findOne.mockResolvedValue(null);
    const res = mockResponse();

    await getMeetup(mockRequest({}, { meetup_id: '99' }), res);

    expect(res.statusCode).toBe(404);
  });

  it('defaults to the detailed shape', async () => {
    mockedMeetup.findOne.mockResolvedValue(fakeMeetupRow());
    mockedTicket.count.mockResolvedValue(10);
    const res = mockResponse();

    await getMeetup(mockRequest({}, { meetup_id: '10' }), res);

    const body = res.body as any;
    expect(body.tickets).toEqual({ total: 100, available: 90 });
    expect(body.location.full_address).toBe('123 Main St');
  });

  it('honors detail_level=simple', async () => {
    mockedMeetup.findOne.mockResolvedValue(fakeMeetupRow());
    const res = mockResponse();

    await getMeetup(
      mockRequest({}, { meetup_id: '10' }, { detail_level: 'simple' }),
      res
    );

    expect((res.body as any).tickets).toBeUndefined();
  });
});

// ---- createMeetup ----------------------------------------------------------

const validCreateBody = (overrides = {}) => ({
  name: 'Brand New Meetup',
  date: '2026-08-01T18:00:00.000Z',
  address: '500 Congress Ave',
  duration_hours: 4,
  capacity: 50,
  image_key: 'http://img',
  ...overrides,
});

describe('createMeetup', () => {
  it('returns 400 for an invalid body', async () => {
    const res = mockResponse();
    res.locals.requestor = { id: '1' };

    await createMeetup(mockRequest({ name: 'x' }), res);

    expect(res.statusCode).toBe(400);
  });

  it('returns 409 when the name is taken', async () => {
    mockedMeetup.findOne.mockResolvedValue(fakeMeetupRow());
    const res = mockResponse();
    res.locals.requestor = { id: '1' };

    await createMeetup(mockRequest(validCreateBody()), res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ message: 'Meetup name is taken.' });
  });

  it('returns 400 when geocoding fails', async () => {
    mockedMeetup.findOne.mockResolvedValue(null);
    mockedGeocode.mockRejectedValue(new Error('bad address'));
    const res = mockResponse();
    res.locals.requestor = { id: '1' };

    await createMeetup(mockRequest(validCreateBody()), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ message: 'bad address' });
  });

  it('creates the meetup with the requestor as organizer', async () => {
    mockedMeetup.findOne.mockResolvedValue(null);
    mockedGeocode.mockResolvedValue(geocodeResult);
    mockedGetUtcOffset.mockResolvedValue(-5);
    const res = mockResponse();
    res.locals.requestor = { id: '1', nick_name: 'jane' };

    await createMeetup(mockRequest(validCreateBody()), res);

    expect(res.statusCode).toBe(201);
    const created = res.body as any;
    // The requestor is the lead, tracked separately — not in the co-organizers.
    expect(created.lead_organizer).toEqual({ id: '1', nick_name: 'jane' });
    expect(created.organizers).toEqual([]);
    expect(created.city).toBe('Austin');
    expect(created.save).toHaveBeenCalled();
  });

  it('sets the selected additional organizers as co-organizers (lead separate)', async () => {
    mockedMeetup.findOne.mockResolvedValue(null);
    mockedGeocode.mockResolvedValue(geocodeResult);
    mockedGetUtcOffset.mockResolvedValue(-5);
    mockedUser.findBy.mockResolvedValue([
      { id: '2', nick_name: 'john' },
      { id: '3', nick_name: 'jill' },
    ] as never);
    const res = mockResponse();
    res.locals.requestor = { id: '1', nick_name: 'jane' };

    await createMeetup(
      mockRequest(validCreateBody({ organizer_ids: ['2', '3'] })),
      res
    );

    expect(mockedUser.findBy).toHaveBeenCalledWith({ id: In(['2', '3']) });
    const created = res.body as any;
    expect(created.lead_organizer).toEqual({ id: '1', nick_name: 'jane' });
    expect(created.organizers).toEqual([
      { id: '2', nick_name: 'john' },
      { id: '3', nick_name: 'jill' },
    ]);
    expect(res.statusCode).toBe(201);
  });

  it('keeps the lead out of the co-organizers when included in organizer_ids', async () => {
    mockedMeetup.findOne.mockResolvedValue(null);
    mockedGeocode.mockResolvedValue(geocodeResult);
    mockedGetUtcOffset.mockResolvedValue(-5);
    // Mirrors the DB returning the requestor row for their own id.
    mockedUser.findBy.mockResolvedValue([
      { id: '1', nick_name: 'jane' },
      { id: '2', nick_name: 'john' },
    ] as never);
    const res = mockResponse();
    res.locals.requestor = { id: '1', nick_name: 'jane' };

    await createMeetup(
      mockRequest(validCreateBody({ organizer_ids: ['1', '2'] })),
      res
    );

    const created = res.body as any;
    expect(created.lead_organizer).toEqual({ id: '1', nick_name: 'jane' });
    expect(created.organizers).toEqual([{ id: '2', nick_name: 'john' }]);
  });

  it('does not query for organizers when none are selected', async () => {
    mockedMeetup.findOne.mockResolvedValue(null);
    mockedGeocode.mockResolvedValue(geocodeResult);
    mockedGetUtcOffset.mockResolvedValue(-5);
    const res = mockResponse();
    res.locals.requestor = { id: '1', nick_name: 'jane' };

    await createMeetup(mockRequest(validCreateBody()), res);

    expect(mockedUser.findBy).not.toHaveBeenCalled();
    expect((res.body as any).organizers).toEqual([]);
    expect((res.body as any).lead_organizer).toEqual({
      id: '1',
      nick_name: 'jane',
    });
  });

  it('promotes the uploaded image out of the temp prefix', async () => {
    mockedMeetup.findOne.mockResolvedValue(null);
    mockedGeocode.mockResolvedValue(geocodeResult);
    mockedGetUtcOffset.mockResolvedValue(-5);
    mockedPromoteImage.mockResolvedValueOnce('meetups/abc.png');
    const res = mockResponse();
    res.locals.requestor = { id: '1', nick_name: 'jane' };

    await createMeetup(
      mockRequest(validCreateBody({ image_key: 'tmp/meetups/abc.png' })),
      res
    );

    expect(mockedPromoteImage).toHaveBeenCalledWith('tmp/meetups/abc.png');
    expect((res.body as any).image_key).toBe('meetups/abc.png');
    expect((res.body as any).save).toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
  });

  it('returns 500 if promoting the uploaded image fails', async () => {
    mockedMeetup.findOne.mockResolvedValue(null);
    mockedGeocode.mockResolvedValue(geocodeResult);
    mockedGetUtcOffset.mockResolvedValue(-5);
    mockedPromoteImage.mockRejectedValueOnce(new Error('R2 down'));
    const res = mockResponse();
    res.locals.requestor = { id: '1', nick_name: 'jane' };

    await createMeetup(
      mockRequest(validCreateBody({ image_key: 'tmp/meetups/abc.png' })),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

// ---- updateMeetup ----------------------------------------------------------

describe('updateMeetup', () => {
  it('returns 400 for an invalid body', async () => {
    const res = mockResponse();

    await updateMeetup(
      mockRequest({ capacity: -1 }, { meetup_id: '10' }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when the meetup does not exist', async () => {
    mockedMeetup.findOne.mockResolvedValueOnce(null); // target lookup
    const res = mockResponse();

    await updateMeetup(
      mockRequest({ duration_hours: 5 }, { meetup_id: '99' }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('updates simple fields and emits an update', async () => {
    const meetup = fakeMeetupRow({ save: jest.fn().mockResolvedValue(undefined) });
    mockedMeetup.findOne
      .mockResolvedValueOnce(meetup) // target lookup
      .mockResolvedValueOnce(null); // name-collision lookup
    const res = mockResponse();

    await updateMeetup(
      mockRequest({ duration_hours: 6, capacity: 200 }, { meetup_id: '10' }),
      res
    );

    expect(meetup.duration_hours).toBe(6);
    expect(meetup.capacity).toBe(200);
    expect(meetup.save).toHaveBeenCalled();
    expect(mockedSocket.emit).toHaveBeenCalledWith('meetup:update', {
      meetupId: '10',
    });
    expect(mockedRefresh).toHaveBeenCalledWith('10');
    expect(res.statusCode).toBe(201);
  });

  it('sets the co-organizer join table to match organizer_ids', async () => {
    const meetup = fakeMeetupRow({
      save: jest.fn().mockResolvedValue(undefined),
    });
    mockedMeetup.findOne
      .mockResolvedValueOnce(meetup) // target lookup (lead_organizer loaded)
      .mockResolvedValueOnce(null) // name-collision lookup
      .mockResolvedValueOnce({
        organizers: [{ id: '2' }, { id: '5' }],
      } as never); // organizers lookup
    const res = mockResponse();
    res.locals.requestor = { id: '1' }; // the lead

    await updateMeetup(
      mockRequest({ organizer_ids: ['2', '3'] }, { meetup_id: '10' }),
      res
    );

    // Add 3, remove 5; 2 is unchanged.
    expect(organizerRelation.addAndRemove).toHaveBeenCalledWith(['3'], ['5']);
    expect(res.statusCode).toBe(201);
  });

  it('never adds the lead to the co-organizer list', async () => {
    // fakeMeetupRow's lead is user 1; a client that includes it is ignored.
    const meetup = fakeMeetupRow({
      save: jest.fn().mockResolvedValue(undefined),
    });
    mockedMeetup.findOne
      .mockResolvedValueOnce(meetup)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ organizers: [{ id: '2' }] } as never);
    const res = mockResponse();
    res.locals.requestor = { id: '1' }; // the lead

    await updateMeetup(
      mockRequest({ organizer_ids: ['1', '2', '3'] }, { meetup_id: '10' }),
      res
    );

    // Lead (1) is filtered out; only co-organizer 3 is added.
    expect(organizerRelation.addAndRemove).toHaveBeenCalledWith(['3'], []);
  });

  it('removes all co-organizers when organizer_ids is empty', async () => {
    const meetup = fakeMeetupRow({
      save: jest.fn().mockResolvedValue(undefined),
    });
    mockedMeetup.findOne
      .mockResolvedValueOnce(meetup)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        organizers: [{ id: '2' }, { id: '3' }],
      } as never);
    const res = mockResponse();
    res.locals.requestor = { id: '1' }; // the lead

    await updateMeetup(
      mockRequest({ organizer_ids: [] }, { meetup_id: '10' }),
      res
    );

    // The lead lives in its own column and is untouched here.
    expect(organizerRelation.addAndRemove).toHaveBeenCalledWith([], ['2', '3']);
  });

  it('leaves organizers untouched when organizer_ids is not provided', async () => {
    const meetup = fakeMeetupRow({
      save: jest.fn().mockResolvedValue(undefined),
    });
    mockedMeetup.findOne
      .mockResolvedValueOnce(meetup)
      .mockResolvedValueOnce(null);
    const res = mockResponse();
    res.locals.requestor = { id: '1' };

    await updateMeetup(
      mockRequest({ duration_hours: 5 }, { meetup_id: '10' }),
      res
    );

    expect(organizerRelation.addAndRemove).not.toHaveBeenCalled();
  });

  it('does not touch the join table when the organizer set is unchanged', async () => {
    const meetup = fakeMeetupRow({
      save: jest.fn().mockResolvedValue(undefined),
    });
    mockedMeetup.findOne
      .mockResolvedValueOnce(meetup)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ organizers: [{ id: '2' }] } as never);
    const res = mockResponse();
    res.locals.requestor = { id: '1' }; // the lead

    await updateMeetup(
      mockRequest({ organizer_ids: ['2'] }, { meetup_id: '10' }),
      res
    );

    // Desired set [2] matches the current co-organizers, so nothing is written.
    expect(organizerRelation.addAndRemove).not.toHaveBeenCalled();
  });

  it('rejects a non-lead organizer changing organizer_ids', async () => {
    // fakeMeetupRow's lead is user 1; user 2 is a co-organizer, not the lead.
    const meetup = fakeMeetupRow({
      save: jest.fn().mockResolvedValue(undefined),
    });
    mockedMeetup.findOne.mockResolvedValueOnce(meetup); // target lookup
    const res = mockResponse();
    res.locals.requestor = { id: '2' }; // a co-organizer, not the lead

    await updateMeetup(
      mockRequest({ organizer_ids: ['2', '3'] }, { meetup_id: '10' }),
      res
    );

    // Forbidden, and nothing is mutated: no save, no join-table write.
    expect(res.statusCode).toBe(403);
    expect(meetup.save).not.toHaveBeenCalled();
    expect(organizerRelation.addAndRemove).not.toHaveBeenCalled();
  });

  it('lets a non-lead organizer edit other fields', async () => {
    const meetup = fakeMeetupRow({
      save: jest.fn().mockResolvedValue(undefined),
    });
    mockedMeetup.findOne
      .mockResolvedValueOnce(meetup) // target lookup
      .mockResolvedValueOnce(null); // name-collision lookup
    const res = mockResponse();
    res.locals.requestor = { id: '2' }; // a co-organizer, not the lead

    await updateMeetup(
      mockRequest({ duration_hours: 4 }, { meetup_id: '10' }),
      res
    );

    // No organizer_ids in the payload, so the non-lead check doesn't fire.
    expect(meetup.duration_hours).toBe(4);
    expect(res.statusCode).toBe(201);
  });

  // BUG: the "name taken" guard matches the meetup being edited against itself,
  // so re-saving a meetup while sending its current name always 409s. The guard
  // should ignore the meetup whose id is being updated. Most edit forms submit
  // the unchanged name, so this blocks routine edits. Remove `.failing` once the
  // lookup excludes the current meetup id.
  it.failing('allows saving a meetup with its own unchanged name', async () => {
    const meetup = fakeMeetupRow({
      id: '10',
      name: 'Tex Mechs',
      save: jest.fn().mockResolvedValue(undefined),
    });
    mockedMeetup.findOne
      .mockResolvedValueOnce(meetup) // target lookup (id 10)
      .mockResolvedValueOnce(meetup); // name lookup returns the SAME meetup
    const res = mockResponse();

    await updateMeetup(
      mockRequest({ name: 'Tex Mechs', duration_hours: 6 }, { meetup_id: '10' }),
      res
    );

    expect(res.statusCode).toBe(201);
  });

  it('deletes the previous image when replaced with a new upload', async () => {
    const meetup = fakeMeetupRow({
      image_key: 'meetups/old.png',
      save: jest.fn().mockResolvedValue(undefined),
    });
    mockedMeetup.findOne
      .mockResolvedValueOnce(meetup) // target lookup
      .mockResolvedValueOnce(null); // name-collision lookup
    const res = mockResponse();

    await updateMeetup(
      mockRequest({ image_key: 'meetups/new.png' }, { meetup_id: '10' }),
      res
    );

    expect(meetup.image_key).toBe('meetups/new.png');
    expect(mockedDeleteObject).toHaveBeenCalledWith('meetups/old.png');
    expect(res.statusCode).toBe(201);
  });

  it('promotes a newly uploaded temp image and deletes the previous one', async () => {
    const meetup = fakeMeetupRow({
      image_key: 'meetups/old.png',
      save: jest.fn().mockResolvedValue(undefined),
    });
    mockedMeetup.findOne
      .mockResolvedValueOnce(meetup)
      .mockResolvedValueOnce(null);
    mockedPromoteImage.mockResolvedValueOnce('meetups/new.png');
    const res = mockResponse();

    await updateMeetup(
      mockRequest({ image_key: 'tmp/meetups/new.png' }, { meetup_id: '10' }),
      res
    );

    expect(mockedPromoteImage).toHaveBeenCalledWith('tmp/meetups/new.png');
    expect(meetup.image_key).toBe('meetups/new.png');
    expect(mockedDeleteObject).toHaveBeenCalledWith('meetups/old.png');
    expect(res.statusCode).toBe(201);
  });

  it('does not delete an external (legacy/Eventbrite) image on replace', async () => {
    const meetup = fakeMeetupRow({
      image_key: 'https://external.example/photo.png',
      save: jest.fn().mockResolvedValue(undefined),
    });
    mockedMeetup.findOne
      .mockResolvedValueOnce(meetup)
      .mockResolvedValueOnce(null);
    const res = mockResponse();

    await updateMeetup(
      mockRequest({ image_key: 'meetups/new.png' }, { meetup_id: '10' }),
      res
    );

    expect(mockedDeleteObject).not.toHaveBeenCalled();
  });

  it('does not delete anything when the image is unchanged', async () => {
    const meetup = fakeMeetupRow({
      image_key: 'meetups/keep.png',
      save: jest.fn().mockResolvedValue(undefined),
    });
    mockedMeetup.findOne
      .mockResolvedValueOnce(meetup)
      .mockResolvedValueOnce(null);
    const res = mockResponse();

    await updateMeetup(
      mockRequest({ duration_hours: 6 }, { meetup_id: '10' }),
      res
    );

    expect(mockedDeleteObject).not.toHaveBeenCalled();
  });

  it('clears and deletes the image when image_key is emptied', async () => {
    const meetup = fakeMeetupRow({
      image_key: 'meetups/old.png',
      save: jest.fn().mockResolvedValue(undefined),
    });
    mockedMeetup.findOne
      .mockResolvedValueOnce(meetup)
      .mockResolvedValueOnce(null);
    const res = mockResponse();

    await updateMeetup(mockRequest({ image_key: '' }, { meetup_id: '10' }), res);

    expect(meetup.image_key).toBe('');
    expect(mockedDeleteObject).toHaveBeenCalledWith('meetups/old.png');
    expect(res.statusCode).toBe(201);
  });

  it('still succeeds if deleting the replaced image fails', async () => {
    const meetup = fakeMeetupRow({
      image_key: 'meetups/old.png',
      save: jest.fn().mockResolvedValue(undefined),
    });
    mockedMeetup.findOne
      .mockResolvedValueOnce(meetup)
      .mockResolvedValueOnce(null);
    mockedDeleteObject.mockRejectedValueOnce(new Error('R2 down'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = mockResponse();

    await updateMeetup(
      mockRequest({ image_key: 'meetups/new.png' }, { meetup_id: '10' }),
      res
    );

    expect(res.statusCode).toBe(201);
    errorSpy.mockRestore();
  });

  it('promotes display images and deletes ones no longer referenced', async () => {
    const displayRecord = {
      idle_image_urls: ['meetups/old1.png', 'meetups/keep.png'],
      raffle_background_url: 'meetups/oldbg.png',
      batch_raffle_background_url: null,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const meetup = fakeMeetupRow({
      displayRecord,
      save: jest.fn().mockResolvedValue(undefined),
    });
    mockedMeetup.findOne
      .mockResolvedValueOnce(meetup)
      .mockResolvedValueOnce(null);
    const res = mockResponse();

    await updateMeetup(
      mockRequest(
        {
          display_idle_image_urls: [
            'meetups/keep.png',
            'tmp/meetups/new.png',
            '',
          ],
          display_raffle_background_url: 'meetups/newbg.png',
        },
        { meetup_id: '10' }
      ),
      res
    );

    // Empty entries dropped; each remaining entry promoted.
    expect(displayRecord.idle_image_urls).toEqual([
      'meetups/keep.png',
      'tmp/meetups/new.png',
    ]);
    expect(mockedPromoteImage).toHaveBeenCalledWith('tmp/meetups/new.png');
    expect(displayRecord.save).toHaveBeenCalled();
    // Removed idle image and replaced raffle background are cleaned up.
    expect(mockedDeleteObject).toHaveBeenCalledWith('meetups/old1.png');
    expect(mockedDeleteObject).toHaveBeenCalledWith('meetups/oldbg.png');
    // Retained image is not deleted.
    expect(mockedDeleteObject).not.toHaveBeenCalledWith('meetups/keep.png');
    expect(res.statusCode).toBe(201);
  });

  it('creates a display record when the meetup has none', async () => {
    const created = {
      idle_image_urls: [] as string[],
      raffle_background_url: null,
      batch_raffle_background_url: null,
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockedDisplayRecord.create.mockReturnValueOnce(created as any);
    const meetup = fakeMeetupRow({
      displayRecord: null,
      save: jest.fn().mockResolvedValue(undefined),
    });
    mockedMeetup.findOne
      .mockResolvedValueOnce(meetup)
      .mockResolvedValueOnce(null);
    const res = mockResponse();

    await updateMeetup(
      mockRequest(
        { display_idle_image_urls: ['tmp/meetups/a.png'] },
        { meetup_id: '10' }
      ),
      res
    );

    expect(mockedDisplayRecord.create).toHaveBeenCalled();
    expect(created.idle_image_urls).toEqual(['tmp/meetups/a.png']);
    expect(created.save).toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
  });

  it('clears and deletes a display background when emptied', async () => {
    const displayRecord = {
      idle_image_urls: [],
      raffle_background_url: 'meetups/bg.png',
      batch_raffle_background_url: null,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const meetup = fakeMeetupRow({
      displayRecord,
      save: jest.fn().mockResolvedValue(undefined),
    });
    mockedMeetup.findOne
      .mockResolvedValueOnce(meetup)
      .mockResolvedValueOnce(null);
    const res = mockResponse();

    await updateMeetup(
      mockRequest({ display_raffle_background_url: '' }, { meetup_id: '10' }),
      res
    );

    expect(displayRecord.raffle_background_url).toBeNull();
    expect(mockedDeleteObject).toHaveBeenCalledWith('meetups/bg.png');
    expect(res.statusCode).toBe(201);
  });
});

// ---- deleteMeetup ----------------------------------------------------------

describe('deleteMeetup', () => {
  it('returns 404 when the meetup does not exist', async () => {
    mockedMeetup.findOneBy.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.requestor = { id: '1' };

    await deleteMeetup(mockRequest({}, { meetup_id: '99' }), res);

    expect(res.statusCode).toBe(404);
  });

  it('deletes the meetup image and display image objects it owns', async () => {
    const meetup = {
      id: '10',
      image_key: 'meetups/main.png',
      tickets: [],
      raffleRecords: [],
      discordMessage: null,
      eventbriteRecord: null,
      displayRecord: {
        idle_image_urls: ['meetups/idle1.png', 'https://external/x.png'],
        raffle_background_url: 'meetups/bg.png',
        batch_raffle_background_url: null,
      },
      lead_organizer: { id: '1' },
      remove: jest.fn().mockResolvedValue(undefined),
    };
    mockedMeetup.findOne.mockResolvedValueOnce(meetup as any);
    const res = mockResponse();
    res.locals.requestor = { id: '1' };

    await deleteMeetup(mockRequest({}, { meetup_id: '10' }), res);

    expect(mockedDeleteObject).toHaveBeenCalledWith('meetups/main.png');
    expect(mockedDeleteObject).toHaveBeenCalledWith('meetups/idle1.png');
    expect(mockedDeleteObject).toHaveBeenCalledWith('meetups/bg.png');
    // External URLs are not ours to delete.
    expect(mockedDeleteObject).not.toHaveBeenCalledWith('https://external/x.png');
    expect(res.statusCode).toBe(204);
  });

  it('lets the lead organizer delete the meetup', async () => {
    const meetup = {
      id: '10',
      image_key: 'meetups/main.png',
      tickets: [],
      raffleRecords: [],
      discordMessage: null,
      eventbriteRecord: null,
      displayRecord: null,
      lead_organizer: { id: '1' },
      remove: jest.fn().mockResolvedValue(undefined),
    };
    mockedMeetup.findOne.mockResolvedValueOnce(meetup as any);
    const res = mockResponse();
    res.locals.requestor = { id: '1' };

    await deleteMeetup(mockRequest({}, { meetup_id: '10' }), res);

    expect(res.statusCode).toBe(204);
  });

  it('rejects a non-lead organizer with 403', async () => {
    const meetup = {
      id: '10',
      tickets: [],
      raffleRecords: [],
      discordMessage: null,
      eventbriteRecord: null,
      displayRecord: null,
      lead_organizer: { id: '1' },
      remove: jest.fn().mockResolvedValue(undefined),
    };
    mockedMeetup.findOne.mockResolvedValueOnce(meetup as any);
    const res = mockResponse();
    res.locals.requestor = { id: '2' }; // a co-organizer, not the lead

    await deleteMeetup(mockRequest({}, { meetup_id: '10' }), res);

    expect(res.statusCode).toBe(403);
    // Nothing is destroyed for a forbidden request.
    expect(meetup.remove).not.toHaveBeenCalled();
  });
});

// ---- getMeetupAttendees ----------------------------------------------------

describe('getMeetupAttendees', () => {
  it('returns 404 when the meetup does not exist', async () => {
    mockedMeetup.findOne.mockResolvedValue(null);
    const res = mockResponse();

    await getMeetupAttendees(mockRequest({}, { meetup_id: '99' }), res);

    expect(res.statusCode).toBe(404);
  });

  it('maps tickets and includes checked_in_at only for checked-in tickets', async () => {
    const checkedInAt = new Date('2026-07-01T19:00:00.000Z');
    mockedMeetup.findOne.mockResolvedValue({
      id: '10',
      tickets: [
        {
          id: '1',
          created_at: new Date('2026-06-01'),
          is_checked_in: true,
          checked_in_at: checkedInAt,
          ticket_holder_display_name: 'eve',
          ticket_holder_first_name: 'eve',
          ticket_holder_last_name: 'stone',
        },
        {
          id: '2',
          created_at: new Date('2026-06-02'),
          is_checked_in: false,
          checked_in_at: null,
          ticket_holder_display_name: 'sam',
          ticket_holder_first_name: 'sam',
          ticket_holder_last_name: 'lee',
        },
      ],
    } as any);
    const res = mockResponse();

    await getMeetupAttendees(mockRequest({}, { meetup_id: '10' }), res);

    const body = res.body as any[];
    expect(body[0].checked_in_at).toBe(checkedInAt);
    expect(body[1]).not.toHaveProperty('checked_in_at');
  });
});

// ---- getMeetupDisplayAssets ------------------------------------------------

describe('getMeetupDisplayAssets', () => {
  it('returns 404 when the meetup does not exist', async () => {
    mockedMeetup.findOne.mockResolvedValue(null);
    const res = mockResponse();

    await getMeetupDisplayAssets(mockRequest({}, { meetup_id: '99' }), res);

    expect(res.statusCode).toBe(404);
  });

  it('returns nulls when there is no display record', async () => {
    mockedMeetup.findOne.mockResolvedValue({ id: '10', displayRecord: null } as any);
    const res = mockResponse();

    await getMeetupDisplayAssets(mockRequest({}, { meetup_id: '10' }), res);

    expect(res.body).toEqual({
      idleImageUrls: null,
      raffleWinnerBackgroundImageUrl: null,
      batchRaffleWinnerBackgroundImageUrl: null,
    });
  });

  it('resolves stored keys to public URLs and passes external URLs through', async () => {
    mockedMeetup.findOne.mockResolvedValue({
      id: '10',
      displayRecord: {
        idle_image_urls: ['meetups/a.png', 'https://external.com/b.png'],
        raffle_background_url: 'meetups/bg.png',
        batch_raffle_background_url: 'https://external.com/batch.png',
      },
    } as any);
    const res = mockResponse();

    await getMeetupDisplayAssets(mockRequest({}, { meetup_id: '10' }), res);

    expect(res.body).toEqual({
      idleImageUrls: [
        'https://cdn.test/meetups/a.png',
        'https://external.com/b.png',
      ],
      raffleWinnerBackgroundImageUrl: 'https://cdn.test/meetups/bg.png',
      batchRaffleWinnerBackgroundImageUrl: 'https://external.com/batch.png',
    });
  });
});

// ---- syncEventbriteAttendees -----------------------------------------------

describe('syncEventbriteAttendees', () => {
  it('returns 400 when the meetup has no Eventbrite record', async () => {
    const res = mockResponse();
    res.locals.meetup = { id: '10', eventbriteRecord: null };
    res.locals.requestor = { encrypted_eventbrite_token: 'enc' };

    await syncEventbriteAttendees(mockRequest(), res);

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when the requestor has no Eventbrite token', async () => {
    const res = mockResponse();
    res.locals.meetup = { id: '10', eventbriteRecord: { event_id: '1' } };
    res.locals.requestor = { encrypted_eventbrite_token: null };

    await syncEventbriteAttendees(mockRequest(), res);

    expect(res.statusCode).toBe(400);
  });

  it('returns 500 when fetching attendees fails', async () => {
    mockedGetAttendees.mockRejectedValue(new Error('eb down'));
    const res = mockResponse();
    res.locals.meetup = {
      id: '10',
      eventbriteRecord: {
        event_id: '1',
        ticket_class_id: '2',
        display_name_question_id: '3',
      },
    };
    res.locals.requestor = { encrypted_eventbrite_token: 'enc' };

    await syncEventbriteAttendees(mockRequest(), res);

    expect(res.statusCode).toBe(500);
  });

  it('emits an update and returns 200 on success', async () => {
    mockedGetAttendees.mockResolvedValue([]);
    const res = mockResponse();
    res.locals.meetup = {
      id: '10',
      eventbriteRecord: {
        event_id: '1',
        ticket_class_id: '2',
        display_name_question_id: '3',
      },
    };
    res.locals.requestor = { encrypted_eventbrite_token: 'enc' };

    await syncEventbriteAttendees(mockRequest(), res);

    expect(res.statusCode).toBe(200);
    expect(mockedSocket.emit).toHaveBeenCalledWith('meetup:update', {
      meetupId: '10',
    });
  });
});

// ---- createMeetupFromEventbrite --------------------------------------------

describe('createMeetupFromEventbrite', () => {
  const validBody = {
    eventbrite_event_id: '1',
    eventbrite_ticket_id: '2',
    eventbrite_question_id: '3',
  };

  it('returns 400 for an invalid body', async () => {
    const res = mockResponse();
    res.locals.requestor = { encrypted_eventbrite_token: 'enc' };

    await createMeetupFromEventbrite(mockRequest({}), res);

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 when the requestor has no Eventbrite token', async () => {
    const res = mockResponse();
    res.locals.requestor = { encrypted_eventbrite_token: null };

    await createMeetupFromEventbrite(mockRequest(validBody), res);

    expect(res.statusCode).toBe(401);
  });

  it('returns 500 when the event has no venue', async () => {
    mockedGetEvent.mockResolvedValue({ venueId: null } as any);
    const res = mockResponse();
    res.locals.requestor = { encrypted_eventbrite_token: 'enc' };

    await createMeetupFromEventbrite(mockRequest(validBody), res);

    expect(res.statusCode).toBe(500);
  });

  it('creates the meetup and Eventbrite record on success', async () => {
    mockedGetEvent.mockResolvedValue({
      id: '1',
      venueId: '7',
      startTime: '2026-09-01T18:00:00.000Z',
      endTime: '2026-09-01T21:00:00.000Z',
      organizationId: '99',
      name: 'EB Meetup',
      url: 'http://eb',
      imageUrl: 'http://img',
      description: 'desc',
    } as any);
    mockedGetVenue.mockResolvedValue({ address: '1 Venue Way' } as any);
    mockedGetTicket.mockResolvedValue({ total: 80 } as any);
    mockedGeocode.mockResolvedValue(geocodeResult);
    mockedGetUtcOffset.mockResolvedValue(-5);
    mockedCreateWebhook.mockResolvedValue({ id: '555' } as any);
    const res = mockResponse();
    res.locals.requestor = { id: '1', encrypted_eventbrite_token: 'enc' };

    await createMeetupFromEventbrite(mockRequest(validBody), res);

    expect(mockedMeetup.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'EB Meetup', capacity: 80 })
    );
    expect(mockedEventbriteRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: '1',
        ticket_class_id: '2',
        display_name_question_id: '3',
      })
    );
    expect(res.statusCode).toBe(201);
  });
});
