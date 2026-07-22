import { type Request, type Response } from 'express';
import config from '../config';
import { GalleryRecord } from '../entity/GalleryRecord';
import { Meetup } from '../entity/Meetup';
import { User } from '../entity/User';
import { cropImageUrl, publicUrl } from '../util/objectStorage';
import { meetupUrl, profileUrl, renderOgHtml } from '../util/ogPage';

const HOME_TITLE = 'KeebMeet';
const HOME_DESCRIPTION = 'A meetup management system.';

const NO_DESCRIPTION = 'No description';

const sendOg = (res: Response, html: string): Response => {
  res.type('html');
  return res.send(html);
};

// OG/Twitter HTML for a meetup, so shared links preview richly. Reached only by
// crawler user-agents (Caddy routes them here); real browsers get the SPA. An
// unknown slug falls back to the generic card so a stale link still previews.
export const getMeetupOgPage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { slug } = req.params as Record<string, string>;

  const meetup = await Meetup.findOne({ where: { slug } });

  if (meetup == null) {
    return sendOg(
      res,
      renderOgHtml({
        title: HOME_TITLE,
        description: HOME_DESCRIPTION,
        url: config.webUrl,
      })
    );
  }

  const description =
    meetup.description != null && meetup.description.trim() !== ''
      ? meetup.description
      : NO_DESCRIPTION;

  return sendOg(
    res,
    renderOgHtml({
      title: meetup.name,
      description,
      url: meetupUrl(meetup.slug),
      image: cropImageUrl(publicUrl(meetup.image_key)),
      imageAlt: meetup.name,
    })
  );
};

// OG/Twitter HTML for a user's profile. Counts only non-unlisted meetups and
// galleries, matching what an anonymous visitor sees.
export const getUserOgPage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { username } = req.params as Record<string, string>;

  const user = await User.findOneBy({ username });

  if (user == null) {
    return sendOg(
      res,
      renderOgHtml({
        title: HOME_TITLE,
        description: HOME_DESCRIPTION,
        url: config.webUrl,
      })
    );
  }

  const hostedCount = await Meetup.count({
    where: { lead_organizer: { id: user.id }, is_unlisted: false },
  });
  const galleryCount = await GalleryRecord.createQueryBuilder('gallery')
    .innerJoin('gallery.meetup', 'meetup')
    .where('gallery.user_id = :userId', { userId: user.id })
    .andWhere('meetup.is_unlisted = false')
    .getCount();

  const parts: string[] = [];
  if (user.is_organizer) parts.push('Organizer');
  if (hostedCount > 0) {
    parts.push(`${hostedCount} meetup${hostedCount === 1 ? '' : 's'} hosted`);
  }
  if (galleryCount > 0) {
    parts.push(
      `${galleryCount} ${galleryCount === 1 ? 'gallery' : 'galleries'}`
    );
  }

  return sendOg(
    res,
    renderOgHtml({
      title: user.nick_name,
      description: parts.length > 0 ? parts.join(' · ') : undefined,
      url: profileUrl(user.username),
      image: user.photo_key
        ? cropImageUrl(publicUrl(user.photo_key), 600, 600)
        : undefined,
      imageAlt: user.nick_name,
      card: 'summary',
    })
  );
};
