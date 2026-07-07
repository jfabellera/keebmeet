import sharp from 'sharp';

interface NormalizeOptions {
  /** Cap on the longest edge in pixels. Images are downscaled to fit, never enlarged. */
  maxDimension?: number;
}

/**
 * Downscales and re-encodes an uploaded image before it is stored in R2 so a
 * multi-megapixel phone/camera photo lands as a few hundred KB. Keeps the
 * original format (so the R2 key extension logic in objectStorage is unchanged),
 * applies EXIF orientation then drops the tag (fixes sideways phone photos), and
 * strips metadata (sharp does not copy it unless asked). Throws on input sharp
 * cannot decode, so the caller can return a 400.
 */
export const normalizeImage = async (
  buffer: Buffer,
  mimetype: string,
  { maxDimension = 2560 }: NormalizeOptions = {}
): Promise<Buffer> => {
  const pipeline = sharp(buffer).rotate().resize({
    width: maxDimension,
    height: maxDimension,
    fit: 'inside',
    withoutEnlargement: true,
  });

  switch (mimetype) {
    case 'image/jpeg':
      return pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    case 'image/webp':
      return pipeline.webp({ quality: 90 }).toBuffer();
    case 'image/png':
      return pipeline.png({ compressionLevel: 9 }).toBuffer();
    default:
      // Unreachable: the multer filter and controller both reject other types.
      return pipeline.toBuffer();
  }
};
