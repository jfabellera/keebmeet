import {
  type Organizer as OrganizerInterface,
  type User as UserInterface,
} from '@keebmeet/shared';
import { type Request, type Response } from 'express';
import { OrganizerRequest } from '../entity/OrganizerRequest';
import { User } from '../entity/User';
import { fetchDiscordUsername } from '../util/discord';
import {
  IMAGE_EXT_BY_MIME,
  buildTempImageKey,
  publicUrl,
  upload,
} from '../util/objectStorage';
import { toUserResponse } from '../util/userResponse';

/**
 * Accepts a single multipart image file, stores it in R2 under the users temp
 * prefix, and returns the object key + URL. Unauthenticated (registration has
 * no token yet); the key is promoted to permanent only when a user referencing
 * it is saved, and abandoned temp uploads are reaped by the R2 lifecycle rule.
 */
export const uploadUserImage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const file = req.file;

  if (file == null) {
    return res.status(400).json({ message: 'No image file provided.' });
  }

  const ext = IMAGE_EXT_BY_MIME[file.mimetype];
  if (ext === undefined) {
    return res
      .status(400)
      .json({ message: 'Unsupported image type. Use PNG, JPEG, or WebP.' });
  }

  const key = buildTempImageKey('users', ext);
  await upload(key, file.buffer, file.mimetype);

  return res.status(201).json({ image_key: key, image_url: publicUrl(key) });
};

export const getAllUsers = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const users = await User.find();

  const response: UserInterface[] = users.map(toUserResponse);

  return res.json(response);
};

export const getOrganizers = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const organizers = await User.findBy({
    is_organizer: true,
  });

  const response: OrganizerInterface[] = organizers.map(
    (user) =>
      ({
        id: user.id,
        display_name: user.nick_name,
        photo_url: publicUrl(user.photo_key ?? ''),
      }) satisfies OrganizerInterface
  );

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

  // Surface whether the user has a pending organizer request so the account
  // page can reflect the right state.
  response.has_organizer_request =
    (await OrganizerRequest.findOne({ where: { user: { id: user.id } } })) !=
    null;

  return res.json(response);
};
