import express, { type RequestHandler } from 'express';
import { getUserGalleries } from '../controllers/gallery';
import { getUserTickets } from '../controllers/tickets';
import {
  getUserDiscordServerChannels,
  getUserDiscordServers,
  unlinkDiscordAccount,
} from '../controllers/userDiscord';
import {
  getAllUsers,
  getOrganizers,
  getPublicUser,
  getUser,
  searchUsers,
  uploadUserImage,
  usernameAvailable,
} from '../controllers/users';
import { authChecker, optionalAuth, Rule } from '../middleware/authChecker';
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
  '/organizers',
  authChecker() as RequestHandler,
  getOrganizers as RequestHandler
);
router.get('/username-available', usernameAvailable as RequestHandler);
router.get(
  '/search',
  authChecker([Rule.requireOrganizer]) as RequestHandler,
  searchUsers as RequestHandler
);
router.get('/:user_id/public', getPublicUser as RequestHandler);
router.get(
  '/:user_id/galleries',
  optionalAuth() as RequestHandler,
  getUserGalleries as RequestHandler
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
router.delete(
  '/:user_id/discord',
  authChecker() as RequestHandler,
  unlinkDiscordAccount as RequestHandler
);

export default router;
