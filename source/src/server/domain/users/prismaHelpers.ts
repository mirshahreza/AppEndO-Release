import type { Prisma } from '../../../generated/prisma/client';
import { normalizeRoleName } from './roleUtils';
import { getPrismaControlPlane } from '../../db/prismaControlPlane';
import { SETTINGS_PATH } from '../../config/settingsFile';
import { readControlPlaneDatabaseSettings, type ControlPlaneDbProvider } from '../../db/controlPlaneDatabase';

let cachedControlPlaneProvider: ControlPlaneDbProvider | null = null;

export const prisma = () => getPrismaControlPlane();

export const toUserId = (id: number | bigint): bigint => BigInt(id);

export const fromUserId = (id: bigint | number): number => Number(id);

export const invalidateControlPlaneProviderCache = (): void => {
  cachedControlPlaneProvider = null;
};

export const readControlPlaneProvider = (): ControlPlaneDbProvider => {
  if (cachedControlPlaneProvider) {
    return cachedControlPlaneProvider;
  }
  cachedControlPlaneProvider = readControlPlaneDatabaseSettings(SETTINGS_PATH).provider;
  return cachedControlPlaneProvider;
};

export const buildCaseInsensitiveEquals = (
  value: string,
  provider: ControlPlaneDbProvider = readControlPlaneProvider(),
): string | Prisma.StringFilter => {
  const trimmed = value.trim();
  if (provider === 'postgresql' || provider === 'mysql') {
    return { equals: trimmed, mode: 'insensitive' };
  }
  return trimmed.toLowerCase();
};

export const buildCaseInsensitiveContains = (
  value: string,
  provider: ControlPlaneDbProvider = readControlPlaneProvider(),
): Prisma.StringFilter => {
  const trimmed = value.trim();
  if (provider === 'postgresql' || provider === 'mysql') {
    return { contains: trimmed, mode: 'insensitive' };
  }
  return { contains: trimmed.toLowerCase() };
};

export const parseDateStart = (isoDate: string): Date => new Date(`${isoDate.trim()}T00:00:00.000Z`);

export const parseDateEnd = (isoDate: string): Date => new Date(`${isoDate.trim()}T23:59:59.999Z`);

/** Cross-provider viewOrder sort — extended `{ sort, nulls }` is PostgreSQL-only and unsupported in Prisma 7 client validation. */
export const orderByViewOrderAsc = () => [{ viewOrder: 'asc' as const }];

export const orderByViewOrderThenKey = () => [
  { viewOrder: 'asc' as const },
  { key: 'asc' as const },
];

export const orderByViewOrderThenId = () => [
  { viewOrder: 'asc' as const },
  { id: 'asc' as const },
];

export const loadUserRoles = async (userId: number | bigint): Promise<string[]> => {
  const { getUserRolesForRequest } = await import('./userRoleRepository');
  return getUserRolesForRequest(fromUserId(toUserId(userId)));
};

/** WFV2-21 — all user ids that currently hold the given normalized role name. */
export const loadUserIdsWithRole = async (roleId: string): Promise<number[]> => {
  const normalizedRole = normalizeRoleName(roleId);
  const rows = await prisma().baseUserRole.findMany({
    where: { roleName: normalizedRole },
    orderBy: [{ userId: 'asc' }],
    select: { userId: true },
  });
  return Array.from(new Set(rows.map((row) => fromUserId(row.userId)))).sort((a, b) => a - b);
};

export const loadUsernameMap = async (userIds: Array<bigint | number | null | undefined>) => {
  const ids = Array.from(
    new Set(
      userIds
        .filter((id): id is bigint | number => id !== null && id !== undefined)
        .map((id) => toUserId(id)),
    ),
  );
  if (ids.length === 0) {
    return new Map<number, string>();
  }
  const rows = await prisma().baseUser.findMany({
    where: { id: { in: ids } },
    select: { id: true, username: true },
  });
  return new Map(rows.map((row) => [fromUserId(row.id), row.username]));
};
