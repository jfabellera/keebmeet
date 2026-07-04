import express, { type RequestHandler } from 'express';
import { getUserTickets } from '../controllers/tickets';
import {
  getUserDiscordServerChannels,
  getUserDiscordServers,
} from '../controllers/userDiscord';
import { getAllUsers, getUser, uploadUserImage } from '../controllers/users';
import { authChecker, Rule } from '../middleware/authChecker';
import { uploadImageFile } from '../middleware/imageUpload';
import { loginLimiter } from '../middleware/rateLimiter';

const router = express.Router();

// Public (registration has no token yet) but throttled with the same limiter as
// the auth flow. Writes only to the temp prefix; promoted when the user saves.
router.post(
  '/photo',
  loginLimiter,
  uploadImageFile,
  uploadUserImage as RequestHandler
);

router.get(
  '/',
  authChecker([Rule.requireAdmin]) as RequestHandler,
  getAllUsers as RequestHandler
);
router.get(
  '/:user_id',
  authChecker([Rule.overrideAdmin]) as RequestHandler,
  getUser as RequestHandler
);
router.get(
  '/:user_id/tickets',
  authChecker() as RequestHandler,
  getUserTickets as RequestHandler
);
router.get(
  '/:user_id/discord/servers',
  authChecker([Rule.overrideAdmin]) as RequestHandler,
  getUserDiscordServers as RequestHandler
);
router.get(
  '/:user_id/discord/servers/:server_id/channels',
  authChecker([Rule.overrideAdmin]) as RequestHandler,
  getUserDiscordServerChannels as RequestHandler
);

export default router;
