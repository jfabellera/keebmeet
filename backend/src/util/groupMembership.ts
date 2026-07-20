import { In, IsNull, Not } from 'typeorm';
import config from '../config';
import { Group } from '../entity/Group';
import { type User } from '../entity/User';
import { isGuildMember } from './discord';

const TTL_MS = 5 * 60 * 1000;

// Keyed by discord_id and provides the group-backing server ids the user is in
const cache = new Map<string, { value: Set<string>; expires: number }>();

export const invalidateMemberServers = (discordId: string): void => {
  cache.delete(discordId);
};

export const clearMemberServerCache = (): void => {
  cache.clear();
};

const getMemberGroupServerIds = async (
  discordId: string
): Promise<Set<string>> => {
  const hit = cache.get(discordId);
  if (hit != null && hit.expires > Date.now()) return hit.value;

  if (config.discordBotToken === '') return new Set();

  const groups = await Group.find({
    select: { discord_server_id: true },
    where: { discord_server_id: Not(IsNull()) },
  });
  const serverIds = [
    ...new Set(
      groups
        .map((group) => group.discord_server_id)
        .filter((id): id is string => id != null)
    ),
  ];

  const checks = await Promise.all(
    serverIds.map(
      async (id) => [id, await isGuildMember(id, discordId)] as const
    )
  );
  const memberServers = new Set(
    checks.filter(([, isMember]) => isMember).map(([id]) => id)
  );

  cache.set(discordId, { value: memberServers, expires: Date.now() + TTL_MS });
  return memberServers;
};

export const getDiscordDerivedGroups = async (
  discordId: string | null | undefined
): Promise<Group[]> => {
  if (discordId == null) return [];
  const servers = await getMemberGroupServerIds(discordId);
  if (servers.size === 0) return [];
  return Group.find({ where: { discord_server_id: In([...servers]) } });
};

export const getEffectiveGroups = async (
  user: Pick<User, 'groups' | 'discord_id'>
): Promise<Group[]> => {
  const derived = await getDiscordDerivedGroups(user.discord_id);
  const byId = new Map<string, Group>();
  for (const group of user.groups) byId.set(group.id, group);
  for (const group of derived)
    if (!byId.has(group.id)) byId.set(group.id, group);
  return [...byId.values()];
};

export const getEffectiveGroupIds = async (
  user: Pick<User, 'groups' | 'discord_id'>
): Promise<string[]> => {
  const ids = new Set(user.groups.map((group) => group.id));
  if (user.discord_id != null) {
    const servers = await getMemberGroupServerIds(user.discord_id);
    if (servers.size > 0) {
      const derived = await Group.find({
        select: { id: true },
        where: { discord_server_id: In([...servers]) },
      });
      for (const group of derived) ids.add(group.id);
    }
  }
  return [...ids];
};
