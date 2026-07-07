import { lookup } from 'dns/promises';
import { getPreviewFromContent } from 'link-preview-js';
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
// A real browser UA — some hosts serve no OpenGraph tags (or 403) to bots.
const USER_AGENT =
  'Mozilla/5.0 (compatible; keebmeet-link-preview/1.0; +https://keebmeet)';

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
 * only for non-image responses (link-preview-js parses the HTML; direct images
 * need no body). Returns null-body pages for images so the caller uses the URL.
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
    // Skip reading the body for images — getPreviewFromContent keys off the
    // content-type header and we'd otherwise pull down the whole image.
    const isImage = (headers['content-type'] ?? '').startsWith('image/');
    const data = isImage ? '' : await response.text();

    return { url, status: response.status, headers, data };
  }

  throw new Error('Too many redirects');
};

/**
 * Fetch OpenGraph-style metadata for a URL, server-side (browsers can't, due to
 * CORS). Cached with a TTL and resilient: any failure resolves to empty fields
 * so the caller/UI simply falls back to a plain link.
 */
export const fetchLinkPreview = async (url: string): Promise<LinkPreview> => {
  const cached = cache.get(url);
  if (cached != null && cached.expires > Date.now()) return cached.value;

  let value = EMPTY;
  try {
    const page = await fetchValidatedPage(url);
    const preview = await getPreviewFromContent({
      url: page.url,
      status: page.status,
      headers: page.headers,
      data: page.data,
    });

    const images = 'images' in preview ? preview.images : [];
    const title =
      'title' in preview && preview.title !== '' ? preview.title : null;
    const siteName = 'siteName' in preview ? (preview.siteName ?? null) : null;
    const image =
      images[0] ?? (preview.mediaType === 'image' ? preview.url : null);

    value = { title, image: image ?? null, siteName };
  } catch {
    value = EMPTY;
  }

  cache.set(url, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
};
