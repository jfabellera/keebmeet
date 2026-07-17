import { User } from '../entity/User';

// Coerce arbitrary text into a valid username (see USERNAME_REGEX in
// @keebmeet/shared): lowercase snake_case, 3–30 chars, must contain a letter.
export const usernamify = (seed: string): string => {
  const base = seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!/[a-z]/.test(base) || base.length < 3) {
    return base === '' ? 'user' : `user_${base}`.slice(0, 30);
  }
  return base.slice(0, 30);
};

// Append _2, _3, … until no user holds the username. Used to backfill/seed a
// unique handle from a non-unique seed (nick_name, else email local-part).
export const deriveUniqueUsername = async (seed: string): Promise<string> => {
  const base = usernamify(seed);
  let candidate = base;
  let n = 1;
  while ((await User.countBy({ username: candidate })) > 0) {
    n += 1;
    candidate = `${base}_${n}`;
  }
  return candidate;
};
