/// <reference types="jest" />
import { type Request, type Response } from 'express';

// ---- Mocks -----------------------------------------------------------------

jest.mock('../config', () => ({
  __esModule: true,
  default: {
    eventbriteApiKey: 'eb-key',
    eventbriteClientSecret: 'eb-secret',
  },
}));

jest.mock('axios');
jest.mock('../util/security', () => ({
  encrypt: jest.fn((value: string) => `encrypted(${value})`),
}));

import axios from 'axios';
import { eventbriteAuthorize, eventbriteRedirect } from './oauth2';
import { encrypt } from '../util/security';

const mockedAxios = jest.mocked(axios);
const mockedEncrypt = jest.mocked(encrypt);

// ---- Helpers ---------------------------------------------------------------

type MockResponse = Response & { statusCode?: number; body?: unknown };

const mockResponse = (): MockResponse => {
  const res: any = {};
  res.status = jest.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn().mockImplementation((body: unknown) => {
    res.body = body;
    return res;
  });
  res.end = jest.fn().mockImplementation(() => res);
  res.redirect = jest.fn();
  res.locals = {};
  return res as MockResponse;
};

const fakeUser = (overrides: Record<string, unknown> = {}): any => ({
  id: 1,
  encrypted_eventbrite_token: null,
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ---- eventbriteAuthorize ---------------------------------------------------

describe('eventbriteAuthorize', () => {
  it('redirects to the Eventbrite OAuth URL with the client id and redirect_uri', () => {
    const res = mockResponse();
    const req = {
      query: { redirect_uri: 'http://localhost/cb' },
    } as unknown as Request;

    eventbriteAuthorize(req, res);

    expect(res.redirect).toHaveBeenCalledWith(
      'https://www.eventbrite.com/oauth/authorize?response_type=code&client_id=eb-key&redirect_uri=http://localhost/cb'
    );
  });
});

// ---- eventbriteRedirect ----------------------------------------------------

describe('eventbriteRedirect', () => {
  it('exchanges the code, encrypts the token, and persists it', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { access_token: 'raw-token' },
    } as any);
    const user = fakeUser();
    const res = mockResponse();
    res.locals.requestor = user;

    await eventbriteRedirect(
      { body: { access_code: 'auth-code' } } as Request,
      res
    );

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://www.eventbrite.com/oauth/token',
      expect.anything()
    );
    // The raw OAuth token must never be stored verbatim — only encrypted.
    expect(mockedEncrypt).toHaveBeenCalledWith('raw-token');
    expect(user.encrypted_eventbrite_token).toBe('encrypted(raw-token)');
    expect(user.save).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('returns 500 and does not persist when the exchange fails', async () => {
    mockedAxios.post.mockRejectedValue(new Error('token exchange failed'));
    const user = fakeUser();
    const res = mockResponse();
    res.locals.requestor = user;

    await eventbriteRedirect(
      { body: { access_code: 'auth-code' } } as Request,
      res
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ message: 'token exchange failed' });
    expect(user.save).not.toHaveBeenCalled();
  });
});
