import axios from 'axios';
import config from '../config';

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
      { headers: { Authorization: `Bot ${config.discordBotToken}` } }
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
