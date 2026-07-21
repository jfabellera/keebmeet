import config from '../config';

export interface OgPageData {
  title: string;
  description: string;
  url: string;
  // Absolute image URL, or empty for a text-only card.
  image?: string;
  imageAlt?: string;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Minimal HTML carrying Open Graph / Twitter Card tags for link-preview
// crawlers. Only <head> matters to them; the body is a courtesy redirect.
export const renderOgHtml = ({
  title,
  description,
  url,
  image,
  imageAlt,
}: OgPageData): string => {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const u = escapeHtml(url);
  const hasImage = image != null && image !== '';
  const img = hasImage ? escapeHtml(image) : '';
  const alt = escapeHtml(imageAlt ?? title);

  const imageTags = hasImage
    ? `
    <meta property="og:image" content="${img}" />
    <meta property="og:image:alt" content="${alt}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${img}" />`
    : `
    <meta name="twitter:card" content="summary" />`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${t}</title>
    <meta name="description" content="${d}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="KeebMeet" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:url" content="${u}" />${imageTags}
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <link rel="canonical" href="${u}" />
    <meta http-equiv="refresh" content="0; url=${u}" />
  </head>
  <body>
    <p>Redirecting to <a href="${u}">${t}</a>&hellip;</p>
  </body>
</html>`;
};

export const meetupUrl = (slug: string): string =>
  `${config.webUrl.replace(/\/+$/, '')}/meetup/${encodeURIComponent(slug)}`;
