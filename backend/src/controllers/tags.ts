import { createTagSchema, editTagSchema, type TagInfo } from '@keebmeet/shared';
import { type Request, type Response } from 'express';
import { AppDataSource } from '../datasource';
import { Tag } from '../entity/Tag';
import { User } from '../entity/User';
import { getVisibleUnlistedMeetups } from '../util/meetupVisibility';

const toTagResponse = (tag: Tag): TagInfo => ({
  id: tag.id,
  name: tag.name,
  color: tag.color,
});

// Case-insensitive lookup, matching the lower(name) unique index.
const findByNameInsensitive = async (name: string): Promise<Tag | null> =>
  Tag.createQueryBuilder('tag')
    .where('LOWER(tag.name) = LOWER(:name)', { name })
    .getOne();

export const getTags = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const tags = await Tag.find({ order: { name: 'ASC' } });

  const requestor = res.locals.requestor as User | undefined;
  const { all: visibleUnlistedIds } =
    await getVisibleUnlistedMeetups(requestor);

  const countQuery = AppDataSource.createQueryBuilder()
    .select('mt.tag_id', 'tag_id')
    .addSelect('COUNT(*)', 'count')
    .from('meetups_tags', 'mt')
    .innerJoin('meetups', 'm', 'm.id = mt.meetup_id')
    .groupBy('mt.tag_id');
  if (visibleUnlistedIds.length > 0) {
    countQuery.where(
      'm.is_unlisted = false OR m.id IN (:...visibleUnlistedIds)',
      { visibleUnlistedIds }
    );
  } else {
    countQuery.where('m.is_unlisted = false');
  }
  const countRows = await countQuery.getRawMany<{
    tag_id: string;
    count: string;
  }>();
  const countByTagId = new Map(
    countRows.map((row) => [row.tag_id, Number(row.count)])
  );

  return res.json(
    tags.map((tag) => ({
      ...toTagResponse(tag),
      meetup_count: countByTagId.get(tag.id) ?? 0,
    }))
  );
};

export const createTag = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const result = createTagSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json(result.error);
  }

  if ((await findByNameInsensitive(result.data.name)) != null) {
    return res.status(409).json({ message: 'Tag name is taken.' });
  }

  const requestor = res.locals.requestor as User;
  const tag = await Tag.create({
    name: result.data.name,
    color: result.data.color,
    created_by: requestor.id,
  }).save();

  return res.status(201).json(toTagResponse(tag));
};

export const editTag = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { tag_id } = req.params as Record<string, string>;

  const result = editTagSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json(result.error);
  }

  const tag = await Tag.findOneBy({ id: tag_id });

  if (tag == null) {
    return res.status(404).json({ message: 'Invalid tag ID.' });
  }

  if (result.data.name != null && result.data.name !== tag.name) {
    const existing = await findByNameInsensitive(result.data.name);
    if (existing != null && existing.id !== tag.id) {
      return res.status(409).json({ message: 'Tag name is taken.' });
    }
    tag.name = result.data.name;
  }

  if (result.data.color != null) tag.color = result.data.color;

  await tag.save();

  return res.status(200).json(toTagResponse(tag));
};

export const deleteTag = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { tag_id } = req.params as Record<string, string>;

  const tag = await Tag.findOneBy({ id: tag_id });

  if (tag == null) {
    return res.status(404).json({ message: 'Invalid tag ID.' });
  }

  // Join rows are cleared by the FK's ON DELETE CASCADE.
  await tag.remove();

  return res.status(204).end();
};
