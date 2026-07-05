/// <reference types="jest" />
import { type Request, type Response } from 'express';

// ---- Mocks -----------------------------------------------------------------

jest.mock('../Server', () => ({ socket: { emit: jest.fn() } }));

jest.mock('../entity/RaffleRecord', () => ({
  RaffleRecord: { create: jest.fn(), find: jest.fn(), findOne: jest.fn() },
}));
jest.mock('../entity/RaffleWinner', () => ({
  RaffleWinner: { create: jest.fn() },
}));
jest.mock('../entity/Ticket', () => ({
  Ticket: { find: jest.fn() },
}));
jest.mock('../util/math', () => ({
  generateMultipleRandomNumbers: jest.fn(),
}));
jest.mock('../datasource', () => ({
  AppDataSource: { transaction: jest.fn() },
}));

import {
  claimRaffleWinner,
  deleteRaffleRecord,
  getRaffleRecord,
  getRaffleRecords,
  markRaffleRecordAsDisplayed,
  rollRaffleWinner,
  unclaimRaffleWinner,
} from './raffles';
import { socket } from '../Server';
import { AppDataSource } from '../datasource';
import { RaffleRecord } from '../entity/RaffleRecord';
import { RaffleWinner } from '../entity/RaffleWinner';
import { Ticket } from '../entity/Ticket';
import { generateMultipleRandomNumbers } from '../util/math';

const mockedRaffleRecord = jest.mocked(RaffleRecord);
const mockedRaffleWinner = jest.mocked(RaffleWinner);
const mockedTicket = jest.mocked(Ticket);
const mockedRandom = jest.mocked(generateMultipleRandomNumbers);
const mockedSocket = jest.mocked(socket);
const mockedDataSource = jest.mocked(AppDataSource);

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

const fakeTicket = (id: string, name: string, overrides = {}): any => ({
  id,
  ticket_holder_display_name: name,
  ticket_holder_first_name: name,
  ticket_holder_last_name: 'X',
  raffle_wins: 0,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockedRaffleRecord.create.mockImplementation((attrs: any) => ({
    ...attrs,
    winners: [],
    save: jest.fn().mockResolvedValue(undefined),
  }));
  mockedRaffleWinner.create.mockImplementation((attrs: any) => ({
    ...attrs,
    save: jest.fn().mockResolvedValue(undefined),
  }));
});

// ---- rollRaffleWinner ------------------------------------------------------

