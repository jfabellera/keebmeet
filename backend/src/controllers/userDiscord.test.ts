/// <reference types="jest" />
import { type Request, type Response } from 'express';

// ---- Mocks -----------------------------------------------------------------

jest.mock('../entity/User', () => ({
  User: {
    findOneBy: jest.fn(),
  },
}));

jest.mock('../util/discord', () => ({
  fetchUserMutualServers: jest.fn(),
}));

import { getUserDiscordServers } from './userDiscord';
import { User } from '../entity/User';
import { fetchUserMutualServers } from '../util/discord';

const mockedUser = jest.mocked(User);
const mockedFetchUserMutualServers = jest.mocked(fetchUserMutualServers);

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
  id: 1,
  discord_id: null,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ---- getUserDiscordServers -------------------------------------------------

describe('getUserDiscordServers', () => {
  it('returns 404 when the user does not exist', async () => {
    mockedUser.findOneBy.mockResolvedValue(null);
    const res = mockResponse();

    await getUserDiscordServers(mockRequest({ user_id: '99' }), res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ message: 'Invalid user ID.' });
    expect(mockedFetchUserMutualServers).not.toHaveBeenCalled();
  });

  it('looks the user up by the numeric id from the route params', async () => {
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ discord_id: '123' }));
    mockedFetchUserMutualServers.mockResolvedValue([]);
    const res = mockResponse();

    await getUserDiscordServers(mockRequest({ user_id: '42' }), res);

    expect(mockedUser.findOneBy).toHaveBeenCalledWith({ id: 42 });
  });

  it('returns 409 when the user has not linked a Discord account', async () => {
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ discord_id: null }));
    const res = mockResponse();

    await getUserDiscordServers(mockRequest({ user_id: '1' }), res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      message: 'User has not linked a Discord account.',
    });
    expect(mockedFetchUserMutualServers).not.toHaveBeenCalled();
  });

  it('returns the mutual servers for a linked user', async () => {
    const servers = [
      { id: 'A', name: 'Server A', icon_url: 'https://cdn/icon.png' },
      { id: 'B', name: 'Server B', icon_url: null },
    ];
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ discord_id: '123' }));
    mockedFetchUserMutualServers.mockResolvedValue(servers);
    const res = mockResponse();

    await getUserDiscordServers(mockRequest({ user_id: '1' }), res);

    expect(mockedFetchUserMutualServers).toHaveBeenCalledWith('123');
    expect(res.body).toEqual(servers);
    expect(res.statusCode).toBeUndefined();
  });

  it('returns an empty array when there are no mutual servers', async () => {
    mockedUser.findOneBy.mockResolvedValue(fakeUser({ discord_id: '123' }));
    mockedFetchUserMutualServers.mockResolvedValue([]);
    const res = mockResponse();

    await getUserDiscordServers(mockRequest({ user_id: '1' }), res);

    expect(res.body).toEqual([]);
  });
});
