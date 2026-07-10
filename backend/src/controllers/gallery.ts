import {
  createGallerySchema,
  type GalleryInfo,
  type GalleryPreview,
} from '@keebmeet/shared';
import { type Request, type Response } from 'express';
import { socket } from '../Server';
import { type Meetup } from '../entity/Meetup';
import { GalleryRecord } from '../entity/GalleryRecord';
import { Ticket } from '../entity/Ticket';
import { type User } from '../entity/User';
import { fetchLinkPreview } from '../util/linkPreview';

const isMeetupOrganizer = (meetup: Meetup, user: User): boolean =>
  meetup.lead_organizer?.id === user.id ||
  (meetup.organizers?.some((organizer) => organizer.id === user.id) ?? false);

// Two kinds of gallery:
//  - A self link is keyed by (meetup_id, user_id): an attendee or organizer may
//    have at most one per meetup (enforced by a partial unique index).
//  - A credited link (contributor_name, no user) lets an organizer attribute a
//    link to someone without an account, e.g. a hired photographer. Many are
//    allowed. Every link is identified by its surrogate record id.
export const createGallery = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const meetup = res.locals.meetup as Meetup;
  const user = res.locals.requestor as User;

  if (meetup == null || user == null) {
    return res.status(400).end();
  }

  const result = createGallerySchema.safeParse(req.body ?? {});
  if (!result.success) {
    return res.status(400).json(result.error);
  }

  const isOrganizer = isMeetupOrganizer(meetup, user);
  const contributorName = result.data.contributor_name?.trim();

  // Photos only exist once a live meetup is under way; archives are already past.
  if (!meetup.is_archive && new Date(meetup.date) > new Date()) {
    return res.status(400).json({ message: 'Meetup has not started yet.' });
  }

  if (contributorName != null && contributorName !== '') {
    if (!isOrganizer) {
      return res.status(403).json({
        message: 'Only an organizer can credit a gallery to someone else.',
      });
    }

    const record = GalleryRecord.create({
      meetup,
      contributor_name: contributorName,
      gallery: result.data.gallery,
    });
    await record.save();

    socket.emit('meetup:update', { meetupId: meetup.id });

    return res.status(201).json({
      id: record.id,
      user_id: null,
      display_name: contributorName,
      gallery: record.gallery,
    } satisfies GalleryInfo);
  }

  if (!isOrganizer) {
    const ticket = await Ticket.findOne({
      where: {
        meetup: { id: meetup.id },
        user: { id: user.id },
      },
    });

    if (ticket == null) {
      return res.status(403).json({
        message: 'Only meetup attendees or organizers can add a gallery.',
      });
    }
  }

  const existing = await GalleryRecord.findOne({
    where: {
      meetup: { id: meetup.id },
      user: { id: user.id },
    },
  });

  if (existing != null) {
    return res.status(409).json({ message: 'Gallery already exists.' });
  }

  const record = GalleryRecord.create({
    meetup,
    user,
    gallery: result.data.gallery,
  });
  await record.save();

  socket.emit('meetup:update', { meetupId: meetup.id });

  return res.status(201).json({
    id: record.id,
    user_id: user.id,
    display_name: user.nick_name,
    gallery: record.gallery,
  } satisfies GalleryInfo);
};

// Self-service: the requestor removes their own gallery for the meetup.
export const deleteGallery = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const meetup = res.locals.meetup as Meetup;
  const user = res.locals.requestor as User;

  if (meetup == null || user == null) {
    return res.status(400).end();
  }

  const record = await GalleryRecord.findOne({
    where: {
      meetup: { id: meetup.id },
      user: { id: user.id },
    },
  });

  return finishRemoval(res, meetup.id, record);
};

// Moderation: a meetup organizer removes another attendee's gallery. The
// organizer check is enforced by authChecker on the :meetup_id param (the route
// omits Rule.ignoreMeetupOrganizer).
export const deleteGalleryForUser = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const meetup = res.locals.meetup as Meetup;
  const { target_user_id } = req.params as Record<string, string>;

  if (meetup == null) {
    return res.status(400).end();
  }

  const record = await GalleryRecord.findOne({
    where: {
      meetup: { id: meetup.id },
      user: { id: target_user_id },
    },
  });

  return finishRemoval(res, meetup.id, record);
};

// Organizer moderation by record id — the only way to remove an archive's
// account-less contributor links (which have no user_id to target). Organizer
// status is enforced by authChecker on the :meetup_id param.
export const deleteGalleryById = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const meetup = res.locals.meetup as Meetup;
  const { gallery_id } = req.params as Record<string, string>;

  if (meetup == null) {
    return res.status(400).end();
  }

  const record = await GalleryRecord.findOne({
    where: {
      id: gallery_id,
      meetup: { id: meetup.id },
    },
  });

  return finishRemoval(res, meetup.id, record);
};

const finishRemoval = async (
  res: Response,
  meetupId: string,
  record: GalleryRecord | null
): Promise<Response> => {
  if (record == null) {
    return res.status(404).json({ message: 'Gallery not found.' });
  }

  await record.remove();

  socket.emit('meetup:update', { meetupId });

  return res.status(204).end();
};

export const getMeetupGallery = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { meetup_id } = req.params as Record<string, string>;

  const records = await GalleryRecord.find({
    relations: { user: true },
    where: {
      meetup: { id: meetup_id },
    },
    order: {
      created_at: 'ASC',
    },
  });

  const response = records.map(
    (record) =>
      ({
        id: record.id,
        user_id: record.user_id,
        display_name: record.contributor_name ?? record.user?.nick_name ?? '',
        gallery: record.gallery,
      }) satisfies GalleryInfo
  );

  return res.status(200).json(response);
};

// OpenGraph-style previews for the meetup's galleries, scraped server-side
// (the browser can't fetch cross-origin). Only the meetup's own stored links are
// ever fetched — the client never supplies a URL — so there's no open SSRF
// surface. fetchLinkPreview caches and never throws, so one bad link can't fail
// the batch.
export const getMeetupGalleryPreviews = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { meetup_id } = req.params as Record<string, string>;

  const records = await GalleryRecord.find({
    where: {
      meetup: { id: meetup_id },
    },
    order: {
      created_at: 'ASC',
    },
  });

  const previews = await Promise.all(
    records.map(async (record) => {
      const preview = await fetchLinkPreview(record.gallery);
      return {
        id: record.id,
        title: preview.title,
        image: preview.image,
        siteName: preview.siteName,
      } satisfies GalleryPreview;
    })
  );

  return res.status(200).json(previews);
};
