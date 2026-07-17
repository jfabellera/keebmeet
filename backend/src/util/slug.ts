import { slugify as baseSlugify } from '@keebmeet/shared';
import { randomBytes } from 'crypto';
import { Meetup } from '../entity/Meetup';

// Shared slugify, with a random fallback for names that reduce to an empty slug
// (used by non-interactive callers: the Eventbrite import and the backfill).
export const slugify = (text: string): string =>
  baseSlugify(text) || randomBytes(6).toString('hex');

// Append -2, -3, … until no meetup uses the slug. For non-interactive callers
// (Eventbrite import) that can't ask a user to resolve a clash.
export const uniqueMeetupSlug = async (base: string): Promise<string> => {
  let candidate = base;
  let n = 1;
  while ((await Meetup.countBy({ slug: candidate })) > 0) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
};
