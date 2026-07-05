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
    count: jest.fn(),
  },
}));
jest.mock('../entity/Meetup', () => ({
  Meetup: { findOne: jest.fn() },
}));
jest.mock('../util/eventbriteApi', () => ({
  getEventbriteAttendeeByUri: jest.fn(),
}));
jest.mock('../util/email', () => ({
  sendRsvpConfirmationEmail: jest.fn(),
}));
jest.mock('../util/meetupDiscordMessage', () => ({
  refreshMeetupDiscordMessage: jest.fn(),
}));

import { socket } from '../Server';
import { Meetup } from '../entity/Meetup';
import { Ticket } from '../entity/Ticket';
import { getEventbriteAttendeeByUri } from '../util/eventbriteApi';
import { sendRsvpConfirmationEmail } from '../util/email';
import { refreshMeetupDiscordMessage } from '../util/meetupDiscordMessage';
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

const mockedTicket = jest.mocked(Ticket);
const mockedMeetup = jest.mocked(Meetup);
const mockedGetAttendee = jest.mocked(getEventbriteAttendeeByUri);
const mockedSocket = jest.mocked(socket);
const mockedRefresh = jest.mocked(refreshMeetupDiscordMessage);
const mockedSendRsvpEmail = jest.mocked(sendRsvpConfirmationEmail);

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

// Build an ISO timestamp a given number of hours from now.
const hoursFromNow = (hours: number): string =>
  new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

const fakeMeetup = (overrides = {}): any => ({
  id: '10',
  default_raffle_entries: 2,
  date: hoursFromNow(1),
  duration_hours: 2,
  ...overrides,
});

const fakeRequestor = (overrides = {}): any => ({
  id: '1',
  nick_name: 'jane',
  first_name: 'Jane',
  last_name: 'Doe',
  email: 'jane@example.com',
  ...overrides,
});

// createTicketSchema wraps an optional `ticket_holder` object: when present,
// every field is required; when absent, the requestor's details win.
const fakeTicketHolder = (overrides = {}): any => ({
  display_name: 'spotter',
  first_name: 'Sam',
  last_name: 'Holder',
  email: 'sam.holder@example.com',
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
  mockedTicket.create.mockImplementation((attrs: any) => {
    // Mirror the DB assigning the id on save, so newTicket.id is available
    // afterwards (e.g. for the RSVP confirmation email / QR code).
    const ticket: any = { ...attrs };
    ticket.save = jest.fn().mockImplementation(() => {
      ticket.id = 'new-ticket-id';
      return Promise.resolve(undefined);
    });
    return ticket;
  });
  // Default: meetup is below capacity.
  mockedTicket.count.mockResolvedValue(0);
});

// ---- getAllTickets / getTicket ---------------------------------------------

