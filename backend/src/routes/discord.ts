import express, { type RequestHandler } from 'express';
import { handleMembershipChanged } from '../controllers/discordMembership';
import { handleDiscordRsvp } from '../controllers/discordRsvp';
import { internalAuth } from '../middleware/internalAuth';

const router = express.Router();

router.post(
  '/rsvp',
  internalAuth as RequestHandler,
  handleDiscordRsvp as RequestHandler
);

router.post(
  '/membership-changed',
  internalAuth as RequestHandler,
  handleMembershipChanged as RequestHandler
);

export default router;
