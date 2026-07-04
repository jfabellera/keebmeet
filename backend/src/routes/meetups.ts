import express, { type RequestHandler } from 'express';
import multer from 'multer';
import {
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
  createMeetupDiscordMessage,
  deleteMeetupDiscordMessage,
  getMeetupDiscordMessage,
  updateMeetupDiscordMessage,
} from '../controllers/meetupDiscord';
import { getRaffleRecords, rollRaffleWinner } from '../controllers/raffles';
import { createTicket, updateTicketViaWebhook } from '../controllers/tickets';
import { Rule, authChecker } from '../middleware/authChecker';

const router = express.Router();

// Meetup images are held in memory and streamed straight to R2; they never
// touch disk. Mimetype is validated again in the handler.
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

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
  imageUpload.single('image'),
  uploadMeetupImage as RequestHandler
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

export default router;
