import type { Prisma } from '../../../generated/prisma/client';
import bcrypt from 'bcryptjs';
import { USER_ID_SEQUENCE_START } from '../../../core/db/database';
import {
  USERS_DEFAULT_PAGE_SIZE,
  USERS_MAX_PAGE_SIZE,
  type UsersListQuery,
} from '../../../shared/api/contracts/users/listQuery';
import { normalizeRoleName } from './roleUtils';
import { buildUserPersonTypeCodeFilter } from './userPersonTypeListFilter';
import { buildUserRoleNamesFilter } from './userRoleListFilter';
import {
  buildCaseInsensitiveContains,
  buildCaseInsensitiveEquals,
  fromUserId,
  loadUsernameMap,
  parseDateEnd,
  parseDateStart,
  prisma,
  readControlPlaneProvider,
  toUserId,
} from './prismaHelpers';
import { insertSqlServerUserWithIdentity } from '../../db/sqlServerIdentityUserInsert';
import {
  listWhereTreeToIr,
  parseListWhereTreeParam,
} from '../../../shared/ui/list-filter/listWhereFilter';
import { listWhereIrToPrisma } from '../../../shared/ui/list-filter/listWhereQuery';
import { DEFAULT_WHERE_OPERATORS } from '../../../shared/ui/where-builder/whereBuilderModel';
import {
  createUsersWhereFields,
  USERS_LIST_WHERE_COLUMNS,
} from '../../../shared/api/contracts/users/usersListWhere';

export type AuthUserRow = {
  id: number;
  email: string;
  username: string;
  role: string;
  roles: string[];
  locked: boolean;
  password_hash: string;
  is_builtin: boolean;
  email_verified_at: Date | null;
  mobile: string | null;
};

const mapAuthUserRow = (
  row: Prisma.BaseUserGetPayload<{ select: typeof authUserSelectWithRoles }>,
): AuthUserRow => {
  const roles = Array.from(new Set(
    row.userRoles
      .map((userRole) => normalizeRoleName(userRole.roleName))
      .filter(Boolean),
  ));
  const normalizedRoles = roles;
  const primaryRole = normalizedRoles[0] ?? '';
  return {
    id: fromUserId(row.id),
    email: row.email ?? '',
    username: row.username,
    role: primaryRole,
    roles: normalizedRoles,
    locked: Boolean(row.locked),
    password_hash: row.passwordHash,
    is_builtin: row.isBuiltin,
    email_verified_at: row.emailVerifiedAt,
    mobile: row.mobile,
  };
};

const authUserSelect = {
  id: true,
  email: true,
  username: true,
  locked: true,
  passwordHash: true,
  isBuiltin: true,
  emailVerifiedAt: true,
  mobile: true,
} as const;

const authUserSelectWithRoles = {
  ...authUserSelect,
  userRoles: {
    select: { roleName: true },
    orderBy: [{ createdAt: 'asc' }, { roleName: 'asc' }],
  },
} as const;

export const findAuthUserByEmail = async (email: string): Promise<AuthUserRow | undefined> => {
  const provider = readControlPlaneProvider();
  const row = await prisma().baseUser.findFirst({
    where: { email: buildCaseInsensitiveEquals(email, provider) },
    select: authUserSelectWithRoles,
  });
  if (!row) return undefined;
  return mapAuthUserRow(row);
};

export const findAuthUserByUsername = async (username: string): Promise<AuthUserRow | undefined> => {
  const provider = readControlPlaneProvider();
  const row = await prisma().baseUser.findFirst({
    where: { username: buildCaseInsensitiveEquals(username, provider) },
    select: authUserSelectWithRoles,
  });
  if (!row) return undefined;
  return mapAuthUserRow(row);
};

export const findAuthUserByMobile = async (mobile: string): Promise<AuthUserRow | undefined> => {
  const row = await prisma().baseUser.findFirst({
    where: { mobile },
    select: authUserSelectWithRoles,
  });
  if (!row) return undefined;
  return mapAuthUserRow(row);
};

export const findAuthUserRecordById = async (userId: number): Promise<AuthUserRow | undefined> => {
  const row = await prisma().baseUser.findUnique({
    where: { id: toUserId(userId) },
    select: authUserSelectWithRoles,
  });
  if (!row) return undefined;
  return mapAuthUserRow(row);
};

