import {
  type Organizer as OrganizerInterface,
  type PublicUser as PublicUserInterface,
  type User as UserInterface,
  USERNAME_REGEX,
} from '@keebmeet/shared';
import { type Request, type Response } from 'express';
import { ILike } from 'typeorm';
import { GalleryRecord } from '../entity/GalleryRecord';
import { OrganizerRequest } from '../entity/OrganizerRequest';
import { User } from '../entity/User';
import { fetchDiscordUsername } from '../util/discord';
import { getVisibleUnlistedMeetups } from '../util/meetupVisibility';
import { normalizeImage } from '../util/imageProcessing';
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

  let processed: Buffer;
  try {
    processed = await normalizeImage(file.buffer, file.mimetype, {
      maxDimension: 1024,
    });
  } catch {
    return res
      .status(400)
      .json({ message: 'Could not process the uploaded image.' });
  }

  const key = buildTempImageKey('users', ext);
  await upload(key, processed, file.mimetype);

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
        username: user.username,
        display_name: user.nick_name,
        photo_url: publicUrl(user.photo_key ?? ''),
      }) satisfies OrganizerInterface
  );

  return res.json(response);
};

export const searchUsers = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) {
    return res.json([]);
  }

  const escaped = q.replace(/[%_\\]/g, '\\$&');
  const users = await User.find({
    where: { username: ILike(`${escaped}%`) },
    order: { username: 'ASC' },
    take: 8,
  });

  return res.json(
    users.map(
      (user) =>
        ({
          id: user.id,
          username: user.username,
          display_name: user.nick_name,
          photo_url: publicUrl(user.photo_key ?? ''),
          is_organizer: user.is_organizer,
        }) satisfies PublicUserInterface
    )
  );
};

// Public profiles resolve by username only; a numeric id 404s.
export const getPublicUser = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { user_id: username } = req.params as Record<string, string>;

  const user = await User.findOneBy({ username });

  if (user == null) {
    return res.status(404).json({ message: 'User not found.' });
  }

  const galleryRecords = await GalleryRecord.find({
    relations: { meetup: true },
    where: { user_id: user.id },
  });

  // Same unlisted filter as getUserGalleries.
  const requestor = res.locals.requestor as User | undefined;
  const visibleUnlisted = new Set(
    (await getVisibleUnlistedMeetups(requestor)).all
  );
  const hasGalleries = galleryRecords.some(
    (record) =>
      !record.meetup.is_unlisted || visibleUnlisted.has(record.meetup.id)
  );

  const response: PublicUserInterface = {
    id: user.id,
    username: user.username,
    display_name: user.nick_name,
    photo_url: publicUrl(user.photo_key ?? ''),
    is_organizer: user.is_organizer,
    has_galleries: hasGalleries,
  };

  return res.json(response);
};

export const usernameAvailable = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const username = String(req.query.username ?? '');
  const excludeId =
    req.query.exclude_id != null ? String(req.query.exclude_id) : null;

  if (!USERNAME_REGEX.test(username)) {
    return res.json({ available: false });
  }

  const existing = await User.findOne({
    where: { username },
    select: { id: true },
  });
  return res.json({ available: existing == null || existing.id === excludeId });
};

export const getUser = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { user_id } = req.params as Record<string, string>;

  const user = await User.findOneBy({
    id: user_id,
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
