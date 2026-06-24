import { rateLimit } from 'express-rate-limit';

/**
 * Limits abuse of the unauthenticated verification-resend endpoint. Even with
 * uniform responses, an attacker could otherwise email-bomb a known address or
 * brute-force valid user IDs at scale.
 */
export const resendVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // per IP per window
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    message: 'Too many requests. Please try again later.',
  },
});

/**
 * Throttles credential-stuffing / brute-force attempts against login.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // per IP per window
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    message: 'Too many requests. Please try again later.',
  },
});
