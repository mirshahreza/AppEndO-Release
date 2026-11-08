import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => {
  const tx = {
    baseInfo: {
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    baseContactMessage: { updateMany: vi.fn() },
    baseUserProfile: { updateMany: vi.fn() },
    baseSettingsAttribute: { updateMany: vi.fn() },
    baseScopeMembership: { updateMany: vi.fn() },
    baseScopeMembershipEvent: { updateMany: vi.fn() },
    baseScopeRoleMembership: { updateMany: vi.fn() },
    baseScopeRoleMembershipEvent: { updateMany: vi.fn() },
    baseUserAttribute: {
      findMany: vi.fn(async () => []),
      update: vi.fn(),
    },
    baseRoleAttribute: {
      findMany: vi.fn(async () => []),
      update: vi.fn(),
    },
  };

  return {
    tx,
    baseInfo: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<void>) => fn(tx)),
  };
});

vi.mock('../../users/prismaHelpers', () => ({
  prisma: () => prismaMock,
  toUserId: (value: number) => BigInt(value),
  orderByViewOrderThenId: () => [{ viewOrder: 'asc' }, { id: 'asc' }],
}));

import { renameBaseInfoSubtree } from '../treeRepository';

describe('renameBaseInfoSubtree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.baseInfo.findMany.mockResolvedValue([{ id: '104.1' }]);
    prismaMock.tx.baseInfo.findUniqueOrThrow.mockResolvedValue({
      parentId: '104',
      title: 'Support',
      titleEn: 'Support',
      titleFa: null,
      titleAr: null,
      shortName: null,
      viewOrder: 10,
      note: null,
      noteEn: null,
      noteFa: null,
      noteAr: null,
      metadata: null,
      value: 1,
      isActive: true,
      uiColor: null,
      uiHtml: null,
      createdAt: new Date('2026-01-01'),
      createdBy: null,
    });
  });

  it('creates the new row, remaps FK references, then deletes the old row', async () => {
    await renameBaseInfoSubtree(['104.1', '105.1', '105', null, 1]);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.tx.baseInfo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: '105.1',
          parentId: '105',
        }),
      }),
    );
    expect(prismaMock.tx.baseInfo.updateMany).toHaveBeenCalledWith({
      where: { parentId: '104.1' },
      data: { parentId: '105.1' },
    });
    expect(prismaMock.tx.baseContactMessage.updateMany).toHaveBeenCalledWith({
      where: { topicCode: '104.1' },
      data: { topicCode: '105.1' },
    });
    expect(prismaMock.tx.baseInfo.delete).toHaveBeenCalledWith({ where: { id: '104.1' } });
  });
});
