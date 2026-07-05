/// <reference types="jest" />

jest.mock('../config', () => ({
  __esModule: true,
  default: { jwtSecret: 'test-secret', webUrl: 'https://app.example.com' },
}));

import jwt from 'jsonwebtoken';
import {
  buildVerificationLink,
  generateVerificationToken,
  verifyVerificationToken,
} from './emailVerification';

describe('generateVerificationToken / verifyVerificationToken', () => {
  it('round-trips the user id', () => {
    const token = generateVerificationToken('42');
    expect(verifyVerificationToken(token)).toBe('42');
  });

  it('rejects a token signed with a different secret', () => {
    const forged = jwt.sign(
      { user_id: 42, purpose: 'email_verify' },
      'wrong-secret'
    );
    expect(verifyVerificationToken(forged)).toBeNull();
  });

  it('rejects a token with the wrong purpose', () => {
    const other = jwt.sign(
      { user_id: 42, purpose: 'discord_link' },
      'test-secret'
    );
    expect(verifyVerificationToken(other)).toBeNull();
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign(
      { user_id: 42, purpose: 'email_verify' },
      'test-secret',
      { expiresIn: -10 }
    );
    expect(verifyVerificationToken(expired)).toBeNull();
  });

  it('rejects a malformed token', () => {
    expect(verifyVerificationToken('not-a-jwt')).toBeNull();
  });
});

describe('buildVerificationLink', () => {
  it('builds a link to the web app carrying the token', () => {
    const token = generateVerificationToken('1');
    expect(buildVerificationLink(token)).toBe(
      `https://app.example.com/verify-email?token=${encodeURIComponent(token)}`
    );
  });
});
