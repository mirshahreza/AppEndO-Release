import { normalizeRoleName } from './roleUtils';
import { HttpError } from '../../errors/HttpError';
import { fromUserId, loadUsernameMap, prisma, toUserId } from './prismaHelpers';
import {
  getCachedUserRoles,
  invalidateUserRolesCache,
  setCachedUserRoles,
} from './userRolesCache';

export async function findFirstAdminUser(): Promise<
  { id: number; email: string; username: string } | undefined
> {
  const row = await prisma().baseUser.findFirst({
    where: { userRoles: { some: { roleName: 'ADMIN' } } },
    orderBy: { id: 'asc' },
    select: { id: true, email: true, username: true },
  });
  if (!row) return undefined;
  return {
    id: fromUserId(row.id),
    email: row.email ?? '',
    username: row.username,
  };
}

export type RoleMemberSummary = {
  userId: number;
  username: string;
  email: string | null;
  locked: boolean;
  displayName: string;
};

/** Members of a role for workflow routing / notify — never includes secrets. */
export async function listRoleMemberSummaries(
  roleName: string,
  options: { includeLocked?: boolean } = {},
): Promise<{ roleName: string; members: RoleMemberSummary[] } | { roleMissing: true }> {
  const { resolved, invalid } = await resolveCanonicalRoleNames([roleName]);
  if (invalid.length > 0 || resolved.length === 0) {
    return { roleMissing: true };
  }
  const canonical = resolved[0]!;
  const includeLocked = options.includeLocked === true;
  const rows = await prisma().baseUser.findMany({
    where: {
      userRoles: { some: { roleName: canonical } },
      ...(includeLocked ? {} : { locked: 0 }),
    },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      username: true,
      email: true,
      locked: true,
      profile: { select: { firstname: true, lastname: true, nickname: true, companyName: true } },
    },
  });
  const members: RoleMemberSummary[] = rows.map((row) => {
    const profile = row.profile;
    const personName = [profile?.firstname, profile?.lastname].filter(Boolean).join(' ').trim();
    const displayName =
      (profile?.nickname && profile.nickname.trim()) ||
      personName ||
      (profile?.companyName && profile.companyName.trim()) ||
      row.username;
    return {
      userId: fromUserId(row.id),
      username: row.username,
      email: row.email ?? null,
      locked: row.locked !== 0,
      displayName,
    };
  });
  return { roleName: canonical, members };
}

export async function listAllUserRoleRows() {
  const rows = await prisma().baseUserRole.findMany({
    orderBy: [{ userId: 'asc' }, { createdAt: 'asc' }, { roleName: 'asc' }],
    select: { userId: true, roleName: true },
  });
  return rows.map((row) => ({
    user_id: fromUserId(row.userId),
    role_name: row.roleName,
  }));
}

export async function listUserRoleRows(userId: number) {
  const rows = await prisma().baseUserRole.findMany({
    where: { userId: toUserId(userId) },
    orderBy: [{ createdAt: 'asc' }, { roleName: 'asc' }],
    select: { roleName: true },
  });
  return rows.map((row) => ({ role_name: row.roleName }));
}

export async function deleteUserRoles(userId: number) {
  await prisma().baseUserRole.deleteMany({ where: { userId: toUserId(userId) } });
}

export async function insertUserRole(userId: number, roleName: string) {
  await prisma().baseUserRole.create({
    data: { userId: toUserId(userId), roleName },
  });
  await invalidateUserRolesCache(userId);
}

export async function deleteUserRole(userId: number, roleName: string) {
  await prisma().baseUserRole.deleteMany({
    where: { userId: toUserId(userId), roleName },
  });
  await invalidateUserRolesCache(userId);
}

export async function listRoleNameRows() {
  const rows = await prisma().baseRole.findMany({
    orderBy: { name: 'asc' },
    select: { name: true },
  });
  return rows;
}

export async function getAllowedRoles() {
  const rows = await listRoleNameRows();
  return new Set(rows.map((row) => normalizeRoleName(row.name)).filter(Boolean));
}

export async function resolveCanonicalRoleNames(roles: string[]) {
  const rows = await listRoleNameRows();
  const byNormalized = new Map<string, string>();
  for (const row of rows) {
    const key = normalizeRoleName(row.name);
    if (key) {
      byNormalized.set(key, row.name);
    }
  }

  const resolved: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const role of roles) {
    const key = normalizeRoleName(role);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const canonical = byNormalized.get(key);
    if (!canonical) {
      invalid.push(key);
      continue;
    }
    resolved.push(canonical);
  }

  return { resolved, invalid };
}

export async function getUserRolesForRequest(userId: number, fallbackRole?: string) {
  const cached = await getCachedUserRoles(userId);
  if (cached !== null) {
    return cached;
  }

  const rows = await listUserRoleRows(userId);
  const normalized = rows.map((row) => normalizeRoleName(row.role_name)).filter(Boolean);
  const roles = normalized.length > 0
    ? Array.from(new Set(normalized))
    : (() => {
      const fallback = normalizeRoleName(fallbackRole || '');
      return fallback ? [fallback] : [];
    })();

  await setCachedUserRoles(userId, roles);
  return roles;
}

export async function assignUserRoles(userId: number, roles: string[]) {
  const { resolved, invalid } = await resolveCanonicalRoleNames(roles);
  if (invalid.length > 0) {
    throw new HttpError(400, `Invalid roles: ${invalid.join(', ')}`);
  }
  await deleteUserRoles(userId);
  if (resolved.length === 0) {
    await invalidateUserRolesCache(userId);
    await setCachedUserRoles(userId, []);
    return;
  }

  for (const roleName of resolved) {
    await insertUserRole(userId, roleName);
  }

  const cachedRoles = Array.from(
    new Set(resolved.map((roleName) => normalizeRoleName(roleName)).filter(Boolean)),
  );
  await invalidateUserRolesCache(userId);
  await setCachedUserRoles(userId, cachedRoles);
}

export async function validateRoles(roles: string[]) {
  const { invalid } = await resolveCanonicalRoleNames(roles);
  const allowedRoles = await getAllowedRoles();
  return { invalid, allowedRoles };
}
