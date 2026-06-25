import { type Request, type Response } from 'express';
import { socket } from '../Server';
import { Meetup } from '../entity/Meetup';
import { Ticket } from '../entity/Ticket';
import { type User } from '../entity/User';
import { type EventbriteAttendee } from '../interfaces/eventbriteInterfaces';
import { getEventbriteAttendeeByUri } from '../util/eventbriteApi';
import { createTicketSchema, editTicketSchema } from '../util/validator';

export interface SimpleTicketInfo {
  id: number;
  meetup_id: number;
}

// The meetup is still happening until its start date plus its duration.
const getMeetupEnd = (meetup: Meetup): Date => {
  const end = new Date(meetup.date);
  end.setHours(end.getHours() + meetup.duration_hours);
  return end;
};

export const getAllTickets = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const tickets = await Ticket.find();

  return res.json(tickets);
};

export const getTicket = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticket_id } = req.params as Record<string, string>;

  const ticket = await Ticket.findOneBy({
    id: parseInt(ticket_id),
  });

  if (ticket == null) {
    return res.status(404).json({ message: 'Invalid ticket ID.' });
  }

  return res.json(ticket);
};

export const createTicket = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const meetup = res.locals.meetup as Meetup;
  const user = res.locals.requestor as User;
  const result = createTicketSchema.safeParse(req.body ?? {});

  if (meetup == null || user == null) {
    return res.status(400).end();
  }

  if (!result.success) {
    return res.status(400).json(result.error);
  }

  // Check if ticket already exists
  const existingTicket = await Ticket.findOne({
    relations: {
      meetup: true,
      user: true,
    },
    where: {
      meetup: { id: meetup.id },
      user: { id: user.id },
    },
  });

  if (existingTicket != null) {
    return res.status(409).json({ message: 'Ticket already exists.' });
  }

  if (getMeetupEnd(meetup) < new Date()) {
    return res.status(400).json({ message: 'Meetup has already occurred.' });
  }

  const newTicket = Ticket.create({
    meetup,
    user,
    raffle_entries: meetup.default_raffle_entries,
    ticket_holder_display_name:
      result.data.ticket_holder?.display_name ?? user.nick_name,
    ticket_holder_first_name:
      result.data.ticket_holder?.first_name ?? user.first_name,
    ticket_holder_last_name:
      result.data.ticket_holder?.last_name ?? user.last_name,
    ticket_holder_email: result.data.ticket_holder?.email ?? user.email,
  });
  await newTicket.save();

  socket.emit('meetup:update', { meetupId: meetup.id });
  return res.status(201).json(newTicket);
};

export const updateTicket = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticket_id } = req.params as Record<string, string>;

  const result = editTicketSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json(result.error);
  }

  const ticket = await Ticket.findOne({
    relations: {
      meetup: true,
    },
    where: {
      id: parseInt(ticket_id),
    },
  });

  if (ticket == null) {
    return res.status(404).json({ message: 'Invalid ticket ID.' });
  }

  // TODO(jan): Do we want to throw an error when meetup_id or user_id is found in req.body?
  ticket.is_checked_in = req.body.is_checked_in ?? ticket.is_checked_in;
  ticket.raffle_entries = req.body.raffle_entries ?? ticket.raffle_entries;
  ticket.raffle_wins = req.body.raffle_wins ?? ticket.raffle_wins;

  if (result.data.ticket_holder != null) {
    ticket.ticket_holder_display_name = result.data.ticket_holder.display_name;
    ticket.ticket_holder_first_name = result.data.ticket_holder.first_name;
    ticket.ticket_holder_last_name = result.data.ticket_holder.last_name;
    ticket.ticket_holder_email = result.data.ticket_holder.email;
  }

  await ticket.save();

  socket.emit('meetup:update', { meetupId: ticket.meetup.id });
  return res.status(201).json(ticket);
};

export const deleteTicket = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const ticket = res.locals.ticket as Ticket;
  const meetupId = ticket.meetup.id;

  if (getMeetupEnd(ticket.meetup) < new Date()) {
    return res.status(400).json({ message: 'Meetup has already occurred.' });
  }

  await ticket.remove();

  socket.emit('meetup:update', { meetupId });
  return res.status(204).end();
};

