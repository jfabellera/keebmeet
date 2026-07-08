import crypto from 'crypto';
import QRCode from 'qrcode';
import config from '../config';

export const hmacTicket = (ticketId: string): string => {
  const data = `qr:${ticketId}`;
  return crypto
    .createHmac('sha256', config.qrCodeKey)
    .update(data)
    .digest('base64url')
    .slice(0, 14); // 80 bits
};

export const generateQrCodeBuffer = (ticketId: string): Promise<Buffer> => {
  const hmac = hmacTicket(ticketId);
  return QRCode.toBuffer(hmac, {
    type: 'png',
    // Render at a high resolution so the code stays crisp when displayed large
    // in the RSVP email and on Discord. Both paths share this single buffer.
    width: 400,
  });
};
