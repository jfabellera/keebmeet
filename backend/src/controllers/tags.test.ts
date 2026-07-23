/// <reference types="jest" />
import { type Request, type Response } from 'express';

// ---- Mocks -----------------------------------------------------------------

jest.mock('../entity/Tag', () => ({
  Tag: {
    find: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    createQueryBuilder: jest.fn(),
  },
}));

jest.mock('../entity/User', () => ({ User: {} }));

// Chainable stub for AppDataSource.createQueryBuilder(); getRawMany returns the
// per-tag meetup counts.
const countQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  getRawMany: jest.fn().mockResolvedValue([]),
};

jest.mock('../datasource', () => ({
  AppDataSource: { createQueryBuilder: jest.fn() },
}));

jest.mock('../util/meetupVisibility', () => ({
  getVisibleUnlistedMeetups: jest.fn(),
}));

import { createTag, deleteTag, editTag, getTags } from './tags';
import { Tag } from '../entity/Tag';
import { AppDataSource } from '../datasource';
import { getVisibleUnlistedMeetups } from '../util/meetupVisibility';

const mockedTag = jest.mocked(Tag);
const mockedDataSource = jest.mocked(AppDataSource);
const mockedGetVisibleUnlisted = jest.mocked(getVisibleUnlistedMeetups);

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

const mockRequest = (
  body: Record<string, unknown> = {},
  params: Record<string, string> = {}
): Request => ({ body, params }) as unknown as Request;

/** A fake tag row with a stubbed save()/remove(). */
const fakeTag = (overrides: Record<string, unknown> = {}): any => ({
  id: '1',
  name: 'gmk',
  color: '#1a2b3c',
  save: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

/** Stubs Tag.createQueryBuilder so findByNameInsensitive resolves to `match`. */
const mockNameLookup = (match: unknown): void => {
  const qb: any = {};
  qb.where = jest.fn().mockReturnValue(qb);
  qb.getOne = jest.fn().mockResolvedValue(match);
  mockedTag.createQueryBuilder.mockReturnValue(qb as never);
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedDataSource.createQueryBuilder.mockReturnValue(countQueryBuilder as any);
  countQueryBuilder.getRawMany.mockResolvedValue([]);
  mockedGetVisibleUnlisted.mockResolvedValue({
    organizedIds: new Set(),
    attendedIds: new Set(),
    groupMeetupIds: new Set(),
    all: [],
  });
});

// ---- getTags ---------------------------------------------------------------

describe('getTags', () => {
  it('returns every tag with its meetup count, ordered by name', async () => {
    mockedTag.find.mockResolvedValue([
      fakeTag({ id: '1', name: 'alpha', color: '#000000' }),
      fakeTag({ id: '2', name: 'beta', color: '#ffffff' }),
    ] as never);
    // alpha is on 3 meetups; beta on none.
    countQueryBuilder.getRawMany.mockResolvedValue([{ tag_id: '1', count: '3' }]);
    const res = mockResponse();

    await getTags(mockRequest(), res);

    expect(mockedTag.find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
    expect(res.body).toEqual([
      { id: '1', name: 'alpha', color: '#000000', meetup_count: 3 },
      { id: '2', name: 'beta', color: '#ffffff', meetup_count: 0 },
    ]);
  });

  it('counts only public meetups for anonymous requests', async () => {
    mockedTag.find.mockResolvedValue([fakeTag()] as never);
    const res = mockResponse();

    await getTags(mockRequest(), res);

    expect(countQueryBuilder.where).toHaveBeenCalledWith('m.is_unlisted = false');
  });

  it('also counts unlisted meetups the requestor may see', async () => {
    mockedTag.find.mockResolvedValue([fakeTag()] as never);
    mockedGetVisibleUnlisted.mockResolvedValue({
      organizedIds: new Set(),
      attendedIds: new Set(),
      groupMeetupIds: new Set(),
      all: ['30', '40'],
    });
    const res = mockResponse();
    res.locals.requestor = { id: '1' };

    await getTags(mockRequest(), res);

    expect(mockedGetVisibleUnlisted).toHaveBeenCalledWith({ id: '1' });
    expect(countQueryBuilder.where).toHaveBeenCalledWith(
      'm.is_unlisted = false OR m.id IN (:...visibleUnlistedIds)',
      { visibleUnlistedIds: ['30', '40'] }
    );
  });

  it('returns an empty array when there are no tags', async () => {
    mockedTag.find.mockResolvedValue([] as never);
    const res = mockResponse();

    await getTags(mockRequest(), res);

    expect(res.body).toEqual([]);
  });
});

// ---- createTag -------------------------------------------------------------

describe('createTag', () => {
  it('returns 400 when the name is missing', async () => {
    const res = mockResponse();

    await createTag(mockRequest({ color: '#1a2b3c' }), res);

    expect(res.statusCode).toBe(400);
    expect(mockedTag.create).not.toHaveBeenCalled();
  });

  it('returns 400 when the color is not a hex code', async () => {
    const res = mockResponse();

    await createTag(mockRequest({ name: 'gmk', color: 'red' }), res);

    expect(res.statusCode).toBe(400);
    expect(mockedTag.create).not.toHaveBeenCalled();
  });

  it('returns 409 when the name is already taken (case-insensitive)', async () => {
    mockNameLookup(fakeTag({ id: '9', name: 'gmk' }));
    const res = mockResponse();
    res.locals.requestor = { id: '100' };

    await createTag(mockRequest({ name: 'GMK', color: '#1a2b3c' }), res);

    expect(res.statusCode).toBe(409);
    expect(mockedTag.create).not.toHaveBeenCalled();
  });

  it('creates the tag with the requestor as creator and returns 201', async () => {
    mockNameLookup(null);
    const saved = fakeTag({ id: '7', name: 'gmk', color: '#1a2b3c' });
    const save = jest.fn().mockResolvedValue(saved);
    mockedTag.create.mockReturnValue({ save } as never);
    const res = mockResponse();
    res.locals.requestor = { id: '100' };

    await createTag(mockRequest({ name: 'gmk', color: '#1a2b3c' }), res);

    expect(mockedTag.create).toHaveBeenCalledWith({
      name: 'gmk',
      color: '#1a2b3c',
      created_by: '100',
    });
    expect(save).toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ id: '7', name: 'gmk', color: '#1a2b3c' });
  });
});

