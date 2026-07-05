/// <reference types="jest" />
import { type Request, type Response } from 'express';

// ---- Mocks -----------------------------------------------------------------

jest.mock('../Server', () => ({ socket: { emit: jest.fn() } }));

jest.mock('../entity/Meetup', () => ({
  Meetup: { findOneBy: jest.fn() },
}));
jest.mock('../entity/Ticket', () => ({
  Ticket: { findOne: jest.fn(), create: jest.fn() },
}));
jest.mock('../entity/User', () => ({
  User: { findOneBy: jest.fn() },
}));
jest.mock('../entity/MeetupDiscordMessage', () => ({
  MeetupDiscordMessage: { findOneBy: jest.fn() },
}));
jest.mock('../util/meetupDiscordMessage', () => ({
  refreshMeetupDiscordMessage: jest.fn(),
}));
jest.mock('../util/rsvp', () => ({
  getMeetupEnd: jest.fn(),
  isMeetupAtCapacity: jest.fn(),
}));

import { handleDiscordRsvp } from './discordRsvp';
import { Meetup } from '../entity/Meetup';
import { Ticket } from '../entity/Ticket';
import { User } from '../entity/User';
import { MeetupDiscordMessage } from '../entity/MeetupDiscordMessage';
import { refreshMeetupDiscordMessage } from '../util/meetupDiscordMessage';
import { getMeetupEnd, isMeetupAtCapacity } from '../util/rsvp';

const mockedMeetup = jest.mocked(Meetup);
const mockedTicket = jest.mocked(Ticket);
const mockedUser = jest.mocked(User);
const mockedDiscordMsg = jest.mocked(MeetupDiscordMessage);
const mockedRefresh = jest.mocked(refreshMeetupDiscordMessage);
const mockedGetMeetupEnd = jest.mocked(getMeetupEnd);
const mockedIsAtCapacity = jest.mocked(isMeetupAtCapacity);

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
  res.locals = {};
  return res as MockResponse;
};

const mockRequest = (body: unknown): Request =>
  ({ body }) as unknown as Request;

const validBody = {
  meetup_id: 10,
  discord_id: 'd-1',
  display_name: 'Discord Dan',
  action: 'rsvp',
};

const cancelBody = { ...validBody, action: 'cancel' };

const fakeMeetup = (overrides: Record<string, unknown> = {}): any => ({
  id: 10,
  name: 'Test Meetup',
  capacity: 100,
  default_raffle_entries: 2,
  date: '2026-07-01T00:00:00Z',
  duration_hours: 2,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  // Default: meetup is in the future and not at capacity.
  mockedGetMeetupEnd.mockReturnValue(new Date('2999-01-01'));
  mockedIsAtCapacity.mockResolvedValue(false);
  // Default: no tracked Discord message (so message_url is null).
  mockedDiscordMsg.findOneBy.mockResolvedValue(null);
  mockedTicket.create.mockImplementation((attrs: any) => ({
    ...attrs,
    save: jest.fn().mockResolvedValue(undefined),
  }));
});