export const getUserTickets = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { user_id } = req.params as Record<string, string>;

  // TODO(jan): make this better

  const tickets = await Ticket.find({
    relations: { meetup: true },
    select: {
      id: true,
      meetup: {
        id: true,
      },
    },
    where: {
      user: {
        id: parseInt(user_id),
      },
    },
  });

  const ticketsInfo: SimpleTicketInfo[] = tickets.map((ticket) => {
    const ticketInfo: SimpleTicketInfo = {
      id: ticket.id,
      meetup_id: ticket.meetup.id,
    };
    return ticketInfo;
  });

  return res.json(ticketsInfo);
};

export const checkInTicket = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const ticket = res.locals.ticket as Ticket;

  if (ticket.eventbrite_attendee_id != null) {
    return res.status(400).json({
      message: 'Ticket must be checked in via Eventbrite.',
    });
  }

  if (ticket.is_checked_in) {
    return res
      .status(200)
      .json({ message: 'Ticket has already been checked in.' });
  }

  ticket.is_checked_in = true;
  ticket.checked_in_at = new Date();
  await ticket.save();

  socket.emit('meetup:update', { meetupId: ticket.meetup.id });
  return res.status(200).end();
};

export const syncEventbriteAttendee = async (
  attendee: EventbriteAttendee,
  meetup: Meetup
): Promise<void> => {
  if (attendee.ticketClassId !== meetup.eventbriteRecord?.ticket_class_id) {
    // Ignore attendees that do not match the specified ticket class
    return;
  }

  const ticket = await Ticket.findOne({
    where: { eventbrite_attendee_id: attendee.id },
  });

  if (ticket == null) {
    if (!attendee.isAttending) {
      // Don't do anything if no ticket exists and user isn't attending
      return;
    }

    // Create ticket for new attendee
    const newTicket = Ticket.create({
      meetup,
      eventbrite_attendee_id: attendee.id,
      created_at: attendee.createdAt,
      raffle_entries: meetup.default_raffle_entries,
      ticket_holder_display_name: attendee.displayName,
      ticket_holder_first_name: attendee.firstName,
      ticket_holder_last_name: attendee.lastName,
    });

    await newTicket.save();
    return;
  }

  // Remove ticket if user is no longer attending
  if (!attendee.isAttending) {
    await ticket.remove();
    return;
  }

  // Update checked in timestamp on first check in
  if (
    !ticket.is_checked_in &&
    attendee.isCheckedIn &&
    ticket.checked_in_at == null
  ) {
    ticket.checked_in_at = attendee.checkInStatusUpdatedAt;
  }

  // Update checked out timestamp on latest check out
  if (ticket.is_checked_in && !attendee.isCheckedIn) {
    ticket.checked_out_at = attendee.checkInStatusUpdatedAt;
  }

  // Sync checked in status regardless of check in or check out
  ticket.is_checked_in = attendee.isCheckedIn;

  ticket.ticket_holder_display_name = attendee.displayName;
  ticket.ticket_holder_first_name = attendee.firstName;
  ticket.ticket_holder_last_name = attendee.lastName;

  await ticket.save();
};

export const updateTicketViaWebhook = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { meetup_id } = req.params as Record<string, string>;
  const { token } = req.query;
  const { api_url } = req.body;

  try {
    const meetup = await Meetup.findOne({
      relations: { eventbriteRecord: true },
      where: { id: parseInt(meetup_id) },
      select: {
        eventbriteRecord: {
          display_name_question_id: true,
          ticket_class_id: true,
        },
      },
    });

    if (meetup?.eventbriteRecord == null) return res.status(404).end();

    let attendee: EventbriteAttendee | undefined;
    try {
      attendee = await getEventbriteAttendeeByUri(
        String(token),
        api_url,
        meetup.eventbriteRecord.display_name_question_id
      );
    } catch (error: any) {
      return res
        .status(500)
        .json({ message: 'Unable to get Eventbrite details' });
    }

    if (attendee == null) return res.status(400).end();

    await syncEventbriteAttendee(attendee, meetup);

    socket.emit('meetup:update', { meetupId: meetup.id });
    return res.status(200).end();
  } catch (error: any) {
    return res.status(400).end();
  }
};
