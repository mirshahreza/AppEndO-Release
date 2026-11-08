import { afterEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  baseUserNotification: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
};

vi.mock('../../../db/prismaControlPlane', () => ({
  isPrismaControlPlaneReady: () => true,
  getPrismaControlPlane: () => prismaMock,
}));

vi.mock('../../../config/settingsFile', () => ({
  SETTINGS_PATH: '/tmp/settings.json',
  buildDefaultRuntimeSettings: () => ({
    accessTokenSecret: 'test-access',
    refreshTokenSecret: 'test-refresh',
  }),
}));

vi.mock('../../../domain/users/userRoleRepository', () => ({
  listRoleMemberSummaries: vi.fn(),
}));

const invalidateMock = vi.fn();
const removeProjectionItemMock = vi.fn();
vi.mock('../../personal-inbox/personalInboxProjectionInvalidate', () => ({
  invalidatePersonalInboxProjection: (userId: number) => invalidateMock(userId),
}));
vi.mock('../../personal-inbox/personalInboxProjectionSync', () => ({
  patchPersonalInboxProjectionAttention: vi.fn(),
  removePersonalInboxProjectionItem: (...args: unknown[]) => removeProjectionItemMock(...args),
}));

import {
  createUserNotification,
  listUserNotifications,
  countUnreadNotifications,
  countUnseenNotifications,
  markNotificationsBellSeen,
  markNotificationRead,
  markAllNotificationsRead,
  listAllUserNotifications,
  deleteUserNotification,
} from '../userNotification.service';

describe('userNotification.service (HWF-0.1)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('createUserNotification writes a row with defaults', async () => {
    prismaMock.baseUserNotification.create.mockResolvedValue({ id: BigInt(42) });
    const result = await createUserNotification({ userId: 7, title: 'Hi', body: 'Body' });
    expect(result).toEqual({ id: 42 });
    expect(prismaMock.baseUserNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: BigInt(7), title: 'Hi', body: 'Body', severity: 'info', source: 'workflow' }) }),
    );
    expect(invalidateMock).toHaveBeenCalledWith(7);
  });

  it('listUserNotifications maps rows and scopes to userId', async () => {
    const createdAt = new Date('2026-08-30T00:00:00.000Z');
    prismaMock.baseUserNotification.findMany.mockResolvedValue([
      { id: BigInt(1), title: 'T', body: 'B', severity: 'info', href: null, source: 'workflow', metadataJson: null, readAt: null, seenAt: null, createdAt },
    ]);
    const items = await listUserNotifications(7, { take: 10 });
    expect(items).toEqual([{ id: 1, title: 'T', body: 'B', severity: 'info', href: null, source: 'workflow', metadataJson: null, readAt: null, seenAt: null, createdAt: createdAt.toISOString() }]);
    expect(prismaMock.baseUserNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: BigInt(7) } }),
    );
  });

  it('listUserNotifications filters unreadOnly', async () => {
    prismaMock.baseUserNotification.findMany.mockResolvedValue([]);
    await listUserNotifications(7, { unreadOnly: true });
    expect(prismaMock.baseUserNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: BigInt(7), readAt: null } }),
    );
  });

  it('listUserNotifications caps take at 100', async () => {
    prismaMock.baseUserNotification.findMany.mockResolvedValue([]);
    await listUserNotifications(7, { take: 500 });
    expect(prismaMock.baseUserNotification.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
  });

  it('countUnreadNotifications scopes to userId + unread', async () => {
    prismaMock.baseUserNotification.count.mockResolvedValue(3);
    const count = await countUnreadNotifications(7);
    expect(count).toBe(3);
    expect(prismaMock.baseUserNotification.count).toHaveBeenCalledWith({ where: { userId: BigInt(7), readAt: null } });
  });

  it('countUnseenNotifications scopes to userId + unseen', async () => {
    prismaMock.baseUserNotification.count.mockResolvedValue(2);
    const count = await countUnseenNotifications(7);
    expect(count).toBe(2);
    expect(prismaMock.baseUserNotification.count).toHaveBeenCalledWith({ where: { userId: BigInt(7), seenAt: null } });
  });

  it('markNotificationsBellSeen stamps seenAt without readAt', async () => {
    prismaMock.baseUserNotification.updateMany.mockResolvedValue({ count: 4 });
    const result = await markNotificationsBellSeen(7);
    expect(result).toEqual({ updated: 4 });
    expect(prismaMock.baseUserNotification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: BigInt(7), seenAt: null } }),
    );
    expect(invalidateMock).toHaveBeenCalledWith(7);
  });

  it('deleteUserNotification removes owned rows and projection entries', async () => {
    prismaMock.baseUserNotification.deleteMany.mockResolvedValue({ count: 1 });
    const deleted = await deleteUserNotification(7, 42);
    expect(deleted).toBe(true);
    expect(prismaMock.baseUserNotification.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: BigInt(42), userId: BigInt(7) } }),
    );
    expect(removeProjectionItemMock).toHaveBeenCalledWith(7, 'alert:42');
    expect(invalidateMock).toHaveBeenCalledWith(7);
  });

  it('deleteUserNotification returns false when no row matched', async () => {
    prismaMock.baseUserNotification.deleteMany.mockResolvedValue({ count: 0 });
    const deleted = await deleteUserNotification(7, 99);
    expect(deleted).toBe(false);
    expect(removeProjectionItemMock).not.toHaveBeenCalled();
  });

  it('markNotificationRead is idempotent (only touches unread rows owned by the actor)', async () => {
    prismaMock.baseUserNotification.updateMany.mockResolvedValue({ count: 1 });
    await markNotificationRead(7, 42);
    expect(prismaMock.baseUserNotification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: BigInt(42), userId: BigInt(7), readAt: null } }),
    );
    expect(invalidateMock).toHaveBeenCalledWith(7);
  });

  it('markAllNotificationsRead returns the updated count', async () => {
    prismaMock.baseUserNotification.updateMany.mockResolvedValue({ count: 5 });
    const result = await markAllNotificationsRead(7);
    expect(result).toEqual({ updated: 5 });
    expect(invalidateMock).toHaveBeenCalledWith(7);
  });

  it('listAllUserNotifications maps rows with username and paginates', async () => {
    const createdAt = new Date('2026-09-16T00:00:00.000Z');
    prismaMock.baseUserNotification.findMany.mockResolvedValue([
      {
        id: BigInt(9),
        userId: BigInt(3),
        title: 'Alert',
        body: 'Body',
        severity: 'info',
        href: null,
        source: 'workflow',
        metadataJson: null,
        readAt: null,
        seenAt: null,
        createdAt,
        user: { username: 'admin' },
      },
    ]);
    prismaMock.baseUserNotification.count.mockResolvedValue(1);
    const result = await listAllUserNotifications({ page: 1, pageSize: 25, search: 'admin' });
    expect(result.items[0]).toMatchObject({ id: 9, userId: 3, username: 'admin', title: 'Alert' });
    expect(result.totalCount).toBe(1);
    expect(prismaMock.baseUserNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
        skip: 0,
        take: 25,
      }),
    );
  });
});