export const findAuthUserById = async (userId: number): Promise<Omit<AuthUserRow, 'password_hash' | 'is_builtin'> | undefined> => {
  const row = await prisma().baseUser.findUnique({
    where: { id: toUserId(userId) },
    select: authUserSelectWithRoles,
  });
  if (!row) return undefined;
  const mapped = mapAuthUserRow(row);
  const { password_hash: _password, is_builtin: _builtin, ...rest } = mapped;
  return rest;
};

const listProfileSelect = {
  firstname: true,
  lastname: true,
  fathername: true,
  grandfathername: true,
  nickname: true,
  nationalCode: true,
  birthYear: true,
  birthMonth: true,
  birthDay: true,
  genderCode: true,
  personTypeCode: true,
  companyName: true,
  registrationNumber: true,
  website: true,
  profileImageMime: true,
  profileImageSize: true,
  updatedAt: true,
} as const;

const mapListUserRow = (
  row: Prisma.BaseUserGetPayload<{
    include: {
      profile: { select: typeof listProfileSelect };
      userRoles: { select: { roleName: true } };
    };
  }>,
  usernameById: Map<number, string>,
) => {
  const roles = Array.from(new Set(
    row.userRoles
      .map((userRole) => normalizeRoleName(userRole.roleName))
      .filter(Boolean),
  ));
  return {
  id: fromUserId(row.id),
  username: row.username,
  email: row.email,
  locked: row.locked,
  locked_at: row.lockedAt,
  locked_by: row.lockedBy !== null ? fromUserId(row.lockedBy) : null,
  locked_by_username: row.lockedBy !== null ? usernameById.get(fromUserId(row.lockedBy)) ?? null : null,
  unlocked_at: row.unlockedAt,
  unlocked_by: row.unlockedBy !== null ? fromUserId(row.unlockedBy) : null,
  unlocked_by_username: row.unlockedBy !== null ? usernameById.get(fromUserId(row.unlockedBy)) ?? null : null,
  is_builtin: row.isBuiltin,
  created_at: row.createdAt,
  created_by: row.createdBy !== null ? fromUserId(row.createdBy) : null,
  created_by_username: row.createdBy !== null ? usernameById.get(fromUserId(row.createdBy)) ?? null : null,
  updated_at: row.updatedAt,
  updated_by: row.updatedBy !== null ? fromUserId(row.updatedBy) : null,
  updated_by_username: row.updatedBy !== null ? usernameById.get(fromUserId(row.updatedBy)) ?? null : null,
  firstname: row.profile?.firstname ?? null,
  lastname: row.profile?.lastname ?? null,
  fathername: row.profile?.fathername ?? null,
  grandfathername: row.profile?.grandfathername ?? null,
  nickname: row.profile?.nickname ?? null,
  national_code: row.profile?.nationalCode ?? null,
  birth_year: row.profile?.birthYear ?? null,
  birth_month: row.profile?.birthMonth ?? null,
  birth_day: row.profile?.birthDay ?? null,
  gender_code: row.profile?.genderCode ?? null,
  person_type_code: row.profile?.personTypeCode ?? null,
  company_name: row.profile?.companyName ?? null,
  registration_number: row.profile?.registrationNumber ?? null,
  website: row.profile?.website ?? null,
  profile_image_mime: row.profile?.profileImageMime ?? null,
  profile_image_size: row.profile?.profileImageSize ?? null,
  profile_updated_at: row.profile?.updatedAt?.toISOString() ?? null,
  has_profile_image: (row.profile?.profileImageSize ?? 0) > 0,
  has_profile_image_xs: Boolean(row.profile?.profileImageMime?.trim()),
  roles,
  role: roles[0] ?? '',
  };
};

