import {
  CopyObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import config from '../config';

const BUCKET = 'keebmeet';

const ABSOLUTE_URL = /^https?:\/\//i;

// Fresh uploads land under a temp prefix. They are "promoted" to the permanent
// prefix only when a meetup that references them is saved; anything left under
// the temp prefix (abandoned uploads) is reaped by an R2 bucket lifecycle rule.
const IMAGE_PREFIX = 'meetups/';
const TEMP_PREFIX = 'meetups/tmp/';

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
  if (keyOrUrl === '') {
    return '';
  }
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
 * Inverse of {@link publicUrl}: recovers the stored object key from a value that
 * may be a public URL for an object we own. Values not under our public base
 * (external URLs, bare keys, empty) are returned unchanged. Lets a client
 * round-trip a serialized `publicUrl` back to the key we persist — needed where
 * a whole set of references is re-submitted (e.g. the idle-images array) rather
 * than only the changed ones.
 */
export const toStoredKey = (value: string): string => {
  const base = config.r2PublicBaseUrl.replace(/\/+$/, '');
  if (base !== '' && value.startsWith(`${base}/`)) {
    return value.slice(base.length + 1);
  }
  return value;
};

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
 * Builds a unique key for a freshly uploaded meetup image, under the temp
 * prefix, e.g. `meetups/tmp/<uuid>.png`. It becomes permanent via
 * {@link promoteImage} once a meetup referencing it is saved.
 */
export const buildTempImageKey = (ext: string): string =>
  `${TEMP_PREFIX}${randomUUID()}.${ext}`;

/**
 * Promotes a freshly uploaded temp object to its permanent key by copying it
 * out of the temp prefix and removing the temp copy. Returns the permanent key.
 *
 * A no-op for anything that isn't a temp key — permanent keys (an unchanged
 * image on edit) and external absolute URLs (legacy/Eventbrite) are returned
 * unchanged, so callers can pass whatever `image_key` they hold.
 */
export const promoteImage = async (keyOrUrl: string): Promise<string> => {
  if (!keyOrUrl.startsWith(TEMP_PREFIX)) {
    return keyOrUrl;
  }

  const permanentKey = `${IMAGE_PREFIX}${keyOrUrl.slice(TEMP_PREFIX.length)}`;

  // The copy must succeed for the meetup to reference a valid object.
  await getS3Client().send(
    new CopyObjectCommand({
      Bucket: BUCKET,
      CopySource: `${BUCKET}/${keyOrUrl}`,
      Key: permanentKey,
    })
  );

  // Removing the temp copy is best-effort: the permanent copy already exists,
  // and any leftover temp object is reaped by the bucket lifecycle rule.
  try {
    await deleteObject(keyOrUrl);
  } catch (error) {
    console.error(`Failed to delete promoted temp image "${keyOrUrl}":`, error);
  }

  return permanentKey;
};
