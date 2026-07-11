/// <reference types="jest" />
import { type Request, type Response } from 'express';

// ---- Mocks -----------------------------------------------------------------

jest.mock('../config', () => ({
  __esModule: true,
  default: {
    webUrl: 'https://app.test',
  },
}));

jest.mock('../entity/OrganizerRequest', () => ({
  OrganizerRequest: {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
  },
}));

// The notification + email side effects are covered separately; here we only
// assert that the controller triggers them at the right times.
jest.mock('../util/organizerRequestNotification', () => ({
  __esModule: true,
  notifyAdminsOfOrganizerRequest: jest.fn(),
}));

jest.mock('../util/email', () => ({
  __esModule: true,
  sendOrganizerApprovedEmail: jest.fn(),
  sendOrganizerDeniedEmail: jest.fn(),
}));

import {
  approveOrganizerRequest,
  createOrganizerRequest,
  denyOrganizerRequest,
  getOrganizerRequests,
} from './organizerRequests';
import { OrganizerRequest } from '../entity/OrganizerRequest';
import {
  sendOrganizerApprovedEmail,
  sendOrganizerDeniedEmail,
} from '../util/email';
import { notifyAdminsOfOrganizerRequest } from '../util/organizerRequestNotification';

const mockedOrganizerRequest = jest.mocked(OrganizerRequest);
const mockedNotifyAdmins = jest.mocked(notifyAdminsOfOrganizerRequest);
const mockedSendApproved = jest.mocked(sendOrganizerApprovedEmail);
const mockedSendDenied = jest.mocked(sendOrganizerDeniedEmail);

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
  res.locals = {};
  return res as MockResponse;
};

const mockRequest = (params: Record<string, string> = {}): Request =>
  ({ params }) as unknown as Request;

const fakeUser = (overrides: Record<string, unknown> = {}): any => ({
  id: '1',
  email: 'user@example.com',
  first_name: 'Jane',
  last_name: 'Doe',
  nick_name: 'jane',
  is_admin: false,
  is_organizer: false,
  discord_id: null,
  encrypted_eventbrite_token: null,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

/** A fake request row with a stubbed remove() and (optionally) a user. */
const fakeRequest = (overrides: Record<string, unknown> = {}): any => ({
  id: '10',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  user: fakeUser(),
  remove: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ---- createOrganizerRequest ------------------------------------------------

describe('createOrganizerRequest', () => {
  it('returns 400 when the requestor is already an organizer', async () => {
    const res = mockResponse();
    res.locals.requestor = fakeUser({ is_organizer: true });

    await createOrganizerRequest(mockRequest(), res);

    expect(res.statusCode).toBe(400);
    expect(mockedOrganizerRequest.create).not.toHaveBeenCalled();
    expect(mockedNotifyAdmins).not.toHaveBeenCalled();
  });

  it('returns 409 when a request already exists', async () => {
    mockedOrganizerRequest.findOne.mockResolvedValue(fakeRequest() as never);
    const res = mockResponse();
    res.locals.requestor = fakeUser();

    await createOrganizerRequest(mockRequest(), res);

    expect(res.statusCode).toBe(409);
    expect(mockedOrganizerRequest.create).not.toHaveBeenCalled();
    expect(mockedNotifyAdmins).not.toHaveBeenCalled();
  });

  it('creates the request, notifies admins, and returns 201 on success', async () => {
    mockedOrganizerRequest.findOne.mockResolvedValue(null);
    const saved = { save: jest.fn().mockResolvedValue(undefined) };
    mockedOrganizerRequest.create.mockReturnValue(saved as never);
    const res = mockResponse();
    const requestor = fakeUser();
    res.locals.requestor = requestor;

    await createOrganizerRequest(mockRequest(), res);

    expect(mockedOrganizerRequest.create).toHaveBeenCalledWith({
      user: requestor,
    });
    expect(saved.save).toHaveBeenCalled();
    expect(mockedNotifyAdmins).toHaveBeenCalledWith(requestor);
    expect(res.statusCode).toBe(201);
  });
});

// ---- getOrganizerRequests --------------------------------------------------

describe('getOrganizerRequests', () => {
  it('maps each request to its public shape, oldest first', async () => {
    mockedOrganizerRequest.find.mockResolvedValue([
      fakeRequest({
        id: '10',
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        user: fakeUser({ id: '1', nick_name: 'jane' }),
      }),
    ] as never);
    const res = mockResponse();

    await getOrganizerRequests(mockRequest(), res);

    expect(mockedOrganizerRequest.find).toHaveBeenCalledWith({
      relations: { user: true },
      order: { created_at: 'ASC' },
    });
    const body = res.body as any[];
    expect(body).toHaveLength(1);
    expect(body[0]).toEqual({
      id: '10',
      created_at: '2026-01-01T00:00:00.000Z',
      user: expect.objectContaining({ id: '1', display_name: 'jane' }),
    });
    // The mapped user must not leak sensitive columns.
    expect(body[0].user).not.toHaveProperty('password_hash');
  });

  it('returns an empty array when there are no requests', async () => {
    mockedOrganizerRequest.find.mockResolvedValue([] as never);
    const res = mockResponse();

    await getOrganizerRequests(mockRequest(), res);

    expect(res.body).toEqual([]);
  });
});

// ---- approveOrganizerRequest -----------------------------------------------

describe('approveOrganizerRequest', () => {
  it('returns 404 when the request does not exist', async () => {
    mockedOrganizerRequest.findOne.mockResolvedValue(null);
    const res = mockResponse();

    await approveOrganizerRequest(mockRequest({ request_id: '99' }), res);

    expect(res.statusCode).toBe(404);
    expect(mockedSendApproved).not.toHaveBeenCalled();
  });

  it('grants organizer access, removes the request, and emails the user', async () => {
    const user = fakeUser({ id: '1', is_organizer: false });
    const request = fakeRequest({ id: '10', user });
    mockedOrganizerRequest.findOne.mockResolvedValue(request as never);
    const res = mockResponse();

    await approveOrganizerRequest(mockRequest({ request_id: '10' }), res);

    expect(user.is_organizer).toBe(true);
    expect(user.save).toHaveBeenCalled();
    expect(request.remove).toHaveBeenCalled();
    expect(mockedSendApproved).toHaveBeenCalledWith(
      'user@example.com',
      'https://app.test/organizer'
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ id: '1', is_organizer: true })
    );
  });
});

// ---- denyOrganizerRequest --------------------------------------------------

describe('denyOrganizerRequest', () => {
  it('returns 404 when the request does not exist', async () => {
    mockedOrganizerRequest.findOne.mockResolvedValue(null);
    const res = mockResponse();

    await denyOrganizerRequest(mockRequest({ request_id: '99' }), res);

    expect(res.statusCode).toBe(404);
    expect(mockedSendDenied).not.toHaveBeenCalled();
  });

  it('removes the request, emails the user, and returns 204', async () => {
    const user = fakeUser({ id: '1', email: 'denied@example.com' });
    const request = fakeRequest({ id: '10', user });
    mockedOrganizerRequest.findOne.mockResolvedValue(request as never);
    const res = mockResponse();

    await denyOrganizerRequest(mockRequest({ request_id: '10' }), res);

    expect(request.remove).toHaveBeenCalled();
    expect(mockedSendDenied).toHaveBeenCalledWith('denied@example.com');
    // The user keeps their non-organizer status.
    expect(user.is_organizer).toBe(false);
    expect(user.save).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(204);
    expect(res.end).toHaveBeenCalled();
  });
});
