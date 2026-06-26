import axios from 'axios';
import config from '../config';
import { type DiscordServer } from '../interfaces/userInterfaces';

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
const isGuildMember = async (
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
