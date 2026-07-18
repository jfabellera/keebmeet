import axios from 'axios';
import config from '../config';
import {
  type DiscordChannel,
  type DiscordServer,
} from '@keebmeet/shared';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

const botAuthHeaders = (): { Authorization: string } => ({
  Authorization: `Bot ${config.discordBotToken}`,
});

/**
 * Looks up a Discord user's handle by ID via the Discord API. Requires a bot
 * token (DISCORD_BOT_TOKEN). Returns null when unconfigured or the lookup fails
 * so callers can degrade gracefully rather than erroring the request.
 */
export const fetchDiscordUsername = async (
  discordId: string
): Promise<string | null> => {
  if (config.discordBotToken === '') {
    return null;
  }

  try {
    const response = await axios.get(
      `https://discord.com/api/users/${discordId}`,
      { headers: botAuthHeaders() }
    );

    return response.data.username ?? null;
  } catch (error: any) {
    console.error(
      'Failed to fetch Discord username:',
      error.response?.status,
      error.response?.data ?? error.message
    );
    return null;
  }
};

interface BotGuild {
  id: string;
  name: string;
  icon: string | null;
}

/**
 * Lists the guilds (servers) the bot is a member of. Requires a bot token.
 * Returns an empty array when unconfigured or the lookup fails so callers can
 * degrade gracefully rather than erroring the request.
 */
export const fetchBotGuilds = async (): Promise<BotGuild[]> => {
  if (config.discordBotToken === '') {
    return [];
  }

  try {
    const response = await axios.get(`${DISCORD_API_BASE}/users/@me/guilds`, {
      headers: botAuthHeaders(),
    });

    return response.data.map((guild: any) => ({
      id: guild.id,
      name: guild.name,
      icon: guild.icon ?? null,
    }));
  } catch (error: any) {
    console.error(
      'Failed to fetch bot guilds:',
      error.response?.status,
      error.response?.data ?? error.message
    );
    return [];
  }
};

/**
 * Checks whether a Discord user is a member of a guild the bot is in. Uses the
 * single-member "Get Guild Member" endpoint, which returns 404 for non-members.
 * Treats any error as "not a member" so a single failed lookup doesn't drop the
 * whole list.
 */
export const isGuildMember = async (
  guildId: string,
  discordId: string
): Promise<boolean> => {
  try {
    await axios.get(
      `${DISCORD_API_BASE}/guilds/${guildId}/members/${discordId}`,
      { headers: botAuthHeaders() }
    );
    return true;
  } catch (error: any) {
    if (error.response?.status !== 404) {
      console.error(
        'Failed to check Discord guild membership:',
        error.response?.status,
        error.response?.data ?? error.message
      );
    }
    return false;
  }
};

/**
 * Returns the servers the bot is in that the given Discord user is also a member
 * of (the mutual guilds). Computed with the bot token since the user's OAuth
 * token is not stored.
 */
export const fetchUserMutualServers = async (
  discordId: string
): Promise<DiscordServer[]> => {
  const botGuilds = await fetchBotGuilds();

  const memberships = await Promise.all(
    botGuilds.map(async (guild) => await isGuildMember(guild.id, discordId))
  );

  return botGuilds
    .filter((_, index) => memberships[index])
    .map((guild) => ({
      id: guild.id,
      name: guild.name,
      icon_url:
        guild.icon != null
          ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
          : null,
    }));
};

// Discord channel types we treat as postable text channels.
const GUILD_TEXT = 0;
const GUILD_ANNOUNCEMENT = 5;

// Permission bit flags (https://discord.com/developers/docs/topics/permissions).
const ZERO = BigInt(0);
const ADMINISTRATOR = BigInt(1) << BigInt(3);
const VIEW_CHANNEL = BigInt(1) << BigInt(10);
const SEND_MESSAGES = BigInt(1) << BigInt(11);

// Overwrite target types.
const OVERWRITE_ROLE = 0;
const OVERWRITE_MEMBER = 1;

interface PermissionOverwrite {
  id: string;
  type: number;
  allow: string;
  deny: string;
}

interface GuildRole {
  id: string;
  permissions: string;
}

interface GuildChannel {
  id: string;
  name: string;
  type: number;
  permission_overwrites?: PermissionOverwrite[];
}

/**
 * Computes the bot's effective permission bits in a channel by applying the
 * documented Discord algorithm: base role permissions, then the channel's
 * @everyone / role / member overwrites in order.
 * See https://discord.com/developers/docs/topics/permissions#permission-overwrites
 */
