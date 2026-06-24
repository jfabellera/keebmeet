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
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('bcrypt');

// Stub the email module so importing the controller doesn't construct a real
// Resend client (which throws without RESEND_API_KEY at module load).
jest.mock('../util/email', () => ({
  __esModule: true,
  sendVerificationEmail: jest.fn(),
}));

// Control token issuing/verification directly; the JWT logic itself is covered
// by emailVerification.test.ts.
jest.mock('../util/emailVerification', () => ({
  __esModule: true,
  generateVerificationToken: jest.fn(() => 'verify-token'),
  buildVerificationLink: jest.fn(
    (token: string) => `https://app.test/verify-email?token=${token}`
  ),
  verifyVerificationToken: jest.fn(),
}));

import bcrypt from 'bcrypt';
import {
  createUser,
  deleteUser,
  login,
  resendVerificationEmail,
  updateUser,
  verifyUser,
} from './auth';
import { User } from '../entity/User';
import { sendVerificationEmail } from '../util/email';
import {
  buildVerificationLink,
  generateVerificationToken,
  verifyVerificationToken,
} from '../util/emailVerification';

const mockedUser = jest.mocked(User);
const mockedBcrypt = jest.mocked(bcrypt);
const mockedSendVerificationEmail = jest.mocked(sendVerificationEmail);
const mockedGenerateVerificationToken = jest.mocked(generateVerificationToken);
const mockedBuildVerificationLink = jest.mocked(buildVerificationLink);
const mockedVerifyVerificationToken = jest.mocked(verifyVerificationToken);

// ---- Helpers ---------------------------------------------------------------

type MockResponse = Response & { statusCode?: number; body?: unknown };

/** Minimal Express Response capturing the status + json/end payload. */
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
  res.locals = {};
  return res as MockResponse;
};

const mockRequest = (
  body: unknown,
  params: Record<string, string> = {}
): Request => ({ body, params }) as unknown as Request;

/** A fake User row with stubbed save()/remove(). */
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
  remove: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const validCreateBody = (overrides: Record<string, unknown> = {}) => ({
  email: 'new@example.com',
  first_name: 'New',
  last_name: 'User',
  nick_name: 'newbie',
  password: 'password123',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  // create() echoes its input back as a saveable row by default.
  mockedUser.create.mockImplementation((attrs: any) => fakeUser(attrs) as never);
  (mockedBcrypt.hash as unknown as jest.Mock).mockResolvedValue('hashed');
  mockedGenerateVerificationToken.mockReturnValue('verify-token');
  mockedBuildVerificationLink.mockImplementation(
    (token: string) => `https://app.test/verify-email?token=${token}`
  );
});

// ---- createUser ------------------------------------------------------------

describe('createUser', () => {
  it('returns 400 when the body fails validation', async () => {
    const res = mockResponse();
    await createUser(mockRequest({ email: 'not-an-email' }), res);

    expect(res.statusCode).toBe(400);
    expect(mockedUser.create).not.toHaveBeenCalled();
  });

  it('returns 409 when the email is already taken', async () => {
    mockedUser.findOne.mockResolvedValue(fakeUser());
    const res = mockResponse();

    await createUser(mockRequest(validCreateBody()), res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ message: 'Email is taken.' });
    expect(mockedUser.create).not.toHaveBeenCalled();
  });

  it('hashes the password and creates the user on success', async () => {
    mockedUser.findOne.mockResolvedValue(null);
    const res = mockResponse();

    await createUser(mockRequest(validCreateBody()), res);

    expect(mockedBcrypt.hash).toHaveBeenCalledWith('password123', 10);
    expect(mockedUser.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@example.com',
        nick_name: 'newbie',
        password_hash: 'hashed',
      })
    );
    expect(res.statusCode).toBe(201);
    const created = mockedUser.create.mock.results[0].value as any;
    expect(created.save).toHaveBeenCalled();
    // The response must not leak sensitive columns.
    expect(res.body).not.toHaveProperty('password_hash');
    expect(res.body).not.toHaveProperty('encrypted_eventbrite_token');
  });

  it('emails a freshly generated verification link on success', async () => {
    mockedUser.findOne.mockResolvedValue(null);
    const res = mockResponse();

    await createUser(mockRequest(validCreateBody()), res);

    const created = res.body as any;
    expect(mockedGenerateVerificationToken).toHaveBeenCalledWith(created.id);
    expect(mockedSendVerificationEmail).toHaveBeenCalledWith(
      'new@example.com',
      'https://app.test/verify-email?token=verify-token'
    );
  });
});

// ---- updateUser ------------------------------------------------------------

