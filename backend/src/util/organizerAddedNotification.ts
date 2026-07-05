import { In } from 'typeorm';
import config from '../config';
import { User } from '../entity/User';
import { sendOrganizerAddedEmail } from './email';

/**
 * Notifies newly added co-organizers by email that they've been added to a
 * meetup, naming the lead organizer and the meetup.
 *
 * Only verified users are emailed. Best-effort: failures are logged (by the
 * email util) rather than thrown, so a mail outage never blocks the update.
 */
export const notifyAddedOrganizers = async (
  addedUserIds: string[],
  meetupId: string,
  meetupName: string,
  leadOrganizerName: string
): Promise<void> => {
  if (addedUserIds.length === 0) return;

  const users = await User.find({
    where: { id: In(addedUserIds), is_verified: true },
  });
  const manageLink = `${config.webUrl}/meetup/${meetupId}/manage`;

  await Promise.all(
    users.map((user) =>
      sendOrganizerAddedEmail(
        user.email,
        meetupName,
        leadOrganizerName,
        manageLink
      )
    )
  );
};