// ---- editTag ---------------------------------------------------------------

describe('editTag', () => {
  it('returns 400 when the payload is invalid', async () => {
    const res = mockResponse();

    await editTag(mockRequest({ color: 'nope' }, { tag_id: '1' }), res);

    expect(res.statusCode).toBe(400);
    expect(mockedTag.findOneBy).not.toHaveBeenCalled();
  });

  it('returns 404 when the tag does not exist', async () => {
    mockedTag.findOneBy.mockResolvedValue(null);
    const res = mockResponse();

    await editTag(mockRequest({ name: 'renamed' }, { tag_id: '99' }), res);

    expect(res.statusCode).toBe(404);
  });

  it('returns 409 when the new name belongs to another tag', async () => {
    const tag = fakeTag({ id: '1', name: 'gmk' });
    mockedTag.findOneBy.mockResolvedValue(tag as never);
    mockNameLookup(fakeTag({ id: '2', name: 'taken' }));
    const res = mockResponse();

    await editTag(mockRequest({ name: 'taken' }, { tag_id: '1' }), res);

    expect(res.statusCode).toBe(409);
    expect(tag.save).not.toHaveBeenCalled();
  });

  it('updates only the fields present in the payload', async () => {
    const tag = fakeTag({ id: '1', name: 'gmk', color: '#1a2b3c' });
    mockedTag.findOneBy.mockResolvedValue(tag as never);
    const res = mockResponse();

    await editTag(mockRequest({ color: '#ffffff' }, { tag_id: '1' }), res);

    expect(tag.color).toBe('#ffffff');
    // Name untouched, so no uniqueness lookup runs.
    expect(tag.name).toBe('gmk');
    expect(mockedTag.createQueryBuilder).not.toHaveBeenCalled();
    expect(tag.save).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ id: '1', name: 'gmk', color: '#ffffff' });
  });

  it('renames when the new name is free', async () => {
    const tag = fakeTag({ id: '1', name: 'gmk', color: '#1a2b3c' });
    mockedTag.findOneBy.mockResolvedValue(tag as never);
    mockNameLookup(null);
    const res = mockResponse();

    await editTag(mockRequest({ name: 'sa' }, { tag_id: '1' }), res);

    expect(tag.name).toBe('sa');
    expect(tag.save).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });
});

// ---- deleteTag -------------------------------------------------------------

describe('deleteTag', () => {
  it('returns 404 when the tag does not exist', async () => {
    mockedTag.findOneBy.mockResolvedValue(null);
    const res = mockResponse();

    await deleteTag(mockRequest({}, { tag_id: '99' }), res);

    expect(res.statusCode).toBe(404);
  });

  it('removes the tag and returns 204', async () => {
    const tag = fakeTag({ id: '1' });
    mockedTag.findOneBy.mockResolvedValue(tag as never);
    const res = mockResponse();

    await deleteTag(mockRequest({}, { tag_id: '1' }), res);

    expect(tag.remove).toHaveBeenCalled();
    expect(res.statusCode).toBe(204);
    expect(res.end).toHaveBeenCalled();
  });
});
