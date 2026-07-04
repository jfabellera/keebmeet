/// <reference types="jest" />

// A single stand-in for S3Client.send; commands are tagged so tests can assert
// which S3 operation was issued.
const send = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send })),
  PutObjectCommand: jest.fn((input: unknown) => ({ command: 'Put', input })),
  CopyObjectCommand: jest.fn((input: unknown) => ({ command: 'Copy', input })),
  DeleteObjectCommand: jest.fn((input: unknown) => ({
    command: 'Delete',
    input,
  })),
}));

jest.mock('../config', () => ({
  __esModule: true,
  default: {
    r2AccessKeyId: 'ak',
    r2SecretKey: 'sk',
    r2JurisdictionUrl: 'https://acct.r2.cloudflarestorage.com',
    r2PublicBaseUrl: 'https://pub.r2.dev',
    r2Bucket: 'keebmeet',
  },
}));

import {
  buildTempImageKey,
  isManagedKey,
  promoteImage,
  publicUrl,
  toStoredKey,
} from './objectStorage';

beforeEach(() => {
  send.mockReset();
  send.mockResolvedValue({});
});

describe('isManagedKey', () => {
  it('is true for bare object keys', () => {
    expect(isManagedKey('meetups/x.png')).toBe(true);
  });

  it('is false for absolute URLs and empty strings', () => {
    expect(isManagedKey('https://cdn/x.png')).toBe(false);
    expect(isManagedKey('http://cdn/x.png')).toBe(false);
    expect(isManagedKey('')).toBe(false);
  });
});

describe('publicUrl', () => {
  it('prefixes bare keys with the public base', () => {
    expect(publicUrl('meetups/x.png')).toBe('https://pub.r2.dev/meetups/x.png');
  });

  it('returns absolute URLs unchanged', () => {
    expect(publicUrl('https://cdn/x.png')).toBe('https://cdn/x.png');
  });

  it('returns empty string for an empty key (no image)', () => {
    expect(publicUrl('')).toBe('');
  });
});

describe('toStoredKey', () => {
  it('recovers the object key from one of our public URLs', () => {
    expect(toStoredKey('https://pub.r2.dev/meetups/x.png')).toBe('meetups/x.png');
  });

  it('leaves external URLs, bare keys, and empty strings unchanged', () => {
    expect(toStoredKey('https://external/x.png')).toBe('https://external/x.png');
    expect(toStoredKey('meetups/x.png')).toBe('meetups/x.png');
    expect(toStoredKey('')).toBe('');
  });
});

describe('buildTempImageKey', () => {
  it('creates a unique key under the temp prefix', () => {
    expect(buildTempImageKey('png')).toMatch(
      /^meetups\/tmp\/[0-9a-f-]{36}\.png$/
    );
  });
});

describe('promoteImage', () => {
  it('is a no-op for permanent keys', async () => {
    expect(await promoteImage('meetups/x.png')).toBe('meetups/x.png');
    expect(send).not.toHaveBeenCalled();
  });

  it('is a no-op for absolute URLs', async () => {
    expect(await promoteImage('https://cdn/x.png')).toBe('https://cdn/x.png');
    expect(send).not.toHaveBeenCalled();
  });

  it('copies a temp object to the permanent prefix and deletes the temp copy', async () => {
    const result = await promoteImage('meetups/tmp/abc.png');

    expect(result).toBe('meetups/abc.png');
    const commands = send.mock.calls.map(([command]) => command);
    expect(commands.find((c) => c.command === 'Copy').input).toMatchObject({
      Bucket: 'keebmeet',
      CopySource: 'keebmeet/meetups/tmp/abc.png',
      Key: 'meetups/abc.png',
    });
    expect(commands.find((c) => c.command === 'Delete').input).toMatchObject({
      Bucket: 'keebmeet',
      Key: 'meetups/tmp/abc.png',
    });
  });

  it('still returns the permanent key if deleting the temp copy fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    send.mockImplementation((command: { command: string }) =>
      command.command === 'Delete'
        ? Promise.reject(new Error('boom'))
        : Promise.resolve({})
    );

    expect(await promoteImage('meetups/tmp/abc.png')).toBe('meetups/abc.png');
    errorSpy.mockRestore();
  });
});
