/// <reference types="jest" />
import { type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';

// ---- Mocks -----------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret';

jest.mock('../config', () => ({
  __esModule: true,
  default: { jwtSecret: 'test-secret' },
}));

jest.mock('../entity/User', () => ({
  User: { findOneBy: jest.fn() },
}));

jest.mock('../entity/Meetup', () => ({
  Meetup: { findOne: jest.fn() },
}));

jest.mock('../entity/Ticket', () => ({
  Ticket: { findOne: jest.fn() },
}));

jest.mock('../entity/RaffleRecord', () => ({
  RaffleRecord: { findOne: jest.fn() },
}));

import { authChecker, Rule } from './authChecker';
import { User } from '../entity/User';
import { Meetup } from '../entity/Meetup';
import { Ticket } from '../entity/Ticket';
import { RaffleRecord } from '../entity/RaffleRecord';

const mockedUser = jest.mocked(User);
const mockedMeetup = jest.mocked(Meetup);
const mockedTicket = jest.mocked(Ticket);
const mockedRaffleRecord = jest.mocked(RaffleRecord);

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
  res.send = jest.fn().mockImplementation((body: unknown) => {
    res.body = body;
    return res;
  });
  res.locals = {};
  return res as MockResponse;
};

/** Request with a Bearer token header and optional route params. */
const mockRequest = (
  token: string | null,
  params: Record<string, string> = {}
): Request =>
  ({
    params,
    header: (name: string) =>
      name === 'Authorization' && token != null ? `Bearer ${token}` : undefined,
  }) as unknown as Request;

const signToken = (
  overrides: Partial<{
    id: number;
    nick_name: string;
    is_organizer: boolean;
    is_admin: boolean;
  }> = {}
): string =>
  jwt.sign(
    { id: 1, nick_name: 'jane', is_organizer: false, is_admin: false, ...overrides },
    TEST_JWT_SECRET
  );

const fakeUser = (overrides: Record<string, unknown> = {}): any => ({
  id: 1,
  nick_name: 'jane',
  is_admin: false,
  is_organizer: false,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ---- Token + user resolution -----------------------------------------------

describe('authChecker: token and user resolution', () => {
  it('returns 401 when no auth token is present', async () => {
    const res = mockResponse();
    const next = jest.fn();

    await authChecker()(mockRequest(null), res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      message: 'No auth token found. Authorization denied.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 when the token cannot be verified', async () => {
    const res = mockResponse();
    const next = jest.fn();

    await authChecker()(mockRequest('garbage-token'), res, next);

    expect(res.statusCode).toBe(500);
    expect(next).not.toHaveBeenCalled();
    expect(mockedUser.findOneBy).not.toHaveBeenCalled();
  });

  it('returns 404 when the decoded user no longer exists', async () => {
    mockedUser.findOneBy.mockResolvedValue(null);
    const res = mockResponse();
    const next = jest.fn();

    await authChecker()(mockRequest(signToken()), res, next);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ message: 'Invalid user ID.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('passes the requestor through and calls next() with no rules', async () => {
    const user = fakeUser();
    mockedUser.findOneBy.mockResolvedValue(user);
    const res = mockResponse();
    const next = jest.fn();

    await authChecker()(mockRequest(signToken()), res, next);

    expect(res.locals.requestor).toBe(user);
    expect(next).toHaveBeenCalled();
  });
});

// ---- Account-type rules ----------------------------------------------------

describe('authChecker: account-type rules', () => {
  it('rejects a non-admin when requireAdmin is set', async () => {
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ is_admin: false }));
    const res = mockResponse();
    const next = jest.fn();

    await authChecker([Rule.requireAdmin])(mockRequest(signToken()), res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ message: 'Invalid authorization.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows an admin when requireAdmin is set', async () => {
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ is_admin: true }));
    const res = mockResponse();
    const next = jest.fn();

    await authChecker([Rule.requireAdmin])(
      mockRequest(signToken({ is_admin: true })),
      res,
      next
    );

    expect(next).toHaveBeenCalled();
  });

  it('rejects a non-organizer when requireOrganizer is set', async () => {
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ is_organizer: false }));
    const res = mockResponse();
    const next = jest.fn();

    await authChecker([Rule.requireOrganizer])(
      mockRequest(signToken()),
      res,
      next
    );

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('short-circuits via overrideAdmin for an admin without checking params', async () => {
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ id: 1, is_admin: true }));
    const res = mockResponse();
    const next = jest.fn();

    // user_id mismatches, but overrideAdmin should let the admin through first.
    await authChecker([Rule.overrideAdmin])(
      mockRequest(signToken({ is_admin: true }), { user_id: '999' }),
      res,
      next
    );

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeUndefined();
  });

  it('short-circuits via overrideOrganizer for an organizer', async () => {
    mockedUser.findOneBy.mockResolvedValue(
      fakeUser({ id: 1, is_organizer: true })
    );
    const res = mockResponse();
    const next = jest.fn();

    await authChecker([Rule.overrideOrganizer])(
      mockRequest(signToken({ is_organizer: true }), { user_id: '999' }),
      res,
      next
    );

    expect(next).toHaveBeenCalled();
  });
});

