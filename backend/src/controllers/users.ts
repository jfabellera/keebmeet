import { type Request, type Response } from 'express';
import { User } from '../entity/User';
import { type User as UserInterface } from '../interfaces/userInterfaces';

export const getAllUsers = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const users = await User.find();

  const response: UserInterface[] = users.map((user): UserInterface => {
    return {
      id: user.id,
      display_name: user.nick_name,
      first_name: user.first_name,
      last_name: user.last_name,
      is_admin: user.is_admin,
      is_organizer: user.is_organizer,
      is_eventbrite_linked: user.encrypted_eventbrite_token != null,
    } satisfies UserInterface;
  });

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

  const response: UserInterface = {
    id: user.id,
    display_name: user.nick_name,
    first_name: user.first_name,
    last_name: user.last_name,
    is_admin: user.is_admin,
    is_organizer: user.is_organizer,
    is_eventbrite_linked: user.encrypted_eventbrite_token != null,
  };

  return res.json(response);
};
