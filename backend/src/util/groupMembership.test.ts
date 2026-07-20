/// <reference types="jest" />
jest.mock('../config', () => ({
  __esModule: true,
  default: { discordBotToken: 'bot-token' },
}));

jest.mock('./discord', () => ({
  __esModule: true,
  isGuildMember: jest.fn(),
}));

jest.mock('../entity/Group', () => ({
  Group: { find: jest.fn() },
}));

import config from '../config';
import { Group } from '../entity/Group';
import { isGuildMember } from './discord';
import {
  getDiscordDerivedGroups,
  getEffectiveGroupIds,
  getEffectiveGroups,
  invalidateMemberServers,
} from './groupMembership';

const mockedGroup = jest.mocked(Group);
const mockedIsGuildMember = jest.mocked(isGuildMember);

const g1: any = { id: 'g1', name: 'Alpha', code: 'a', discord_server_id: 's1' };
const g2: any = { id: 'g2', name: 'Beta', code: 'b', discord_server_id: 's2' };
const ALL = [g1, g2];

// Group.find is used two ways: the distinct-servers lookup (where uses Not(IsNull))
// and the derived-by-server lookup (where uses In). Route by the operator type.
const routeGroupFind = (opts: any): Promise<any[]> => {
  const op = opts?.where?.discord_server_id;
  if (op?.type === 'in') {
    const wanted = new Set(op.value as string[]);
    return Promise.resolve(ALL.filter((g) => wanted.has(g.discord_server_id)));
  }
  return Promise.resolve(ALL);
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  config.discordBotToken = 'bot-token';
  mockedGroup.find.mockImplementation(routeGroupFind as never);
  // The user is in s1 but not s2.
  mockedIsGuildMember.mockImplementation(
    async (serverId: string) => serverId === 's1'
  );
});

afterAll(() => {
  jest.useRealTimers();
});

describe('getEffectiveGroups', () => {
  it('returns only explicit groups and skips Discord when unlinked', async () => {
    const groups = await getEffectiveGroups({
      groups: [g2],
      discord_id: undefined,
    });

    expect(groups.map((g) => g.id)).toEqual(['g2']);
    expect(mockedIsGuildMember).not.toHaveBeenCalled();
    expect(mockedGroup.find).not.toHaveBeenCalled();
  });

  it('derives groups from the servers the linked Discord is in', async () => {
    const groups = await getEffectiveGroups({ groups: [], discord_id: 'd-1' });

    expect(groups.map((g) => g.id)).toEqual(['g1']);
  });

  it('dedupes a group that is both explicit and Discord-derived', async () => {
    const groups = await getEffectiveGroups({ groups: [g1], discord_id: 'd-2' });

    expect(groups.map((g) => g.id)).toEqual(['g1']);
  });

  it('returns explicit only and issues no In query when in no matching servers', async () => {
    mockedIsGuildMember.mockResolvedValue(false);

    const groups = await getEffectiveGroups({ groups: [], discord_id: 'd-3' });

    expect(groups).toEqual([]);
    const inQueries = mockedGroup.find.mock.calls.filter(
      (call) => (call[0] as any)?.where?.discord_server_id?.type === 'in'
    );
    expect(inQueries).toHaveLength(0);
  });

  it('makes no Discord calls when the bot token is unset', async () => {
    config.discordBotToken = '';

    const groups = await getDiscordDerivedGroups('d-4');

    expect(groups).toEqual([]);
    expect(mockedIsGuildMember).not.toHaveBeenCalled();
    expect(mockedGroup.find).not.toHaveBeenCalled();
  });
});

describe('membership cache', () => {
  it('reuses the cached server set within the TTL', async () => {
    await getDiscordDerivedGroups('d-hit');
    await getDiscordDerivedGroups('d-hit');

    // Two servers checked once, not once per call.
    expect(mockedIsGuildMember).toHaveBeenCalledTimes(2);
  });

  it('re-checks Discord after the TTL expires', async () => {
    await getDiscordDerivedGroups('d-ttl');
    expect(mockedIsGuildMember).toHaveBeenCalledTimes(2);

    jest.setSystemTime(Date.now() + 5 * 60 * 1000 + 1);
    await getDiscordDerivedGroups('d-ttl');

    expect(mockedIsGuildMember).toHaveBeenCalledTimes(4);
  });

  it('re-checks Discord after the entry is invalidated', async () => {
    await getDiscordDerivedGroups('d-inv');
    expect(mockedIsGuildMember).toHaveBeenCalledTimes(2);

    invalidateMemberServers('d-inv');
    await getDiscordDerivedGroups('d-inv');

    expect(mockedIsGuildMember).toHaveBeenCalledTimes(4);
  });
});

describe('getEffectiveGroupIds', () => {
  it('unions explicit ids with Discord-derived ids', async () => {
    const ids = await getEffectiveGroupIds({
      groups: [{ id: 'gx' } as any],
      discord_id: 'd-5',
    });

    expect([...ids].sort()).toEqual(['g1', 'gx']);
  });
});
