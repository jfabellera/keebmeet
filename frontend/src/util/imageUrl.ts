import config from '../config';

interface ResizeOptions {
  width: number;
  quality?: number;
}

export const resizedImageUrl = (
  url: string,
  { width, quality = 80 }: ResizeOptions
): string => {
  const base = config.cdnBaseUrl.replace(/\/+$/, '');
  if (base === '' || !url.startsWith(`${base}/`)) return url;

  const dpr = Math.min(
    typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    2
  );
  const targetWidth = Math.round(width * dpr);
  const source = url.slice(base.length + 1);
  const options = `width=${targetWidth},quality=${quality},format=auto,fit=scale-down`;
  return `${base}/cdn-cgi/image/${options}/${source}`;
};
