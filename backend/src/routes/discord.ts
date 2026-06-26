import express, { type RequestHandler } from 'express';
import { toggleDiscordRsvp } from '../controllers/discordRsvp';
import { internalAuth } from '../middleware/internalAuth';

const router = express.Router();

router.post(
  '/rsvp',
  internalAuth as RequestHandler,
  toggleDiscordRsvp as RequestHandler
);

export default router;