describe('updateUser', () => {
  it('returns 400 when the body fails validation', async () => {
    const res = mockResponse();
    await updateUser(
      mockRequest({ email: 'not-an-email' }, { user_id: '1' }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when the user does not exist', async () => {
    mockedUser.findOneBy.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.requestor = fakeUser();

    await updateUser(
      mockRequest({ first_name: 'Updated' }, { user_id: '99' }),
      res
    );

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ message: 'Invalid user ID.' });
  });

  it('returns 409 when the new email is taken', async () => {
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ id: 1 }));
    mockedUser.findOne.mockResolvedValue(fakeUser({ id: 2 }));
    const res = mockResponse();
    res.locals.requestor = fakeUser();

    await updateUser(
      mockRequest({ email: 'taken@example.com' }, { user_id: '1' }),
      res
    );

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ message: 'Email is taken.' });
  });

  it('updates the provided fields and saves on success', async () => {
    const target = fakeUser({ id: 1 });
    mockedUser.findOneBy.mockResolvedValue(target);
    mockedUser.findOne.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.requestor = fakeUser({ is_admin: false });

    await updateUser(
      mockRequest(
        { first_name: 'Updated', nick_name: 'updated' },
        { user_id: '1' }
      ),
      res
    );

    expect(target.first_name).toBe('Updated');
    expect(target.nick_name).toBe('updated');
    expect(target.save).toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
  });

  it('ignores admin-only fields for a non-admin requestor', async () => {
    const target = fakeUser({ id: 1, is_admin: false, is_organizer: false });
    mockedUser.findOneBy.mockResolvedValue(target);
    mockedUser.findOne.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.requestor = fakeUser({ is_admin: false });

    await updateUser(
      mockRequest({ is_admin: true, is_organizer: true }, { user_id: '1' }),
      res
    );

    expect(target.is_admin).toBe(false);
    expect(target.is_organizer).toBe(false);
  });

  it('applies admin-only fields for an admin requestor', async () => {
    const target = fakeUser({ id: 1, is_admin: false, is_organizer: false });
    mockedUser.findOneBy.mockResolvedValue(target);
    mockedUser.findOne.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.requestor = fakeUser({ is_admin: true });

    await updateUser(
      mockRequest({ is_admin: true, is_organizer: true }, { user_id: '1' }),
      res
    );

    expect(target.is_admin).toBe(true);
    expect(target.is_organizer).toBe(true);
  });

  it('rehashes the password when one is provided', async () => {
    const target = fakeUser({ id: 1, password_hash: 'old' });
    mockedUser.findOneBy.mockResolvedValue(target);
    mockedUser.findOne.mockResolvedValue(null);
    (mockedBcrypt.hash as unknown as jest.Mock).mockResolvedValue('new-hash');
    const res = mockResponse();
    res.locals.requestor = fakeUser();

    await updateUser(
      mockRequest({ password: 'brand-new-password' }, { user_id: '1' }),
      res
    );

    expect(mockedBcrypt.hash).toHaveBeenCalledWith('brand-new-password', 10);
    expect(target.password_hash).toBe('new-hash');
  });
});

// ---- deleteUser ------------------------------------------------------------

describe('deleteUser', () => {
  it('returns 404 when the user does not exist', async () => {
    mockedUser.findOneBy.mockResolvedValue(null);
    const res = mockResponse();

    await deleteUser(mockRequest({}, { user_id: '99' }), res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ message: 'Invalid user ID.' });
  });

  it('removes the user and returns 204 on success', async () => {
    const target = fakeUser({ id: 1 });
    mockedUser.findOneBy.mockResolvedValue(target);
    const res = mockResponse();

    await deleteUser(mockRequest({}, { user_id: '1' }), res);

    expect(target.remove).toHaveBeenCalled();
    expect(res.statusCode).toBe(204);
    expect(res.end).toHaveBeenCalled();
  });
});

// ---- verifyUser ------------------------------------------------------------

describe('verifyUser', () => {
  // Whether a token is accepted is decided by the mocked verifyVerificationToken,
  // not the value.
  const TOKEN = 'verify-token';

  it('returns 400 when the token is missing', async () => {
    const res = mockResponse();

    await verifyUser(mockRequest({}), res);

    expect(res.statusCode).toBe(400);
    // Bails out on validation before ever touching the database.
    expect(mockedVerifyVerificationToken).not.toHaveBeenCalled();
    expect(mockedUser.findOneBy).not.toHaveBeenCalled();
  });

  it('returns 400 when the token is invalid or expired', async () => {
    mockedVerifyVerificationToken.mockReturnValue(null);
    const res = mockResponse();

    await verifyUser(mockRequest({ token: TOKEN }), res);

    expect(mockedVerifyVerificationToken).toHaveBeenCalledWith(TOKEN);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      message: 'Invalid or expired verification link.',
    });
    expect(mockedUser.findOneBy).not.toHaveBeenCalled();
  });

  it('returns 404 when the token is valid but the user is gone', async () => {
    mockedVerifyVerificationToken.mockReturnValue(99);
    mockedUser.findOneBy.mockResolvedValue(null);
    const res = mockResponse();

    await verifyUser(mockRequest({ token: TOKEN }), res);

    expect(mockedUser.findOneBy).toHaveBeenCalledWith({ id: 99 });
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ message: 'Invalid user ID.' });
  });

  it('returns 200 when the token is accepted and the user is verified', async () => {
    const target = fakeUser({ id: 1, is_verified: false });
    mockedVerifyVerificationToken.mockReturnValue(1);
    mockedUser.findOneBy.mockResolvedValue(target);
    const res = mockResponse();

    await verifyUser(mockRequest({ token: TOKEN }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ message: 'User verified successfully.' });
  });

  it('marks is_verified and saves for a newly verified user', async () => {
    const target = fakeUser({ id: 1, is_verified: false });
    mockedVerifyVerificationToken.mockReturnValue(1);
    mockedUser.findOneBy.mockResolvedValue(target);
    const res = mockResponse();

    await verifyUser(mockRequest({ token: TOKEN }), res);

    expect(target.is_verified).toBe(true);
    expect(target.save).toHaveBeenCalled();
  });

  it('is a no-op when the user is already verified', async () => {
    const target = fakeUser({ id: 1, is_verified: true });
    mockedVerifyVerificationToken.mockReturnValue(1);
    mockedUser.findOneBy.mockResolvedValue(target);
    const res = mockResponse();

    await verifyUser(mockRequest({ token: TOKEN }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ message: 'User already verified.' });
    expect(target.is_verified).toBe(true);
    expect(target.save).not.toHaveBeenCalled();
  });
});

