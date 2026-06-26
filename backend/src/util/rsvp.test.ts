/// <reference types="jest" />

jest.mock('../entity/Ticket', () => ({
  Ticket: { count: jest.fn() },
}));

import { Ticket } from '../entity/Ticket';
import { getMeetupEnd, isMeetupAtCapacity } from './rsvp';

const mockedTicket = jest.mocked(Ticket);

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

    expect(await isMeetupAtCapacity(1, 5)).toBe(true);
    expect(mockedTicket.count).toHaveBeenCalledWith({
      where: { meetup: { id: 1 } },
    });
  });

  it('is false when below capacity', async () => {
    mockedTicket.count.mockResolvedValue(4);

    expect(await isMeetupAtCapacity(1, 5)).toBe(false);
  });
});
