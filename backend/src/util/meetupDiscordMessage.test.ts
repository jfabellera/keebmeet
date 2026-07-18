/// <reference types="jest" />

// ---- Mocks -----------------------------------------------------------------

jest.mock('../config', () => ({
  __esModule: true,
  default: { webUrl: 'http://web' },
}));

jest.mock('../entity/Meetup', () => ({
  Meetup: { findOne: jest.fn() },
}));

jest.mock('../entity/Ticket', () => ({
  Ticket: { find: jest.fn() },
}));

jest.mock('./discord', () => ({
  editEmbedMessage: jest.fn(),
}));

import {
  buildMeetupComponents,
  buildMeetupEmbed,
  getMeetupAttendeeDisplayNames,
  refreshMeetupDiscordMessage,
} from './meetupDiscordMessage';
import { Meetup } from '../entity/Meetup';
import { Ticket } from '../entity/Ticket';
import { editEmbedMessage } from './discord';

const mockedMeetup = jest.mocked(Meetup);
const mockedTicket = jest.mocked(Ticket);
const mockedEditEmbed = jest.mocked(editEmbedMessage);

const fakeMeetup = (overrides: Record<string, unknown> = {}): any => ({
  id: '1',
  slug: 'my-meetup',
  name: 'Meetup',
  description: 'desc',
  date: '2026-07-01T00:00:00Z',
  address: '123 St',
  image_key: 'http://img',
  capacity: 100,
  lead_organizer: { id: '10', username: 'ada', nick_name: 'Ada' },
  organizers: [],
  discordMessage: null,
  ...overrides,
});

const attendeesField = (embed: any): any =>
  embed.fields.find((field: any) => field.name.startsWith('Attendees'));

const fieldNamed = (embed: any, name: string): any =>
  embed.fields.find((field: any) => field.name === name);

beforeEach(() => {
  jest.clearAllMocks();
});

// ---- getMeetupAttendeeDisplayNames -----------------------------------------

describe('getMeetupAttendeeDisplayNames', () => {
  it('returns non-empty display names in RSVP order', async () => {
    mockedTicket.find.mockResolvedValue([
      { ticket_holder_display_name: 'Alice' },
      { ticket_holder_display_name: '' },
      { ticket_holder_display_name: 'Bob' },
    ] as any);

    const result = await getMeetupAttendeeDisplayNames('1');

    expect(result).toEqual(['Alice', 'Bob']);
    expect(mockedTicket.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { meetup: { id: '1' } },
        order: { created_at: 'ASC' },
      })
    );
  });
});

// ---- buildMeetupEmbed ------------------------------------------------------

describe('buildMeetupEmbed', () => {
  it('includes an attendees field with the count and names', () => {
    const embed = buildMeetupEmbed(fakeMeetup(), ['Alice', 'Bob']);
    const field = attendeesField(embed);

    expect(field.name).toBe('Attendees (2/100)');
    expect(field.value).toBe('Alice\nBob');
  });

  it('credits a single organizer in the footer', () => {
    const embed = buildMeetupEmbed(fakeMeetup(), []);

    expect(embed.footer?.text).toBe('Organized by Ada');
  });

  it('credits multiple organizers with lead first, deduped', () => {
    const embed = buildMeetupEmbed(
      fakeMeetup({
        lead_organizer: { id: '10', username: 'ada', nick_name: 'Ada' },
        organizers: [
          { id: '10', username: 'ada', nick_name: 'Ada' },
          { id: '11', username: 'grace', nick_name: 'Grace' },
        ],
      }),
      []
    );

    expect(embed.footer?.text).toBe('Organized by Ada and Grace');
  });

  it('links the location to a Google Maps search', () => {
    const embed = buildMeetupEmbed(fakeMeetup({ address: '123 St' }), []);
    const field = fieldNamed(embed, 'Location');

    expect(field.value).toBe(
      '[123 St](https://www.google.com/maps/search/?api=1&query=123%20St)'
    );
  });

  it('shows a placeholder when there are no attendees', () => {
    const embed = buildMeetupEmbed(fakeMeetup(), []);
    const field = attendeesField(embed);

    expect(field.name).toBe('Attendees (0/100)');
    expect(field.value).toBe('No attendees yet.');
  });

  it('truncates a long list with "…and N more" and stays within 1024 chars', () => {
    // 200 names of 20 chars each (~4000 chars) far exceeds the 1024 limit.
    const names = Array.from({ length: 200 }, (_, i) =>
      `attendee-${String(i).padStart(10, '0')}`
    );

    const embed = buildMeetupEmbed(fakeMeetup(), names);
    const field = attendeesField(embed);

    expect(field.name).toBe('Attendees (200/100)');
    expect(field.value.length).toBeLessThanOrEqual(1024);
    expect(field.value).toMatch(/…and \d+ more$/);
    // The first name is listed; a later one is dropped into the overflow.
    expect(field.value).toContain(names[0]);
    expect(field.value).not.toContain(names[199]);
  });
});

