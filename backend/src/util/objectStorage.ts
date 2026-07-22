import {
  CopyObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import config from '../config';

const BUCKET = config.r2Bucket;

const ABSOLUTE_URL = /^https?:\/\//i;

// Accepted upload mimetypes mapped to the extension stored in R2. Single source
// of truth for both the multer filter (routes) and the upload handler.
export const IMAGE_EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
export const ALLOWED_IMAGE_TYPES = Object.keys(IMAGE_EXT_BY_MIME);

// Fresh uploads land under a single root temp prefix ("tmp/<category>/..."),
// e.g. tmp/meetups/ or tmp/users/. They are "promoted" to the permanent key
// ("<category>/...") only when the record referencing them is saved. A single
// R2 lifecycle rule on "tmp/" reaps every category's abandoned uploads, so new
// image categories need no additional rule.
const TEMP_PREFIX = 'tmp/';

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
 * True when `value` is a bare R2 object key we own (not an external absolute
 * URL such as a legacy or Eventbrite image, which must never be deleted).
 */
export const isManagedKey = (value: string): boolean =>
  value !== '' && !ABSOLUTE_URL.test(value);

/**
 * Resolves a stored image reference to a URL a browser can load.
 *
 * New uploads are stored as bare R2 object keys, but some meetups reference an
 * external absolute URL (legacy rows, Eventbrite-sourced images), and an empty
 * key means "no image". Only bare keys are prefixed with the R2 public base;
 * everything else is returned unchanged.
 */
export const publicUrl = (keyOrUrl: string): string =>
  isManagedKey(keyOrUrl)
    ? `${config.r2PublicBaseUrl.replace(/\/+$/, '')}/${keyOrUrl}`
    : keyOrUrl;

// Wraps an image URL in a wsrv.nl proxy that crops it to the given size,
// defaulting to the 2:1 social-share card. Empty in, empty out.
export const cropImageUrl = (
  url: string,
  width = 1200,
  height = 600
): string =>
  url
    ? `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${width}&h=${height}&fit=cover`
    : url;

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
  return base !== '' && value.startsWith(`${base}/`)
    ? value.slice(base.length + 1)
    : value;
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
 * Builds a unique key for a freshly uploaded image, under the given category's
 * temp prefix, e.g. `buildTempImageKey('users', 'png')` -> `users/tmp/<uuid>.png`.
 * It becomes permanent via {@link promoteImage} once the record is saved.
 */
export const buildTempImageKey = (category: string, ext: string): string =>
  `${TEMP_PREFIX}${category}/${randomUUID()}.${ext}`;

/**
 * Promotes a freshly uploaded temp object to its permanent key by copying it
 * out of the temp prefix (dropping the leading `tmp/`) and removing the temp
 * copy. Returns the permanent key.
 *
 * A no-op for anything that isn't a temp key — permanent keys (an unchanged
 * image on edit) and external absolute URLs (legacy/Eventbrite) are returned
 * unchanged, so callers can pass whatever key they hold.
 */
export const promoteImage = async (keyOrUrl: string): Promise<string> => {
  if (!keyOrUrl.startsWith(TEMP_PREFIX)) {
    return keyOrUrl;
  }

  const permanentKey = keyOrUrl.slice(TEMP_PREFIX.length);

  // The copy must succeed for the record to reference a valid object.
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
