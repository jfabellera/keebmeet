/// <reference types="jest" />

jest.mock('../config', () => ({
  __esModule: true,
  default: { otpSecret: 'test-otp-secret' },
}));

import { generateOtp, verifyOtp, OTP_PERIOD_MS } from './otp';

// A fixed instant so the tests don't depend on the wall clock.
const NOW = 1_700_000_000_000;

describe('generateOtp', () => {
  it('produces a 6-digit numeric code', () => {
    expect(generateOtp(1, NOW)).toMatch(/^\d{6}$/);
  });

  it('is deterministic within the same window', () => {
    expect(generateOtp(1, NOW)).toBe(generateOtp(1, NOW + 1000));
  });

  it('differs across users', () => {
    expect(generateOtp(1, NOW)).not.toBe(generateOtp(2, NOW));
  });

  it('changes once the window rolls over', () => {
    expect(generateOtp(1, NOW)).not.toBe(generateOtp(1, NOW + OTP_PERIOD_MS));
  });
});

describe('verifyOtp', () => {
  it('accepts a code within its window', () => {
    const otp = generateOtp(1, NOW);
    expect(verifyOtp(1, otp, NOW)).toBe(true);
  });

  it('still accepts a code one window later (guaranteed one-hour validity)', () => {
    const otp = generateOtp(1, NOW);
    expect(verifyOtp(1, otp, NOW + OTP_PERIOD_MS)).toBe(true);
  });

  it('rejects a code that is two windows old (expired)', () => {
    const otp = generateOtp(1, NOW);
    expect(verifyOtp(1, otp, NOW + 2 * OTP_PERIOD_MS)).toBe(false);
  });

  it('rejects a code issued for another user', () => {
    const otp = generateOtp(2, NOW);
    expect(verifyOtp(1, otp, NOW)).toBe(false);
  });

  it('rejects a malformed code', () => {
    expect(verifyOtp(1, 'abc', NOW)).toBe(false);
  });

  it('rejects a different but valid-looking code', () => {
    const correct = generateOtp(1, NOW);
    const wrong = (((parseInt(correct, 10) + 1) % 1_000_000) + '').padStart(
      6,
      '0'
    );
    expect(verifyOtp(1, wrong, NOW)).toBe(false);
  });
});
