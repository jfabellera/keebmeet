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

const htmlResponse = (body: string): unknown =>
  fakeResponse(200, { headers: { 'content-type': 'text/html' }, body });

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
  it('fetches, parses, and maps OpenGraph fields', async () => {
    mockedFetch.mockResolvedValue(
      htmlResponse(`<html><head>
        <meta property="og:title" content="Meetup album" />
        <meta property="og:site_name" content="Example Photos" />
        <meta content="https://album.example.com/cover.jpg" property="og:image" />
      </head></html>`)
    );

    await expect(fetchLinkPreview('https://album.example.com/ok')).resolves.toEqual(
      {
        title: 'Meetup album',
        image: 'https://album.example.com/cover.jpg',
        siteName: 'Example Photos',
      }
    );
  });

  // imgur emits bare attribute values.
  it('parses unquoted attribute values', async () => {
    mockedFetch.mockResolvedValue(
      htmlResponse(
        '<meta property=og:title content=Imgur data-react-helmet=true />' +
          '<meta property=og:image content=https://i.example.com/a.jpeg?fb />'
      )
    );

    await expect(fetchLinkPreview('https://imgur.example.com/a/x')).resolves.toEqual({
      title: 'Imgur',
      image: 'https://i.example.com/a.jpeg?fb',
      siteName: null,
    });
  });

  // imgur serves bots an empty shell, so album/gallery links resolve via its
  // unauthenticated oEmbed (title) and ajaxalbums (cover image) JSON endpoints.
  const imgurJson = (): void => {
    mockedFetch.mockImplementation((url: string) => {
      if (url.includes('oembed')) {
        return Promise.resolve(
          fakeResponse(200, {
            body: JSON.stringify({
              html: '<blockquote><a href="x">Saguaro Keeb 23</a></blockquote>',
            }),
          })
        );
      }
      if (url.includes('ajaxalbums')) {
        return Promise.resolve(
          fakeResponse(200, {
            body: JSON.stringify({ data: { images: [{ hash: 'jBg0ZBa' }] } }),
          })
        );
      }
      return Promise.resolve(fakeResponse(404, {}));
    });
  };

  it('resolves an imgur album via its JSON endpoints', async () => {
    imgurJson();

    await expect(fetchLinkPreview('https://imgur.com/a/YLdgady')).resolves.toEqual({
      title: 'Saguaro Keeb 23',
      image: 'https://i.imgur.com/jBg0ZBa.jpg',
      siteName: 'Imgur',
    });
    // The HTML page (empty shell) is never fetched for a matched album.
    expect(mockedLookup).not.toHaveBeenCalled();
  });

  it('extracts the imgur hash from a slug-prefixed gallery path', async () => {
    imgurJson();

    const result = await fetchLinkPreview(
      'https://imgur.com/gallery/dallas-keyboard-meetup-2018-WJkq95F'
    );

    expect(result.siteName).toBe('Imgur');
    expect(mockedFetch).toHaveBeenCalledWith(
      'https://imgur.com/ajaxalbums/getimages/WJkq95F/hit.json',
      expect.anything()
    );
  });

  it('falls through to the generic scrape for a direct imgur image', async () => {
    mockedFetch.mockResolvedValue(
      fakeResponse(200, { headers: { 'content-type': 'image/jpeg' } })
    );

    await expect(
      fetchLinkPreview('https://i.imgur.com/jBg0ZBa.jpg')
    ).resolves.toEqual({
      title: null,
      image: 'https://i.imgur.com/jBg0ZBa.jpg',
      siteName: null,
    });
    // Not an album/gallery URL, so the SSRF-guarded generic path runs.
    expect(mockedLookup).toHaveBeenCalled();
  });

  it('falls back to twitter tags and <title>, decoding entities', async () => {
    mockedFetch.mockResolvedValue(
      htmlResponse(`<html><head>
        <title>Tom &amp; Jerry&#39;s page</title>
        <meta name="twitter:image" content="/img/cover.jpg" />
      </head></html>`)
    );

    await expect(fetchLinkPreview('https://blog.example.com/post')).resolves.toEqual(
      {
        title: "Tom & Jerry's page",
        image: 'https://blog.example.com/img/cover.jpg',
        siteName: null,
      }
    );
  });

  it('uses the URL itself as the image for direct image links', async () => {
    mockedFetch.mockResolvedValue(
      fakeResponse(200, { headers: { 'content-type': 'image/jpeg' } })
    );

    await expect(
      fetchLinkPreview('https://cdn.example.com/photo.jpg')
    ).resolves.toEqual({
      title: null,
      image: 'https://cdn.example.com/photo.jpg',
      siteName: null,
    });
  });

  it('returns empty fields for an error-status page', async () => {
    mockedFetch.mockResolvedValue(
      fakeResponse(403, {
        headers: { 'content-type': 'text/html' },
        body: '<title>Just a moment...</title>',
      })
    );

    await expect(
      fetchLinkPreview('https://walled.example.com/gallery')
    ).resolves.toEqual({ title: null, image: null, siteName: null });
  });

  it('does not fetch a literal internal host', async () => {
    await expect(
      fetchLinkPreview('http://localhost:8080/internal')
    ).resolves.toEqual({ title: null, image: null, siteName: null });
    expect(mockedFetch).not.toHaveBeenCalled();
    expect(mockedLookup).not.toHaveBeenCalled();
  });

  it('does not fetch when the host resolves to a private address', async () => {
    mockedLookup.mockResolvedValue([{ address: '10.0.0.9', family: 4 }] as never);

    await expect(
      fetchLinkPreview('https://rebind.example.com/x')
    ).resolves.toEqual({ title: null, image: null, siteName: null });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('follows a redirect and validates the new host', async () => {
    mockedFetch
      .mockResolvedValueOnce(
        fakeResponse(302, {
          headers: { location: 'https://dest.example.com/final' },
        })
      )
      .mockResolvedValueOnce(
        htmlResponse('<meta property="og:title" content="Redirected" />')
      );

    const result = await fetchLinkPreview('https://short.example.com/r');

    expect(result.title).toBe('Redirected');
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    // The redirect target host was DNS-validated too (once per hop).
    expect(mockedLookup).toHaveBeenCalledTimes(2);
  });

  it('resolves to empty fields when the fetch throws', async () => {
    mockedFetch.mockRejectedValue(new Error('network down'));

    await expect(
      fetchLinkPreview('https://boom.example.com/x')
    ).resolves.toEqual({ title: null, image: null, siteName: null });
  });
});