describe('getAllTickets', () => {
  it('returns every ticket', async () => {
    mockedTicket.find.mockResolvedValue([{ id: '1' }, { id: '2' }] as any);
    const res = mockResponse();

    await getAllTickets(mockRequest(), res);

    expect(res.body).toEqual([{ id: '1' }, { id: '2' }]);
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
    mockedTicket.findOneBy.mockResolvedValue({ id: '5' } as any);
    const res = mockResponse();

    await getTicket(mockRequest({}, { ticket_id: '5' }), res);

    expect(res.body).toEqual({ id: '5' });
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
    mockedTicket.findOne.mockResolvedValue({ id: '99' } as any);
    const res = mockResponse();
    res.locals.meetup = fakeMeetup();
    res.locals.requestor = fakeRequestor();

    await createTicket(mockRequest(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ message: 'Ticket already exists.' });
  });

  it('returns 400 when the meetup has fully ended (past its date + duration)', async () => {
    mockedTicket.findOne.mockResolvedValue(null);
    const res = mockResponse();
    // Started 3h ago, ran for 2h -> ended 1h ago.
    res.locals.meetup = fakeMeetup({
      date: hoursFromNow(-3),
      duration_hours: 2,
    });
    res.locals.requestor = fakeRequestor();

    await createTicket(mockRequest(), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ message: 'Meetup has already occurred.' });
  });

  it('creates the ticket while the meetup is happening (started but not yet ended)', async () => {
    mockedTicket.findOne.mockResolvedValue(null);
    const res = mockResponse();
    // Started 1h ago, runs for 2h -> still has 1h left.
    res.locals.meetup = fakeMeetup({
      date: hoursFromNow(-1),
      duration_hours: 2,
    });
    res.locals.requestor = fakeRequestor();

    await createTicket(mockRequest(), res);

    expect(mockedTicket.create).toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
  });

  it('returns 400 when the meetup is at capacity', async () => {
    mockedTicket.findOne.mockResolvedValue(null);
    mockedTicket.count.mockResolvedValue(5);
    const res = mockResponse();
    res.locals.meetup = fakeMeetup({ capacity: 5 });
    res.locals.requestor = fakeRequestor();

    await createTicket(mockRequest(), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ message: 'Meetup is full.' });
    expect(mockedTicket.create).not.toHaveBeenCalled();
  });

  it("stamps the requestor's linked discord_id on the ticket", async () => {
    mockedTicket.findOne.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.meetup = fakeMeetup({ capacity: 100 });
    res.locals.requestor = fakeRequestor({ discord_id: 'd-99' });

    await createTicket(mockRequest(), res);

    expect(mockedTicket.create).toHaveBeenCalledWith(
      expect.objectContaining({ discord_id: 'd-99' })
    );
    expect(res.statusCode).toBe(201);
  });

  it("falls back to the requestor's details when no ticket holder is supplied, then emits an update", async () => {
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
        ticket_holder_email: 'jane@example.com',
      })
    );
    expect(mockedSocket.emit).toHaveBeenCalledWith('meetup:update', {
      meetupId: '10',
    });
    expect(mockedRefresh).toHaveBeenCalledWith('10');
    expect(res.statusCode).toBe(201);
  });

  it('sends the RSVP confirmation email with the saved ticket id (used for the QR code)', async () => {
    mockedTicket.findOne.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.meetup = fakeMeetup({ name: 'Keeb Night', address: '123 Main St' });
    res.locals.requestor = fakeRequestor();

    await createTicket(mockRequest(), res);

    expect(mockedSendRsvpEmail).toHaveBeenCalledWith(
      'jane@example.com',
      'Keeb Night',
      expect.any(String),
      '123 Main St',
      'new-ticket-id'
    );
    expect(res.statusCode).toBe(201);
  });

  it('accepts an RSVP with no body and falls back to the requestor (Express 5 leaves req.body undefined)', async () => {
    mockedTicket.findOne.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.meetup = fakeMeetup();
    res.locals.requestor = fakeRequestor();

    // Genuinely undefined body — mockRequest()'s default would coerce to {}.
    const req = {
      body: undefined,
      params: {},
      query: {},
    } as unknown as Request;
    await createTicket(req, res);

    expect(mockedTicket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ticket_holder_display_name: 'jane',
        ticket_holder_email: 'jane@example.com',
      })
    );
    expect(res.statusCode).toBe(201);
  });

  it('uses the supplied ticket holder details instead of the requestor when provided', async () => {
    mockedTicket.findOne.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.meetup = fakeMeetup();
    res.locals.requestor = fakeRequestor();

    await createTicket(mockRequest({ ticket_holder: fakeTicketHolder() }), res);

    expect(mockedTicket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ticket_holder_display_name: 'spotter',
        ticket_holder_first_name: 'Sam',
        ticket_holder_last_name: 'Holder',
        ticket_holder_email: 'sam.holder@example.com',
      })
    );
    expect(res.statusCode).toBe(201);
  });

  it('rejects (400) a partial ticket holder that omits some details', async () => {
    const res = mockResponse();
    res.locals.meetup = fakeMeetup();
    res.locals.requestor = fakeRequestor();

    // first_name / last_name / email omitted.
    await createTicket(
      mockRequest({ ticket_holder: { display_name: 'spotter' } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(mockedTicket.findOne).not.toHaveBeenCalled();
    expect(mockedTicket.create).not.toHaveBeenCalled();
  });

  it('rejects (400) a ticket holder with an invalid email', async () => {
    const res = mockResponse();
    res.locals.meetup = fakeMeetup();
    res.locals.requestor = fakeRequestor();

    await createTicket(
      mockRequest({
        ticket_holder: fakeTicketHolder({ email: 'not-an-email' }),
      }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(mockedTicket.create).not.toHaveBeenCalled();
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
      id: '5',
      is_checked_in: false,
      raffle_entries: 1,
      raffle_wins: 0,
      meetup: { id: '10', organizers: [{ id: '13' }] },
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockedTicket.findOne.mockResolvedValue(ticket as any);
    const res = mockResponse();
    // An organizer of the meetup is allowed to change check-in status and raffle data.
    res.locals.requestor = fakeRequestor({ id: '13', is_organizer: true });

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
      meetupId: '10',
    });
    expect(res.statusCode).toBe(201);
  });

  it('lets the lead organizer (not in the co-organizer list) check a ticket out', async () => {
    const ticket = {
      id: '5',
      is_checked_in: true,
      raffle_entries: 1,
      raffle_wins: 0,
      // The lead is tracked separately and is NOT in `organizers`.
      meetup: { id: '10', organizers: [], lead_organizer: { id: '7' } },
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockedTicket.findOne.mockResolvedValue(ticket as any);
    const res = mockResponse();
    res.locals.requestor = fakeRequestor({ id: '7', is_organizer: true });

    await updateTicket(
      mockRequest({ is_checked_in: false }, { ticket_id: '5' }),
      res
    );

    expect(ticket.is_checked_in).toBe(false);
    expect(ticket.save).toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
  });

  it('does not let a non-organizer modify their own check-in status, raffle wins, or raffle entries', async () => {
    const ticket = {
      id: '5',
      is_checked_in: false,
      raffle_entries: 1,
      raffle_wins: 0,
      user: { id: '1' },
      meetup: { id: '10' },
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockedTicket.findOne.mockResolvedValue(ticket as any);
    const res = mockResponse();
    // A regular attendee editing their own ticket.
    res.locals.requestor = fakeRequestor({
      id: '1',
      is_organizer: false,
      is_admin: false,
    });

    await updateTicket(
      mockRequest(
        { is_checked_in: true, raffle_entries: 99, raffle_wins: 5 },
        { ticket_id: '5' }
      ),
      res
    );

    // These privileged fields must be untouched for a non-organizer.
    expect(ticket.is_checked_in).toBe(false);
    expect(ticket.raffle_entries).toBe(1);
    expect(ticket.raffle_wins).toBe(0);
  });

  it('updates the ticket holder details when a full ticket_holder is provided', async () => {
    const ticket = {
      id: '5',
      ticket_holder_display_name: 'old',
      ticket_holder_first_name: 'Old',
      ticket_holder_last_name: 'Name',
      ticket_holder_email: 'old@example.com',
      meetup: { id: '10' },
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockedTicket.findOne.mockResolvedValue(ticket as any);
    const res = mockResponse();

    await updateTicket(
      mockRequest({ ticket_holder: fakeTicketHolder() }, { ticket_id: '5' }),
      res
    );

    expect(ticket.ticket_holder_display_name).toBe('spotter');
    expect(ticket.ticket_holder_first_name).toBe('Sam');
    expect(ticket.ticket_holder_last_name).toBe('Holder');
    expect(ticket.ticket_holder_email).toBe('sam.holder@example.com');
    expect(ticket.save).toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
  });

  it('rejects (400) a partial ticket_holder without touching the ticket', async () => {
    const res = mockResponse();

    await updateTicket(
      mockRequest(
        { ticket_holder: { display_name: 'spotter' } },
        { ticket_id: '5' }
      ),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(mockedTicket.findOne).not.toHaveBeenCalled();
  });
});

// ---- deleteTicket ----------------------------------------------------------

describe('deleteTicket', () => {
  it('returns 400 when the meetup has fully ended (past its date + duration)', async () => {
    const ticket = {
      // Started 3h ago, ran for 2h -> ended 1h ago.
      meetup: { id: '10', date: hoursFromNow(-3), duration_hours: 2 },
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const res = mockResponse();
    res.locals.ticket = ticket;

    await deleteTicket(mockRequest(), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ message: 'Meetup has already occurred.' });
    expect(ticket.remove).not.toHaveBeenCalled();
  });

  it('removes the ticket while the meetup is happening (started but not yet ended)', async () => {
    const ticket = {
      // Started 1h ago, runs for 2h -> still has 1h left.
      meetup: { id: '10', date: hoursFromNow(-1), duration_hours: 2 },
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const res = mockResponse();
    res.locals.ticket = ticket;

    await deleteTicket(mockRequest(), res);

    expect(ticket.remove).toHaveBeenCalled();
    expect(mockedSocket.emit).toHaveBeenCalledWith('meetup:update', {
      meetupId: '10',
    });
    expect(mockedRefresh).toHaveBeenCalledWith('10');
    expect(res.statusCode).toBe(204);
  });
});

// ---- getUserTickets --------------------------------------------------------

describe('getUserTickets', () => {
  it("maps a user's tickets to id + meetup_id", async () => {
    mockedTicket.find.mockResolvedValue([
      { id: '1', meetup: { id: '10' } },
      { id: '2', meetup: { id: '11' } },
    ] as any);
    const res = mockResponse();

    await getUserTickets(mockRequest({}, { user_id: '1' }), res);

    expect(res.body).toEqual([
      { id: '1', meetup_id: '10' },
      { id: '2', meetup_id: '11' },
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
      meetup: { id: '10' },
      save: jest.fn().mockResolvedValue(undefined),
    };
    const res = mockResponse();
    res.locals.ticket = ticket;

    await checkInTicket(mockRequest(), res);

    expect(ticket.is_checked_in).toBe(true);
    expect(ticket.checked_in_at).toBeInstanceOf(Date);
    expect(ticket.save).toHaveBeenCalled();
    expect(mockedSocket.emit).toHaveBeenCalledWith('meetup:update', {
      meetupId: '10',
    });
    expect(res.statusCode).toBe(200);
  });
});

// ---- syncEventbriteAttendee ------------------------------------------------

describe('syncEventbriteAttendee', () => {
  const meetup = {
    id: '10',
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
      id: '10',
      eventbriteRecord: {
        ticket_class_id: 'tc-1',
        display_name_question_id: 'q',
      },
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
      id: '10',
      eventbriteRecord: {
        ticket_class_id: 'tc-1',
        display_name_question_id: 'q',
      },
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
      id: '10',
      eventbriteRecord: {
        ticket_class_id: 'tc-1',
        display_name_question_id: 'q',
      },
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
      meetupId: '10',
    });
  });
});
