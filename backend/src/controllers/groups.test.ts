/// <reference types="jest" />
import { type Request, type Response } from 'express';

// ---- Mocks -----------------------------------------------------------------

jest.mock('../entity/Group', () => ({
  Group: {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    countBy: jest.fn(),
  },
}));

import { createGroup, deleteGroup, editGroup, getGroups } from './groups';
import { Group } from '../entity/Group';

const mockedGroup = jest.mocked(Group);

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

/** A fake group row with stubbed save()/remove(). */
const fakeGroup = (overrides: Record<string, unknown> = {}): any => ({
  id: '1',
  name: 'Keeb Club',
  code: 'keeb',
  discord_server_id: null,
  save: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ---- getGroups -------------------------------------------------------------

describe('getGroups', () => {
  it('returns every group as its public shape, ordered by name', async () => {
    mockedGroup.find.mockResolvedValue([
      fakeGroup({ id: '1', name: 'Alpha', code: 'a', discord_server_id: '9' }),
      fakeGroup({ id: '2', name: 'Beta', code: 'b', discord_server_id: null }),
    ] as never);
    const res = mockResponse();

    await getGroups(mockRequest(), res);

    expect(mockedGroup.find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
    expect(res.body).toEqual([
      { id: '1', name: 'Alpha', code: 'a', discord_server_id: '9' },
      { id: '2', name: 'Beta', code: 'b', discord_server_id: null },
    ]);
  });

  it('returns an empty array when there are no groups', async () => {
    mockedGroup.find.mockResolvedValue([] as never);
    const res = mockResponse();

    await getGroups(mockRequest(), res);

    expect(res.body).toEqual([]);
  });
});

// ---- createGroup -----------------------------------------------------------

describe('createGroup', () => {
  it('returns 400 when the payload is invalid', async () => {
    const res = mockResponse();

    // name too short, no code
    await createGroup(mockRequest({ name: 'x' }), res);

    expect(res.statusCode).toBe(400);
    expect(mockedGroup.countBy).not.toHaveBeenCalled();
    expect(mockedGroup.create).not.toHaveBeenCalled();
  });

  it('returns 409 when the code is already taken', async () => {
    mockedGroup.countBy.mockResolvedValue(1);
    const res = mockResponse();

    await createGroup(
      mockRequest({ name: 'Keeb Club', code: 'keeb' }),
      res
    );

    expect(res.statusCode).toBe(409);
    expect(mockedGroup.create).not.toHaveBeenCalled();
  });

  it('creates the group and returns 201 with its public shape', async () => {
    mockedGroup.countBy.mockResolvedValue(0);
    const saved = fakeGroup({
      id: '7',
      name: 'Keeb Club',
      code: 'keeb',
      discord_server_id: '123',
    });
    const save = jest.fn().mockResolvedValue(saved);
    mockedGroup.create.mockReturnValue({ save } as never);
    const res = mockResponse();

    await createGroup(
      mockRequest({
        name: 'Keeb Club',
        code: 'keeb',
        discord_server_id: '123',
      }),
      res
    );

    expect(mockedGroup.create).toHaveBeenCalledWith({
      name: 'Keeb Club',
      code: 'keeb',
      discord_server_id: '123',
    });
    expect(save).toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      id: '7',
      name: 'Keeb Club',
      code: 'keeb',
      discord_server_id: '123',
    });
  });

  it('stores a null discord_server_id when none is provided', async () => {
    mockedGroup.countBy.mockResolvedValue(0);
    const save = jest.fn().mockResolvedValue(fakeGroup());
    mockedGroup.create.mockReturnValue({ save } as never);
    const res = mockResponse();

    await createGroup(mockRequest({ name: 'Keeb Club', code: 'keeb' }), res);

    expect(mockedGroup.create).toHaveBeenCalledWith({
      name: 'Keeb Club',
      code: 'keeb',
      discord_server_id: null,
    });
  });
});

// ---- editGroup -------------------------------------------------------------

describe('editGroup', () => {
  it('returns 400 when the payload is invalid', async () => {
    const res = mockResponse();

    await editGroup(mockRequest({ name: 'x' }, { group_id: '1' }), res);

    expect(res.statusCode).toBe(400);
    expect(mockedGroup.findOneBy).not.toHaveBeenCalled();
  });

  it('returns 404 when the group does not exist', async () => {
    mockedGroup.findOneBy.mockResolvedValue(null);
    const res = mockResponse();

    await editGroup(
      mockRequest({ name: 'Renamed' }, { group_id: '99' }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('returns 409 when the new code belongs to another group', async () => {
    const group = fakeGroup({ id: '1', code: 'keeb' });
    mockedGroup.findOneBy.mockResolvedValue(group as never);
    mockedGroup.findOne.mockResolvedValue(
      fakeGroup({ id: '2', code: 'taken' }) as never
    );
    const res = mockResponse();

    await editGroup(
      mockRequest({ code: 'taken' }, { group_id: '1' }),
      res
    );

    expect(res.statusCode).toBe(409);
    expect(group.save).not.toHaveBeenCalled();
  });

  it('allows keeping the same code (case-insensitive match on self)', async () => {
    const group = fakeGroup({ id: '1', code: 'keeb', name: 'Keeb Club' });
    mockedGroup.findOneBy.mockResolvedValue(group as never);
    // The only match is the group itself.
    mockedGroup.findOne.mockResolvedValue(group as never);
    const res = mockResponse();

    await editGroup(
      mockRequest({ code: 'KEEB' }, { group_id: '1' }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(group.code).toBe('KEEB');
    expect(group.save).toHaveBeenCalled();
  });

  it('updates only the fields present in the payload', async () => {
    const group = fakeGroup({
      id: '1',
      name: 'Keeb Club',
      code: 'keeb',
      discord_server_id: '123',
    });
    mockedGroup.findOneBy.mockResolvedValue(group as never);
    const res = mockResponse();

    await editGroup(mockRequest({ name: 'Renamed' }, { group_id: '1' }), res);

    expect(group.name).toBe('Renamed');
    // Untouched fields are preserved; no code lookup runs when code is absent.
    expect(group.code).toBe('keeb');
    expect(group.discord_server_id).toBe('123');
    expect(mockedGroup.findOne).not.toHaveBeenCalled();
    expect(group.save).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ id: '1', name: 'Renamed', code: 'keeb' })
    );
  });

  it('clears the discord_server_id when passed an empty string', async () => {
    const group = fakeGroup({ id: '1', discord_server_id: '123' });
    mockedGroup.findOneBy.mockResolvedValue(group as never);
    const res = mockResponse();

    await editGroup(
      mockRequest({ discord_server_id: '' }, { group_id: '1' }),
      res
    );

    expect(group.discord_server_id).toBeNull();
    expect(res.body).toEqual(
      expect.objectContaining({ discord_server_id: null })
    );
  });
});

// ---- deleteGroup -----------------------------------------------------------

describe('deleteGroup', () => {
  it('returns 404 when the group does not exist', async () => {
    mockedGroup.findOneBy.mockResolvedValue(null);
    const res = mockResponse();

    await deleteGroup(mockRequest({}, { group_id: '99' }), res);

    expect(res.statusCode).toBe(404);
  });

  it('removes the group and returns 204', async () => {
    const group = fakeGroup({ id: '1' });
    mockedGroup.findOneBy.mockResolvedValue(group as never);
    const res = mockResponse();

    await deleteGroup(mockRequest({}, { group_id: '1' }), res);

    expect(group.remove).toHaveBeenCalled();
    expect(res.statusCode).toBe(204);
    expect(res.end).toHaveBeenCalled();
  });
});
