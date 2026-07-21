// Minimal self-hosted Iframely config (ESM). No credentials needed. Do NOT add
// provider keys here in plaintext — inject any future secret at runtime.
export default {
  DEBUG: false,
  RICH_LOG_ENABLED: false,

  baseAppUrl: 'http://iframely:8061',
  relativeStaticUrl: '/r',
  port: 8061,
  host: '0.0.0.0',

  // Group `links` by rel to match what the backend parses.
  GROUP_LINKS: true,
  SKIP_IFRAMELY_RENDERS: true,

  MAX_REDIRECTS: 4,

  // SSRF: refuse loopback / private / link-local targets (backend also guards).
  IGNORE_DOMAINS_RE: [
    /^https?:\/\/localhost/i,
    /^https?:\/\/(\[::1\]|127\.)/i,
    /^https?:\/\/10\./i,
    /^https?:\/\/192\.168\./i,
    /^https?:\/\/172\.(1[6-9]|2\d|3[01])\./i,
    /^https?:\/\/169\.254\./i,
  ],
};
