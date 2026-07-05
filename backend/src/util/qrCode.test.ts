/// <reference types="jest" />

// A fixed signing key so HMAC output is deterministic and can be asserted
// against precomputed values.
jest.mock('../config', () => ({
  __esModule: true,
  default: { qrCodeKey: 'test-qr-code-key' },
}));

import { hmacTicket, generateQrCodeBuffer } from './qrCode';

// Precomputed HMAC-SHA256 of `qr:<ticketId>` keyed by 'test-qr-code-key',
// base64url-encoded and truncated to 14 chars — mirrors util/qrCode.ts.
const EXPECTED = {
  'ticket-123': '8sdeAPRrGNX86N',
  'ticket-456': '8NCwVKSFZ_xLKv',
} as const;

describe('hmacTicket', () => {
  it('produces the expected signature for a known key and ticket', () => {
    expect(hmacTicket('ticket-123')).toBe(EXPECTED['ticket-123']);
  });

  it('is deterministic for the same ticket id', () => {
    expect(hmacTicket('ticket-123')).toBe(hmacTicket('ticket-123'));
  });

  it('produces different signatures for different ticket ids', () => {
    expect(hmacTicket('ticket-123')).not.toBe(hmacTicket('ticket-456'));
  });

  it('is 14 base64url characters (80 bits)', () => {
    const hmac = hmacTicket('ticket-123');
    expect(hmac).toHaveLength(14);
    // base64url alphabet only: no +, /, or = padding.
    expect(hmac).toMatch(/^[A-Za-z0-9_-]{14}$/);
  });
});

describe('generateQrCodeBuffer', () => {
  it('returns a PNG buffer', async () => {
    const buffer = await generateQrCodeBuffer('ticket-123');

    expect(Buffer.isBuffer(buffer)).toBe(true);
    // PNG magic number: 0x89 'P' 'N' 'G'.
    expect(buffer.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  it('encodes different tickets into different images', async () => {
    const [a, b] = await Promise.all([
      generateQrCodeBuffer('ticket-123'),
      generateQrCodeBuffer('ticket-456'),
    ]);

    expect(a.equals(b)).toBe(false);
  });
});
