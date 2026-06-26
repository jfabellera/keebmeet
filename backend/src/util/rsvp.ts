import { IsNull } from 'typeorm';
import { type Meetup } from '../entity/Meetup';
import { Ticket } from '../entity/Ticket';
import { type User } from '../entity/User';
import { refreshMeetupDiscordMessage } from './meetupDiscordMessage';

// The meetup is still happening until its start date plus its duration.
export const getMeetupEnd = (meetup: Meetup): Date => {
  const end = new Date(meetup.date);
  end.setHours(end.getHours() + meetup.duration_hours);
  return end;
};

// Whether the meetup already has at least `capacity` tickets.
export const isMeetupAtCapacity = async (
  meetupId: number,
  capacity: number
): Promise<boolean> => {
  const ticketCount = await Ticket.count({
    where: { meetup: { id: meetupId } },
  });
  return ticketCount >= capacity;
};

/**
 * Ties account-less Discord RSVP tickets (discord_id set, no user) to a user who
 * has just had that discord_id linked. Reassigns each orphan to the user, unless
 * the user already has a ticket for that meetup — in which case the orphan is
 * removed to avoid two tickets for the same meetup+user, and the embed is
 * refreshed since the attendee count drops. No-op when the user has no linked
 * Discord id.
 */
export const claimDiscordTickets = async (user: User): Promise<void> => {
  if (user.discord_id == null) return;

  const orphans = await Ticket.find({
    relations: { meetup: true },
    where: { discord_id: user.discord_id, user: IsNull() },
  });

  for (const orphan of orphans) {
    const existing = await Ticket.findOne({
      where: { meetup: { id: orphan.meetup.id }, user: { id: user.id } },
    });

    if (existing != null) {
      await orphan.remove();
      await refreshMeetupDiscordMessage(orphan.meetup.id);
    } else {
      orphan.user = user;
      await orphan.save();
    }
  }
};
