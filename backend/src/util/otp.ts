import crypto from 'crypto';
import config from '../config';

/**
 * Stateless, time-based one-time passwords for email verification.
 *
 * The code is an HMAC of the user id and a counter derived from the current
 * time, so nothing needs to be persisted: the same code can be re-derived at
 * verification time from the shared secret. The secret comes from the
 * `OTP_SECRET` environment variable (see {@link config}).
 */

const OTP_DIGITS = 6;

/** A code is tied to a one-hour window. */
export const OTP_PERIOD_MS = 60 * 60 * 1000;

const counterFor = (timestamp: number): number =>
  Math.floor(timestamp / OTP_PERIOD_MS);

/** RFC 4226-style dynamic truncation of an HMAC-SHA256 digest. */
const deriveOtp = (userId: number, counter: number): string => {
  const hmac = crypto.createHmac('sha256', config.otpSecret);
  hmac.update(`${userId}:${counter}`);
  const digest = hmac.digest();

  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return (binary % 10 ** OTP_DIGITS).toString().padStart(OTP_DIGITS, '0');
};

/** Constant-time string comparison that tolerates length mismatches. */
const safeEqual = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
};

/** Generates the current verification code for a user. */
export const generateOtp = (
  userId: number,
  now: number = Date.now()
): string => deriveOtp(userId, counterFor(now));

/**
 * Verifies a code for a user.
 *
 * Both the current and immediately previous one-hour windows are accepted: a
 * code issued late in a window would otherwise expire almost immediately, so
 * allowing the previous window guarantees every code stays valid for at least
 * one full hour after it is sent.
 */
export const verifyOtp = (
  userId: number,
  otp: string,
  now: number = Date.now()
): boolean => {
  const counter = counterFor(now);
  return (
    safeEqual(otp, deriveOtp(userId, counter)) ||
    safeEqual(otp, deriveOtp(userId, counter - 1))
  );
};
