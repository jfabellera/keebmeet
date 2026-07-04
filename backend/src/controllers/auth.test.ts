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
    turnstileSecretKey: 'test-turnstile-secret',
  },
}));

// Turnstile verification hits Cloudflare over HTTP; stub axios so it doesn't.
jest.mock('axios');

jest.mock('../entity/User', () => ({
  User: {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('../entity/OrganizerRequest', () => ({
  OrganizerRequest: {
    create: jest.fn(),
  },
}));

// Admin notification is covered by its own tests; here we just assert it fires.
jest.mock('../util/organizerRequestNotification', () => ({
  __esModule: true,
  notifyAdminsOfOrganizerRequest: jest.fn(),
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

import axios from 'axios';
import bcrypt from 'bcrypt';
import {
  createUser,
  deleteUser,
  login,
  resendVerificationEmail,
  updateUser,
  verifyUser,
} from './auth';
import { OrganizerRequest } from '../entity/OrganizerRequest';
import { User } from '../entity/User';
import { sendVerificationEmail } from '../util/email';
import {
  buildVerificationLink,
  generateVerificationToken,
  verifyVerificationToken,
} from '../util/emailVerification';
import { notifyAdminsOfOrganizerRequest } from '../util/organizerRequestNotification';

const mockedUser = jest.mocked(User);
const mockedOrganizerRequest = jest.mocked(OrganizerRequest);
const mockedNotifyAdmins = jest.mocked(notifyAdminsOfOrganizerRequest);
const mockedBcrypt = jest.mocked(bcrypt);
const mockedSendVerificationEmail = jest.mocked(sendVerificationEmail);
const mockedGenerateVerificationToken = jest.mocked(generateVerificationToken);
const mockedBuildVerificationLink = jest.mocked(buildVerificationLink);
const mockedVerifyVerificationToken = jest.mocked(verifyVerificationToken);
const mockedAxios = jest.mocked(axios);

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
  is_owner: false,
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
  turnstile_token: 'turnstile-token',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  // create() echoes its input back as a saveable row by default.
  mockedUser.create.mockImplementation((attrs: any) => fakeUser(attrs) as never);
  mockedOrganizerRequest.create.mockReturnValue({
    save: jest.fn().mockResolvedValue(undefined),
  } as never);
  (mockedBcrypt.hash as unknown as jest.Mock).mockResolvedValue('hashed');
  mockedGenerateVerificationToken.mockReturnValue('verify-token');
  mockedBuildVerificationLink.mockImplementation(
    (token: string) => `https://app.test/verify-email?token=${token}`
  );
  // Turnstile verification passes by default; individual tests override this.
  mockedAxios.post.mockResolvedValue({ data: { success: true } });
});

// ---- createUser ------------------------------------------------------------

describe('createUser', () => {
  it('returns 400 when the body fails validation', async () => {
    const res = mockResponse();
    await createUser(mockRequest({ email: 'not-an-email' }), res);

    expect(res.statusCode).toBe(400);
    expect(mockedUser.create).not.toHaveBeenCalled();
  });

  it('returns 400 when the Turnstile token is missing', async () => {
    const res = mockResponse();
    await createUser(
      mockRequest(validCreateBody({ turnstile_token: undefined })),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(mockedUser.create).not.toHaveBeenCalled();
  });

  it('returns 403 when Turnstile verification fails', async () => {
    mockedAxios.post.mockResolvedValue({ data: { success: false } });
    const res = mockResponse();

    await createUser(mockRequest(validCreateBody()), res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ message: 'Captcha verification failed.' });
    expect(mockedUser.findOne).not.toHaveBeenCalled();
    expect(mockedUser.create).not.toHaveBeenCalled();
  });

  it('sends the token and secret to the Turnstile siteverify endpoint', async () => {
    mockedUser.findOne.mockResolvedValue(null);
    const res = mockResponse();

    await createUser(mockRequest(validCreateBody()), res);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.any(URLSearchParams),
      expect.objectContaining({
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    );
    const params = mockedAxios.post.mock.calls[0][1] as URLSearchParams;
    expect(params.get('secret')).toBe('test-turnstile-secret');
    expect(params.get('response')).toBe('turnstile-token');
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

  it('does not create an organizer request by default', async () => {
    mockedUser.findOne.mockResolvedValue(null);
    const res = mockResponse();

    await createUser(mockRequest(validCreateBody()), res);

    expect(mockedOrganizerRequest.create).not.toHaveBeenCalled();
    expect(mockedNotifyAdmins).not.toHaveBeenCalled();
  });

  it('records a pending organizer request and notifies admins when requested', async () => {
    mockedUser.findOne.mockResolvedValue(null);
    const res = mockResponse();

    await createUser(
      mockRequest(validCreateBody({ is_organizer_requested: true })),
      res
    );

    const created = res.body as any;
    expect(mockedOrganizerRequest.create).toHaveBeenCalledWith({
      user: expect.objectContaining({ id: created.id }),
    });
    expect(mockedNotifyAdmins).toHaveBeenCalledTimes(1);
    // The account is still created as a non-organizer; requesting never grants.
    expect(created.is_organizer).toBe(false);
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

  it('skips the email-taken check when no email is provided (partial update)', async () => {
    const target = fakeUser({ id: 1, is_organizer: false });
    mockedUser.findOneBy.mockResolvedValue(target);
    const res = mockResponse();
    res.locals.requestor = fakeUser({ is_admin: true });

    await updateUser(
      mockRequest({ is_organizer: true }, { user_id: '1' }),
      res
    );

    // findOne is the email-taken lookup; it must not run for a partial update.
    expect(mockedUser.findOne).not.toHaveBeenCalled();
    expect(target.is_organizer).toBe(true);
    expect(res.statusCode).toBe(201);
  });

  it('applies admin-only fields for an admin requestor with a valid password', async () => {
    const target = fakeUser({ id: 1, is_admin: false, is_organizer: false });
    mockedUser.findOneBy.mockResolvedValue(target);
    mockedUser.findOne.mockResolvedValue(null);
    (mockedBcrypt.compare as unknown as jest.Mock).mockResolvedValue(true);
    const res = mockResponse();
    res.locals.requestor = fakeUser({ is_admin: true });

    await updateUser(
      mockRequest(
        { is_admin: true, is_organizer: true, current_password: 'pw' },
        { user_id: '1' }
      ),
      res
    );

    expect(target.is_admin).toBe(true);
    expect(target.is_organizer).toBe(true);
  });

  it('requires the requestor password to change admin status', async () => {
    const target = fakeUser({ id: 1, is_admin: false, is_organizer: false });
    mockedUser.findOneBy.mockResolvedValue(target);
    mockedUser.findOne.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.requestor = fakeUser({ is_admin: true });

    // No current_password supplied.
    await updateUser(
      mockRequest({ is_admin: true }, { user_id: '1' }),
      res
    );

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ message: 'Incorrect password.' });
    expect(target.is_admin).toBe(false);
    expect(target.save).not.toHaveBeenCalled();
  });

  it('rejects an incorrect password when changing admin status', async () => {
    const target = fakeUser({ id: 1, is_admin: false });
    mockedUser.findOneBy.mockResolvedValue(target);
    mockedUser.findOne.mockResolvedValue(null);
    (mockedBcrypt.compare as unknown as jest.Mock).mockResolvedValue(false);
    const res = mockResponse();
    res.locals.requestor = fakeUser({ is_admin: true });

    await updateUser(
      mockRequest(
        { is_admin: true, current_password: 'wrong' },
        { user_id: '1' }
      ),
      res
    );

    expect(res.statusCode).toBe(401);
    expect(target.is_admin).toBe(false);
  });

  it('does not require a password to change only organizer status', async () => {
    const target = fakeUser({ id: 1, is_admin: false, is_organizer: false });
    mockedUser.findOneBy.mockResolvedValue(target);
    mockedUser.findOne.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.requestor = fakeUser({ is_admin: true });

    // is_admin is sent unchanged (matches current), so no password is needed.
    await updateUser(
      mockRequest(
        { is_admin: false, is_organizer: true },
        { user_id: '1' }
      ),
      res
    );

    expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    expect(target.is_organizer).toBe(true);
    expect(res.statusCode).toBe(201);
  });

  it('does not let an admin change the admin status of an owner', async () => {
    const target = fakeUser({ id: 1, is_owner: true, is_admin: true });
    mockedUser.findOneBy.mockResolvedValue(target);
    mockedUser.findOne.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.requestor = fakeUser({ id: 2, is_admin: true, is_owner: false });

    await updateUser(
      mockRequest({ is_admin: false }, { user_id: '1' }),
      res
    );

    // The owner keeps their admin status.
    expect(target.is_admin).toBe(true);
  });

  it('lets an owner change the admin status of an owner', async () => {
    const target = fakeUser({ id: 1, is_owner: true, is_admin: true });
    mockedUser.findOneBy.mockResolvedValue(target);
    mockedUser.findOne.mockResolvedValue(null);
    (mockedBcrypt.compare as unknown as jest.Mock).mockResolvedValue(true);
    const res = mockResponse();
    res.locals.requestor = fakeUser({ id: 2, is_owner: true });

    await updateUser(
      mockRequest({ is_admin: false, current_password: 'pw' }, { user_id: '1' }),
      res
    );

    expect(target.is_admin).toBe(false);
  });

  it('never changes owner status via the API, even for an owner requestor', async () => {
    const target = fakeUser({ id: 1, is_owner: false });
    mockedUser.findOneBy.mockResolvedValue(target);
    mockedUser.findOne.mockResolvedValue(null);
    const res = mockResponse();
    res.locals.requestor = fakeUser({ id: 2, is_owner: true });

    await updateUser(mockRequest({ is_owner: true }, { user_id: '1' }), res);

    // Owner status is managed only via direct DB access.
    expect(target.is_owner).toBe(false);
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
  const GENERIC_MESSAGE = {
    message: 'If an account requires verification, a new email has been sent.',
  };

  it('returns a generic 200 and sends nothing when the user does not exist', async () => {
    mockedUser.findOneBy.mockResolvedValue(null);
    const res = mockResponse();

    await resendVerificationEmail(mockRequest({}, { user_id: '99' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(GENERIC_MESSAGE);
    expect(mockedSendVerificationEmail).not.toHaveBeenCalled();
  });

  it('does not resend to an already-verified user, but still returns the generic 200', async () => {
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ id: 1, is_verified: true }));
    const res = mockResponse();

    await resendVerificationEmail(mockRequest({}, { user_id: '1' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(GENERIC_MESSAGE);
    expect(mockedSendVerificationEmail).not.toHaveBeenCalled();
  });

  it('does not query the DB for a non-numeric user id', async () => {
    const res = mockResponse();

    await resendVerificationEmail(mockRequest({}, { user_id: '1abc' }), res);

    expect(mockedUser.findOneBy).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(GENERIC_MESSAGE);
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
    expect(res.body).toEqual(GENERIC_MESSAGE);
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