describe('rollRaffleWinner', () => {
  it('returns 400 for an invalid body', async () => {
    const res = mockResponse();
    res.locals.meetup = { id: '10' };

    await rollRaffleWinner(mockRequest({ quantity: -1 }), res);

    expect(res.statusCode).toBe(400);
  });

  it('returns 200 with no body when there are no eligible tickets', async () => {
    mockedTicket.find.mockResolvedValue([]);
    const res = mockResponse();
    res.locals.meetup = { id: '10' };

    await rollRaffleWinner(mockRequest({}), res);

    expect(res.statusCode).toBe(200);
    expect(mockedRaffleRecord.create).not.toHaveBeenCalled();
    expect(res.body).toBeUndefined();
  });

  it('only considers checked-in attendees by default', async () => {
    mockedTicket.find.mockResolvedValue([]);
    const res = mockResponse();
    res.locals.meetup = { id: '10' };

    await rollRaffleWinner(mockRequest({ quantity: 1 }), res);

    const whereArg = (mockedTicket.find.mock.calls[0][0] as any).where;
    expect(whereArg.is_checked_in).toBe(true);
  });

  it('includes not-checked-in attendees when includeNotCheckedIn is set', async () => {
    mockedTicket.find.mockResolvedValue([]);
    const res = mockResponse();
    res.locals.meetup = { id: '10' };

    await rollRaffleWinner(
      mockRequest({ quantity: 1, includeNotCheckedIn: true }),
      res
    );

    const whereArg = (mockedTicket.find.mock.calls[0][0] as any).where;
    expect(whereArg.is_checked_in).toBeUndefined();
  });

  it('rolls a winner, persists the record, and emits an update', async () => {
    const tickets = [
      fakeTicket('1', 'alice'),
      fakeTicket('2', 'bob'),
      fakeTicket('3', 'carol'),
    ];
    mockedTicket.find.mockResolvedValue(tickets);
    mockedRandom.mockReturnValue([0]); // alice wins
    const res = mockResponse();
    res.locals.meetup = { id: '10' };

    await rollRaffleWinner(mockRequest({ quantity: 1 }), res);

    expect(res.statusCode).toBe(200);
    const body = res.body as any;
    expect(body.raffleRecord.winners).toHaveLength(1);
    expect(body.raffleRecord.winners[0].displayName).toBe('alice');
    expect(mockedSocket.emit).toHaveBeenCalledWith('meetup:update', {
      meetupId: '10',
    });
  });

  // BUG: `losers` is built from every eligible ticket, so it also includes the
  // winners. A "losers" list should exclude whoever was just drawn. This test
  // asserts the intended behavior; drop `.failing` once the controller filters
  // the winning tickets out of the losers list.
  it.failing('excludes the drawn winner from the losers list', async () => {
    const tickets = [
      fakeTicket('1', 'alice'),
      fakeTicket('2', 'bob'),
      fakeTicket('3', 'carol'),
    ];
    mockedTicket.find.mockResolvedValue(tickets);
    mockedRandom.mockReturnValue([0]); // alice wins
    const res = mockResponse();
    res.locals.meetup = { id: '10' };

    await rollRaffleWinner(mockRequest({ quantity: 1 }), res);

    const body = res.body as any;
    expect(body.losers).not.toContain('alice');
    expect(body.losers).toEqual(['bob', 'carol']);
  });
});

// ---- claimRaffleWinner -----------------------------------------------------

describe('claimRaffleWinner', () => {
  it('returns 400 for an invalid body', async () => {
    const res = mockResponse();
    res.locals.ticket = fakeTicket('5', 'eve');

    await claimRaffleWinner(mockRequest({}), res); // raffleRecordId required

    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when the raffle record is missing', async () => {
    mockedRaffleRecord.findOne.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.ticket = fakeTicket('5', 'eve');

    await claimRaffleWinner(mockRequest({ raffleRecordId: '1' }), res);

    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when the ticket is not part of the record', async () => {
    mockedRaffleRecord.findOne.mockResolvedValue({
      meetup: { id: '10' },
      winners: [{ ticket: { id: '99' }, claimed: false }],
    } as any);
    const res = mockResponse();
    res.locals.ticket = fakeTicket('5', 'eve');

    await claimRaffleWinner(mockRequest({ raffleRecordId: '1' }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      message: 'Ticket is not part of raffle record.',
    });
  });

  it('returns 400 when the ticket was already claimed', async () => {
    mockedRaffleRecord.findOne.mockResolvedValue({
      meetup: { id: '10' },
      winners: [{ ticket: { id: '5' }, claimed: true }],
    } as any);
    const res = mockResponse();
    res.locals.ticket = fakeTicket('5', 'eve');

    await claimRaffleWinner(mockRequest({ raffleRecordId: '1' }), res);

    expect(res.statusCode).toBe(400);
  });

  it('claims the winner, increments wins, and emits on success', async () => {
    const winner = { ticket: { id: '5' }, claimed: false, save: jest.fn() };
    mockedRaffleRecord.findOne.mockResolvedValue({
      meetup: { id: '10' },
      winners: [winner],
    } as any);
    const ticket = fakeTicket('5', 'eve', {
      raffle_wins: 2,
      save: jest.fn().mockResolvedValue(undefined),
    });
    const res = mockResponse();
    res.locals.ticket = ticket;

    await claimRaffleWinner(mockRequest({ raffleRecordId: '1' }), res);

    expect(winner.claimed).toBe(true);
    expect(winner.save).toHaveBeenCalled();
    expect(ticket.raffle_wins).toBe(3);
    expect(ticket.save).toHaveBeenCalled();
    expect(mockedSocket.emit).toHaveBeenCalledWith('meetup:update', {
      meetupId: '10',
    });
    expect(res.statusCode).toBe(200);
  });
});

