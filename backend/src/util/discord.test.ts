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
  createEmbedMessage,
  deleteEmbedMessage,
  editEmbedMessage,
  fetchBotGuilds,
  fetchDiscordUsername,
  fetchGuildTextChannels,
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

describe('fetchGuildTextChannels', () => {
  const GUILD_ID = 'g1';
  const BOT_ID = 'bot-1';
  // 1024 (VIEW_CHANNEL) | 2048 (SEND_MESSAGES).
  const VIEW_AND_SEND = '3072';

  // Wires axios.get to respond per Discord endpoint. `channels` and the
  // @everyone `everyonePermissions` / `botRoleIds` / `roles` are configurable.
  const mockGuild = (options: {
    channels: any[];
    everyonePermissions?: string;
    botRoleIds?: string[];
    extraRoles?: Array<{ id: string; permissions: string }>;
  }): void => {
    const roles = [
      { id: GUILD_ID, permissions: options.everyonePermissions ?? VIEW_AND_SEND },
      ...(options.extraRoles ?? []),
    ];
    mockedAxios.get.mockImplementation(async (url: string) => {
      if (url.endsWith('/users/@me')) {
        return { data: { id: BOT_ID } };
      }
      if (url.endsWith(`/guilds/${GUILD_ID}/channels`)) {
        return { data: options.channels };
      }
      if (url.endsWith(`/guilds/${GUILD_ID}/roles`)) {
        return { data: roles };
      }
      if (url.endsWith(`/guilds/${GUILD_ID}/members/${BOT_ID}`)) {
        return { data: { roles: options.botRoleIds ?? [] } };
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
  };

  it('returns an empty array without calling Discord when no bot token is configured', async () => {
    config.discordBotToken = '';

    const result = await fetchGuildTextChannels(GUILD_ID);

    expect(result).toEqual([]);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('keeps only text and announcement channels the bot can post in', async () => {
    mockGuild({
      channels: [
        { id: '1', name: 'general', type: 0 },
        { id: '2', name: 'Voice', type: 2 },
        { id: '3', name: 'Category', type: 4 },
        { id: '4', name: 'news', type: 5 },
      ],
    });

    const result = await fetchGuildTextChannels(GUILD_ID);

    expect(result).toEqual([
      { id: '1', name: 'general' },
      { id: '4', name: 'news' },
    ]);
  });

  it('excludes channels where an overwrite denies the bot access', async () => {
    mockGuild({
      channels: [
        { id: '1', name: 'open', type: 0 },
        {
          id: '2',
          name: 'locked',
          type: 0,
          // @everyone overwrite denies SEND_MESSAGES (2048) in this channel.
          permission_overwrites: [
            { id: GUILD_ID, type: 0, allow: '0', deny: '2048' },
          ],
        },
      ],
    });

    const result = await fetchGuildTextChannels(GUILD_ID);

    expect(result).toEqual([{ id: '1', name: 'open' }]);
  });

  it('includes a channel re-allowed by a bot role overwrite', async () => {
    mockGuild({
      // @everyone has no permissions by default; the bot's role grants them.
      everyonePermissions: '0',
      botRoleIds: ['role-1'],
      extraRoles: [{ id: 'role-1', permissions: '0' }],
      channels: [
        {
          id: '1',
          name: 'staff',
          type: 0,
          permission_overwrites: [
            { id: GUILD_ID, type: 0, allow: '0', deny: '3072' },
            { id: 'role-1', type: 0, allow: '3072', deny: '0' },
          ],
        },
      ],
    });

    const result = await fetchGuildTextChannels(GUILD_ID);

    expect(result).toEqual([{ id: '1', name: 'staff' }]);
  });

  it('treats an administrator bot as able to post everywhere', async () => {
    mockGuild({
      everyonePermissions: '8', // ADMINISTRATOR
      channels: [
        {
          id: '1',
          name: 'locked',
          type: 0,
          permission_overwrites: [
            { id: GUILD_ID, type: 0, allow: '0', deny: '3072' },
          ],
        },
      ],
    });

    const result = await fetchGuildTextChannels(GUILD_ID);

    expect(result).toEqual([{ id: '1', name: 'locked' }]);
  });

  it('returns an empty array when a lookup fails', async () => {
    mockedAxios.get.mockRejectedValue(new Error('500'));

    const result = await fetchGuildTextChannels(GUILD_ID);

    expect(result).toEqual([]);
  });
});

describe('createEmbedMessage', () => {
  it('posts the embed and returns the new message id', async () => {
    mockedAxios.post.mockResolvedValue({ data: { id: 'msg-1' } });

    const result = await createEmbedMessage('channel-1', { title: 'Hi' });

    expect(result).toBe('msg-1');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://discord.com/api/v10/channels/channel-1/messages',
      { embeds: [{ title: 'Hi' }] },
      { headers: { Authorization: 'Bot bot-token' } }
    );
  });

  it('includes components in the body when provided', async () => {
    mockedAxios.post.mockResolvedValue({ data: { id: 'msg-1' } });
    const components = [{ type: 1, components: [] }];

    await createEmbedMessage('channel-1', { title: 'Hi' }, components);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://discord.com/api/v10/channels/channel-1/messages',
      { embeds: [{ title: 'Hi' }], components },
      { headers: { Authorization: 'Bot bot-token' } }
    );
  });

  it('throws when Discord rejects the request', async () => {
    mockedAxios.post.mockRejectedValue(new Error('403'));

    await expect(
      createEmbedMessage('channel-1', { title: 'Hi' })
    ).rejects.toThrow('403');
  });
});

describe('editEmbedMessage', () => {
  it('patches the message embed', async () => {
    mockedAxios.patch.mockResolvedValue({ data: {} });

    await editEmbedMessage('channel-1', 'msg-1', { title: 'Updated' });

    expect(mockedAxios.patch).toHaveBeenCalledWith(
      'https://discord.com/api/v10/channels/channel-1/messages/msg-1',
      { embeds: [{ title: 'Updated' }] },
      { headers: { Authorization: 'Bot bot-token' } }
    );
  });

  it('includes components in the body when provided', async () => {
    mockedAxios.patch.mockResolvedValue({ data: {} });
    const components = [{ type: 1, components: [] }];

    await editEmbedMessage('channel-1', 'msg-1', { title: 'Updated' }, components);

    expect(mockedAxios.patch).toHaveBeenCalledWith(
      'https://discord.com/api/v10/channels/channel-1/messages/msg-1',
      { embeds: [{ title: 'Updated' }], components },
      { headers: { Authorization: 'Bot bot-token' } }
    );
  });

  it('throws when Discord rejects the request', async () => {
    mockedAxios.patch.mockRejectedValue(new Error('403'));

    await expect(
      editEmbedMessage('channel-1', 'msg-1', { title: 'Updated' })
    ).rejects.toThrow('403');
  });
});

describe('deleteEmbedMessage', () => {
  it('deletes the message', async () => {
    mockedAxios.delete.mockResolvedValue({ data: {} });

    await deleteEmbedMessage('channel-1', 'msg-1');

    expect(mockedAxios.delete).toHaveBeenCalledWith(
      'https://discord.com/api/v10/channels/channel-1/messages/msg-1',
      { headers: { Authorization: 'Bot bot-token' } }
    );
  });

  it('treats a 404 as success', async () => {
    mockedAxios.delete.mockRejectedValue(notFound());

    await expect(
      deleteEmbedMessage('channel-1', 'msg-1')
    ).resolves.toBeUndefined();
  });

  it('throws on any other failure', async () => {
    mockedAxios.delete.mockRejectedValue(new Error('500'));

    await expect(deleteEmbedMessage('channel-1', 'msg-1')).rejects.toThrow(
      '500'
    );
  });
});
