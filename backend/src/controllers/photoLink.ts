import {
  createPhotoLinkSchema,
  type PhotoLinkInfo,
} from '@keebmeet/shared';
import { type Request, type Response } from 'express';
import { socket } from '../Server';
import { type Meetup } from '../entity/Meetup';
import { PhotoLinkRecord } from '../entity/PhotoLinkRecord';
import { Ticket } from '../entity/Ticket';
import { type User } from '../entity/User';

// A photo link is keyed by (meetup_id, user_id): each attendee may have at most
// one link per meetup. A duplicate POST is rejected with 409; to change a link
// the attendee deletes it and creates a new one.
export const createPhotoLink = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const meetup = res.locals.meetup as Meetup;
  const user = res.locals.requestor as User;

  if (meetup == null || user == null) {
    return res.status(400).end();
  }

  const result = createPhotoLinkSchema.safeParse(req.body ?? {});
  if (!result.success) {
    return res.status(400).json(result.error);
  }

  // Only an organizer or an attendee (ticket holder) of the meetup may add a
  // photo link. authChecker lets any signed-in user onto this route
  // (Rule.ignoreMeetupOrganizer), so the attendee/organizer gate lives here.
  const isOrganizer =
    meetup.lead_organizer?.id === user.id ||
    (meetup.organizers?.some((organizer) => organizer.id === user.id) ?? false);

  if (!isOrganizer) {
    const ticket = await Ticket.findOne({
      where: {
        meetup: { id: meetup.id },
        user: { id: user.id },
      },
    });

    if (ticket == null) {
      return res.status(403).json({
        message: 'Only meetup attendees or organizers can add a photo link.',
      });
    }
  }

  const existing = await PhotoLinkRecord.findOne({
    where: {
      meetup: { id: meetup.id },
      user: { id: user.id },
    },
  });

  if (existing != null) {
    return res.status(409).json({ message: 'Photo link already exists.' });
  }

  const record = PhotoLinkRecord.create({
    meetup,
    user,
    photo_link: result.data.photo_link,
  });
  await record.save();

  socket.emit('meetup:update', { meetupId: meetup.id });

  return res.status(201).json({
    user_id: user.id,
    display_name: user.nick_name,
    photo_link: record.photo_link,
  } satisfies PhotoLinkInfo);
};

// Self-service: the requestor removes their own photo link for the meetup.
export const deletePhotoLink = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const meetup = res.locals.meetup as Meetup;
  const user = res.locals.requestor as User;

  if (meetup == null || user == null) {
    return res.status(400).end();
  }

  return removePhotoLink(res, meetup.id, user.id);
};

// Moderation: a meetup organizer removes another attendee's photo link. The
// organizer check is enforced by authChecker on the :meetup_id param (the route
// omits Rule.ignoreMeetupOrganizer).
export const deletePhotoLinkForUser = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const meetup = res.locals.meetup as Meetup;
  const { target_user_id } = req.params as Record<string, string>;

  if (meetup == null) {
    return res.status(400).end();
  }

  return removePhotoLink(res, meetup.id, target_user_id);
};

const removePhotoLink = async (
  res: Response,
  meetupId: string,
  userId: string
): Promise<Response> => {
  const record = await PhotoLinkRecord.findOne({
    where: {
      meetup: { id: meetupId },
      user: { id: userId },
    },
  });

  if (record == null) {
    return res.status(404).json({ message: 'Photo link not found.' });
  }

  await record.remove();

  socket.emit('meetup:update', { meetupId });

  return res.status(204).end();
};

export const getMeetupPhotoLinks = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { meetup_id } = req.params as Record<string, string>;

  const records = await PhotoLinkRecord.find({
    relations: { user: true },
    where: {
      meetup: { id: meetup_id },
    },
  });

  const response = records.map(
    (record) =>
      ({
        user_id: record.user.id,
        display_name: record.user.nick_name,
        photo_link: record.photo_link,
      }) satisfies PhotoLinkInfo
  );

  return res.status(200).json(response);
};
