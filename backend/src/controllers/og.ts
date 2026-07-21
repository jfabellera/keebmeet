import { type Request, type Response } from 'express';
import config from '../config';
import { Meetup } from '../entity/Meetup';
import { cropImageUrl, publicUrl } from '../util/objectStorage';
import { meetupUrl, renderOgHtml } from '../util/ogPage';

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