const buildUsersWhere = (query: UsersListQuery): Prisma.BaseUserWhereInput => {
  const provider = readControlPlaneProvider();
  const and: Prisma.BaseUserWhereInput[] = [];

  if (query.email?.trim()) {
    const needle = query.email.trim();
    and.push({
      OR: [
        { email: buildCaseInsensitiveContains(needle, provider) },
        { username: buildCaseInsensitiveContains(needle, provider) },
      ],
    });
  }

  if (query.full_name?.trim()) {
    const needle = query.full_name.trim();
    and.push({
      profile: {
        OR: [
          { firstname: buildCaseInsensitiveContains(needle, provider) },
          { lastname: buildCaseInsensitiveContains(needle, provider) },
          { companyName: buildCaseInsensitiveContains(needle, provider) },
        ],
      },
    });
  }

  if (query.roles?.trim()) {
    and.push({
      userRoles: {
        some: { roleName: buildCaseInsensitiveContains(query.roles.trim(), provider) },
      },
    });
  }

  if (query.roleNames?.trim()) {
    const roleNames = query.roleNames
      .split(',')
      .map((role) => role.trim().toUpperCase())
      .filter(Boolean);
    const roleFilter = buildUserRoleNamesFilter(roleNames, query.roleMatch ?? 'or');
    if (roleFilter) {
      and.push(roleFilter);
    }
  }

  if (query.personTypeCode?.trim()) {
    const personTypeFilter = buildUserPersonTypeCodeFilter(query.personTypeCode);
    if (personTypeFilter) {
      and.push(personTypeFilter);
    }
  }

  if (query.search?.trim()) {
    const needle = query.search.trim();
    const searchOr: Prisma.BaseUserWhereInput[] = [
      { username: buildCaseInsensitiveContains(needle, provider) },
      { email: buildCaseInsensitiveContains(needle, provider) },
      {
        profile: {
          OR: [
            { firstname: buildCaseInsensitiveContains(needle, provider) },
            { lastname: buildCaseInsensitiveContains(needle, provider) },
            { fathername: buildCaseInsensitiveContains(needle, provider) },
            { grandfathername: buildCaseInsensitiveContains(needle, provider) },
            { nickname: buildCaseInsensitiveContains(needle, provider) },
            { nationalCode: buildCaseInsensitiveContains(needle, provider) },
            { companyName: buildCaseInsensitiveContains(needle, provider) },
            { registrationNumber: buildCaseInsensitiveContains(needle, provider) },
            { website: buildCaseInsensitiveContains(needle, provider) },
          ],
        },
      },
    ];
    if (/^\d+$/.test(needle)) {
      searchOr.push({ id: toUserId(Number(needle)) });
    }
    and.push({ OR: searchOr });
  }

  if (query.locked === 'true') {
    and.push({ locked: { not: 0 } });
  } else if (query.locked === 'false') {
    and.push({ locked: 0 });
  }

  if (query.createdFrom?.trim()) {
    and.push({ createdAt: { gte: parseDateStart(query.createdFrom) } });
  }
  if (query.createdTo?.trim()) {
    and.push({ createdAt: { lte: parseDateEnd(query.createdTo) } });
  }
  if (query.updatedFrom?.trim()) {
    and.push({ updatedAt: { gte: parseDateStart(query.updatedFrom) } });
  }
  if (query.updatedTo?.trim()) {
    and.push({ updatedAt: { lte: parseDateEnd(query.updatedTo) } });
  }

  if (query.where?.trim()) {
    const fields = createUsersWhereFields();
    const tree = parseListWhereTreeParam(query.where, fields, DEFAULT_WHERE_OPERATORS);
    const compiled = listWhereIrToPrisma(
      tree ? listWhereTreeToIr(tree, DEFAULT_WHERE_OPERATORS) : null,
      USERS_LIST_WHERE_COLUMNS,
      (value) => buildCaseInsensitiveContains(value, provider),
    );
    if (compiled) {
      and.push(compiled as Prisma.BaseUserWhereInput);
    }
  }

  return and.length > 0 ? { AND: and } : {};
};

const buildUsersOrderBy = (query: UsersListQuery): Prisma.BaseUserOrderByWithRelationInput[] => {
  const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
  switch (query.sortBy) {
    case 'email':
      return [{ email: sortDir }, { id: 'desc' }];
    case 'full_name':
      return [
        { profile: { companyName: sortDir } },
        { profile: { firstname: sortDir } },
        { profile: { lastname: sortDir } },
        { id: 'desc' },
      ];
    case 'updated_at':
      return [{ updatedAt: sortDir }, { id: 'desc' }];
    case 'created_at':
    default:
      return [{ createdAt: sortDir }, { id: 'desc' }];
  }
};

