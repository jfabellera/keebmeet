/// <reference types="jest" />
import { type Request, type Response } from 'express';

// ---- Mocks -----------------------------------------------------------------

jest.mock('../entity/User', () => ({
  User: {
    find: jest.fn(),
    findBy: jest.fn(),
    findOneBy: jest.fn(),
  },
}));

jest.mock('../config', () => ({
  __esModule: true,
  default: { r2PublicBaseUrl: 'https://cdn.test' },
}));

jest.mock('../entity/OrganizerRequest', () => ({
  OrganizerRequest: {
    findOne: jest.fn(),
  },
}));

jest.mock('../util/discord', () => ({
  fetchDiscordUsername: jest.fn(),
}));

import { getAllUsers, getOrganizers, getUser } from './users';
import { OrganizerRequest } from '../entity/OrganizerRequest';
import { User } from '../entity/User';
import { fetchDiscordUsername } from '../util/discord';

const mockedUser = jest.mocked(User);
const mockedOrganizerRequest = jest.mocked(OrganizerRequest);
const mockedFetchDiscordUsername = jest.mocked(fetchDiscordUsername);

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
  is_owner: false,
  is_organizer: false,
  discord_id: null,
  encrypted_eventbrite_token: null,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  // Default: no pending organizer request.
  mockedOrganizerRequest.findOne.mockResolvedValue(null);
});

// ---- getAllUsers -----------------------------------------------------------

describe('getAllUsers', () => {
  it('maps every user to the public shape', async () => {
    mockedUser.find.mockResolvedValue([
      fakeUser({ id: '1', discord_id: '123', encrypted_eventbrite_token: 'tok' }),
      fakeUser({ id: '2' }),
    ]);
    const res = mockResponse();

    await getAllUsers(mockRequest(), res);

    const body = res.body as any[];
    expect(body).toHaveLength(2);
    expect(body[0]).toEqual({
      id: '1',
      email: 'user@example.com',
      display_name: 'jane',
      first_name: 'Jane',
      last_name: 'Doe',
      is_admin: false,
      is_owner: false,
      is_organizer: false,
      is_eventbrite_linked: true,
      is_discord_linked: true,
      photo_url: '',
    });
    expect(body[1].is_eventbrite_linked).toBe(false);
    expect(body[1].is_discord_linked).toBe(false);
  });

  it('returns an empty array when there are no users', async () => {
    mockedUser.find.mockResolvedValue([]);
    const res = mockResponse();

    await getAllUsers(mockRequest(), res);

    expect(res.body).toEqual([]);
  });
});

// ---- getOrganizers ---------------------------------------------------------

describe('getOrganizers', () => {
  it('queries only for organizers', async () => {
    mockedUser.findBy.mockResolvedValue([]);
    const res = mockResponse();

    await getOrganizers(mockRequest(), res);

    expect(mockedUser.findBy).toHaveBeenCalledWith({ is_organizer: true });
  });

  it('maps organizers to the public organizer shape', async () => {
    mockedUser.findBy.mockResolvedValue([
      fakeUser({
        id: '1',
        nick_name: 'jane',
        is_organizer: true,
        photo_key: 'users/1.png',
      }),
      fakeUser({
        id: '2',
        nick_name: 'john',
        is_organizer: true,
        photo_key: null,
      }),
    ]);
    const res = mockResponse();

    await getOrganizers(mockRequest(), res);

    const body = res.body as any[];
    expect(body).toEqual([
      {
        id: '1',
        display_name: 'jane',
        photo_url: 'https://cdn.test/users/1.png',
      },
      { id: '2', display_name: 'john', photo_url: '' },
    ]);
  });

  it('returns an empty array when there are no organizers', async () => {
    mockedUser.findBy.mockResolvedValue([]);
    const res = mockResponse();

    await getOrganizers(mockRequest(), res);

    expect(res.body).toEqual([]);
  });

  it('excludes non-organizers via the query filter', async () => {
    // Make the mock honor the where-clause the controller passes, so a
    // non-organizer in the underlying data is filtered out by the query.
    const allUsers = [
      fakeUser({ id: '1', nick_name: 'jane', is_organizer: true }),
      fakeUser({ id: '2', nick_name: 'john', is_organizer: false }),
    ];
    mockedUser.findBy.mockImplementation(async (where: any) =>
      allUsers.filter((user) => user.is_organizer === where.is_organizer)
    );
    const res = mockResponse();

    await getOrganizers(mockRequest(), res);

    const body = res.body as any[];
    expect(mockedUser.findBy).toHaveBeenCalledWith({ is_organizer: true });
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ id: '1', display_name: 'jane' });
    expect(body.map((organizer) => organizer.id)).not.toContain('2');
  });
});

// ---- getUser ---------------------------------------------------------------

describe('getUser', () => {
  it('returns 404 when the user does not exist', async () => {
    mockedUser.findOneBy.mockResolvedValue(null);
    const res = mockResponse();

    await getUser(mockRequest({ user_id: '99' }), res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ message: 'Invalid user ID.' });
  });

  it('returns the public shape without a Discord handle when unlinked', async () => {
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ id: '1' }));
    const res = mockResponse();

    await getUser(mockRequest({ user_id: '1' }), res);

    const body = res.body as any;
    expect(body.id).toBe('1');
    expect(body.is_discord_linked).toBe(false);
    expect(body).not.toHaveProperty('discord_username');
    expect(mockedFetchDiscordUsername).not.toHaveBeenCalled();
  });

  it('resolves the live Discord handle when linked', async () => {
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ id: '1', discord_id: '123' }));
    mockedFetchDiscordUsername.mockResolvedValue('janediscord');
    const res = mockResponse();

    await getUser(mockRequest({ user_id: '1' }), res);

    const body = res.body as any;
    expect(mockedFetchDiscordUsername).toHaveBeenCalledWith('123');
    expect(body.is_discord_linked).toBe(true);
    expect(body.discord_username).toBe('janediscord');
  });

  it('reports has_organizer_request false when there is no pending request', async () => {
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ id: '1' }));
    mockedOrganizerRequest.findOne.mockResolvedValue(null);
    const res = mockResponse();

    await getUser(mockRequest({ user_id: '1' }), res);

    const body = res.body as any;
    expect(mockedOrganizerRequest.findOne).toHaveBeenCalledWith({
      where: { user: { id: '1' } },
    });
    expect(body.has_organizer_request).toBe(false);
  });

  it('reports has_organizer_request true when a request is pending', async () => {
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ id: '1' }));
    mockedOrganizerRequest.findOne.mockResolvedValue({ id: '5' } as never);
    const res = mockResponse();

    await getUser(mockRequest({ user_id: '1' }), res);

    const body = res.body as any;
    expect(body.has_organizer_request).toBe(true);
  });
});