// ---- getRaffleRecords / getRaffleRecord ------------------------------------

describe('getRaffleRecords', () => {
  it('maps every record for the meetup to the response shape', async () => {
    mockedRaffleRecord.find.mockResolvedValue([
      {
        id: '1',
        is_batch_roll: false,
        was_displayed: false,
        created_at: new Date('2026-01-01'),
        winners: [
          {
            ticket: {
              id: '5',
              ticket_holder_display_name: 'eve',
              ticket_holder_first_name: 'eve',
              ticket_holder_last_name: 'X',
              raffle_wins: 1,
            },
            claimed: true,
          },
        ],
      },
    ] as any);
    const res = mockResponse();
    res.locals.meetup = { id: '10' };

    await getRaffleRecords(mockRequest(), res);

    const body = res.body as any[];
    expect(body).toHaveLength(1);
    expect(body[0].winners[0]).toMatchObject({
      ticketId: '5',
      displayName: 'eve',
      claimed: true,
    });
  });
});

describe('getRaffleRecord', () => {
  it('returns 404 when the record does not exist', async () => {
    mockedRaffleRecord.findOne.mockResolvedValue(null);
    const res = mockResponse();

    await getRaffleRecord(mockRequest({}, { raffle_id: '3' }), res);

    expect(res.statusCode).toBe(404);
  });

  it('returns the mapped record on success', async () => {
    mockedRaffleRecord.findOne.mockResolvedValue({
      id: '3',
      is_batch_roll: true,
      was_displayed: false,
      created_at: new Date('2026-01-01'),
      winners: [],
    } as any);
    const res = mockResponse();

    await getRaffleRecord(mockRequest({}, { raffle_id: '3' }), res);

    expect(res.statusCode).toBe(200);
    expect((res.body as any).id).toBe('3');
    expect((res.body as any).isBatchRoll).toBe(true);
  });
});

// ---- markRaffleRecordAsDisplayed -------------------------------------------