const fetchListUserRows = async (query: UsersListQuery = {}) => {
  const where = buildUsersWhere(query);
  const orderBy = buildUsersOrderBy(query);
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(USERS_MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? USERS_DEFAULT_PAGE_SIZE));
  const skip = (page - 1) * pageSize;

  const [rows, total] = await Promise.all([
    prisma().baseUser.findMany({
      where,
      orderBy,
      include: {
        profile: { select: listProfileSelect },
        userRoles: {
          select: { roleName: true },
          orderBy: [{ createdAt: 'asc' }, { roleName: 'asc' }],
        },
      },
      skip,
      take: pageSize,
    }),
    prisma().baseUser.count({ where }),
  ]);
  const usernameById = await loadUsernameMap(
    rows.flatMap((row) => [row.createdBy, row.updatedBy, row.lockedBy, row.unlockedBy]),
  );
  return {
    items: rows.map((row) => mapListUserRow(row, usernameById)),
    totalCount: total,
  };
};

export async function countAllUsers(): Promise<number> {
  return prisma().baseUser.count();
}

export async function listUsersRows() {
  const result = await fetchListUserRows();
  return result.items;
}

export async function listUsersFilteredRows(query: UsersListQuery = {}) {
  return fetchListUserRows(query);
}

const BOOTSTRAP_ADMIN_PLACEHOLDER_HASH = bcrypt.hashSync('__appendo_install_bootstrap_admin__', 10);

const ensureAdminRoleAssigned = async (userId: number): Promise<void> => {
  const actorId = toUserId(userId);
  await prisma().baseUserRole.upsert({
    where: { userId_roleName: { userId: actorId, roleName: 'ADMIN' } },
    update: {},
    create: { userId: actorId, roleName: 'ADMIN', createdBy: actorId },
  });
};

export async function assignBootstrapAdminRole(userId: number = USER_ID_SEQUENCE_START): Promise<void> {
  await ensureAdminRoleAssigned(userId);
}

type EnsureBootstrapAdminUserOptions = {
  /** When false, only ensure the stub user exists — roles must be seeded before assignment. */
  assignAdminRole?: boolean;
};

/** Ensures the builtin install admin stub (username `admin`, id {@link USER_ID_SEQUENCE_START}) exists for audit columns. */
export async function ensureBootstrapAdminUser(
  options: EnsureBootstrapAdminUserOptions = {},
): Promise<number> {
  const assignAdminRole = options.assignAdminRole ?? true;
  const adminId = USER_ID_SEQUENCE_START;

  const existingById = await prisma().baseUser.findUnique({
    where: { id: toUserId(adminId) },
    select: { id: true },
  });
  if (existingById) {
    if (assignAdminRole) {
      await ensureAdminRoleAssigned(adminId);
    }
    return adminId;
  }

  const existingByUsername = await prisma().baseUser.findUnique({
    where: { username: 'admin' },
    select: { id: true },
  });
  if (existingByUsername) {
    const resolvedId = fromUserId(existingByUsername.id);
    if (assignAdminRole) {
      await ensureAdminRoleAssigned(resolvedId);
    }
    return resolvedId;
  }

  if (readControlPlaneProvider() === 'sqlserver') {
    await insertSqlServerUserWithIdentity({
      id: adminId,
      username: 'admin',
      email: null,
      passwordHash: BOOTSTRAP_ADMIN_PLACEHOLDER_HASH,
    });
  } else {
    await prisma().baseUser.create({
      data: {
        id: toUserId(adminId),
        username: 'admin',
        email: null,
        passwordHash: BOOTSTRAP_ADMIN_PLACEHOLDER_HASH,
        isBuiltin: true,
        createdBy: toUserId(adminId),
        updatedBy: toUserId(adminId),
      },
    });
  }

  if (assignAdminRole) {
    await ensureAdminRoleAssigned(adminId);
  }
  return adminId;
}