describe('handleDiscordRsvp', () => {
  it('returns 400 on an invalid body', async () => {
    const res = mockResponse();

    await handleDiscordRsvp(mockRequest({ meetup_id: 'nope' }), res);

    expect(res.statusCode).toBe(400);
    expect(mockedMeetup.findOneBy).not.toHaveBeenCalled();
  });

  it('returns 404 when the meetup does not exist', async () => {
    mockedMeetup.findOneBy.mockResolvedValue(null);
    const res = mockResponse();

    await handleDiscordRsvp(mockRequest(validBody), res);

    expect(res.statusCode).toBe(404);
  });

  it('returns status "ended" when the meetup has already happened', async () => {
    mockedMeetup.findOneBy.mockResolvedValue(fakeMeetup());
    mockedGetMeetupEnd.mockReturnValue(new Date('2000-01-01'));
    const res = mockResponse();

    await handleDiscordRsvp(mockRequest(validBody), res);

    expect(res.body).toEqual({ status: 'ended' });
    expect(mockedTicket.create).not.toHaveBeenCalled();
  });

  it('creates an account-less ticket with the Discord display name and a message link', async () => {
    mockedMeetup.findOneBy.mockResolvedValue(fakeMeetup());
    mockedUser.findOneBy.mockResolvedValue(null); // no linked account
    mockedTicket.findOne.mockResolvedValue(null);
    mockedDiscordMsg.findOneBy.mockResolvedValue({
      guild_id: 'g',
      channel_id: 'c',
      message_id: 'm',
    } as any);
    const res = mockResponse();

    await handleDiscordRsvp(mockRequest(validBody), res);

    expect(mockedTicket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user: null,
        discord_id: 'd-1',
        ticket_holder_display_name: 'Discord Dan',
        ticket_holder_email: '',
      })
    );
    expect(mockedRefresh).toHaveBeenCalledWith('10');
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      status: 'created',
      meetup_name: 'Test Meetup',
      message_url: 'https://discord.com/channels/g/c/m',
    });
  });

  it('links the ticket to an account when one has the discord id', async () => {
    const user = {
      id: 7,
      nick_name: 'janed',
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@example.com',
    };
    mockedMeetup.findOneBy.mockResolvedValue(fakeMeetup());
    mockedUser.findOneBy.mockResolvedValue(user as any);
    mockedTicket.findOne.mockResolvedValue(null);
    const res = mockResponse();

    await handleDiscordRsvp(mockRequest(validBody), res);

    expect(mockedTicket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user,
        discord_id: 'd-1',
        ticket_holder_display_name: 'janed',
        ticket_holder_email: 'jane@example.com',
      })
    );
    expect(res.body).toEqual({
      status: 'created',
      meetup_name: 'Test Meetup',
      message_url: null,
    });
  });

  it('reports "already" on an rsvp action when a ticket exists (no removal)', async () => {
    const ticket = { remove: jest.fn().mockResolvedValue(undefined) };
    mockedMeetup.findOneBy.mockResolvedValue(fakeMeetup());
    mockedUser.findOneBy.mockResolvedValue(null);
    mockedTicket.findOne.mockResolvedValue(ticket as any);
    const res = mockResponse();

    await handleDiscordRsvp(mockRequest(validBody), res);

    expect(ticket.remove).not.toHaveBeenCalled();
    expect(mockedTicket.create).not.toHaveBeenCalled();
    expect(res.body).toEqual({ status: 'already' });
  });

  it('cancels an existing RSVP on a cancel action', async () => {
    const ticket = { remove: jest.fn().mockResolvedValue(undefined) };
    mockedMeetup.findOneBy.mockResolvedValue(fakeMeetup());
    mockedUser.findOneBy.mockResolvedValue(null);
    mockedTicket.findOne.mockResolvedValue(ticket as any);
    const res = mockResponse();

    await handleDiscordRsvp(mockRequest(cancelBody), res);

    expect(ticket.remove).toHaveBeenCalled();
    expect(mockedRefresh).toHaveBeenCalledWith('10');
    expect(res.body).toEqual({
      status: 'cancelled',
      meetup_name: 'Test Meetup',
      message_url: null,
    });
  });

  it('reports "not_found" on a cancel action with no ticket', async () => {
    mockedMeetup.findOneBy.mockResolvedValue(fakeMeetup());
    mockedUser.findOneBy.mockResolvedValue(null);
    mockedTicket.findOne.mockResolvedValue(null);
    const res = mockResponse();

    await handleDiscordRsvp(mockRequest(cancelBody), res);

    expect(res.body).toEqual({ status: 'not_found' });
    expect(mockedRefresh).not.toHaveBeenCalled();
  });

  it('returns status "ended" on a cancel action after the meetup has happened', async () => {
    const ticket = { remove: jest.fn().mockResolvedValue(undefined) };
    mockedMeetup.findOneBy.mockResolvedValue(fakeMeetup());
    mockedUser.findOneBy.mockResolvedValue(null);
    mockedTicket.findOne.mockResolvedValue(ticket as any);
    mockedGetMeetupEnd.mockReturnValue(new Date('2000-01-01'));
    const res = mockResponse();

    await handleDiscordRsvp(mockRequest(cancelBody), res);

    expect(res.body).toEqual({ status: 'ended' });
    expect(ticket.remove).not.toHaveBeenCalled();
    expect(mockedRefresh).not.toHaveBeenCalled();
  });

  it('returns status "full" at capacity without creating a ticket', async () => {
    mockedMeetup.findOneBy.mockResolvedValue(fakeMeetup());
    mockedUser.findOneBy.mockResolvedValue(null);
    mockedTicket.findOne.mockResolvedValue(null);
    mockedIsAtCapacity.mockResolvedValue(true);
    const res = mockResponse();

    await handleDiscordRsvp(mockRequest(validBody), res);

    expect(res.body).toEqual({ status: 'full' });
    expect(mockedTicket.create).not.toHaveBeenCalled();
  });
});