// ---- resendVerificationEmail -----------------------------------------------

describe('resendVerificationEmail', () => {
  it('returns 404 when the user does not exist', async () => {
    mockedUser.findOneBy.mockResolvedValue(null);
    const res = mockResponse();

    await resendVerificationEmail(mockRequest({}, { user_id: '99' }), res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ message: 'Invalid user ID.' });
    expect(mockedSendVerificationEmail).not.toHaveBeenCalled();
  });

  it('does not resend to an already-verified user', async () => {
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ id: 1, is_verified: true }));
    const res = mockResponse();

    await resendVerificationEmail(mockRequest({}, { user_id: '1' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ message: 'User already verified.' });
    expect(mockedSendVerificationEmail).not.toHaveBeenCalled();
  });

  it('emails a freshly generated link to an unverified user', async () => {
    mockedUser.findOneBy.mockResolvedValue(
      fakeUser({ id: 1, email: 'user@example.com', is_verified: false })
    );
    const res = mockResponse();

    await resendVerificationEmail(mockRequest({}, { user_id: '1' }), res);

    expect(mockedGenerateVerificationToken).toHaveBeenCalledWith(1);
    expect(mockedSendVerificationEmail).toHaveBeenCalledWith(
      'user@example.com',
      'https://app.test/verify-email?token=verify-token'
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ message: 'Verification email sent.' });
  });
});

// ---- login -----------------------------------------------------------------

describe('login', () => {
  it('returns 401 when no account matches the email', async () => {
    mockedUser.findOne.mockResolvedValue(null);
    const res = mockResponse();

    await login(mockRequest({ email: 'nobody@example.com', password: 'pw' }), res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ message: 'Invalid email or password.' });
  });

  it('returns 401 when the account has no password hash (SSO-only)', async () => {
    mockedUser.findOne.mockResolvedValue(fakeUser({ password_hash: null }));
    const res = mockResponse();

    await login(mockRequest({ email: 'user@example.com', password: 'pw' }), res);

    expect(res.statusCode).toBe(401);
    expect(mockedBcrypt.compare).not.toHaveBeenCalled();
  });

  it('returns 401 when the password is wrong', async () => {
    mockedUser.findOne.mockResolvedValue(fakeUser());
    (mockedBcrypt.compare as unknown as jest.Mock).mockResolvedValue(false);
    const res = mockResponse();

    await login(
      mockRequest({ email: 'user@example.com', password: 'wrong' }),
      res
    );

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ message: 'Invalid email or password.' });
  });

  it('returns 403 when the password is correct but the email is unverified', async () => {
    mockedUser.findOne.mockResolvedValue(
      fakeUser({ id: 7, is_verified: false })
    );
    (mockedBcrypt.compare as unknown as jest.Mock).mockResolvedValue(true);
    const res = mockResponse();

    await login(
      mockRequest({ email: 'user@example.com', password: 'correct' }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      message: 'Please verify your email before signing in.',
      user_id: 7,
    });
  });

  it('returns a signed session token on success', async () => {
    mockedUser.findOne.mockResolvedValue(
      fakeUser({
        id: 7,
        nick_name: 'jane',
        is_admin: true,
        is_organizer: false,
        is_verified: true,
      })
    );
    (mockedBcrypt.compare as unknown as jest.Mock).mockResolvedValue(true);
    const res = mockResponse();

    await login(
      mockRequest({ email: 'user@example.com', password: 'correct' }),
      res
    );

    expect(res.statusCode).toBe(201);
    const body = res.body as { token: string };
    expect(body).toHaveProperty('token');
    const decoded = jwt.verify(body.token, TEST_JWT_SECRET) as any;
    expect(decoded.id).toBe(7);
    expect(decoded.nick_name).toBe('jane');
    expect(decoded.is_admin).toBe(true);
  });
});
