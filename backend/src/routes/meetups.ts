import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import multer, { MulterError } from 'multer';
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

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_MB = MAX_IMAGE_BYTES / (1024 * 1024);
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
// Marker so the wrapper can distinguish a rejected mimetype from other errors.
const UNSUPPORTED_IMAGE_TYPE = 'UNSUPPORTED_IMAGE_TYPE';

// Meetup images are held in memory and streamed straight to R2; they never
// touch disk. Mimetype is validated again in the handler.
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(new Error(UNSUPPORTED_IMAGE_TYPE));
      return;
    }
    cb(null, true);
  },
});

// Runs the multer upload and turns its errors into specific JSON responses so
// the client can show a meaningful message (e.g. file too large, wrong type).
const uploadMeetupImageFile = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  imageUpload.single('image')(req, res, (error: unknown) => {
    if (error instanceof MulterError) {
      const message =
        error.code === 'LIMIT_FILE_SIZE'
          ? `Image is too large. Maximum size is ${MAX_IMAGE_MB} MB.`
          : 'Could not process the uploaded image.';
      res.status(400).json({ message });
      return;
    }
    if (error instanceof Error && error.message === UNSUPPORTED_IMAGE_TYPE) {
      res
        .status(400)
        .json({ message: 'Unsupported image type. Use PNG, JPEG, or WebP.' });
      return;
    }
    if (error != null) {
      next(error);
      return;
    }
    next();
  });
};

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
  uploadMeetupImageFile,
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
