import { type Request, type Response } from 'express';
import { User } from '../entity/User';
import { type DiscordServer } from '../interfaces/userInterfaces';
import { fetchUserMutualServers } from '../util/discord';

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
