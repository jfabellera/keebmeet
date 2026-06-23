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
import { fetchDiscordUsername } from './discord';

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
