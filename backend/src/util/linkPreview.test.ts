/// <reference types="jest" />

jest.mock('dns/promises', () => ({ lookup: jest.fn() }));

import { lookup } from 'dns/promises';
import {
  assertPublicHost,
  fetchLinkPreview,
  isBlockedAddress,
} from './linkPreview';

const mockedLookup = jest.mocked(lookup);
const mockedFetch = jest.fn();
(global as unknown as { fetch: unknown }).fetch = mockedFetch;

const PUBLIC = [{ address: '93.184.216.34', family: 4 }];

/** Minimal Response stand-in for the fields the module reads. */
const fakeResponse = (
  status: number,
  { headers = {}, body = '' }: { headers?: Record<string, string>; body?: string }
): unknown => ({
  status,
  ok: status >= 200 && status < 300,
  headers: {
    get: (key: string) => headers[key.toLowerCase()] ?? null,
    forEach: (cb: (value: string, key: string) => void) => {
      for (const [key, value] of Object.entries(headers)) cb(value, key);
    },
  },
  text: async () => body,
  json: async () => JSON.parse(body),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockedLookup.mockResolvedValue(PUBLIC as never);
});

// ---- isBlockedAddress ------------------------------------------------------

describe('isBlockedAddress', () => {
  const blocked = [
    '127.0.0.1',
    '10.0.0.5',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254', // cloud metadata
    '100.64.0.1', // CGNAT
    '0.0.0.0',
    '224.0.0.1', // multicast
    '::1',
    '::',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
    'not-an-ip',
  ];
  const allowed = [
    '8.8.8.8',
    '1.1.1.1',
    '172.15.0.1',
    '172.32.0.1',
    '93.184.216.34',
    '2606:2800:220:1:248:1893:25c8:1946',
    '::ffff:8.8.8.8',
  ];

  it.each(blocked)('blocks %s', (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });
  it.each(allowed)('allows %s', (address) => {
    expect(isBlockedAddress(address)).toBe(false);
  });
});

// ---- assertPublicHost ------------------------------------------------------

describe('assertPublicHost', () => {
  it('resolves when every address is public', async () => {
    mockedLookup.mockResolvedValue(PUBLIC as never);
    await expect(
      assertPublicHost('https://example.com/a')
    ).resolves.toBeUndefined();
  });

  it('throws when the host resolves to a private address', async () => {
    mockedLookup.mockResolvedValue([
      { address: '169.254.169.254', family: 4 },
    ] as never);
    await expect(assertPublicHost('https://evil.example.com')).rejects.toThrow();
  });

  // A rebinding host that returns one public and one private record is rejected.
  it('throws when any resolved address is private', async () => {
    mockedLookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.5', family: 4 },
    ] as never);
    await expect(assertPublicHost('https://mixed.example.com')).rejects.toThrow();
  });
});

// ---- fetchLinkPreview ------------------------------------------------------

describe('fetchLinkPreview', () => {
  // A grouped Iframely response (group=true): links keyed by rel.
  const iframely = (body: unknown): void => {
    mockedFetch.mockResolvedValue(
      fakeResponse(200, { body: JSON.stringify(body) })
    );
  };

  it('maps title, thumbnail image, and site from an Iframely response', async () => {
    iframely({
      meta: { title: 'Meetup album', site: 'Example Photos' },
      links: {
        thumbnail: [{ href: 'https://album.example.com/cover.jpg' }],
        icon: [{ href: 'https://album.example.com/favicon.ico' }],
      },
    });

    await expect(fetchLinkPreview('https://album.example.com/ok')).resolves.toEqual(
      {
        title: 'Meetup album',
        image: 'https://album.example.com/cover.jpg',
        siteName: 'Example Photos',
      }
    );
  });

  it('falls back to the image rel when there is no thumbnail', async () => {
    iframely({
      meta: { title: 'Photo' },
      links: { image: [{ href: 'https://cdn.example.com/full.jpg' }] },
    });

    await expect(
      fetchLinkPreview('https://photos.example.com/p')
    ).resolves.toEqual({
      title: 'Photo',
      image: 'https://cdn.example.com/full.jpg',
      siteName: null,
    });
  });

  it('requests the Iframely endpoint with group=true and the encoded url', async () => {
    iframely({ meta: {}, links: {} });
    const target = 'https://site.example.com/a?x=1&y=2';

    await fetchLinkPreview(target);

    expect(mockedFetch).toHaveBeenCalledWith(
      `http://iframely:8061/iframely?url=${encodeURIComponent(target)}&group=true`,
      expect.anything()
    );
  });

  it('DNS-validates the target host before calling Iframely', async () => {
    iframely({ meta: { title: 'ok' }, links: {} });

    await fetchLinkPreview('https://validated.example.com/x');

    // The original host is resolved, not the internal Iframely host.
    expect(mockedLookup).toHaveBeenCalledWith(
      'validated.example.com',
      expect.anything()
    );
  });

  it('returns empty fields when Iframely responds non-2xx', async () => {
    mockedFetch.mockResolvedValue(fakeResponse(422, { body: '{}' }));

    await expect(
      fetchLinkPreview('https://unsupported.example.com/x')
    ).resolves.toEqual({ title: null, image: null, siteName: null });
  });

  it('does not fetch a literal internal host', async () => {
    await expect(
      fetchLinkPreview('http://localhost:8080/internal')
    ).resolves.toEqual({ title: null, image: null, siteName: null });
    expect(mockedFetch).not.toHaveBeenCalled();
    expect(mockedLookup).not.toHaveBeenCalled();
  });

  it('does not call Iframely when the host resolves to a private address', async () => {
    mockedLookup.mockResolvedValue([{ address: '10.0.0.9', family: 4 }] as never);

    await expect(
      fetchLinkPreview('https://rebind.example.com/x')
    ).resolves.toEqual({ title: null, image: null, siteName: null });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('resolves to empty fields when the fetch throws', async () => {
    mockedFetch.mockRejectedValue(new Error('network down'));

    await expect(
      fetchLinkPreview('https://boom.example.com/x')
    ).resolves.toEqual({ title: null, image: null, siteName: null });
  });
});
