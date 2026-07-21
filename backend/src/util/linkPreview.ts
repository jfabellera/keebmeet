import { lookup } from 'dns/promises';
import { isIP } from 'net';

export interface LinkPreview {
  title: string | null;
  image: string | null;
  siteName: string | null;
}

const EMPTY: LinkPreview = { title: null, image: null, siteName: null };

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map<string, { value: LinkPreview; expires: number }>();

const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 5;
// Sites like imgur serve OpenGraph tags only to recognized crawler UAs, so
// lead with a known unfurler token.
const USER_AGENT =
  'Discordbot/2.0 (compatible; keebmeet-link-preview/1.0; +https://keebmeet)';

/**
 * Cheap first-pass SSRF guard on the literal host: reject non-http(s) and
 * obvious loopback/private/link-local literals before we even resolve DNS.
 */
const isFetchablePreviewUrl = (raw: string): boolean => {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return false;
  }
  // Reject private / loopback / link-local IPv4 literals and IPv6 loopback.
  if (/^(0\.|127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  if (host === '::1' || host === '[::1]') return false;

  return true;
};

const isBlockedIPv4 = (ip: string): boolean => {
  const parts = ip.split('.').map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)
  ) {
    return true; // Not parseable as IPv4 — fail closed.
  }
  const [a, b] = parts;
  if (a === 0 || a === 127) return true; // "this host", loopback
  if (a === 10) return true; // private
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 169 && b === 254) return true; // link-local (incl. cloud metadata)
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast + reserved
  return false;
};

const isBlockedIPv6 = (ip: string): boolean => {
  const address = ip.toLowerCase();
  if (address === '::1' || address === '::') return true; // loopback, unspecified
  // IPv4-mapped (::ffff:a.b.c.d) — classify by the embedded IPv4 address.
  const mapped = address.match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped != null) return isBlockedIPv4(mapped[1]);
  const firstHextet = parseInt(address.split(':')[0] || '0', 16) || 0;
  if ((firstHextet & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((firstHextet & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  return false;
};

/**
 * Whether an IP literal is in a range we refuse to fetch (loopback, private,
 * link-local, CGNAT, multicast/reserved). Anything that isn't a recognizable
 * public IP fails closed. Exported for testing.
 */
export const isBlockedAddress = (address: string): boolean => {
  const family = isIP(address);
  if (family === 4) return isBlockedIPv4(address);
  if (family === 6) return isBlockedIPv6(address);
  return true; // Not a valid IP — fail closed.
};

/**
 * Reject a URL whose host resolves to any non-public address. Throws so the
 * caller aborts the fetch. Exported for testing.
 *
 * Residual risk: a DNS-rebinding window between this lookup and fetch()'s own
 * resolution. Fully closing it would require pinning the socket to the checked
 * IP, which node's fetch doesn't expose.
 */
export const assertPublicHost = async (url: string): Promise<void> => {
  const { hostname } = new URL(url);
  const results = await lookup(hostname, { all: true });
  if (results.length === 0) throw new Error(`No DNS records for ${hostname}`);
  for (const { address } of results) {
    if (isBlockedAddress(address)) {
      throw new Error(`Refusing to fetch non-public address for ${hostname}`);
    }
  }
};

interface FetchedPage {
  url: string;
  status: number;
  headers: Record<string, string>;
  data: string;
}

/**
 * Fetch a URL following redirects manually, DNS-validating the host on EVERY hop
 * so a public URL can't 302 the server onto an internal address. Reads the body
 * only for non-image responses (direct images need no body).
 */
const fetchValidatedPage = async (startUrl: string): Promise<FetchedPage> => {
  let url = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isFetchablePreviewUrl(url)) {
      throw new Error(`Refusing to fetch ${url}`);
    }
    await assertPublicHost(url);

    const response = await fetch(url, {
      redirect: 'manual',
      headers: { 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location == null || location === '') {
        throw new Error('Redirect without a location');
      }
      url = new URL(location, url).href;
      continue;
    }

    const headers: Record<string, string> = {};
    response.headers.forEach((headerValue, key) => {
      headers[key] = headerValue;
    });
    const isImage = (headers['content-type'] ?? '').startsWith('image/');
    const data = isImage ? '' : await response.text();

    return { url, status: response.status, headers, data };
  }

  throw new Error('Too many redirects');
};

const decodeEntities = (text: string): string =>
  text
    .replace(/&#x([0-9a-f]+);/gi, (match, hex: string) => {
      const codePoint = parseInt(hex, 16);
      return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
    })
    .replace(/&#(\d+);/g, (match, dec: string) => {
      const codePoint = Number(dec);
      return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
    })
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

