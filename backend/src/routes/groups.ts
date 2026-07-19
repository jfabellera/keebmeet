import express, { type RequestHandler } from 'express';
import {
  createGroup,
  deleteGroup,
  editGroup,
} from '../controllers/groups';
import { authChecker, Rule } from '../middleware/authChecker';

const router = express.Router();

// Managing groups is admin only.
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