const computeChannelPermissions = (
  channel: GuildChannel,
  guildId: string,
  botUserId: string,
  memberRoleIds: string[],
  roles: GuildRole[]
): bigint => {
  const rolePermissions = new Map(
    roles.map((role) => [role.id, BigInt(role.permissions)])
  );

  // Base permissions: @everyone role (its id equals the guild id) OR'd with
  // every role the bot has.
  let permissions = rolePermissions.get(guildId) ?? ZERO;
  for (const roleId of memberRoleIds) {
    permissions |= rolePermissions.get(roleId) ?? ZERO;
  }

  // Administrator grants everything and ignores overwrites.
  if ((permissions & ADMINISTRATOR) === ADMINISTRATOR) {
    return ~ZERO;
  }

  const overwrites = channel.permission_overwrites ?? [];
  const overwriteFor = (id: string): PermissionOverwrite | undefined =>
    overwrites.find((overwrite) => overwrite.id === id);

  // @everyone channel overwrite.
  const everyone = overwriteFor(guildId);
  if (everyone != null) {
    permissions &= ~BigInt(everyone.deny);
    permissions |= BigInt(everyone.allow);
  }

  // Role overwrites are accumulated, then applied (deny before allow).
  let allow = ZERO;
  let deny = ZERO;
  for (const overwrite of overwrites) {
    if (
      overwrite.type === OVERWRITE_ROLE &&
      memberRoleIds.includes(overwrite.id)
    ) {
      allow |= BigInt(overwrite.allow);
      deny |= BigInt(overwrite.deny);
    }
  }
  permissions &= ~deny;
  permissions |= allow;

  // Member-specific overwrite takes final precedence.
  const member = overwrites.find(
    (overwrite) =>
      overwrite.type === OVERWRITE_MEMBER && overwrite.id === botUserId
  );
  if (member != null) {
    permissions &= ~BigInt(member.deny);
    permissions |= BigInt(member.allow);
  }

  return permissions;
};

/**
 * Lists the text/announcement channels of a guild that the bot can actually
 * post in (View Channel + Send Messages). Requires a bot token. Returns an
 * empty array when unconfigured or any lookup fails so callers can degrade
 * gracefully.
 */
export const fetchGuildTextChannels = async (
  guildId: string
): Promise<DiscordChannel[]> => {
  if (config.discordBotToken === '') {
    return [];
  }

  try {
    const headers = botAuthHeaders();

    // The bot's own user id is needed to resolve member-specific overwrites.
    const botUser = await axios.get(`${DISCORD_API_BASE}/users/@me`, {
      headers,
    });
    const botUserId: string = botUser.data.id;

    const [channelsRes, rolesRes, memberRes] = await Promise.all([
      axios.get(`${DISCORD_API_BASE}/guilds/${guildId}/channels`, { headers }),
      axios.get(`${DISCORD_API_BASE}/guilds/${guildId}/roles`, { headers }),
      axios.get(`${DISCORD_API_BASE}/guilds/${guildId}/members/${botUserId}`, {
        headers,
      }),
    ]);

    const roles: GuildRole[] = rolesRes.data;
    const memberRoleIds: string[] = memberRes.data.roles ?? [];

    return channelsRes.data
      .filter(
        (channel: GuildChannel) =>
          channel.type === GUILD_TEXT || channel.type === GUILD_ANNOUNCEMENT
      )
      .filter((channel: GuildChannel) => {
        const permissions = computeChannelPermissions(
          channel,
          guildId,
          botUserId,
          memberRoleIds,
          roles
        );
        return (
          (permissions & VIEW_CHANNEL) === VIEW_CHANNEL &&
          (permissions & SEND_MESSAGES) === SEND_MESSAGES
        );
      })
      .map((channel: GuildChannel) => ({
        id: channel.id,
        name: channel.name,
      }));
  } catch (error: any) {
    console.error(
      'Failed to fetch Discord guild channels:',
      error.response?.status,
      error.response?.data ?? error.message
    );
    return [];
  }
};

// Minimal subset of a Discord embed object (https://discord.com/developers/docs/resources/message#embed-object).
export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  image?: { url: string };
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string; icon_url?: string };
}

// Message components (action rows + buttons). Loosely typed — the caller builds
// the exact shape Discord expects.
export type DiscordComponent = Record<string, unknown>;

const messageBody = (
  embed: DiscordEmbed,
  components?: DiscordComponent[]
): Record<string, unknown> =>
  components != null
    ? { embeds: [embed], components }
    : { embeds: [embed] };

/**
 * Posts an embed (and optional components) to a channel and returns the new
 * message id. Throws on failure (unlike the read helpers) so the caller can
 * surface a real error, e.g. when the bot lacks permission to post.
 */
export const createEmbedMessage = async (
  channelId: string,
  embed: DiscordEmbed,
  components?: DiscordComponent[]
): Promise<string> => {
  const response = await axios.post(
    `${DISCORD_API_BASE}/channels/${channelId}/messages`,
    messageBody(embed, components),
    { headers: botAuthHeaders() }
  );

  return response.data.id;
};

/**
 * Replaces the embed (and components) of an existing message. Throws on failure.
 */
export const editEmbedMessage = async (
  channelId: string,
  messageId: string,
  embed: DiscordEmbed,
  components?: DiscordComponent[]
): Promise<void> => {
  await axios.patch(
    `${DISCORD_API_BASE}/channels/${channelId}/messages/${messageId}`,
    messageBody(embed, components),
    { headers: botAuthHeaders() }
  );
};

/**
 * Deletes a message. A 404 is treated as success (already gone); any other
 * failure throws.
 */
export const deleteEmbedMessage = async (
  channelId: string,
  messageId: string
): Promise<void> => {
  try {
    await axios.delete(
      `${DISCORD_API_BASE}/channels/${channelId}/messages/${messageId}`,
      { headers: botAuthHeaders() }
    );
  } catch (error: any) {
    if (error.response?.status === 404) {
      return;
    }
    throw error;
  }
};
