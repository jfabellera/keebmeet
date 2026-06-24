/// <reference types="jest" />
import { type Request, type Response } from 'express';

// ---- Mocks -----------------------------------------------------------------

jest.mock('../Server', () => ({ socket: { emit: jest.fn() } }));

jest.mock('../entity/Ticket', () => ({
  Ticket: {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
  },
}));
jest.mock('../entity/Meetup', () => ({
  Meetup: { findOne: jest.fn() },
}));
jest.mock('../util/eventbriteApi', () => ({
  getEventbriteAttendeeByUri: jest.fn(),
}));

import {
  checkInTicket,
  createTicket,
  deleteTicket,
  getAllTickets,
  getTicket,
  getUserTickets,
  syncEventbriteAttendee,
  updateTicket,
  updateTicketViaWebhook,
} from './tickets';
import { socket } from '../Server';
import { Ticket } from '../entity/Ticket';
import { Meetup } from '../entity/Meetup';
import { getEventbriteAttendeeByUri } from '../util/eventbriteApi';

const mockedTicket = jest.mocked(Ticket);
const mockedMeetup = jest.mocked(Meetup);
const mockedGetAttendee = jest.mocked(getEventbriteAttendeeByUri);
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
  params: Record<string, string> = {},
  query: Record<string, unknown> = {}
): Request => ({ body, params, query }) as unknown as Request;

const fakeMeetup = (overrides = {}): any => ({
  id: 10,
  default_raffle_entries: 2,
  ...overrides,
});

const fakeRequestor = (overrides = {}): any => ({
  id: 1,
  nick_name: 'jane',
  first_name: 'Jane',
  last_name: 'Doe',
  ...overrides,
});

const fakeAttendee = (overrides = {}): any => ({
  id: 'att-1',
  ticketClassId: 'tc-1',
  isAttending: true,
  isCheckedIn: false,
  createdAt: new Date('2026-01-01'),
  checkInStatusUpdatedAt: new Date('2026-01-02'),
  displayName: 'Eve',
  firstName: 'Eve',
  lastName: 'Stone',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockedTicket.create.mockImplementation((attrs: any) => ({
    ...attrs,
    save: jest.fn().mockResolvedValue(undefined),
  }));
});

// ---- getAllTickets / getTicket ---------------------------------------------

describe('getAllTickets', () => {
  it('returns every ticket', async () => {
    mockedTicket.find.mockResolvedValue([{ id: 1 }, { id: 2 }] as any);
    const res = mockResponse();

    await getAllTickets(mockRequest(), res);

    expect(res.body).toEqual([{ id: 1 }, { id: 2 }]);
  });
});

describe('getTicket', () => {
  it('returns 404 when the ticket does not exist', async () => {
    mockedTicket.findOneBy.mockResolvedValue(null);
    const res = mockResponse();

    await getTicket(mockRequest({}, { ticket_id: '5' }), res);

    expect(res.statusCode).toBe(404);
  });

  it('returns the ticket when found', async () => {
    mockedTicket.findOneBy.mockResolvedValue({ id: 5 } as any);
    const res = mockResponse();

    await getTicket(mockRequest({}, { ticket_id: '5' }), res);

    expect(res.body).toEqual({ id: 5 });
  });
});

// ---- createTicket ----------------------------------------------------------

describe('createTicket', () => {
  it('returns 400 when meetup or requestor is missing from locals', async () => {
    const res = mockResponse();
    res.locals.meetup = fakeMeetup();
    // no requestor

    await createTicket(mockRequest(), res);

    expect(res.statusCode).toBe(400);
  });

  it('returns 409 when the user already has a ticket for the meetup', async () => {
    mockedTicket.findOne.mockResolvedValue({ id: 99 } as any);
    const res = mockResponse();
    res.locals.meetup = fakeMeetup();
    res.locals.requestor = fakeRequestor();

    await createTicket(mockRequest(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ message: 'Ticket already exists.' });
  });

  it('returns 400 when the meetup has already occurred', async () => {
    mockedTicket.findOne.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.meetup = fakeMeetup({ date: '2020-01-01' });
    res.locals.requestor = fakeRequestor();

    await createTicket(mockRequest(), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ message: 'Meetup has already occurred.' });
  });

  it('creates the ticket with the meetup default entries and emits an update', async () => {
    mockedTicket.findOne.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.meetup = fakeMeetup({ default_raffle_entries: 3 });
    res.locals.requestor = fakeRequestor();

    await createTicket(mockRequest(), res);

    expect(mockedTicket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        raffle_entries: 3,
        ticket_holder_display_name: 'jane',
        ticket_holder_first_name: 'Jane',
        ticket_holder_last_name: 'Doe',
      })
    );
    expect(mockedSocket.emit).toHaveBeenCalledWith('meetup:update', {
      meetupId: 10,
    });
    expect(res.statusCode).toBe(201);
  });
});

