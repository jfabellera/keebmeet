import { type Request, type Response } from 'express';
import { User } from '../entity/User';
import {
  type DiscordChannel,
  type DiscordServer,
} from '../interfaces/userInterfaces';
import {
  fetchGuildTextChannels,
  fetchUserMutualServers,
  isGuildMember,
} from '../util/discord';

export const getUserDiscordServers = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { user_id } = req.params as Record<string, string>;

  const user = await User.findOneBy({
    id: parseInt(user_id),
  });

  if (user == null) {
    return res.status(404).json({ message: 'Invalid user ID.' });
  }

  if (user.discord_id == null) {
    return res
      .status(409)
      .json({ message: 'User has not linked a Discord account.' });
  }

  const servers: DiscordServer[] = await fetchUserMutualServers(
    user.discord_id
  );

  return res.json(servers);
};

export const getUserDiscordServerChannels = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { user_id, server_id } = req.params as Record<string, string>;

  const user = await User.findOneBy({
    id: parseInt(user_id),
  });

  if (user == null) {
    return res.status(404).json({ message: 'Invalid user ID.' });
  }

  if (user.discord_id == null) {
    return res
      .status(409)
      .json({ message: 'User has not linked a Discord account.' });
  }

  // Only allow listing channels of a server the user actually shares with the
  // bot, so a user can't enumerate channels of arbitrary bot guilds.
  if (!(await isGuildMember(server_id, user.discord_id))) {
    return res
      .status(403)
      .json({ message: 'User is not a member of this server.' });
  }

  const channels: DiscordChannel[] = await fetchGuildTextChannels(server_id);

  return res.json(channels);
};
