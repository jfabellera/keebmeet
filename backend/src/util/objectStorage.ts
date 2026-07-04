import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import config from '../config';

const BUCKET = 'keebmeet';

const ABSOLUTE_URL = /^https?:\/\//i;

let s3: S3Client | null = null;

const getS3Client = (): S3Client => {
  if (s3 === null) {
    const { r2AccessKeyId, r2SecretKey, r2JurisdictionUrl } = config;
    if (
      r2AccessKeyId === '' ||
      r2SecretKey === '' ||
      r2JurisdictionUrl === ''
    ) {
      throw new Error('R2 credentials are not set; cannot access storage.');
    }
    s3 = new S3Client({
      region: 'auto',
      endpoint: new URL(r2JurisdictionUrl).origin,
      credentials: {
        accessKeyId: r2AccessKeyId,
        secretAccessKey: r2SecretKey,
      },
    });
  }
  return s3;
};

/**
 * Uploads an object to R2 and returns the key it was stored under.
 *
 * `contentType` should be set for anything served back to a browser (e.g.
 * 'image/png'), otherwise it defaults to a generic binary type and browsers
 * download rather than render it.
 */
export const upload = async (
  key: string,
  body: Buffer | Uint8Array | Blob | string,
  contentType?: string
): Promise<string> => {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return key;
};

/**
 * Resolves a stored image reference to a URL a browser can load.
 *
 * New uploads are stored as bare R2 object keys, but some meetups reference an
 * external absolute URL (legacy rows, Eventbrite-sourced images). Absolute URLs
 * are returned unchanged; bare keys are prefixed with the configured R2 public
 * base URL.
 */
export const publicUrl = (keyOrUrl: string): string => {
  if (ABSOLUTE_URL.test(keyOrUrl)) {
    return keyOrUrl;
  }
  const base = config.r2PublicBaseUrl.replace(/\/+$/, '');
  return `${base}/${keyOrUrl}`;
};

/**
 * True when `value` is a bare R2 object key we own (not an external absolute
 * URL such as a legacy or Eventbrite image, which must never be deleted).
 */
export const isManagedKey = (value: string): boolean =>
  value !== '' && !ABSOLUTE_URL.test(value);

/**
 * Deletes an object from R2 by key. R2/S3 deletes are idempotent — deleting a
 * missing key is not an error.
 */
export const deleteObject = async (key: string): Promise<void> => {
  await getS3Client().send(
    new DeleteObjectCommand({ Bucket: BUCKET, Key: key })
  );
};

/**
 * Builds a unique object key for a meetup image, e.g. `meetups/<uuid>.png`.
 */
export const buildImageKey = (ext: string): string =>
  `meetups/${randomUUID()}.${ext}`;
