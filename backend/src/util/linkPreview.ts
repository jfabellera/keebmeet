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

// Longer than Iframely's own request timeout so we surface its result, not abort.
const REQUEST_TIMEOUT_MS = 10000;

const IFRAMELY_BASE_URL = process.env.IFRAMELY_URL ?? 'http://iframely:8061';

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

interface IframelyResponse {
  meta?: { title?: unknown; site?: unknown };
  // With group=true, links is keyed by rel (thumbnail/image/icon/…).
  links?: Record<string, Array<{ href?: unknown }> | undefined>;
}

/** First usable href in a rel group, or null. */
const firstHref = (
  links: IframelyResponse['links'],
  rel: string
): string | null => {
  const group = links?.[rel];
  if (!Array.isArray(group)) return null;
  for (const link of group) {
    if (typeof link?.href === 'string' && link.href !== '') return link.href;
  }
  return null;
};

// group=true forces the grouped `links` shape regardless of container config.
const fetchFromIframely = async (url: string): Promise<LinkPreview> => {
  const endpoint = `${IFRAMELY_BASE_URL}/iframely?url=${encodeURIComponent(url)}&group=true`;
  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) return EMPTY;

  const data = (await response.json()) as IframelyResponse;
  const title = typeof data.meta?.title === 'string' ? data.meta.title : null;
  const siteName = typeof data.meta?.site === 'string' ? data.meta.site : null;
  const image =
    firstHref(data.links, 'thumbnail') ?? firstHref(data.links, 'image');

  return { title, image, siteName };
};

/**
 * Fetch link metadata via self-hosted Iframely. Cached with a TTL; any failure
 * resolves to empty fields so the UI falls back to a plain link.
 *
 * We DNS-validate the target host before calling: Iframely does the outbound
 * fetch and sits on the internal network, so this stops an organizer-supplied
 * URL from pointing it at a private address (which its URL-pattern filter can't
 * catch when a hostname resolves to a private IP).
 */
export const fetchLinkPreview = async (url: string): Promise<LinkPreview> => {
  const cached = cache.get(url);
  if (cached != null && cached.expires > Date.now()) return cached.value;

  let value = EMPTY;
  try {
    if (isFetchablePreviewUrl(url)) {
      await assertPublicHost(url);
      value = await fetchFromIframely(url);
    }
  } catch {
    value = EMPTY;
  }

  cache.set(url, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
};
