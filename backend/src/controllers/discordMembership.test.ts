/// <reference types="jest" />
import { type Request, type Response } from 'express';

jest.mock('../util/groupMembership', () => ({
  __esModule: true,
  invalidateMemberServers: jest.fn(),
}));

jest.mock('../entity/Group', () => ({
  Group: { countBy: jest.fn() },
}));

import { handleMembershipChanged } from './discordMembership';
import { Group } from '../entity/Group';
import { invalidateMemberServers } from '../util/groupMembership';

const mockedInvalidate = jest.mocked(invalidateMemberServers);
const mockedGroup = jest.mocked(Group);

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
  return res as MockResponse;
};

const mockRequest = (body: Record<string, unknown> = {}): Request =>
  ({ body }) as unknown as Request;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('handleMembershipChanged', () => {
  it('busts the cache when the guild backs a group', async () => {
    mockedGroup.countBy.mockResolvedValue(1);
    const res = mockResponse();

    await handleMembershipChanged(
      mockRequest({ discord_id: '123', guild_id: 'g1' }),
      res
    );

    expect(mockedGroup.countBy).toHaveBeenCalledWith({
      discord_server_id: 'g1',
    });
    expect(mockedInvalidate).toHaveBeenCalledWith('123');
    expect(res.statusCode).toBe(204);
  });

  it('is a no-op (still 204) when the guild backs no group', async () => {
    mockedGroup.countBy.mockResolvedValue(0);
    const res = mockResponse();

    await handleMembershipChanged(
      mockRequest({ discord_id: '123', guild_id: 'unrelated' }),
      res
    );

    expect(mockedInvalidate).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(204);
  });

  it('returns 400 and busts nothing when the body is invalid', async () => {
    const res = mockResponse();

    await handleMembershipChanged(mockRequest({ discord_id: '123' }), res);

    expect(res.statusCode).toBe(400);
    expect(mockedGroup.countBy).not.toHaveBeenCalled();
    expect(mockedInvalidate).not.toHaveBeenCalled();
  });
});
