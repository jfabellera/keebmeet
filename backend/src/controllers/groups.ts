import {
  createGroupSchema,
  editGroupSchema,
  type GroupInfo,
} from '@keebmeet/shared';
import { type Request, type Response } from 'express';
import { ILike } from 'typeorm';
import { Group } from '../entity/Group';

const toGroupResponse = (group: Group): GroupInfo => ({
  id: group.id,
  name: group.name,
  code: group.code,
  discord_server_id: group.discord_server_id ?? null,
});

/**
 * Lists all groups, ordered by name.
 */
export const getGroups = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const groups = await Group.find({ order: { name: 'ASC' } });

  return res.json(groups.map(toGroupResponse));
};

/**
 * Creates a group. The code is a case-insensitive unique identifier, so a
 * collision with an existing group is rejected.
 */
export const createGroup = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const result = createGroupSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json(result.error);
  }

  if ((await Group.countBy({ code: ILike(result.data.code) })) > 0) {
    return res.status(409).json({ message: 'Group code is taken.' });
  }

  const group = await Group.create({
    name: result.data.name,
    code: result.data.code,
    discord_server_id: result.data.discord_server_id ?? null,
  }).save();

  return res.status(201).json(toGroupResponse(group));
};

/**
 * Updates a group's name, code, and/or Discord server. Only the fields present
 * in the payload are changed; passing an empty discord_server_id clears it.
 */
export const editGroup = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { group_id } = req.params as Record<string, string>;

  const result = editGroupSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json(result.error);
  }

  const group = await Group.findOneBy({ id: group_id });

  if (group == null) {
    return res.status(404).json({ message: 'Invalid group ID.' });
  }

  if (result.data.code != null && result.data.code !== group.code) {
    const codeTaken = await Group.findOne({
      where: { code: ILike(result.data.code) },
    });
    if (codeTaken != null && codeTaken.id !== group.id) {
      return res.status(409).json({ message: 'Group code is taken.' });
    }
    group.code = result.data.code;
  }

  if (result.data.name != null) group.name = result.data.name;
  if (result.data.discord_server_id !== undefined) {
    group.discord_server_id = result.data.discord_server_id;
  }

  await group.save();

  return res.status(200).json(toGroupResponse(group));
};

/**
 * Deletes a group.
 */
export const deleteGroup = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { group_id } = req.params as Record<string, string>;

  const group = await Group.findOneBy({ id: group_id });

  if (group == null) {
    return res.status(404).json({ message: 'Invalid group ID.' });
  }

  await group.remove();

  return res.status(204).end();
};
