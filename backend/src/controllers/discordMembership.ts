import { membershipChangedSchema } from '@keebmeet/shared';
import { type Request, type Response } from 'express';
import { Group } from '../entity/Group';
import { invalidateMemberServers } from '../util/groupMembership';

/**
 * Called by the bot when a user joins/leaves a Discord server to invalidate the
 * cache of servers that user is a member of
 */
export const handleMembershipChanged = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const result = membershipChangedSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json(result.error);
  }

  const { discord_id, guild_id } = result.data;

  if ((await Group.countBy({ discord_server_id: guild_id })) > 0) {
    invalidateMemberServers(discord_id);
  }

  return res.status(204).end();
};