// ---- Resource ownership: user_id -------------------------------------------

describe('authChecker: user_id ownership', () => {
  it('allows the requestor to access their own user_id', async () => {
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ id: 1 }));
    const res = mockResponse();
    const next = jest.fn();

    await authChecker()(mockRequest(signToken({ id: 1 }), { user_id: '1' }), res, next);

    expect(res.locals.user).toBeDefined();
    expect(next).toHaveBeenCalled();
  });

  it('rejects accessing a different user_id', async () => {
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ id: 1 }));
    const res = mockResponse();
    const next = jest.fn();

    await authChecker()(
      mockRequest(signToken({ id: 1 }), { user_id: '2' }),
      res,
      next
    );

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// ---- Resource ownership: ticket_id -----------------------------------------

describe('authChecker: ticket_id ownership', () => {
  it('returns 404 when the ticket does not exist', async () => {
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ id: 1 }));
    mockedTicket.findOne.mockResolvedValue(null);
    const res = mockResponse();
    const next = jest.fn();

    await authChecker()(
      mockRequest(signToken({ id: 1 }), { ticket_id: '5' }),
      res,
      next
    );

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ message: 'Invalid ticket ID.' });
  });

  it('allows the ticket owner', async () => {
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ id: 1 }));
    mockedTicket.findOne.mockResolvedValue({
      id: 5,
      user: { id: 1 },
      meetup: { id: 10 },
    } as any);
    const res = mockResponse();
    const next = jest.fn();

    await authChecker()(
      mockRequest(signToken({ id: 1 }), { ticket_id: '5' }),
      res,
      next
    );

    expect(res.locals.ticket).toBeDefined();
    expect(next).toHaveBeenCalled();
  });

  it('rejects a non-owner of the ticket', async () => {
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ id: 1 }));
    mockedTicket.findOne.mockResolvedValue({
      id: 5,
      user: { id: 2 },
      meetup: { id: 10 },
    } as any);
    const res = mockResponse();
    const next = jest.fn();

    await authChecker()(
      mockRequest(signToken({ id: 1 }), { ticket_id: '5' }),
      res,
      next
    );

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects when the ticket has no owning user (e.g. a Discord RSVP)', async () => {
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ id: 1 }));
    mockedTicket.findOne.mockResolvedValue({
      id: 5,
      user: null,
      meetup: { id: 10 },
    } as any);
    const res = mockResponse();
    const next = jest.fn();

    await authChecker()(
      mockRequest(signToken({ id: 1 }), { ticket_id: '5' }),
      res,
      next
    );

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows a meetup organizer via overrideMeetupOrganizer even if not the owner', async () => {
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ id: 1 }));
    mockedTicket.findOne.mockResolvedValue({
      id: 5,
      user: { id: 2 },
      meetup: { id: 10 },
    } as any);
    // checkMeetupOrganizer() resolves the meetup and finds the requestor.
    mockedMeetup.findOne.mockResolvedValue({
      id: 10,
      organizers: [{ id: 1 }],
    } as any);
    const res = mockResponse();
    const next = jest.fn();

    await authChecker([Rule.overrideMeetupOrganizer])(
      mockRequest(signToken({ id: 1 }), { ticket_id: '5' }),
      res,
      next
    );

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeUndefined();
  });
});

