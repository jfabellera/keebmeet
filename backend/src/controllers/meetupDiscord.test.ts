/// <reference types="jest" />
import { type Request, type Response } from 'express';

// ---- Mocks -----------------------------------------------------------------

jest.mock('../config', () => ({
  __esModule: true,
  default: { webUrl: 'http://web' },
}));

jest.mock('../entity/Meetup', () => ({
  Meetup: {
    findOne: jest.fn(),
  },
}));

jest.mock('../entity/MeetupDiscordMessage', () => ({
  MeetupDiscordMessage: {
    create: jest.fn(),
  },
}));

jest.mock('../util/discord', () => ({
  createEmbedMessage: jest.fn(),
  editEmbedMessage: jest.fn(),
  deleteEmbedMessage: jest.fn(),
  isGuildMember: jest.fn(),
}));

jest.mock('../util/meetupDiscordMessage', () => ({
  buildMeetupEmbed: jest.fn(() => ({ embed: true })),
  getMeetupAttendeeDisplayNames: jest.fn(async () => []),
}));

import {
  createMeetupDiscordMessage,
  deleteMeetupDiscordMessage,
  getMeetupDiscordMessage,
  updateMeetupDiscordMessage,
} from './meetupDiscord';
import { Meetup } from '../entity/Meetup';
import { MeetupDiscordMessage } from '../entity/MeetupDiscordMessage';
import {
  createEmbedMessage,
  deleteEmbedMessage,
  editEmbedMessage,
  isGuildMember,
} from '../util/discord';
import {
  buildMeetupEmbed,
  getMeetupAttendeeDisplayNames,
} from '../util/meetupDiscordMessage';

const mockedMeetup = jest.mocked(Meetup);
const mockedMessage = jest.mocked(MeetupDiscordMessage);
const mockedCreateEmbed = jest.mocked(createEmbedMessage);
const mockedEditEmbed = jest.mocked(editEmbedMessage);
const mockedDeleteEmbed = jest.mocked(deleteEmbedMessage);
const mockedIsGuildMember = jest.mocked(isGuildMember);
const mockedBuildEmbed = jest.mocked(buildMeetupEmbed);
const mockedGetAttendeeNames = jest.mocked(getMeetupAttendeeDisplayNames);

// ---- Helpers ---------------------------------------------------------------

type MockResponse = Response & { statusCode?: number; body?: unknown };

const mockResponse = (requestor: unknown = { discord_id: '123' }): MockResponse => {
  const res: any = {};
  res.status = jest.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn().mockImplementation((body: unknown) => {
    res.body = body;
    return res;
  });
  res.send = jest.fn().mockImplementation(() => res);
  res.locals = { requestor };
  return res as MockResponse;
};

const mockRequest = (
  params: Record<string, string> = {},
  body: unknown = {}
): Request => ({ params, body }) as unknown as Request;

const fakeMeetup = (overrides: Record<string, unknown> = {}): any => ({
  id: 1,
  name: 'Meetup',
  description: 'desc',
  date: '2026-07-01T00:00:00Z',
  address: '123 St',
  image_url: 'http://img',
  discordMessage: null,
  ...overrides,
});

const fakeMessage = (): any => ({
  guild_id: 'g1',
  channel_id: 'c1',
  message_id: 'm1',
  remove: jest.fn().mockResolvedValue(undefined),
});

const validBody = { server_id: 'g1', channel_id: 'c1' };

beforeEach(() => {
  jest.clearAllMocks();
});

// ---- getMeetupDiscordMessage -----------------------------------------------

describe('getMeetupDiscordMessage', () => {
  it('returns 404 when the meetup does not exist', async () => {
    mockedMeetup.findOne.mockResolvedValue(null);
    const res = mockResponse();

    await getMeetupDiscordMessage(mockRequest({ meetup_id: '99' }), res);

    expect(res.statusCode).toBe(404);
  });

  it('returns null when the meetup has no message', async () => {
    mockedMeetup.findOne.mockResolvedValue(fakeMeetup());
    const res = mockResponse();

    await getMeetupDiscordMessage(mockRequest({ meetup_id: '1' }), res);

    expect(res.body).toBeNull();
  });

  it('returns the tracked message when present', async () => {
    const message = fakeMessage();
    mockedMeetup.findOne.mockResolvedValue(fakeMeetup({ discordMessage: message }));
    const res = mockResponse();

    await getMeetupDiscordMessage(mockRequest({ meetup_id: '1' }), res);

    expect(res.body).toBe(message);
  });
});

// ---- createMeetupDiscordMessage --------------------------------------------

