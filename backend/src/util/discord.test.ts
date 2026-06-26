/// <reference types="jest" />
jest.mock('../config', () => ({
  __esModule: true,
  default: {
    discordBotToken: 'bot-token',
  },
}));

jest.mock('axios');

import axios from 'axios';
import config from '../config';
import {
  fetchBotGuilds,
  fetchDiscordUsername,
  fetchUserMutualServers,
} from './discord';

const notFound = (): Error => {
  const error: any = new Error('Not found');
  error.response = { status: 404 };
  return error;
};

const mockedAxios = jest.mocked(axios);

beforeEach(() => {
  jest.clearAllMocks();
  // Restore a configured bot token before each test.
  config.discordBotToken = 'bot-token';
});

describe('fetchDiscordUsername', () => {
  it('returns null without calling Discord when no bot token is configured', async () => {
    config.discordBotToken = '';

    const result = await fetchDiscordUsername('123');

    expect(result).toBeNull();
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('returns the username on a successful lookup', async () => {
    mockedAxios.get.mockResolvedValue({ data: { username: 'janediscord' } });

    const result = await fetchDiscordUsername('123');

    expect(result).toBe('janediscord');
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://discord.com/api/users/123',
      { headers: { Authorization: 'Bot bot-token' } }
    );
  });

  it('returns null when the lookup fails', async () => {
    mockedAxios.get.mockRejectedValue(new Error('429'));

    const result = await fetchDiscordUsername('123');

    expect(result).toBeNull();
  });

  it('returns null when the response has no username', async () => {
    mockedAxios.get.mockResolvedValue({ data: {} });

    const result = await fetchDiscordUsername('123');

    expect(result).toBeNull();
  });
});

describe('fetchBotGuilds', () => {
  it('returns an empty array without calling Discord when no bot token is configured', async () => {
    config.discordBotToken = '';

    const result = await fetchBotGuilds();

    expect(result).toEqual([]);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('maps the bot guilds and uses a versioned endpoint', async () => {
    mockedAxios.get.mockResolvedValue({
      data: [
        { id: 'A', name: 'Server A', icon: 'abc' },
        { id: 'B', name: 'Server B' },
      ],
    });

    const result = await fetchBotGuilds();

    expect(result).toEqual([
      { id: 'A', name: 'Server A', icon: 'abc' },
      { id: 'B', name: 'Server B', icon: null },
    ]);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://discord.com/api/v10/users/@me/guilds',
      { headers: { Authorization: 'Bot bot-token' } }
    );
  });

  it('returns an empty array when the lookup fails', async () => {
    mockedAxios.get.mockRejectedValue(new Error('429'));

    const result = await fetchBotGuilds();

    expect(result).toEqual([]);
  });
});

describe('fetchUserMutualServers', () => {
  it('returns an empty array when the bot is in no guilds', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] });

    const result = await fetchUserMutualServers('discord-1');

    expect(result).toEqual([]);
  });

  it('returns only the guilds the user is a member of, with icon urls', async () => {
    mockedAxios.get.mockImplementation(async (url: string) => {
      if (url.endsWith('/users/@me/guilds')) {
        return {
          data: [
            { id: 'A', name: 'Server A', icon: 'abc' },
            { id: 'B', name: 'Server B', icon: null },
            { id: 'C', name: 'Server C', icon: 'xyz' },
          ],
        };
      }
      // Membership checks: the user is in A and B, but not C (404).
      if (url.includes('/guilds/C/members/')) {
        throw notFound();
      }
      return { data: { user: { id: 'discord-1' } } };
    });

    const result = await fetchUserMutualServers('discord-1');

    expect(result).toEqual([
      {
        id: 'A',
        name: 'Server A',
        icon_url: 'https://cdn.discordapp.com/icons/A/abc.png',
      },
      { id: 'B', name: 'Server B', icon_url: null },
    ]);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://discord.com/api/v10/guilds/A/members/discord-1',
      { headers: { Authorization: 'Bot bot-token' } }
    );
  });

  it('excludes a guild when its membership check errors', async () => {
    mockedAxios.get.mockImplementation(async (url: string) => {
      if (url.endsWith('/users/@me/guilds')) {
        return { data: [{ id: 'A', name: 'Server A', icon: null }] };
      }
      throw new Error('500');
    });

    const result = await fetchUserMutualServers('discord-1');

    expect(result).toEqual([]);
  });

  it('returns an empty array when no bot token is configured', async () => {
    config.discordBotToken = '';

    const result = await fetchUserMutualServers('discord-1');

    expect(result).toEqual([]);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });
});
