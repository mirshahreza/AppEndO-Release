import { beforeEach, describe, expect, it, vi } from 'vitest';

const destroyMock = vi.fn();
const createMock = vi.fn();
const findAllMock = vi.fn();

vi.mock('../personalInboxSeenSequelizeModels', () => ({
  ensurePersonalInboxSeenTable: vi.fn().mockResolvedValue(undefined),
  getPersonalInboxItemSeenModel: () => ({
    destroy: destroyMock,
    create: createMock,
    findAll: findAllMock,
  }),
}));

import { PersonalInboxSeenRepository } from '../personalInboxSeen.repository';

describe('PersonalInboxSeenRepository', () => {
  const repo = new PersonalInboxSeenRepository();

  beforeEach(() => {
    destroyMock.mockReset();
    createMock.mockReset();
    findAllMock.mockReset();
    destroyMock.mockResolvedValue(undefined);
    createMock.mockResolvedValue(undefined);
  });

  it('marks item seen with replace write', async () => {
    await repo.markSeen(3, 'work_item:12');
    expect(destroyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 3, itemKey: 'work_item:12' } }),
    );
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 3, itemKey: 'work_item:12' }),
    );
  });

  it('lists seen item keys for user', async () => {
    findAllMock.mockResolvedValue([
      { itemKey: 'work_item:1' },
      { itemKey: 'alert:2' },
    ]);
    const keys = await repo.listSeenItemKeys(3);
    expect(keys).toEqual(new Set(['work_item:1', 'alert:2']));
  });
});