export async function upsertInstallAdminUser(input: {
  username: string;
  email: string;
  passwordHash: string;
  existingAdminId?: number;
}): Promise<number> {
  if (input.existingAdminId) {
    const selfActorId = toUserId(input.existingAdminId);
    await prisma().baseUser.update({
      where: { id: selfActorId },
      data: {
        username: input.username,
        email: input.email,
        passwordHash: input.passwordHash,
        createdBy: selfActorId,
        updatedAt: new Date(),
        updatedBy: selfActorId,
      },
    });
    return input.existingAdminId;
  }

  const adminId = USER_ID_SEQUENCE_START;
  const selfActorId = toUserId(adminId);

  if (readControlPlaneProvider() === 'sqlserver') {
    const existing = await prisma().baseUser.findUnique({
      where: { id: selfActorId },
      select: { id: true },
    });
    if (!existing) {
      await insertSqlServerUserWithIdentity({
        id: adminId,
        username: input.username,
        email: input.email,
        passwordHash: input.passwordHash,
      });
    } else {
      await prisma().baseUser.update({
        where: { id: selfActorId },
        data: {
          username: input.username,
          email: input.email,
          passwordHash: input.passwordHash,
          createdBy: selfActorId,
          updatedAt: new Date(),
          updatedBy: selfActorId,
        },
      });
    }
  } else {
    await prisma().baseUser.upsert({
      where: { id: selfActorId },
      update: {
        username: input.username,
        email: input.email,
        passwordHash: input.passwordHash,
        createdBy: selfActorId,
        updatedAt: new Date(),
        updatedBy: selfActorId,
      },
      create: {
        id: selfActorId,
        username: input.username,
        email: input.email,
        passwordHash: input.passwordHash,
        isBuiltin: true,
        createdBy: selfActorId,
        updatedBy: selfActorId,
      },
    });
  }

  await prisma().baseUserRole.upsert({
    where: { userId_roleName: { userId: selfActorId, roleName: 'ADMIN' } },
    update: {},
    create: { userId: selfActorId, roleName: 'ADMIN', createdBy: selfActorId },
  });

  return adminId;
}

export async function insertUser(
  username: string,
  email: string | null,
  passwordHash: string,
  actorId: number | null,
) {
  await prisma().baseUser.create({
    data: {
      username,
      email,
      passwordHash,
      createdBy: actorId !== null ? toUserId(actorId) : null,
      updatedBy: actorId !== null ? toUserId(actorId) : null,
    },
  });
}

export async function findUserIdByUsername(username: string) {
  const row = await prisma().baseUser.findFirst({
    where: { username },
    orderBy: { id: 'desc' },
    select: { id: true },
  });
  return row ? { id: fromUserId(row.id) } : undefined;
}

export async function findUserIdEmailUsername(userId: number) {
  const row = await prisma().baseUser.findUnique({
    where: { id: toUserId(userId) },
    select: { id: true, email: true, username: true },
  });
  if (!row) return undefined;
  return { id: fromUserId(row.id), email: row.email, username: row.username };
}

export async function findUserIdEmail(userId: number) {
  const row = await prisma().baseUser.findUnique({
    where: { id: toUserId(userId) },
    select: { id: true, email: true },
  });
  if (!row) return undefined;
  return { id: fromUserId(row.id), email: row.email ?? '' };
}

/** Safe user snapshot for workflow Actions — no password hash or binary profile image. */
export async function findUserWorkflowSummary(userId: number) {
  const row = await prisma().baseUser.findUnique({
    where: { id: toUserId(userId) },
    select: {
      id: true,
      username: true,
      email: true,
      locked: true,
      isBuiltin: true,
      mobile: true,
      userRoles: { select: { roleName: true }, orderBy: [{ createdAt: 'asc' }, { roleName: 'asc' }] },
      profile: {
        select: {
          firstname: true,
          lastname: true,
          nickname: true,
          companyName: true,
          personTypeCode: true,
        },
      },
    },
  });
  if (!row) return undefined;

  const roles = row.userRoles
    .map((userRole) => normalizeRoleName(userRole.roleName))
    .filter(Boolean);
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
    mobile: row.mobile ?? null,
    locked: row.locked !== 0,
    isBuiltin: row.isBuiltin,
    roles,
    displayName,
    firstname: profile?.firstname ?? null,
    lastname: profile?.lastname ?? null,
    nickname: profile?.nickname ?? null,
    companyName: profile?.companyName ?? null,
    personTypeCode: profile?.personTypeCode ?? null,
  };
}

export async function findUserId(userId: number) {
  const row = await prisma().baseUser.findUnique({
    where: { id: toUserId(userId) },
    select: { id: true },
  });
  return row ? { id: fromUserId(row.id) } : undefined;
}

export async function findUserIdBuiltin(userId: number) {
  const row = await prisma().baseUser.findUnique({
    where: { id: toUserId(userId) },
    select: { id: true, isBuiltin: true },
  });
  if (!row) return undefined;
  return { id: fromUserId(row.id), is_builtin: row.isBuiltin ? 1 : 0 };
}

