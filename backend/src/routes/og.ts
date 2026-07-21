import express, { type RequestHandler } from 'express';
import { getMeetupOgPage } from '../controllers/og';

const router = express.Router();

router.get('/meetup/:slug', getMeetupOgPage as RequestHandler);
router.get('/meetup/:slug/rsvp', getMeetupOgPage as RequestHandler);

export default router;