// ---- updateTicket ----------------------------------------------------------

describe('updateTicket', () => {
  it('returns 400 for an invalid body', async () => {
    const res = mockResponse();

    await updateTicket(
      mockRequest({ raffle_entries: -5 }, { ticket_id: '5' }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when the ticket does not exist', async () => {
    mockedTicket.findOne.mockResolvedValue(null);
    const res = mockResponse();

    await updateTicket(
      mockRequest({ raffle_entries: 5 }, { ticket_id: '5' }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('updates the provided fields, saves, and emits', async () => {
    const ticket = {
      id: 5,
      is_checked_in: false,
      raffle_entries: 1,
      raffle_wins: 0,
      meetup: { id: 10 },
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockedTicket.findOne.mockResolvedValue(ticket as any);
    const res = mockResponse();

    await updateTicket(
      mockRequest(
        { is_checked_in: true, raffle_entries: 4 },
        { ticket_id: '5' }
      ),
      res
    );

    expect(ticket.is_checked_in).toBe(true);
    expect(ticket.raffle_entries).toBe(4);
    expect(ticket.raffle_wins).toBe(0); // untouched
    expect(ticket.save).toHaveBeenCalled();
    expect(mockedSocket.emit).toHaveBeenCalledWith('meetup:update', {
      meetupId: 10,
    });
    expect(res.statusCode).toBe(201);
  });
});

// ---- deleteTicket ----------------------------------------------------------

describe('deleteTicket', () => {
  it('returns 400 when the meetup has already occurred', async () => {
    const ticket = {
      meetup: { id: 10, date: '2020-01-01' },
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const res = mockResponse();
    res.locals.ticket = ticket;

    await deleteTicket(mockRequest(), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ message: 'Meetup has already occurred.' });
  });

  it('removes the ticket from locals and emits with its meetup id', async () => {
    const ticket = {
      meetup: { id: 10 },
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const res = mockResponse();
    res.locals.ticket = ticket;

    await deleteTicket(mockRequest(), res);

    expect(ticket.remove).toHaveBeenCalled();
    expect(mockedSocket.emit).toHaveBeenCalledWith('meetup:update', {
      meetupId: 10,
    });
    expect(res.statusCode).toBe(204);
  });
});

// ---- getUserTickets --------------------------------------------------------

describe('getUserTickets', () => {
  it('maps a user\'s tickets to id + meetup_id', async () => {
    mockedTicket.find.mockResolvedValue([
      { id: 1, meetup: { id: 10 } },
      { id: 2, meetup: { id: 11 } },
    ] as any);
    const res = mockResponse();

    await getUserTickets(mockRequest({}, { user_id: '1' }), res);

    expect(res.body).toEqual([
      { id: 1, meetup_id: 10 },
      { id: 2, meetup_id: 11 },
    ]);
  });
});

// ---- checkInTicket ---------------------------------------------------------

describe('checkInTicket', () => {
  it('rejects (400) Eventbrite-managed tickets', async () => {
    const res = mockResponse();
    res.locals.ticket = { eventbrite_attendee_id: 'att-1' };

    await checkInTicket(mockRequest(), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      message: 'Ticket must be checked in via Eventbrite.',
    });
  });

  it('is idempotent (200) when already checked in', async () => {
    const ticket = {
      eventbrite_attendee_id: null,
      is_checked_in: true,
      save: jest.fn(),
    };
    const res = mockResponse();
    res.locals.ticket = ticket;

    await checkInTicket(mockRequest(), res);

    expect(res.statusCode).toBe(200);
    expect(ticket.save).not.toHaveBeenCalled();
  });

  it('checks in the ticket, stamps the time, and emits', async () => {
    const ticket = {
      eventbrite_attendee_id: null,
      is_checked_in: false,
      checked_in_at: null,
      meetup: { id: 10 },
      save: jest.fn().mockResolvedValue(undefined),
    };
    const res = mockResponse();
    res.locals.ticket = ticket;

    await checkInTicket(mockRequest(), res);

    expect(ticket.is_checked_in).toBe(true);
    expect(ticket.checked_in_at).toBeInstanceOf(Date);
    expect(ticket.save).toHaveBeenCalled();
    expect(mockedSocket.emit).toHaveBeenCalledWith('meetup:update', {
      meetupId: 10,
    });
    expect(res.statusCode).toBe(200);
  });
});

// ---- syncEventbriteAttendee ------------------------------------------------

describe('syncEventbriteAttendee', () => {
  const meetup = {
    id: 10,
    default_raffle_entries: 2,
    eventbriteRecord: { ticket_class_id: 'tc-1' },
  } as any;

  it('ignores attendees from a different ticket class', async () => {
    await syncEventbriteAttendee(
      fakeAttendee({ ticketClassId: 'other' }),
      meetup
    );

    expect(mockedTicket.findOne).not.toHaveBeenCalled();
  });

  it('does nothing for an unknown attendee who is not attending', async () => {
    mockedTicket.findOne.mockResolvedValue(null);

    await syncEventbriteAttendee(fakeAttendee({ isAttending: false }), meetup);

    expect(mockedTicket.create).not.toHaveBeenCalled();
  });

  it('creates a ticket for a new attending attendee', async () => {
    mockedTicket.findOne.mockResolvedValue(null);

    await syncEventbriteAttendee(fakeAttendee({ isAttending: true }), meetup);

    expect(mockedTicket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventbrite_attendee_id: 'att-1',
        raffle_entries: 2,
        ticket_holder_display_name: 'Eve',
      })
    );
  });

  it('removes the ticket when an existing attendee is no longer attending', async () => {
    const ticket = { remove: jest.fn().mockResolvedValue(undefined) };
    mockedTicket.findOne.mockResolvedValue(ticket as any);

    await syncEventbriteAttendee(fakeAttendee({ isAttending: false }), meetup);

    expect(ticket.remove).toHaveBeenCalled();
  });

  it('stamps checked_in_at on the first check-in', async () => {
    const checkedAt = new Date('2026-03-03');
    const ticket = {
      is_checked_in: false,
      checked_in_at: null,
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockedTicket.findOne.mockResolvedValue(ticket as any);

    await syncEventbriteAttendee(
      fakeAttendee({
        isAttending: true,
        isCheckedIn: true,
        checkInStatusUpdatedAt: checkedAt,
      }),
      meetup
    );

    expect(ticket.checked_in_at).toBe(checkedAt);
    expect(ticket.is_checked_in).toBe(true);
    expect(ticket.save).toHaveBeenCalled();
  });

  it('stamps checked_out_at when an attendee checks back out', async () => {
    const checkedAt = new Date('2026-03-04');
    const ticket = {
      is_checked_in: true,
      checked_in_at: new Date('2026-03-03'),
      checked_out_at: null,
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockedTicket.findOne.mockResolvedValue(ticket as any);

    await syncEventbriteAttendee(
      fakeAttendee({
        isAttending: true,
        isCheckedIn: false,
        checkInStatusUpdatedAt: checkedAt,
      }),
      meetup
    );

    expect(ticket.checked_out_at).toBe(checkedAt);
    expect(ticket.is_checked_in).toBe(false);
  });
});

// ---- updateTicketViaWebhook ------------------------------------------------

describe('updateTicketViaWebhook', () => {
  it('returns 404 when the meetup has no Eventbrite record', async () => {
    mockedMeetup.findOne.mockResolvedValue(null);
    const res = mockResponse();

    await updateTicketViaWebhook(
      mockRequest({ api_url: 'x' }, { meetup_id: '10' }, { token: 't' }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('returns 500 when fetching the attendee fails', async () => {
    mockedMeetup.findOne.mockResolvedValue({
      id: 10,
      eventbriteRecord: { ticket_class_id: 'tc-1', display_name_question_id: 'q' },
    } as any);
    mockedGetAttendee.mockRejectedValue(new Error('eb down'));
    const res = mockResponse();

    await updateTicketViaWebhook(
      mockRequest({ api_url: 'x' }, { meetup_id: '10' }, { token: 't' }),
      res
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ message: 'Unable to get Eventbrite details' });
  });

  it('returns 400 when no attendee is resolved', async () => {
    mockedMeetup.findOne.mockResolvedValue({
      id: 10,
      eventbriteRecord: { ticket_class_id: 'tc-1', display_name_question_id: 'q' },
    } as any);
    mockedGetAttendee.mockResolvedValue(undefined as any);
    const res = mockResponse();

    await updateTicketViaWebhook(
      mockRequest({ api_url: 'x' }, { meetup_id: '10' }, { token: 't' }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('syncs the attendee and emits an update on success', async () => {
    mockedMeetup.findOne.mockResolvedValue({
      id: 10,
      eventbriteRecord: { ticket_class_id: 'tc-1', display_name_question_id: 'q' },
    } as any);
    // A different ticket class makes the (separately tested) sync a no-op,
    // isolating the webhook's own control flow.
    mockedGetAttendee.mockResolvedValue(
      fakeAttendee({ ticketClassId: 'other' })
    );
    const res = mockResponse();

    await updateTicketViaWebhook(
      mockRequest({ api_url: 'x' }, { meetup_id: '10' }, { token: 't' }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(mockedSocket.emit).toHaveBeenCalledWith('meetup:update', {
      meetupId: 10,
    });
  });
});