// One attribute; the value may be double-quoted, single-quoted, or bare.
const ATTR_RE = /([a-zA-Z][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

/** property/name → decoded content for every <meta> tag, first wins. */
const metaContents = (html: string): Map<string, string> => {
  const tags = new Map<string, string>();
  for (const tag of html.matchAll(/<meta\s[^>]*>/gi)) {
    let key: string | null = null;
    let content: string | null = null;
    for (const attr of tag[0].matchAll(ATTR_RE)) {
      const name = attr[1].toLowerCase();
      const value = attr[2] ?? attr[3] ?? attr[4] ?? '';
      if (name === 'property' || name === 'name') key ??= value.toLowerCase();
      if (name === 'content') content ??= value;
    }
    if (key != null && content != null && !tags.has(key)) {
      tags.set(key, decodeEntities(content));
    }
  }
  return tags;
};

/** OpenGraph fields with Twitter Card and <title> fallbacks. */
const parsePreviewHtml = (html: string, pageUrl: string): LinkPreview => {
  const meta = metaContents(html);

  const title =
    meta.get('og:title') ??
    meta.get('twitter:title') ??
    decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '').trim();

  const rawImage =
    meta.get('og:image') ??
    meta.get('og:image:url') ??
    meta.get('og:image:secure_url') ??
    meta.get('twitter:image') ??
    meta.get('twitter:image:src') ??
    '';

  let image: string | null = null;
  if (rawImage !== '') {
    try {
      image = new URL(rawImage, pageUrl).href;
    } catch {
      image = null;
    }
  }

  return {
    title: title === '' ? null : title,
    image,
    siteName: meta.get('og:site_name') ?? null,
  };
};

const IMGUR_HOSTS = new Set(['imgur.com', 'www.imgur.com', 'm.imgur.com']);

const fetchJson = async (url: string): Promise<unknown> => {
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};

// imgur serves datacenter IPs an empty shell, so resolve albums via its keyless
// JSON endpoints (oEmbed = title, ajaxalbums = cover). null for non-album URLs
// and on any failure, so those fall through to the generic scrape.
const fetchImgurPreview = async (url: string): Promise<LinkPreview | null> => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!IMGUR_HOSTS.has(parsed.hostname.toLowerCase())) return null;

  const match = parsed.pathname.match(/^\/(?:a|gallery)\/([^/]+)/);
  if (match == null) return null;
  // A slug path is `title-words-HASH`; take the last segment.
  const slug = match[1];
  const hash = slug.includes('-') ? slug.slice(slug.lastIndexOf('-') + 1) : slug;
  if (!/^[A-Za-z0-9]+$/.test(hash)) return null;

  const [oembed, album] = await Promise.all([
    fetchJson(`https://api.imgur.com/oembed.json?url=${encodeURIComponent(url)}`),
    fetchJson(`https://imgur.com/ajaxalbums/getimages/${hash}/hit.json`),
  ]);

  // oEmbed puts the title only in the embed's <a> text.
  const embedHtml =
    typeof (oembed as { html?: unknown })?.html === 'string'
      ? (oembed as { html: string }).html
      : '';
  const title = decodeEntities(
    embedHtml.match(/<a[^>]*>([^<]*)<\/a>/i)?.[1] ?? ''
  ).trim();

  const images = (album as { data?: { images?: unknown } })?.data?.images;
  const cover =
    Array.isArray(images) && typeof images[0]?.hash === 'string'
      ? images[0].hash
      : null;
  // .jpg yields a static thumbnail for any imgur media type.
  const image =
    cover != null && /^[A-Za-z0-9]+$/.test(cover)
      ? `https://i.imgur.com/${cover}.jpg`
      : null;

  if (title === '' && image == null) return null;
  return { title: title === '' ? null : title, image, siteName: 'Imgur' };
};

/**
 * Fetch preview metadata for a URL, server-side (browsers can't, due to CORS).
 * imgur albums go through imgur's JSON endpoints; everything else is scraped.
 * Cached with a TTL; any failure resolves to empty fields for a plain-link UI.
 */
export const fetchLinkPreview = async (url: string): Promise<LinkPreview> => {
  const cached = cache.get(url);
  if (cached != null && cached.expires > Date.now()) return cached.value;

  let value = EMPTY;
  try {
    const imgur = await fetchImgurPreview(url);
    if (imgur != null) {
      cache.set(url, { value: imgur, expires: Date.now() + CACHE_TTL_MS });
      return imgur;
    }

    const page = await fetchValidatedPage(url);
    const contentType = page.headers['content-type'] ?? '';

    if (page.status >= 400) {
      // Don't parse bot-wall/error pages ("Just a moment...").
      value = EMPTY;
    } else if (contentType.startsWith('image/')) {
      value = { title: null, image: page.url, siteName: null };
    } else {
      value = parsePreviewHtml(page.data, page.url);
    }
  } catch {
    value = EMPTY;
  }

  cache.set(url, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
};
