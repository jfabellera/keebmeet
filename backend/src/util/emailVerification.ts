import jwt from 'jsonwebtoken';
import config from '../config';

/**
 * Stateless email-verification links.
 *
 * The verification link carries a short-lived JWT signed with the server
 * secret. Nothing is persisted: clicking the link returns the token, and the
 * server re-validates the signature and embedded expiry. The `purpose` field
 * keeps these tokens from being interchangeable with the other signed tokens
 * issued by the auth controller (sessions, Discord links).
 */
export interface EmailVerificationTokenData {
  user_id: number;
  purpose: 'email_verify';
}

const TOKEN_TTL = '1h';

/** Issues a one-hour verification token for a user. */
export const generateVerificationToken = (userId: number): string =>
  jwt.sign(
    { user_id: userId, purpose: 'email_verify' } as EmailVerificationTokenData,
    config.jwtSecret,
    { expiresIn: TOKEN_TTL }
  );

/**
 * Validates a verification token. Returns the user id it was issued for, or
 * null if the token is missing, tampered with, expired, or not a verification
 * token.
 */
export const verifyVerificationToken = (token: string): number | null => {
  try {
    const data = jwt.verify(token, config.jwtSecret) as EmailVerificationTokenData;
    if (data.purpose !== 'email_verify') {
      return null;
    }
    return data.user_id;
  } catch {
    return null;
  }
};

/** Builds the user-facing verification link for an issued token. */
export const buildVerificationLink = (token: string): string =>
  `${config.webUrl}/verify-email?token=${encodeURIComponent(token)}`;
