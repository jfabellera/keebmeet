import sharp from 'sharp';
import { normalizeImage } from './imageProcessing';

const solidImage = (
  width: number,
  height: number,
  format: 'png' | 'jpeg' | 'webp'
): Promise<Buffer> => {
  const base = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 120, g: 80, b: 40 },
    },
  });
  if (format === 'png') return base.png().toBuffer();
  if (format === 'jpeg') return base.jpeg().toBuffer();
  return base.webp().toBuffer();
};

describe('normalizeImage', () => {
  it('downscales an oversized image so its long edge fits maxDimension', async () => {
    const input = await solidImage(4000, 2000, 'jpeg');
    const out = await normalizeImage(input, 'image/jpeg', {
      maxDimension: 2560,
    });
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(2560);
    expect(meta.height).toBe(1280);
    expect(meta.format).toBe('jpeg');
  });

  it('does not enlarge an image already smaller than maxDimension', async () => {
    const input = await solidImage(800, 400, 'png');
    const out = await normalizeImage(input, 'image/png', {
      maxDimension: 2560,
    });
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(400);
    expect(meta.format).toBe('png');
  });

  it('preserves the webp format', async () => {
    const input = await solidImage(3000, 3000, 'webp');
    const out = await normalizeImage(input, 'image/webp', {
      maxDimension: 1024,
    });
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(1024);
    expect(meta.format).toBe('webp');
  });

  it('rejects input that cannot be decoded as an image', async () => {
    await expect(
      normalizeImage(Buffer.from('not an image'), 'image/png')
    ).rejects.toThrow();
  });
});
