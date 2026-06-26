import express, { type RequestHandler } from 'express';
import { handleDiscordRsvp } from '../controllers/discordRsvp';
import { internalAuth } from '../middleware/internalAuth';

const router = express.Router();

router.post(
  '/rsvp',
  internalAuth as RequestHandler,
  handleDiscordRsvp as RequestHandler
);

export default router;
