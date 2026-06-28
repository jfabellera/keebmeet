import express, { type RequestHandler } from 'express';
import {
  approveOrganizerRequest,
  createOrganizerRequest,
  denyOrganizerRequest,
  getOrganizerRequests,
} from '../controllers/organizerRequests';
import { authChecker, Rule } from '../middleware/authChecker';

const router = express.Router();

// Any logged-in user can request organizer access for themselves.
router.post(
  '/',
  authChecker() as RequestHandler,
  createOrganizerRequest as RequestHandler
);

// Reviewing requests is admin only.
router.get(
  '/',
  authChecker([Rule.requireAdmin]) as RequestHandler,
  getOrganizerRequests as RequestHandler
);
router.post(
  '/:request_id/approve',
  authChecker([Rule.requireAdmin]) as RequestHandler,
  approveOrganizerRequest as RequestHandler
);
router.delete(
  '/:request_id',
  authChecker([Rule.requireAdmin]) as RequestHandler,
  denyOrganizerRequest as RequestHandler
);

export default router;
