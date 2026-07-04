import { type User } from '../entity/User';
import { publicUrl } from './objectStorage';
import { type User as UserInterface } from '@keebmeet/shared';

/**
 * Maps a User entity to the public-facing response shape, omitting sensitive
 * columns such as password_hash and encrypted_eventbrite_token.
 */
export const toUserResponse = (user: User): UserInterface => {
  return {
    id: user.id,
    email: user.email,
    display_name: user.nick_name,
    first_name: user.first_name,
    last_name: user.last_name,
    is_admin: user.is_admin,
    is_owner: user.is_owner,
    is_organizer: user.is_organizer,
    is_eventbrite_linked: user.encrypted_eventbrite_token != null,
    is_discord_linked: user.discord_id != null,
    photo_url: publicUrl(user.photo_key ?? ''),
  } satisfies UserInterface;
};
