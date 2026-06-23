/// <reference types="jest" />
import { type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';

// ---- Mocks -----------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret';

jest.mock('../config', () => ({
  __esModule: true,
  default: {
    jwtSecret: 'test-secret',
    discordClientId: 'client-id',
    discordClientSecret: 'client-secret',
    discordRedirectUri: 'http://localhost/cb',
    discordBotToken: 'bot-token',
  },
}));

jest.mock('../entity/User', () => ({
  User: {
    findOneBy: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('axios');
jest.mock('bcrypt');

// Stub the email module so importing the controller doesn't construct a real
// Resend client (which throws without RESEND_API_KEY at module load).
jest.mock('../util/email', () => ({
  __esModule: true,
  sendVerificationEmail: jest.fn(),
}));

import axios from 'axios';
import bcrypt from 'bcrypt';
import {
  discordLink,
  discordLogin,
  discordRegister,
  linkDiscordAccount,
} from './auth';
import { User } from '../entity/User';

const mockedAxios = jest.mocked(axios);
const mockedUser = jest.mocked(User);
const mockedBcrypt = jest.mocked(bcrypt);

// ---- Helpers ---------------------------------------------------------------

type MockResponse = Response & { statusCode?: number; body?: unknown };

/** Minimal Express Response capturing the status + json payload. */
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
  res.locals = {};
  return res as MockResponse;
};

const mockRequest = (body: unknown): Request => ({ body }) as Request;

type DiscordProfile = {
  id: string;
  username: string;
  global_name: string | null;
  email: string | null;
};

/** A fake User row with a stubbed save(). */
const fakeUser = (overrides: Record<string, unknown> = {}): any => ({
  id: 1,
  email: 'user@example.com',
  first_name: 'Jane',
  last_name: 'Doe',
  nick_name: 'jane',
  password_hash: 'hashed',
  discord_id: null,
  is_admin: false,
  is_organizer: false,
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const DISCORD_PROFILE: DiscordProfile = {
  id: '123456789',
  username: 'janediscord',
  global_name: 'Jane D',
  email: 'user@example.com',
};

/** Make exchangeCodeForDiscordUser() resolve to the given Discord profile. */
const mockDiscordExchange = (profile: DiscordProfile = DISCORD_PROFILE): void => {
  mockedAxios.post.mockResolvedValue({ data: { access_token: 'access' } } as any);
  mockedAxios.get.mockResolvedValue({ data: profile } as any);
};

const signLinkToken = (
  overrides: Partial<{
    discord_id: string;
    email: string;
    nick_name: string;
    purpose: string;
  }> = {}
): string =>
  jwt.sign(
    {
      discord_id: '123456789',
      email: 'user@example.com',
      nick_name: 'Jane D',
      purpose: 'discord_link',
      ...overrides,
    },
    TEST_JWT_SECRET
  );

beforeEach(() => {
  jest.clearAllMocks();
  // create() echoes its input back as a saveable row by default.
  mockedUser.create.mockImplementation(
    (attrs: any) => fakeUser(attrs) as never
  );
});

// ---- discordLogin ----------------------------------------------------------

describe('discordLogin', () => {
  it('returns 400 when no code is provided', async () => {
    const res = mockResponse();
    await discordLogin(mockRequest({}), res);

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 when the Discord exchange fails', async () => {
    mockedAxios.post.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await discordLogin(mockRequest({ code: 'abc' }), res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      message: 'Failed to authenticate with Discord.',
    });
  });

  it('logs in an account already linked to the Discord ID', async () => {
    mockDiscordExchange();
    const existing = fakeUser({ discord_id: '123456789' });
    mockedUser.findOneBy.mockResolvedValue(existing);
    const res = mockResponse();

    await discordLogin(mockRequest({ code: 'abc' }), res);

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(mockedUser.create).not.toHaveBeenCalled();
  });

  it('asks to link when the email matches an existing account', async () => {
    mockDiscordExchange();
    mockedUser.findOneBy.mockResolvedValue(null); // not linked by discord_id
    mockedUser.findOne.mockResolvedValue(
      fakeUser({ email: 'user@example.com' })
    ); // email collision
    const res = mockResponse();

    await discordLogin(mockRequest({ code: 'abc' }), res);

    expect(res.statusCode).toBe(200);
    const body = res.body as {
      requiresLink: boolean;
      email: string;
      linkToken: string;
    };
    expect(body.requiresLink).toBe(true);
    expect(body.email).toBe('user@example.com');
    // The link token must verify and carry the verified Discord ID.
    const decoded = jwt.verify(body.linkToken, TEST_JWT_SECRET) as any;
    expect(decoded.discord_id).toBe('123456789');
    expect(decoded.purpose).toBe('discord_link');
    expect(mockedUser.create).not.toHaveBeenCalled();
  });

  it('creates a new account when nothing matches', async () => {
    mockDiscordExchange();
    mockedUser.findOneBy.mockResolvedValue(null);
    mockedUser.findOne.mockResolvedValue(null);
    const res = mockResponse();

    await discordLogin(mockRequest({ code: 'abc' }), res);

    expect(mockedUser.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        nick_name: 'Jane D',
        discord_id: '123456789',
        is_verified: true,
      })
    );
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('token');
  });

  it('returns 400 when the Discord account has no email and no match', async () => {
    mockDiscordExchange({ ...DISCORD_PROFILE, email: null });
    mockedUser.findOneBy.mockResolvedValue(null);
    const res = mockResponse();

    await discordLogin(mockRequest({ code: 'abc' }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      message: 'Discord account has no email address.',
    });
  });
});

// ---- discordLink -----------------------------------------------------------

describe('discordLink', () => {
  it('returns 400 when the link token is missing', async () => {
    const res = mockResponse();
    await discordLink(mockRequest({ email: 'a@b.c', password: 'pw' }), res);

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 for an invalid/expired link token', async () => {
    const res = mockResponse();
    await discordLink(
      mockRequest({ email: 'a@b.c', password: 'pw', linkToken: 'garbage' }),
      res
    );

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      message: 'Link request has expired. Please try again.',
    });
  });

  it('returns 401 when the token purpose is wrong', async () => {
    const res = mockResponse();
    await discordLink(
      mockRequest({
        email: 'user@example.com',
        password: 'pw',
        linkToken: signLinkToken({ purpose: 'something_else' }),
      }),
      res
    );

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ message: 'Invalid link token.' });
  });

  it('returns 401 when the account is not found', async () => {
    mockedUser.findOne.mockResolvedValue(null);
    const res = mockResponse();

    await discordLink(
      mockRequest({
        email: 'user@example.com',
        password: 'pw',
        linkToken: signLinkToken(),
      }),
      res
    );

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ message: 'Invalid email or password.' });
  });

  it('returns 401 when the password is wrong', async () => {
    mockedUser.findOne.mockResolvedValue(fakeUser());
    (mockedBcrypt.compare as unknown as jest.Mock).mockResolvedValue(false);
    const res = mockResponse();

    await discordLink(
      mockRequest({
        email: 'user@example.com',
        password: 'wrong',
        linkToken: signLinkToken(),
      }),
      res
    );

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ message: 'Invalid email or password.' });
  });

  it('returns 401 when the signed-in account differs from the token email', async () => {
    mockedUser.findOne.mockResolvedValue(
      fakeUser({ email: 'someone-else@example.com' })
    );
    (mockedBcrypt.compare as unknown as jest.Mock).mockResolvedValue(true);
    const res = mockResponse();

    await discordLink(
      mockRequest({
        email: 'someone-else@example.com',
        password: 'pw',
        linkToken: signLinkToken({ email: 'user@example.com' }),
      }),
      res
    );

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      message: 'This Discord account cannot be linked to this user.',
    });
  });

  it('returns 409 when the Discord ID is already linked elsewhere', async () => {
    mockedUser.findOne.mockResolvedValue(fakeUser({ id: 1 }));
    (mockedBcrypt.compare as unknown as jest.Mock).mockResolvedValue(true);
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ id: 99 })); // owned by another
    const res = mockResponse();

    await discordLink(
      mockRequest({
        email: 'user@example.com',
        password: 'pw',
        linkToken: signLinkToken(),
      }),
      res
    );

    expect(res.statusCode).toBe(409);
  });

  it('links the Discord ID on success', async () => {
    const existing = fakeUser({ id: 1 });
    mockedUser.findOne.mockResolvedValue(existing);
    (mockedBcrypt.compare as unknown as jest.Mock).mockResolvedValue(true);
    mockedUser.findOneBy.mockResolvedValue(null);
    const res = mockResponse();

    await discordLink(
      mockRequest({
        email: 'user@example.com',
        password: 'pw',
        linkToken: signLinkToken({ discord_id: '123456789' }),
      }),
      res
    );

    expect(existing.discord_id).toBe('123456789');
    expect(existing.is_verified).toBe(true);
    expect(existing.save).toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('token');
  });
});

