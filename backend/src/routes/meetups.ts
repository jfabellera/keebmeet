import express, { type RequestHandler } from 'express';
import {
  createMeetupDiscordMessage,
  deleteMeetupDiscordMessage,
  getMeetupDiscordMessage,
  updateMeetupDiscordMessage,
} from '../controllers/meetupDiscord';
import {
  createArchiveMeetup,
  createMeetup,
  createMeetupFromEventbrite,
  deleteMeetup,
  getAllMeetups,
  getMeetup,
  getMeetupAttendees,
  getMeetupDisplayAssets,
  syncEventbriteAttendees,
  updateMeetup,
  uploadMeetupImage,
} from '../controllers/meetups';
import {
  createGallery,
  deleteGallery,
  deleteGalleryById,
  deleteGalleryForUser,
  getMeetupGalleryPreviews,
  getMeetupGallery,
} from '../controllers/gallery';
import { getRaffleRecords, rollRaffleWinner } from '../controllers/raffles';
import { createTicket, updateTicketViaWebhook } from '../controllers/tickets';
import { Rule, authChecker } from '../middleware/authChecker';
import { uploadImageFile } from '../middleware/imageUpload';

const router = express.Router();

router.get('/', getAllMeetups as RequestHandler);

router.get('/:meetup_id', getMeetup as RequestHandler);

router.post(
  '/',
  authChecker([Rule.requireOrganizer]) as RequestHandler,
  createMeetup as RequestHandler
);

router.post(
  '/image',
  authChecker([Rule.requireOrganizer]) as RequestHandler,
  uploadImageFile,
  uploadMeetupImage as RequestHandler
);

router.post(
  '/archive',
  authChecker([Rule.requireOrganizer]) as RequestHandler,
  createArchiveMeetup as RequestHandler
);

router.post(
  '/eventbrite',
  authChecker([Rule.requireOrganizer]) as RequestHandler,
  createMeetupFromEventbrite as RequestHandler
);

router.put(
  '/:meetup_id',
  authChecker([Rule.requireOrganizer]) as RequestHandler,
  updateMeetup as RequestHandler
);

router.delete(
  '/:meetup_id',
  authChecker([Rule.requireOrganizer]) as RequestHandler,
  deleteMeetup as RequestHandler
);

router.post(
  '/:meetup_id/rsvp',
  authChecker([Rule.ignoreMeetupOrganizer]) as RequestHandler,
  createTicket as RequestHandler
);

router.get(
  '/:meetup_id/attendees',
  authChecker([Rule.requireOrganizer]) as RequestHandler,
  getMeetupAttendees as RequestHandler
);

router.post(
  '/:meetup_id/raffle',
  authChecker([Rule.requireOrganizer]) as RequestHandler,
  rollRaffleWinner as RequestHandler
);

router.post(
  '/:meetup_id/sync-eventbrite',
  authChecker([Rule.requireOrganizer]) as RequestHandler,
  syncEventbriteAttendees as RequestHandler
);

router.post(
  '/:meetup_id/attendee-webhook',
  updateTicketViaWebhook as RequestHandler
);

router.get(
  '/:meetup_id/display-assets',
  getMeetupDisplayAssets as RequestHandler
);

router.get(
  '/:meetup_id/raffles',
  authChecker() as RequestHandler,
  getRaffleRecords as RequestHandler
);

router.get(
  '/:meetup_id/discord/message',
  authChecker([Rule.requireOrganizer]) as RequestHandler,
  getMeetupDiscordMessage as RequestHandler
);

router.post(
  '/:meetup_id/discord/message',
  authChecker([Rule.requireOrganizer]) as RequestHandler,
  createMeetupDiscordMessage as RequestHandler
);

router.put(
  '/:meetup_id/discord/message',
  authChecker([Rule.requireOrganizer]) as RequestHandler,
  updateMeetupDiscordMessage as RequestHandler
);

router.delete(
  '/:meetup_id/discord/message',
  authChecker([Rule.requireOrganizer]) as RequestHandler,
  deleteMeetupDiscordMessage as RequestHandler
);

router.post(
  '/:meetup_id/gallery',
  authChecker([Rule.ignoreMeetupOrganizer]) as RequestHandler,
  createGallery as RequestHandler
);

router.delete(
  '/:meetup_id/gallery',
  authChecker([Rule.ignoreMeetupOrganizer]) as RequestHandler,
  deleteGallery as RequestHandler
);

router.delete(
  '/:meetup_id/gallery/:target_user_id',
  authChecker() as RequestHandler,
  deleteGalleryForUser as RequestHandler
);

router.delete(
  '/:meetup_id/galleries/:gallery_id',
  authChecker() as RequestHandler,
  deleteGalleryById as RequestHandler
);

router.get('/:meetup_id/galleries', getMeetupGallery as RequestHandler);

// Public: server-scraped OpenGraph previews for those links.
router.get(
  '/:meetup_id/galleries/previews',
  getMeetupGalleryPreviews as RequestHandler
);

export default router;