export async function findUserPasswordHash(userId: number) {
  const row = await prisma().baseUser.findUnique({
    where: { id: toUserId(userId) },
    select: { id: true, passwordHash: true },
  });
  if (!row) return undefined;
  return { id: fromUserId(row.id), password_hash: row.passwordHash };
}

export async function updateUserEmail(email: string | null, actorId: number | null, userId: number) {
  await prisma().baseUser.update({
    where: { id: toUserId(userId) },
    data: {
      email,
      updatedBy: actorId !== null ? toUserId(actorId) : null,
      updatedAt: new Date(),
    },
  });
}

export async function updateUserPasswordHash(passwordHash: string, userId: number) {
  await prisma().baseUser.update({
    where: { id: toUserId(userId) },
    data: { passwordHash },
  });
}

export async function updateUserUpdatedBy(actorId: number | null, userId: number) {
  await prisma().baseUser.update({
    where: { id: toUserId(userId) },
    data: {
      updatedBy: actorId !== null ? toUserId(actorId) : null,
      updatedAt: new Date(),
    },
  });
}

export async function updateUserEmailVerifiedAt(userId: number) {
  const now = new Date();
  await prisma().baseUser.update({
    where: { id: toUserId(userId) },
    data: { emailVerifiedAt: now, updatedAt: now },
  });
}

export async function updateUserLastLoginAt(userId: number) {
  await prisma().baseUser.update({
    where: { id: toUserId(userId) },
    data: { lastLoginAt: new Date() },
  });
}

export async function deleteUserProfile(userId: number) {
  await prisma().baseUserProfile.deleteMany({ where: { userId: toUserId(userId) } });
}

export async function deleteUser(userId: number) {
  await prisma().baseUser.delete({ where: { id: toUserId(userId) } });
}

export async function lockUser(actorId: number | null, userId: number) {
  const now = new Date();
  await prisma().baseUser.update({
    where: { id: toUserId(userId) },
    data: {
      locked: 1,
      lockedAt: now,
      lockedBy: actorId !== null ? toUserId(actorId) : null,
      unlockedAt: null,
      unlockedBy: null,
    },
  });
}

export async function unlockUser(actorId: number | null, userId: number) {
  const now = new Date();
  await prisma().baseUser.update({
    where: { id: toUserId(userId) },
    data: {
      locked: 0,
      lockedAt: null,
      lockedBy: null,
      unlockedAt: now,
      unlockedBy: actorId !== null ? toUserId(actorId) : null,
      loginFailCount: 0,
      loginFailLastAt: null,
    },
  });
}

export async function setUserLocked(locked: boolean, actorId: number | null, userId: number) {
  const now = new Date();
  const actor = actorId !== null ? toUserId(actorId) : null;
  await prisma().baseUser.update({
    where: { id: toUserId(userId) },
    data: locked
      ? {
          locked: 1,
          lockedAt: now,
          lockedBy: actor,
          unlockedAt: null,
          unlockedBy: null,
          loginFailCount: 0,
          loginFailLastAt: null,
        }
      : {
          locked: 0,
          lockedAt: null,
          lockedBy: null,
          unlockedAt: now,
          unlockedBy: actor,
        },
  });
}

export async function incrementLoginFailCount(userId: number, maxAttempts: number) {
  const row = await prisma().baseUser.findUnique({
    where: { id: toUserId(userId) },
    select: { loginFailCount: true },
  });
  if (!row) return;

  const nextCount = row.loginFailCount + 1;
  const shouldLock = nextCount >= maxAttempts;
  const now = new Date();

  await prisma().baseUser.update({
    where: { id: toUserId(userId) },
    data: {
      loginFailCount: nextCount,
      loginFailLastAt: now,
      ...(shouldLock
        ? {
            locked: 1,
            lockedAt: now,
            lockedBy: toUserId(userId),
            unlockedAt: null,
            unlockedBy: null,
          }
        : {}),
    },
  });
}

export async function clearLoginFailCount(userId: number) {
  await prisma().baseUser.update({
    where: { id: toUserId(userId) },
    data: { loginFailCount: 0, loginFailLastAt: null },
  });
}

export async function revokeUserRefreshTokens(userId: number) {
  await prisma().baseAuthRefreshToken.updateMany({
    where: { userId: toUserId(userId), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