// ---- discordRegister -------------------------------------------------------

describe('discordRegister', () => {
  it('returns 400 when the link token is missing', async () => {
    const res = mockResponse();
    await discordRegister(mockRequest({ email: 'new@example.com' }), res);

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when the email is missing', async () => {
    const res = mockResponse();
    await discordRegister(mockRequest({ linkToken: signLinkToken() }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ message: 'An email address is required.' });
  });

  it('returns 401 for an invalid link token', async () => {
    const res = mockResponse();
    await discordRegister(
      mockRequest({ email: 'new@example.com', linkToken: 'garbage' }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('returns 409 when the chosen email is taken', async () => {
    mockedUser.findOne.mockResolvedValue(fakeUser());
    const res = mockResponse();

    await discordRegister(
      mockRequest({ email: 'taken@example.com', linkToken: signLinkToken() }),
      res
    );

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ message: 'Email is taken.' });
  });

  it('returns 409 when the Discord ID is already linked', async () => {
    mockedUser.findOne.mockResolvedValue(null); // email free
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ id: 99 })); // discord taken
    const res = mockResponse();

    await discordRegister(
      mockRequest({ email: 'new@example.com', linkToken: signLinkToken() }),
      res
    );

    expect(res.statusCode).toBe(409);
  });

  it('creates a separate account on success', async () => {
    mockedUser.findOne.mockResolvedValue(null);
    mockedUser.findOneBy.mockResolvedValue(null);
    const res = mockResponse();

    await discordRegister(
      mockRequest({
        email: 'new@example.com',
        linkToken: signLinkToken({
          discord_id: '123456789',
          nick_name: 'Jane D',
        }),
      }),
      res
    );

    expect(mockedUser.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@example.com',
        nick_name: 'Jane D',
        discord_id: '123456789',
      })
    );
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('token');
  });
});