describe('createMeetupDiscordMessage', () => {
  it('returns 400 on an invalid body', async () => {
    const res = mockResponse();

    await createMeetupDiscordMessage(mockRequest({ meetup_id: '1' }, {}), res);

    expect(res.statusCode).toBe(400);
    expect(mockedMeetup.findOne).not.toHaveBeenCalled();
  });

  it('returns 404 when the meetup does not exist', async () => {
    mockedMeetup.findOne.mockResolvedValue(null);
    const res = mockResponse();

    await createMeetupDiscordMessage(
      mockRequest({ meetup_id: '99' }, validBody),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('returns 409 when a message already exists', async () => {
    mockedMeetup.findOne.mockResolvedValue(
      fakeMeetup({ discordMessage: fakeMessage() })
    );
    const res = mockResponse();

    await createMeetupDiscordMessage(
      mockRequest({ meetup_id: '1' }, validBody),
      res
    );

    expect(res.statusCode).toBe(409);
    expect(mockedCreateEmbed).not.toHaveBeenCalled();
  });

  it('returns 409 when the requestor has no Discord linked', async () => {
    mockedMeetup.findOne.mockResolvedValue(fakeMeetup());
    const res = mockResponse({ discord_id: null });

    await createMeetupDiscordMessage(
      mockRequest({ meetup_id: '1' }, validBody),
      res
    );

    expect(res.statusCode).toBe(409);
    expect(mockedIsGuildMember).not.toHaveBeenCalled();
  });

  it('returns 403 when the requestor is not a member of the server', async () => {
    mockedMeetup.findOne.mockResolvedValue(fakeMeetup());
    mockedIsGuildMember.mockResolvedValue(false);
    const res = mockResponse();

    await createMeetupDiscordMessage(
      mockRequest({ meetup_id: '1' }, validBody),
      res
    );

    expect(mockedIsGuildMember).toHaveBeenCalledWith('g1', '123');
    expect(res.statusCode).toBe(403);
    expect(mockedCreateEmbed).not.toHaveBeenCalled();
  });

  it('returns 502 when posting to Discord fails', async () => {
    mockedMeetup.findOne.mockResolvedValue(fakeMeetup());
    mockedIsGuildMember.mockResolvedValue(true);
    mockedCreateEmbed.mockRejectedValue(new Error('403'));
    const res = mockResponse();

    await createMeetupDiscordMessage(
      mockRequest({ meetup_id: '1' }, validBody),
      res
    );

    expect(res.statusCode).toBe(502);
    expect(mockedMessage.create).not.toHaveBeenCalled();
  });

  it('creates the message and persists the record on success', async () => {
    mockedMeetup.findOne.mockResolvedValue(fakeMeetup());
    mockedIsGuildMember.mockResolvedValue(true);
    mockedCreateEmbed.mockResolvedValue('msg-1');
    const saved = {
      guild_id: 'g1',
      channel_id: 'c1',
      message_id: 'msg-1',
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockedMessage.create.mockReturnValue(saved as any);
    const res = mockResponse();

    await createMeetupDiscordMessage(
      mockRequest({ meetup_id: '1' }, validBody),
      res
    );

    expect(mockedGetAttendeeNames).toHaveBeenCalledWith(1);
    expect(mockedBuildEmbed).toHaveBeenCalled();
    expect(mockedCreateEmbed).toHaveBeenCalledWith('c1', { embed: true });
    expect(saved.save).toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      guild_id: 'g1',
      channel_id: 'c1',
      message_id: 'msg-1',
    });
  });
});

// ---- updateMeetupDiscordMessage --------------------------------------------

describe('updateMeetupDiscordMessage', () => {
  it('returns 404 when the meetup has no message', async () => {
    mockedMeetup.findOne.mockResolvedValue(fakeMeetup());
    const res = mockResponse();

    await updateMeetupDiscordMessage(mockRequest({ meetup_id: '1' }), res);

    expect(res.statusCode).toBe(404);
    expect(mockedEditEmbed).not.toHaveBeenCalled();
  });

  it('returns 502 when editing on Discord fails', async () => {
    mockedMeetup.findOne.mockResolvedValue(
      fakeMeetup({ discordMessage: fakeMessage() })
    );
    mockedEditEmbed.mockRejectedValue(new Error('403'));
    const res = mockResponse();

    await updateMeetupDiscordMessage(mockRequest({ meetup_id: '1' }), res);

    expect(res.statusCode).toBe(502);
  });

  it('edits the embed and returns the record on success', async () => {
    mockedMeetup.findOne.mockResolvedValue(
      fakeMeetup({ discordMessage: fakeMessage() })
    );
    mockedEditEmbed.mockResolvedValue(undefined);
    const res = mockResponse();

    await updateMeetupDiscordMessage(mockRequest({ meetup_id: '1' }), res);

    expect(mockedGetAttendeeNames).toHaveBeenCalledWith(1);
    expect(mockedEditEmbed).toHaveBeenCalledWith('c1', 'm1', { embed: true });
    expect(res.body).toEqual({
      guild_id: 'g1',
      channel_id: 'c1',
      message_id: 'm1',
    });
  });
});

// ---- deleteMeetupDiscordMessage --------------------------------------------

describe('deleteMeetupDiscordMessage', () => {
  it('returns 404 when the meetup has no message', async () => {
    mockedMeetup.findOne.mockResolvedValue(fakeMeetup());
    const res = mockResponse();

    await deleteMeetupDiscordMessage(mockRequest({ meetup_id: '1' }), res);

    expect(res.statusCode).toBe(404);
    expect(mockedDeleteEmbed).not.toHaveBeenCalled();
  });

  it('returns 502 when deleting on Discord fails', async () => {
    mockedMeetup.findOne.mockResolvedValue(
      fakeMeetup({ discordMessage: fakeMessage() })
    );
    mockedDeleteEmbed.mockRejectedValue(new Error('500'));
    const res = mockResponse();

    await deleteMeetupDiscordMessage(mockRequest({ meetup_id: '1' }), res);

    expect(res.statusCode).toBe(502);
  });

  it('deletes the message and removes the record on success', async () => {
    const message = fakeMessage();
    mockedMeetup.findOne.mockResolvedValue(
      fakeMeetup({ discordMessage: message })
    );
    mockedDeleteEmbed.mockResolvedValue(undefined);
    const res = mockResponse();

    await deleteMeetupDiscordMessage(mockRequest({ meetup_id: '1' }), res);

    expect(mockedDeleteEmbed).toHaveBeenCalledWith('c1', 'm1');
    expect(message.remove).toHaveBeenCalled();
    expect(res.statusCode).toBe(204);
  });
});
