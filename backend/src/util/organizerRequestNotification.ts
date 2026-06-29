import config from '../config';
import { User } from '../entity/User';
import { sendOrganizerRequestEmail } from './email';

/**
 * Notifies every admin by email that a user has requested organizer access.
 *
 * Best-effort: failures are logged (by the email util) rather than thrown, so a
 * mail outage never blocks the request itself.
 */
export const notifyAdminsOfOrganizerRequest = async (
  requester: User
): Promise<void> => {
  const admins = await User.find({ where: { is_admin: true } });
  const reviewLink = `${config.webUrl}/admin`;

  await Promise.all(
    admins.map((admin) =>
      sendOrganizerRequestEmail(
        admin.email,
        requester.nick_name,
        requester.email,
        reviewLink
      )
    )
  );
};
