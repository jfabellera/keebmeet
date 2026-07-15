import crypto from 'crypto';
import config from '../config';

const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * Encrypts data using AES-256-CBC algorithm
 *
 * @param plainText Data to encrypt
 * @returns Encrypted data with initialization vector prepended to cipher text
 */
export const encrypt = (plainText: string): string => {
  const key = Buffer.from(config.aesKey, 'base64');
  const ivHex = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, ivHex);
  const cipherText =
    cipher.update(plainText, 'utf8', 'hex') + cipher.final('hex');

  // Prepend iv to cipher text
  return ivHex.toString('hex') + cipherText;
};

/**
 * Decrypts data using AES-256-CBC algorithm
 *
 * @param encryptedData Data to decrypt
 * @returns Decrypted data
 */
export const decrypt = (encryptedData: string): string => {
  // Separate iv and cipher text
  const iv = encryptedData.substring(0, 32);
  const cipherText = encryptedData.substring(32);

  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGORITHM,
    Buffer.from(config.aesKey, 'base64'),
    Buffer.from(iv, 'hex')
  );
  const decryptedData =
    decipher.update(cipherText, 'hex', 'utf8') + decipher.final('utf-8');

  return decryptedData;
};
