import express, { type RequestHandler } from 'express';
import { getMeetupOgPage, getUserOgPage } from '../controllers/og';

const router = express.Router();

router.get('/meetup/:slug', getMeetupOgPage as RequestHandler);
router.get('/meetup/:slug/rsvp', getMeetupOgPage as RequestHandler);
router.get('/user/:username', getUserOgPage as RequestHandler);
router.get('/user/:username/:tab', getUserOgPage as RequestHandler);

export default router;
