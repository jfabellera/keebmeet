import { type Request, type Response } from 'express';
import { User } from '../entity/User';
import { type User as UserInterface } from '../interfaces/userInterfaces';
import { fetchDiscordUsername } from '../util/discord';
import { toUserResponse } from '../util/userResponse';

export const getAllUsers = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const users = await User.find();

  const response: UserInterface[] = users.map(toUserResponse);

  return res.json(response);
};

export const getUser = async (
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

  const response: UserInterface = toUserResponse(user);

  // Resolve the current Discord handle from the Discord API (not stored).
  if (user.discord_id != null) {
    response.discord_username = await fetchDiscordUsername(user.discord_id);
  }

  return res.json(response);
};
