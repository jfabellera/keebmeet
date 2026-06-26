import { type Meetup } from '../entity/Meetup';
import { Ticket } from '../entity/Ticket';

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