// ---- Resource ownership: raffle_id -----------------------------------------

describe('authChecker: raffle_id ownership', () => {
  it('returns 404 when the raffle record does not exist', async () => {
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ id: 1 }));
    mockedRaffleRecord.findOne.mockResolvedValue(null);
    const res = mockResponse();
    const next = jest.fn();

    await authChecker()(
      mockRequest(signToken({ id: 1 }), { raffle_id: '3' }),
      res,
      next
    );

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ message: 'Invalid raffle ID.' });
  });

  it("rejects when the requestor is not an organizer of the raffle's meetup", async () => {
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ id: 1 }));
    mockedRaffleRecord.findOne.mockResolvedValue({
      id: 3,
      meetup: { id: 10 },
    } as any);
    mockedMeetup.findOne.mockResolvedValue({ id: 10, organizers: [] } as any);
    const res = mockResponse();
    const next = jest.fn();

    await authChecker()(
      mockRequest(signToken({ id: 1 }), { raffle_id: '3' }),
      res,
      next
    );

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows an organizer of the raffle meetup', async () => {
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ id: 1 }));
    mockedRaffleRecord.findOne.mockResolvedValue({
      id: 3,
      meetup: { id: 10 },
    } as any);
    mockedMeetup.findOne.mockResolvedValue({
      id: 10,
      organizers: [{ id: 1 }],
    } as any);
    const res = mockResponse();
    const next = jest.fn();

    await authChecker()(
      mockRequest(signToken({ id: 1 }), { raffle_id: '3' }),
      res,
      next
    );

    expect(res.locals.raffleRecord).toBeDefined();
    expect(next).toHaveBeenCalled();
  });
});

// ---- Resource ownership: meetup_id -----------------------------------------

describe('authChecker: meetup_id ownership', () => {
  it('returns 404 when the meetup does not exist', async () => {
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ id: 1 }));
    mockedMeetup.findOne.mockResolvedValue(null);
    const res = mockResponse();
    const next = jest.fn();

    await authChecker()(
      mockRequest(signToken({ id: 1 }), { meetup_id: '10' }),
      res,
      next
    );

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ message: 'Invalid meetup ID.' });
  });

  it('rejects a non-organizer of the meetup', async () => {
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ id: 1 }));
    mockedMeetup.findOne.mockResolvedValue({ id: 10, organizers: [] } as any);
    const res = mockResponse();
    const next = jest.fn();

    await authChecker()(
      mockRequest(signToken({ id: 1 }), { meetup_id: '10' }),
      res,
      next
    );

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows an organizer of the meetup', async () => {
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ id: 1 }));
    mockedMeetup.findOne.mockResolvedValue({
      id: 10,
      organizers: [{ id: 1 }],
    } as any);
    const res = mockResponse();
    const next = jest.fn();

    await authChecker()(
      mockRequest(signToken({ id: 1 }), { meetup_id: '10' }),
      res,
      next
    );

    expect(res.locals.meetup).toBeDefined();
    expect(next).toHaveBeenCalled();
  });

  it('allows the lead organizer even when not in the organizers list', async () => {
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ id: 1 }));
    // Lead lives in its own column; co-organizers list doesn't include them.
    mockedMeetup.findOne.mockResolvedValue({
      id: 10,
      lead_organizer: { id: 1 },
      organizers: [{ id: 2 }],
    } as any);
    const res = mockResponse();
    const next = jest.fn();

    await authChecker()(
      mockRequest(signToken({ id: 1 }), { meetup_id: '10' }),
      res,
      next
    );

    expect(res.locals.meetup).toBeDefined();
    expect(next).toHaveBeenCalled();
  });

  it('skips the organizer check when ignoreMeetupOrganizer is set', async () => {
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ id: 1 }));
    mockedMeetup.findOne.mockResolvedValue({ id: 10, organizers: [] } as any);
    const res = mockResponse();
    const next = jest.fn();

    await authChecker([Rule.ignoreMeetupOrganizer])(
      mockRequest(signToken({ id: 1 }), { meetup_id: '10' }),
      res,
      next
    );

    expect(res.locals.meetup).toBeDefined();
    expect(next).toHaveBeenCalled();
  });
});
