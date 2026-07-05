/// <reference types="jest" />

jest.mock('../entity/Ticket', () => ({
  Ticket: { count: jest.fn(), find: jest.fn(), findOne: jest.fn() },
}));
jest.mock('./meetupDiscordMessage', () => ({
  refreshMeetupDiscordMessage: jest.fn(),
}));

import { IsNull } from 'typeorm';
import { Ticket } from '../entity/Ticket';
import { refreshMeetupDiscordMessage } from './meetupDiscordMessage';
import {
  claimDiscordTickets,
  getMeetupEnd,
  isMeetupAtCapacity,
} from './rsvp';

const mockedTicket = jest.mocked(Ticket);
const mockedRefresh = jest.mocked(refreshMeetupDiscordMessage);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getMeetupEnd', () => {
  it('adds the duration to the start date', () => {
    const meetup = {
      date: '2026-07-01T10:00:00Z',
      duration_hours: 3,
    } as any;

    expect(getMeetupEnd(meetup).toISOString()).toBe('2026-07-01T13:00:00.000Z');
  });
});

describe('isMeetupAtCapacity', () => {
  it('is true when the ticket count meets or exceeds capacity', async () => {
    mockedTicket.count.mockResolvedValue(5);

    expect(await isMeetupAtCapacity('1', 5)).toBe(true);
    expect(mockedTicket.count).toHaveBeenCalledWith({
      where: { meetup: { id: '1' } },
    });
  });

  it('is false when below capacity', async () => {
    mockedTicket.count.mockResolvedValue(4);

    expect(await isMeetupAtCapacity('1', 5)).toBe(false);
  });
});

describe('claimDiscordTickets', () => {
  it('does nothing when the user has no linked discord id', async () => {
    await claimDiscordTickets({ id: '1', discord_id: null } as any);

    expect(mockedTicket.find).not.toHaveBeenCalled();
  });

  it('queries account-less tickets for the discord id', async () => {
    mockedTicket.find.mockResolvedValue([]);

    await claimDiscordTickets({ id: '1', discord_id: 'd-1' } as any);

    expect(mockedTicket.find).toHaveBeenCalledWith({
      relations: { meetup: true },
      where: { discord_id: 'd-1', user: IsNull() },
    });
  });

  it('reassigns an orphan to the user when they have no ticket for that meetup', async () => {
    const user = { id: '7', discord_id: 'd-1' } as any;
    const orphan: any = {
      meetup: { id: '10' },
      user: null,
      save: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    mockedTicket.find.mockResolvedValue([orphan as any]);
    mockedTicket.findOne.mockResolvedValue(null);

    await claimDiscordTickets(user);

    expect(orphan.user).toBe(user);
    expect(orphan.save).toHaveBeenCalled();
    expect(orphan.remove).not.toHaveBeenCalled();
    expect(mockedRefresh).not.toHaveBeenCalled();
  });

  it('removes the orphan and refreshes when the user already has a ticket for the meetup', async () => {
    const user = { id: '7', discord_id: 'd-1' } as any;
    const orphan: any = {
      meetup: { id: '10' },
      user: null,
      save: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    mockedTicket.find.mockResolvedValue([orphan as any]);
    mockedTicket.findOne.mockResolvedValue({ id: '99' } as any);

    await claimDiscordTickets(user);

    expect(orphan.remove).toHaveBeenCalled();
    expect(orphan.save).not.toHaveBeenCalled();
    expect(mockedRefresh).toHaveBeenCalledWith('10');
  });
});
