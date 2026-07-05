import { type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import { Meetup } from '../entity/Meetup';
import { RaffleRecord } from '../entity/RaffleRecord';
import { Ticket } from '../entity/Ticket';
import { User } from '../entity/User';

export enum Rule {
  requireOrganizer,
  requireAdmin,
  overrideOrganizer,
  overrideAdmin,
  overrideMeetupOrganizer, // Organizer of meetup
  ignoreMeetupOrganizer,
}

interface TokenInterface {
  id: string;
  nick_name: string;
  is_organizer: boolean;
  is_admin: boolean;
}

const reject = (res: Response): Response => {
  return res.status(401).json({ message: 'Invalid authorization.' });
};

const checkMeetupOrganizer = async (
  meetupId: string,
  userId: string
): Promise<boolean> => {
  const meetup = await Meetup.findOne({
    relations: {
      lead_organizer: true,
      organizers: true,
    },
    where: {
      id: meetupId,
    },
  });

  if (
    meetup != null &&
    (meetup.lead_organizer?.id === userId ||
      meetup.organizers.filter((organizer) => organizer.id === userId).length >
        0)
  ) {
    return true;
  }
  return false;
};

// TODO(jan): Make it so that there is only 1 next() at the end of the function.
// so that if there is any data transfer from auth middleware to next function,
// that is handled.
export const authChecker =
  (rules?: Rule[]) =>
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const authHeader = req.header('Authorization');
      // const prefix = authHeader?.split(' ')[0]
      const token = authHeader?.split(' ')[1];

      if (token == null) {
        return res
          .status(401)
          .send({ message: 'No auth token found. Authorization denied.' });
      }

      // Get requestor user
      const decodedToken = jwt.verify(
        token,
        config.jwtSecret
      ) as TokenInterface;
      const user = await User.findOneBy({
        id: decodedToken.id,
      });

      // Reject if user does not exist
      if (user == null)
        return res.status(404).json({ message: 'Invalid user ID.' });

      // Pass requestor to next function
      res.locals.requestor = user;

      if (rules != null) {
        // Owners outrank admins, so they satisfy any admin-level check.
        const isAdmin = user.is_admin || user.is_owner;

        // Account type overrides
        if (rules.includes(Rule.overrideOrganizer) && user.is_organizer) {
          next();
          return;
        }
        if (rules.includes(Rule.overrideAdmin) && isAdmin) {
          next();
          return;
        }

        // Account type requires
        if (rules.includes(Rule.requireOrganizer) && !user.is_organizer)
          return reject(res);
        if (rules.includes(Rule.requireAdmin) && !isAdmin) return reject(res);
      }

      // If accessing a user, check that the requestor is the user
      if (req.params.user_id != null) {
        // For some reason requires Number() to work with !== even though it's already a number
        if (Number(user.id) !== parseInt(req.params.user_id as string)) {
          return reject(res);
        }

        // Pass user to next function
        // TODO(jan): validate
        res.locals.user = user;
      }

      // If accessing a ticket, check that the requestor is the owner of the ticket
      if (req.params.ticket_id != null) {
        const ticket = await Ticket.findOne({
          relations: { user: true, meetup: true },
          where: {
            id: req.params.ticket_id as string,
          },
        });

        if (ticket == null)
          return res.status(404).json({ message: 'Invalid ticket ID.' });

        // Pass ticket to next function
        res.locals.ticket = ticket;

        if (
          rules != null &&
          rules.includes(Rule.overrideMeetupOrganizer) &&
          (await checkMeetupOrganizer(ticket.meetup.id, user.id))
        ) {
          next();
          return;
        }

        if (ticket.user == null || user.id !== ticket.user.id) {
          return reject(res);
        }
      }

      // If accessing a raffle record, check that the requestor is an organizer of the raffle's meetup
      if (req.params.raffle_id != null) {
        const raffleRecord = await RaffleRecord.findOne({
          relations: { meetup: true },
          where: { id: req.params.raffle_id as string },
        });

        if (raffleRecord == null)
          return res.status(404).json({ message: 'Invalid raffle ID.' });

        // Pass raffleRecord to next function
        res.locals.raffleRecord = raffleRecord;

        if (!(await checkMeetupOrganizer(raffleRecord.meetup.id, user.id)))
          return reject(res);
      }

      // If accessing a meetup, check that the requestor is an organizer of the meetup
      if (req.params.meetup_id != null) {
        const meetup = await Meetup.findOne({
          relations: {
            lead_organizer: true,
            organizers: true,
            eventbriteRecord: true,
          },
          where: {
            id: req.params.meetup_id as string,
          },
        });

        if (meetup == null)
          return res.status(404).json({ message: 'Invalid meetup ID.' });

        // Pass meetup to next function
        res.locals.meetup = meetup;

        if (
          (rules == null || !rules.includes(Rule.ignoreMeetupOrganizer)) &&
          meetup.lead_organizer?.id !== user.id &&
          meetup.organizers.find((organizer) => organizer.id === user.id) ==
            null
        ) {
          return reject(res);
        }
      }

      next();
    } catch (error) {
      return res.status(500).json({ message: 'Oopsie woopsie!!!' });
    }
  };