// ---- linkDiscordAccount (logged-in user) -----------------------------------

describe('linkDiscordAccount', () => {
  it('returns 400 when no code is provided', async () => {
    const res = mockResponse();
    res.locals.requestor = fakeUser();

    await linkDiscordAccount(mockRequest({}), res);

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 when the Discord exchange fails', async () => {
    mockedAxios.post.mockRejectedValue(new Error('boom'));
    const res = mockResponse();
    res.locals.requestor = fakeUser();

    await linkDiscordAccount(mockRequest({ code: 'abc' }), res);

    expect(res.statusCode).toBe(401);
  });

  it('returns 409 when the Discord ID belongs to another account', async () => {
    mockDiscordExchange();
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ id: 99 }));
    const res = mockResponse();
    res.locals.requestor = fakeUser({ id: 1 });

    await linkDiscordAccount(mockRequest({ code: 'abc' }), res);

    expect(res.statusCode).toBe(409);
  });

  it('links the Discord ID to the requestor on success', async () => {
    mockDiscordExchange();
    mockedUser.findOneBy.mockResolvedValue(null);
    const requestor = fakeUser({ id: 1 });
    const res = mockResponse();
    res.locals.requestor = requestor;

    await linkDiscordAccount(mockRequest({ code: 'abc' }), res);

    expect(requestor.discord_id).toBe('123456789');
    expect(requestor.save).toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('token');
  });

  it('allows re-linking the same Discord ID already owned by the requestor', async () => {
    mockDiscordExchange();
    const requestor = fakeUser({ id: 1 });
    mockedUser.findOneBy.mockResolvedValue(requestor); // same account
    const res = mockResponse();
    res.locals.requestor = requestor;

    await linkDiscordAccount(mockRequest({ code: 'abc' }), res);

    expect(res.statusCode).toBe(201);
  });
});
