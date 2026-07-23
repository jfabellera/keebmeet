import express, { type RequestHandler } from 'express';
import { createTag, deleteTag, editTag, getTags } from '../controllers/tags';
import { authChecker, optionalAuth, Rule } from '../middleware/authChecker';

const router = express.Router();

router.get('/', optionalAuth() as RequestHandler, getTags as RequestHandler);

router.post(
  '/',
  authChecker([Rule.requireOrganizer]) as RequestHandler,
  createTag as RequestHandler
);
router.put(
  '/:tag_id',
  authChecker([Rule.requireOrganizer]) as RequestHandler,
  editTag as RequestHandler
);
router.delete(
  '/:tag_id',
  authChecker([Rule.requireOrganizer]) as RequestHandler,
  deleteTag as RequestHandler
);

export default router;
