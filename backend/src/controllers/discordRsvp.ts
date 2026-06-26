import { type Request, type Response } from 'express';
import { socket } from '../Server';
import { Meetup } from '../entity/Meetup';
import { Ticket } from '../entity/Ticket';
import { User } from '../entity/User';
import { refreshMeetupDiscordMessage } from '../util/meetupDiscordMessage';
import { getMeetupEnd, isMeetupAtCapacity } from '../util/rsvp';
import { discordRsvpSchema } from '../util/validator';

/**
 * Toggles a Discord user's RSVP for a meetup, called by the bot when its RSVP
 * button is clicked. Creating ties the ticket to the Discord user (and to their
 * app account if one is linked by discord_id); clicking again cancels it.
 *
 * Responds 200 with a `status` the bot maps to an ephemeral reply:
 * 'created' | 'cancelled' | 'full' | 'ended'.
 */
export const toggleDiscordRsvp = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const result = discordRsvpSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json(result.error);
  }

  const { meetup_id, discord_id, display_name } = result.data;

  const meetup = await Meetup.findOneBy({ id: meetup_id });

  if (meetup == null) {
    return res.status(404).json({ message: 'Invalid meetup ID.' });
  }

  if (getMeetupEnd(meetup) < new Date()) {
    return res.json({ status: 'ended' });
  }

  // Link to an app account if one is registered with this Discord id.
  const user = await User.findOneBy({ discord_id });

  const existingTicket = await Ticket.findOne({
    relations: { user: true },
    where: [
      { meetup: { id: meetup_id }, discord_id },
      ...(user != null
        ? [{ meetup: { id: meetup_id }, user: { id: user.id } }]
        : []),
    ],
  });

  if (existingTicket != null) {
    await existingTicket.remove();
    socket.emit('meetup:update', { meetupId: meetup_id });
    await refreshMeetupDiscordMessage(meetup_id);
    return res.json({ status: 'cancelled' });
  }

  if (await isMeetupAtCapacity(meetup_id, meetup.capacity)) {
    return res.json({ status: 'full' });
  }

  const ticket = Ticket.create({
    meetup,
    user: user ?? null,
    discord_id,
    raffle_entries: meetup.default_raffle_entries,
    ticket_holder_display_name: user?.nick_name ?? display_name,
    ticket_holder_first_name: user?.first_name ?? '',
    ticket_holder_last_name: user?.last_name ?? '',
    ticket_holder_email: user?.email ?? '',
  });
  await ticket.save();

  socket.emit('meetup:update', { meetupId: meetup_id });
  await refreshMeetupDiscordMessage(meetup_id);

  return res.status(201).json({ status: 'created' });
};