describe('markRaffleRecordAsDisplayed', () => {
  it('returns 404 when the record does not exist', async () => {
    mockedRaffleRecord.findOne.mockResolvedValue(null);
    const res = mockResponse();

    await markRaffleRecordAsDisplayed(mockRequest({}, { raffle_id: '3' }), res);

    expect(res.statusCode).toBe(404);
  });

  it('is a no-op (204) when already displayed', async () => {
    const record = {
      was_displayed: true,
      meetup: { id: '10' },
      save: jest.fn(),
    };
    mockedRaffleRecord.findOne.mockResolvedValue(record as any);
    const res = mockResponse();

    await markRaffleRecordAsDisplayed(mockRequest({}, { raffle_id: '3' }), res);

    expect(res.statusCode).toBe(204);
    expect(record.save).not.toHaveBeenCalled();
  });

  it('marks as displayed, saves, and emits on success', async () => {
    const record = {
      was_displayed: false,
      meetup: { id: '10' },
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockedRaffleRecord.findOne.mockResolvedValue(record as any);
    const res = mockResponse();

    await markRaffleRecordAsDisplayed(mockRequest({}, { raffle_id: '3' }), res);

    expect(record.was_displayed).toBe(true);
    expect(record.save).toHaveBeenCalled();
    expect(mockedSocket.emit).toHaveBeenCalledWith('meetup:update', {
      meetupId: '10',
    });
    expect(res.statusCode).toBe(200);
  });
});

// ---- unclaimRaffleWinner ---------------------------------------------------

describe('unclaimRaffleWinner', () => {
  it('returns 400 for an invalid body', async () => {
    const res = mockResponse();

    await unclaimRaffleWinner(mockRequest({}, { raffle_id: '3' }), res);

    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when the record does not exist', async () => {
    mockedRaffleRecord.findOne.mockResolvedValue(null);
    const res = mockResponse();

    await unclaimRaffleWinner(
      mockRequest({ ticketId: '5' }, { raffle_id: '3' }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when the ticket is not part of the record', async () => {
    mockedRaffleRecord.findOne.mockResolvedValue({
      meetup: { id: '10' },
      winners: [{ ticket: { id: '99' }, claimed: true }],
    } as any);
    const res = mockResponse();

    await unclaimRaffleWinner(
      mockRequest({ ticketId: '5' }, { raffle_id: '3' }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      message: 'Ticket is not part of raffle record.',
    });
  });

  it('returns 400 when the ticket has not been claimed', async () => {
    mockedRaffleRecord.findOne.mockResolvedValue({
      meetup: { id: '10' },
      winners: [{ ticket: { id: '5' }, claimed: false }],
    } as any);
    const res = mockResponse();

    await unclaimRaffleWinner(
      mockRequest({ ticketId: '5' }, { raffle_id: '3' }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('unclaims the winner, decrements wins, and emits on success', async () => {
    const ticket = {
      id: '5',
      raffle_wins: 3,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const winner = { ticket, claimed: true, save: jest.fn() };
    mockedRaffleRecord.findOne.mockResolvedValue({
      meetup: { id: '10' },
      winners: [winner],
    } as any);
    const res = mockResponse();

    await unclaimRaffleWinner(
      mockRequest({ ticketId: '5' }, { raffle_id: '3' }),
      res
    );

    expect(ticket.raffle_wins).toBe(2);
    expect(ticket.save).toHaveBeenCalled();
    expect(winner.claimed).toBe(false);
    expect(winner.save).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });
});

// ---- deleteRaffleRecord ----------------------------------------------------

describe('deleteRaffleRecord', () => {
  // Runs the transaction callback against a throwaway manager so the tests can
  // assert on the decrement/remove calls it makes.
  const stubTransaction = (): {
    decrement: jest.Mock;
    remove: jest.Mock;
  } => {
    const manager = {
      decrement: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    mockedDataSource.transaction.mockImplementation(
      (async (cb: any) => cb(manager)) as any
    );
    return manager;
  };

  it('returns 404 when the record does not exist', async () => {
    mockedRaffleRecord.findOne.mockResolvedValue(null);
    stubTransaction();
    const res = mockResponse();

    await deleteRaffleRecord(mockRequest({}, { raffle_id: '3' }), res);

    expect(res.statusCode).toBe(404);
    expect(mockedDataSource.transaction).not.toHaveBeenCalled();
  });

  it('decrements wins only for claimed winners and removes every row', async () => {
    const claimedWinner = { ticket: { id: '5' }, claimed: true };
    const unclaimedWinner = { ticket: { id: '6' }, claimed: false };
    const raffleRecord = {
      meetup: { id: '10' },
      winners: [claimedWinner, unclaimedWinner],
    };
    mockedRaffleRecord.findOne.mockResolvedValue(raffleRecord as any);
    const manager = stubTransaction();
    const res = mockResponse();

    await deleteRaffleRecord(mockRequest({}, { raffle_id: '3' }), res);

    // Only the claimed winner gives back a win.
    expect(manager.decrement).toHaveBeenCalledTimes(1);
    expect(manager.decrement).toHaveBeenCalledWith(
      Ticket,
      { id: '5' },
      'raffle_wins',
      1
    );
    // Both winners and the record itself are removed.
    expect(manager.remove).toHaveBeenCalledWith(claimedWinner);
    expect(manager.remove).toHaveBeenCalledWith(unclaimedWinner);
    expect(manager.remove).toHaveBeenCalledWith(raffleRecord);
    expect(mockedSocket.emit).toHaveBeenCalledWith('meetup:update', {
      meetupId: '10',
    });
    expect(res.statusCode).toBe(204);
  });
});
