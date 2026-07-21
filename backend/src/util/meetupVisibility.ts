import { In } from 'typeorm';
import { Meetup } from '../entity/Meetup';
import { Ticket } from '../entity/Ticket';
import { User } from '../entity/User';
import { getEffectiveGroupIds } from './groupMembership';

export interface VisibleUnlistedMeetups {
  organizedIds: Set<string>;
  attendedIds: Set<string>;
  groupMeetupIds: Set<string>;
  /** Union of every meetup id whose unlisted status the requestor may see. */
  all: string[];
}

// Unlisted meetups stay out of public listings, but the requestor still sees any
// they organize, attend, or reach through a group they belong to.
export const getVisibleUnlistedMeetups = async (
  requestor: User | undefined
): Promise<VisibleUnlistedMeetups> => {
  const organizedIds = new Set<string>();
  const attendedIds = new Set<string>();
  const groupMeetupIds = new Set<string>();

  if (requestor != null) {
    const attended = await Ticket.createQueryBuilder('ticket')
      .select('ticket.meetup_id', 'meetup_id')
      .where('ticket.user_id = :userId', { userId: requestor.id })
      .getRawMany<{ meetup_id: string }>();
    for (const row of attended) attendedIds.add(String(row.meetup_id));

    const organized = await Meetup.find({
      select: { id: true },
      where: [
        { lead_organizer: { id: requestor.id } },
        { organizers: { id: requestor.id } },
      ],
    });
    for (const meetup of organized) organizedIds.add(meetup.id);

    // Meetups assigned to any group the requestor belongs to (explicitly or via
    // a linked Discord server).
    const membership = await User.findOne({
      where: { id: requestor.id },
      relations: { groups: true },
    });
    const groupIds =
      membership != null ? await getEffectiveGroupIds(membership) : [];
    const groupMeetups =
      groupIds.length > 0
        ? await Meetup.find({
            select: { id: true },
            where: { groups: { id: In(groupIds) } },
          })
        : [];
    for (const meetup of groupMeetups) groupMeetupIds.add(meetup.id);
  }

  return {
    organizedIds,
    attendedIds,
    groupMeetupIds,
    all: [...attendedIds, ...organizedIds, ...groupMeetupIds],
  };
};
