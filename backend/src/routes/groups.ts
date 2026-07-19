import express, { type RequestHandler } from 'express';
import {
  createGroup,
  deleteGroup,
  editGroup,
  getDiscordServers,
  getGroups,
  joinGroup,
  leaveGroup,
} from '../controllers/groups';
import { authChecker, Rule } from '../middleware/authChecker';

const router = express.Router();

router.post(
  '/join',
  authChecker() as RequestHandler,
  joinGroup as RequestHandler
);
router.delete(
  '/:group_id/leave',
  authChecker() as RequestHandler,
  leaveGroup as RequestHandler
);

// Managing groups is admin only.
router.get(
  '/',
  authChecker([Rule.requireAdmin]) as RequestHandler,
  getGroups as RequestHandler
);
// The Discord servers the bot is in, for the group server picker.
router.get(
  '/discord-servers',
  authChecker([Rule.requireAdmin]) as RequestHandler,
  getDiscordServers as RequestHandler
);
router.post(
  '/',
  authChecker([Rule.requireAdmin]) as RequestHandler,
  createGroup as RequestHandler
);
router.put(
  '/:group_id',
  authChecker([Rule.requireAdmin]) as RequestHandler,
  editGroup as RequestHandler
);
router.delete(
  '/:group_id',
  authChecker([Rule.requireAdmin]) as RequestHandler,
  deleteGroup as RequestHandler
);

export default router;