// ---- buildMeetupComponents -------------------------------------------------

describe('buildMeetupComponents', () => {
  const button = (components: any): any => components[0].components[0];

  it('uses an interactive RSVP button when RSVPs are allowed', () => {
    const components = buildMeetupComponents(fakeMeetup({ id: '42' }), true);

    expect(button(components)).toEqual(
      expect.objectContaining({ label: 'RSVP', custom_id: 'rsvp:42' })
    );
    expect(button(components)).not.toHaveProperty('url');
  });

  it('adds a View on KeebMeet link button when RSVPs are allowed', () => {
    const components = buildMeetupComponents(
      fakeMeetup({ slug: 'my-meetup' }),
      true
    );

    expect((components[0] as any).components[1]).toEqual(
      expect.objectContaining({
        label: 'View on KeebMeet',
        url: 'http://web/meetup/my-meetup',
      })
    );
  });

  it('uses a link to the meetup page when RSVPs are not allowed', () => {
    const components = buildMeetupComponents(
      fakeMeetup({ slug: 'my-meetup' }),
      false
    );

    expect(button(components)).toEqual(
      expect.objectContaining({ url: 'http://web/meetup/my-meetup' })
    );
    expect(button(components)).not.toHaveProperty('custom_id');
  });
});

// ---- refreshMeetupDiscordMessage -------------------------------------------

describe('refreshMeetupDiscordMessage', () => {
  it('is a no-op when the meetup has no tracked message', async () => {
    mockedMeetup.findOne.mockResolvedValue(fakeMeetup({ discordMessage: null }));

    await refreshMeetupDiscordMessage('1');

    expect(mockedEditEmbed).not.toHaveBeenCalled();
    expect(mockedTicket.find).not.toHaveBeenCalled();
  });

  it('is a no-op when the meetup does not exist', async () => {
    mockedMeetup.findOne.mockResolvedValue(null);

    await refreshMeetupDiscordMessage('1');

    expect(mockedEditEmbed).not.toHaveBeenCalled();
  });

  it('edits the tracked message with the rebuilt embed', async () => {
    mockedMeetup.findOne.mockResolvedValue(
      fakeMeetup({
        discordMessage: { channel_id: 'c1', message_id: 'm1' },
      })
    );
    mockedTicket.find.mockResolvedValue([
      { ticket_holder_display_name: 'Alice' },
    ] as any);

    await refreshMeetupDiscordMessage('1');

    expect(mockedEditEmbed).toHaveBeenCalledTimes(1);
    const [channelId, messageId, embed] = mockedEditEmbed.mock.calls[0];
    expect(channelId).toBe('c1');
    expect(messageId).toBe('m1');
    expect(attendeesField(embed).value).toBe('Alice');
  });

  it('does not throw when editing the message fails', async () => {
    mockedMeetup.findOne.mockResolvedValue(
      fakeMeetup({
        discordMessage: { channel_id: 'c1', message_id: 'm1' },
      })
    );
    mockedTicket.find.mockResolvedValue([]);
    mockedEditEmbed.mockRejectedValue(new Error('500'));

    await expect(refreshMeetupDiscordMessage('1')).resolves.toBeUndefined();
  });
});
