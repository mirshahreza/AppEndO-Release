import bcrypt from 'bcryptjs';
import {
  buildSeedUsers,
  ROLE_ID_SEQUENCE_START,
  USER_ID_SEQUENCE_START,
  seedElevatedRolesToRemove,
} from '../../core/db/database';
import { loadSeedPicture } from '../../core/db/seedUserPictures';
import { env } from '../config/env';
import type { ControlPlaneDbProvider } from './controlPlaneDatabase';
import { renameBaseInfoSubtree } from '../domain/base-info/treeRepository';
import { fromUserId, prisma, readControlPlaneProvider, toUserId } from '../domain/users/prismaHelpers';
import { assignBootstrapAdminRole, ensureBootstrapAdminUser } from '../domain/users/userRepository';
import { insertSqlServerUserWithIdentity } from './sqlServerIdentityUserInsert';
import { seedRoleMcpGrantsPrisma } from '../services/ai/mcpAccessSeed';
import { seedOrgGeoBaseInfo } from './seedOrgGeoBaseInfo';
import { seedSampleMockCatalog } from './seedSampleMock';
import { RECORD_CHANGE_REASON_SEED_ROWS } from '../../shared/api/contracts/record-events';

type ActorRef = bigint | null;

const toActor = (actorId: number | null): ActorRef =>
  actorId !== null ? toUserId(actorId) : null;

const BUILTIN_ROLES = [
  { id: ROLE_ID_SEQUENCE_START, name: 'ADMIN', note: 'System administrator' },
  { id: ROLE_ID_SEQUENCE_START + 1, name: 'DEVELOPER', note: 'Developer access to platform APIs' },
] as const;

const BASE_INFO_LOOKUP_ROWS: Array<{
  id: string;
  parentId: string | null;
  title: string;
  shortName?: string | null;
  viewOrder: number;
  value: number;
  uiHtml?: string | null;
  uiColor?: string | null;
  metadata?: string | null;
}> = [
  { id: '100', parentId: null, title: 'Base', viewOrder: 100, value: 1 },
  { id: '100.1', parentId: '100', title: 'Gender', viewOrder: 1, value: 1 },
  { id: '100.1.1', parentId: '100.1', title: 'Male', viewOrder: 1, value: 1, uiHtml: '<i data-lucide="Mars"></i>' },
  { id: '100.1.2', parentId: '100.1', title: 'Female', viewOrder: 2, value: 2, uiHtml: '<i data-lucide="Venus"></i>' },
  { id: '100.2', parentId: '100', title: 'Person Type', viewOrder: 2, value: 2 },
  { id: '100.2.1', parentId: '100.2', title: 'Individual', viewOrder: 1, value: 1, uiHtml: '<i data-lucide="User"></i>' },
  { id: '100.2.2', parentId: '100.2', title: 'Company', viewOrder: 2, value: 2, uiHtml: '<i data-lucide="Building2"></i>' },
  { id: '100.3', parentId: '100', title: 'Feedback Subject', viewOrder: 3, value: 3 },
  { id: '100.3.1', parentId: '100.3', title: 'Bug report', shortName: 'BUG', viewOrder: 1, value: 1 },
  { id: '100.3.2', parentId: '100.3', title: 'Suggestion', shortName: 'SUGGESTION', viewOrder: 2, value: 2 },
  { id: '100.3.3', parentId: '100.3', title: 'Question', shortName: 'QUESTION', viewOrder: 3, value: 3 },
  { id: '100.3.4', parentId: '100.3', title: 'Praise', shortName: 'PRAISE', viewOrder: 4, value: 4 },
  { id: '100.7', parentId: '100', title: 'Inbox preset titles', viewOrder: 7, value: 7 },
  { id: '100.8', parentId: '100', title: 'Inbox tags', viewOrder: 8, value: 8 },
  {
    id: '100.8.1',
    parentId: '100.8',
    title: 'Finance',
    viewOrder: 1,
    value: 1,
    uiColor: '#059669',
  },
  {
    id: '100.8.2',
    parentId: '100.8',
    title: 'Urgent',
    viewOrder: 2,
    value: 2,
    uiColor: '#e11d48',
  },
  {
    id: '100.8.3',
    parentId: '100.8',
    title: 'Follow-up',
    viewOrder: 3,
    value: 3,
    uiColor: '#2563eb',
  },
  {
    id: '100.7.1',
    parentId: '100.7',
    title: 'Acknowledgment',
    viewOrder: 1,
    value: 1,
    metadata: JSON.stringify({
      inbox: {
        defaultBody: 'Thanks — we received your message and will follow up shortly.',
        tagIds: ['100.8.3'],
      },
    }),
  },
  {
    id: '100.7.2',
    parentId: '100.7',
    title: 'Need more information',
    viewOrder: 2,
    value: 2,
    metadata: JSON.stringify({
      inbox: {
        defaultBody: 'Could you share a screenshot or the exact steps so we can reproduce this?',
        tagIds: ['100.8.2', '100.8.3'],
      },
    }),
  },
  {
    id: '100.7.3',
    parentId: '100.7',
    title: 'Forwarded for review',
    viewOrder: 3,
    value: 3,
    metadata: JSON.stringify({
      inbox: {
        defaultBody: 'Forwarding this thread for a second opinion — please see the note below.',
        tagIds: ['100.8.1'],
      },
    }),
  },
  ...RECORD_CHANGE_REASON_SEED_ROWS.map((row) => ({
    id: row.id,
    parentId: row.parentId,
    title: row.title,
    viewOrder: row.viewOrder,
    value: row.value,
  })),
];

type SettingsAttributeSeed = {
  scope: string;
  key: string;
  label: string;
  sourceType: string;
  baseInfoRootId?: string | null;
  dataType: string;
  cardinality: string;
  minSelections?: number | null;
  maxSelections?: number | null;
  visibility: string;
  isRequired?: boolean;
  isActive?: boolean;
  userEditable?: boolean;
  userEditPolicy?: string;
  isBuiltin?: boolean;
  viewOrder: number;
};

/** Platform builtins only — demo USER/ROLE attributes are not seeded. */
const SETTINGS_ATTRIBUTE_SEED: SettingsAttributeSeed[] = [
  {
    scope: 'USER', key: 'accent_theme', label: 'Accent Theme',
    sourceType: 'CUSTOM', dataType: 'json', cardinality: 'single', visibility: 'CLIENT', isBuiltin: true,
    userEditable: true, userEditPolicy: 'ALWAYS', viewOrder: 0,
  },
  {
    scope: 'USER', key: 'theme_presets', label: 'Theme Presets',
    sourceType: 'CUSTOM', dataType: 'json', cardinality: 'single', visibility: 'CLIENT', isBuiltin: true,
    userEditable: false, userEditPolicy: 'NONE', viewOrder: 0,
  },
  {
    scope: 'USER', key: 'shell_experience', label: 'Shell Experience',
    sourceType: 'CUSTOM', dataType: 'json', cardinality: 'single', visibility: 'CLIENT', isBuiltin: true,
    userEditable: true, userEditPolicy: 'ALWAYS', viewOrder: 0,
  },
  {
    scope: 'USER', key: 'grid_column_layouts', label: 'Grid Column Layouts',
    sourceType: 'CUSTOM', dataType: 'json', cardinality: 'single', visibility: 'CLIENT', isBuiltin: true,
    userEditable: false, userEditPolicy: 'NONE', viewOrder: 0,
  },
  {
    scope: 'USER', key: 'dashboard_layout', label: 'Dashboard Layout',
    sourceType: 'CUSTOM', dataType: 'json', cardinality: 'single', visibility: 'CLIENT', isBuiltin: true,
    userEditable: false, userEditPolicy: 'NONE', viewOrder: 0,
  },
];

/** Former seed demos — removed on bootstrap; does not delete operator-created attributes. */
const DEPRECATED_DEMO_SETTINGS_ATTRIBUTE_KEYS = [
  'home_city',
  'allowed_cities',
  'employee_code',
  'marketing_opt_in',
  'interest_tags',
  'max_concurrent_sessions',
  'feature_flags',
  'default_person_type',
  'legacy_quota',
] as const;
const DEPRECATED_BASE_INFO_ROOT_PREFIXES = ['103', '104'] as const;

const escapeSqlServerLiteral = (value: string): string => value.replace(/'/g, "''");

const seedBuiltinRolesSqlServer = async (actor: ActorRef): Promise<void> => {
  const actorSql = actor === null ? 'NULL' : actor.toString();
  const sourceRows = BUILTIN_ROLES.map(
    (role) => `(${role.id}, N'${escapeSqlServerLiteral(role.name)}', N'${escapeSqlServerLiteral(role.note)}', ${actorSql}, ${actorSql})`,
  ).join(',\n');

  await prisma().$executeRawUnsafe(`
SET IDENTITY_INSERT [base_roles] ON;
MERGE [base_roles] AS target
USING (VALUES
${sourceRows}
) AS source ([id], [name], [note], [created_by], [updated_by])
ON target.[name] = source.[name]
WHEN MATCHED THEN
  UPDATE SET [note] = source.[note], [updated_by] = source.[updated_by]
WHEN NOT MATCHED THEN
  INSERT ([id], [name], [note], [created_by], [updated_by])
  VALUES (source.[id], source.[name], source.[note], source.[created_by], source.[updated_by]);
SET IDENTITY_INSERT [base_roles] OFF;
`);
};

async function seedBuiltinRoles(actorId: number | null): Promise<void> {
  const actor = toActor(actorId);
  if (readControlPlaneProvider() === 'sqlserver') {
    await seedBuiltinRolesSqlServer(actor);
    return;
  }

  for (const role of BUILTIN_ROLES) {
    await prisma().baseRole.upsert({
      where: { name: role.name },
      update: { note: role.note, updatedBy: actor },
      create: {
        id: BigInt(role.id),
        name: role.name,
        note: role.note,
        createdBy: actor,
        updatedBy: actor,
      },
    });
  }
}

const LEGACY_GENDER_ROOT_ID = '100';
const LEGACY_PERSON_TYPE_ROOT_ID = '102';
const TEMP_GENDER_ROOT_ID = '__mig_gender';
const TEMP_PERSON_TYPE_ROOT_ID = '__mig_person_type';

/**
 * One-time reshape for existing DBs that still have Gender/Person Type as top-level roots.
 * Target: Base (100) → Gender (100.1) / Person Type (100.2).
 */
async function migrateLegacyGenderAndPersonTypeUnderBase(actorId: number | null): Promise<void> {
  const node100 = await prisma().baseInfo.findUnique({
    where: { id: LEGACY_GENDER_ROOT_ID },
    select: { id: true, parentId: true, title: true },
  });
  if (!node100 || node100.parentId !== null) return;

  const label = String(node100.title || '').trim().toLowerCase();
  if (label === 'base') return;
  if (label !== 'gender') return;

  const personTypeRoot = await prisma().baseInfo.findUnique({
    where: { id: LEGACY_PERSON_TYPE_ROOT_ID },
    select: { id: true, parentId: true },
  });

  await renameBaseInfoSubtree([LEGACY_GENDER_ROOT_ID, TEMP_GENDER_ROOT_ID, null, LEGACY_GENDER_ROOT_ID, actorId]);
  if (personTypeRoot && personTypeRoot.parentId === null) {
    await renameBaseInfoSubtree([
      LEGACY_PERSON_TYPE_ROOT_ID,
      TEMP_PERSON_TYPE_ROOT_ID,
      null,
      LEGACY_PERSON_TYPE_ROOT_ID,
      actorId,
    ]);
  }

  const actor = toActor(actorId);
  await prisma().baseInfo.create({
    data: {
      id: '100',
      parentId: null,
      title: 'Base',
      viewOrder: 100,
      value: 1,
      isActive: true,
      createdBy: actor,
      updatedBy: actor,
    },
  });

  await renameBaseInfoSubtree([TEMP_GENDER_ROOT_ID, '100.1', '100', TEMP_GENDER_ROOT_ID, actorId]);
  if (personTypeRoot && personTypeRoot.parentId === null) {
    await renameBaseInfoSubtree([TEMP_PERSON_TYPE_ROOT_ID, '100.2', '100', TEMP_PERSON_TYPE_ROOT_ID, actorId]);
  }
}

async function removeDeprecatedCitiesAndContactTopics(): Promise<void> {
  await prisma().baseContactMessage.deleteMany({
    where: {
      OR: [
        { topicCode: '103' },
        { topicCode: { startsWith: '103.' } },
        { topicCode: '104' },
        { topicCode: { startsWith: '104.' } },
      ],
    },
  });

  const deprecatedAttributes = await prisma().baseSettingsAttribute.findMany({
    where: {
      OR: [
        { key: { in: [...DEPRECATED_DEMO_SETTINGS_ATTRIBUTE_KEYS] } },
        { baseInfoRootId: '103' },
        { baseInfoRootId: { startsWith: '103.' } },
        { baseInfoRootId: '104' },
        { baseInfoRootId: { startsWith: '104.' } },
      ],
    },
    select: { id: true },
  });
  const definitionIds = deprecatedAttributes.map((row) => row.id);
  if (definitionIds.length > 0) {
    await prisma().baseUserAttribute.deleteMany({
      where: { definitionId: { in: definitionIds } },
    });
    await prisma().baseRoleAttribute.deleteMany({
      where: { definitionId: { in: definitionIds } },
    });
    await prisma().baseSettingsAttribute.deleteMany({
      where: { id: { in: definitionIds } },
    });
  }

  const deprecatedNodes = await prisma().baseInfo.findMany({
    where: {
      OR: DEPRECATED_BASE_INFO_ROOT_PREFIXES.flatMap((rootId) => ([
        { id: rootId },
        { id: { startsWith: `${rootId}.` } },
      ])),
    },
    select: { id: true },
  });
  const deepestFirst = [...deprecatedNodes].sort((a, b) => b.id.length - a.id.length);
  for (const node of deepestFirst) {
    await prisma().baseInfo.delete({ where: { id: node.id } });
  }
}

async function seedBaseInfoLookups(actorId: number | null): Promise<void> {
  const actor = toActor(actorId);
  await migrateLegacyGenderAndPersonTypeUnderBase(actorId);
  await removeDeprecatedCitiesAndContactTopics();

  for (const row of BASE_INFO_LOOKUP_ROWS) {
    await prisma().baseInfo.upsert({
      where: { id: row.id },
      update: {
        parentId: row.parentId,
        title: row.title,
        shortName: row.shortName ?? null,
        viewOrder: row.viewOrder,
        value: row.value,
        isActive: true,
        uiHtml: row.uiHtml ?? null,
        uiColor: row.uiColor ?? null,
        metadata: row.metadata ?? null,
        updatedBy: actor,
      },
      create: {
        id: row.id,
        parentId: row.parentId,
        title: row.title,
        shortName: row.shortName ?? null,
        viewOrder: row.viewOrder,
        value: row.value,
        isActive: true,
        uiHtml: row.uiHtml ?? null,
        uiColor: row.uiColor ?? null,
        metadata: row.metadata ?? null,
        createdBy: actor,
        updatedBy: actor,
      },
    });
  }

}

async function seedSettingsAttributes(actorId: number | null): Promise<void> {
  const actor = toActor(actorId);
  for (const row of SETTINGS_ATTRIBUTE_SEED) {
    await prisma().baseSettingsAttribute.upsert({
      where: { scope_key: { scope: row.scope, key: row.key } },
      update: {
        label: row.label,
        sourceType: row.sourceType,
        baseInfoRootId: row.baseInfoRootId ?? null,
        dataType: row.dataType,
        cardinality: row.cardinality,
        minSelections: row.minSelections ?? null,
        maxSelections: row.maxSelections ?? null,
        visibility: row.visibility,
        isRequired: row.isRequired ?? false,
        isActive: row.isActive ?? true,
        userEditable: row.userEditable ?? false,
        userEditPolicy: row.userEditPolicy ?? 'WHEN_EMPTY',
        isBuiltin: row.isBuiltin ?? false,
        viewOrder: row.viewOrder,
        updatedBy: actor,
      },
      create: {
        key: row.key,
        label: row.label,
        scope: row.scope,
        sourceType: row.sourceType,
        baseInfoRootId: row.baseInfoRootId ?? null,
        dataType: row.dataType,
        cardinality: row.cardinality,
        minSelections: row.minSelections ?? null,
        maxSelections: row.maxSelections ?? null,
        visibility: row.visibility,
        isRequired: row.isRequired ?? false,
        isActive: row.isActive ?? true,
        userEditable: row.userEditable ?? false,
        userEditPolicy: row.userEditPolicy ?? 'WHEN_EMPTY',
        isBuiltin: row.isBuiltin ?? false,
        viewOrder: row.viewOrder,
        createdBy: actor,
        updatedBy: actor,
      },
    });
  }
}

async function syncSeedUserRolesPrisma(userId: number, expectedRole: string | null): Promise<void> {
  if (expectedRole) {
    await prisma().baseUserRole.upsert({
      where: { userId_roleName: { userId: toUserId(userId), roleName: expectedRole } },
      update: {},
      create: { userId: toUserId(userId), roleName: expectedRole },
    });
  }
  const toRemove = seedElevatedRolesToRemove(expectedRole);
  if (toRemove.length > 0) {
    await prisma().baseUserRole.deleteMany({
      where: { userId: toUserId(userId), roleName: { in: [...toRemove] } },
    });
  }
}

async function seedSampleUsers(): Promise<number | null> {
  if (env.isProduction) {
    return null;
  }

  const adminHash = bcrypt.hashSync('admin123', 10);
  const userHash = bcrypt.hashSync('user12345', 10);
  const seedUsers = buildSeedUsers(adminHash, userHash);
  const pictureCache = new Map<string, ReturnType<typeof loadSeedPicture>>();

  const resolveSeedPicture = (relativePath: string) => {
    if (!pictureCache.has(relativePath)) {
      pictureCache.set(relativePath, loadSeedPicture(relativePath));
    }
    return pictureCache.get(relativePath)!;
  };

  let adminActorId: number | null = null;

  for (const seed of seedUsers) {
    const picture = resolveSeedPicture(seed.profileImagePath);
    let userId: number;

    if (seed.isBuiltin) {
      let userIdFromSeed: number;
      if (readControlPlaneProvider() === 'sqlserver') {
        const existing = await prisma().baseUser.findUnique({
          where: { username: seed.username },
          select: { id: true },
        });
        if (existing) {
          userIdFromSeed = fromUserId(existing.id);
        } else {
          await insertSqlServerUserWithIdentity({
            id: seed.id,
            username: seed.username,
            email: seed.email,
            passwordHash: seed.passwordHash,
            isBuiltin: true,
            mobile: seed.mobile ?? null,
            emailVerifiedAt: seed.emailVerifiedAt ? new Date(seed.emailVerifiedAt) : null,
            mobileVerifiedAt: seed.mobileVerifiedAt ? new Date(seed.mobileVerifiedAt) : null,
            lastLoginAt: seed.lastLoginAt ? new Date(seed.lastLoginAt) : null,
          });
          userIdFromSeed = seed.id;
        }
      } else {
        const row = await prisma().baseUser.upsert({
          where: { username: seed.username },
          // Upgrade the install bootstrap admin stub (empty email + placeholder
          // hash) to the real seeded builtin credentials on greenfield seed.
          update: {
            email: seed.email,
            passwordHash: seed.passwordHash,
            isBuiltin: true,
          },
          create: {
            id: toUserId(seed.id),
            username: seed.username,
            email: seed.email,
            passwordHash: seed.passwordHash,
            isBuiltin: true,
            mobile: seed.mobile,
            emailVerifiedAt: seed.emailVerifiedAt ? new Date(seed.emailVerifiedAt) : null,
            mobileVerifiedAt: seed.mobileVerifiedAt ? new Date(seed.mobileVerifiedAt) : null,
            lastLoginAt: seed.lastLoginAt ? new Date(seed.lastLoginAt) : null,
          },
          select: { id: true },
        });
        userIdFromSeed = fromUserId(row.id);
      }
      userId = userIdFromSeed;
    } else {
      const existing = await prisma().baseUser.findUnique({
        where: { username: seed.username },
        select: { id: true },
      });
      if (existing) {
        userId = fromUserId(existing.id);
      } else {
        const row = await prisma().baseUser.create({
          data: {
            // Insert with the deterministic seed id (the bootstrap admin already
            // holds USER_ID_SEQUENCE_START via an explicit insert that does not
            // advance the Postgres sequence, so relying on the sequence here
            // collides on a fresh greenfield database).
            id: toUserId(seed.id),
            username: seed.username,
            email: seed.email,
            passwordHash: seed.passwordHash,
            isBuiltin: seed.isBuiltin,
            mobile: seed.mobile,
            emailVerifiedAt: seed.emailVerifiedAt ? new Date(seed.emailVerifiedAt) : null,
            mobileVerifiedAt: seed.mobileVerifiedAt ? new Date(seed.mobileVerifiedAt) : null,
            lastLoginAt: seed.lastLoginAt ? new Date(seed.lastLoginAt) : null,
          },
          select: { id: true },
        });
        userId = fromUserId(row.id);
      }
    }

    if (seed.username === 'admin') {
      adminActorId = userId;
    }

    await syncSeedUserRolesPrisma(userId, seed.role);

    await prisma().baseUserProfile.upsert({
      where: { userId: toUserId(userId) },
      update: {},
      create: {
        userId: toUserId(userId),
        firstname: seed.firstname,
        lastname: seed.lastname,
        fathername: seed.fathername,
        grandfathername: seed.grandfathername,
        genderCode: seed.genderCode,
        nickname: seed.nickname,
        nationalCode: seed.nationalCode,
        birthYear: seed.birthYear,
        birthMonth: seed.birthMonth,
        birthDay: seed.birthDay,
        personTypeCode: seed.personTypeCode,
        phone: seed.phone,
        profileImageBody: picture.body,
        profileImageBodyXs: picture.bodyXs,
        profileImageMime: picture.mime,
        profileImageSize: picture.size,
      },
    });
  }

  return adminActorId;
}

/** Seed/install may only bump identity on these control-plane tables (SEC-1-3). */
const CONTROL_PLANE_SEQUENCE_TABLES = new Set(['base_roles', 'base_users']);
const CONTROL_PLANE_SEQUENCE_COLUMNS = new Set(['id']);
const SQL_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SQL_QUALIFIED_IDENT = /^[A-Za-z_][A-Za-z0-9_.]*$/;

/** Rejects interpolated identifiers that are not the known `base_roles` / `base_users` id columns. */
export const assertControlPlaneSequenceTarget = (tableName: string, columnName: string): void => {
  if (!CONTROL_PLANE_SEQUENCE_TABLES.has(tableName) || !SQL_IDENT.test(tableName)) {
    throw new Error('Refusing to configure auto-increment for an unlisted table.');
  }
  if (!CONTROL_PLANE_SEQUENCE_COLUMNS.has(columnName) || !SQL_IDENT.test(columnName)) {
    throw new Error('Refusing to configure auto-increment for an unlisted column.');
  }
};

const readMaxId = async (tableName: string, columnName: string): Promise<number> => {
  assertControlPlaneSequenceTarget(tableName, columnName);
  const rows = await prisma().$queryRawUnsafe<Array<{ max_id: bigint | number | null }>>(
    `SELECT COALESCE(MAX(${columnName}), 0) AS max_id FROM ${tableName}`,
  );
  return Number(rows[0]?.max_id ?? 0);
};

export async function configureControlPlaneAutoIncrement(
  tableName: string,
  columnName: string,
  minStart: number,
  provider: ControlPlaneDbProvider = readControlPlaneProvider(),
): Promise<void> {
  assertControlPlaneSequenceTarget(tableName, columnName);
  const nextId = Math.max((await readMaxId(tableName, columnName)) + 1, minStart);
  if (!Number.isInteger(minStart) || minStart < 0 || !Number.isInteger(nextId) || nextId < 1) {
    throw new Error('Invalid auto-increment sequence bounds.');
  }

  switch (provider) {
    case 'postgresql': {
      const seqRows = await prisma().$queryRawUnsafe<Array<{ seq: string | null }>>(
        `SELECT pg_get_serial_sequence('${tableName}', '${columnName}') AS seq`,
      );
      const sequenceName = seqRows[0]?.seq;
      if (!sequenceName) return;
      if (!SQL_QUALIFIED_IDENT.test(sequenceName)) {
        throw new Error('Refusing to alter an unexpected PostgreSQL sequence name.');
      }
      await prisma().$executeRawUnsafe(
        `ALTER SEQUENCE ${sequenceName} MINVALUE ${minStart} START WITH ${nextId} RESTART WITH ${nextId}`,
      );
      return;
    }
    case 'mysql':
      await prisma().$executeRawUnsafe(`ALTER TABLE ${tableName} AUTO_INCREMENT = ${nextId}`);
      return;
    case 'sqlite': {
      try {
        const existing = await prisma().$queryRawUnsafe<Array<{ seq: number }>>(
          `SELECT seq FROM sqlite_sequence WHERE name = '${tableName}'`,
        );
        if (existing.length > 0) {
          await prisma().$executeRawUnsafe(
            `UPDATE sqlite_sequence SET seq = ${nextId - 1} WHERE name = '${tableName}'`,
          );
        } else {
          await prisma().$executeRawUnsafe(
            `INSERT INTO sqlite_sequence (name, seq) VALUES ('${tableName}', ${nextId - 1})`,
          );
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        // INTEGER PRIMARY KEY without AUTOINCREMENT has no sqlite_sequence until first insert.
        if (!/no such table:\s*sqlite_sequence/i.test(message)) {
          throw error;
        }
      }
      return;
    }
    case 'sqlserver':
      await prisma().$executeRawUnsafe(`DBCC CHECKIDENT ('${tableName}', RESEED, ${nextId - 1})`);
      return;
    default: {
      const exhaustive: never = provider;
      throw new Error(`Unsupported provider for auto-increment: ${exhaustive}`);
    }
  }
}

/** PostgreSQL-only view used by base-contact-messages-v edge route. */
async function ensureContactMessagesView(provider: ControlPlaneDbProvider): Promise<void> {
  if (provider !== 'postgresql') return;

  await prisma().$executeRawUnsafe(`
    CREATE OR REPLACE VIEW base_contact_messages_v AS
    SELECT
      m.id,
      m.topic_code,
      COALESCE(bi.title_fa, bi.title_en, bi.title, m.topic_code) AS topic_label,
      m.title,
      m.note,
      m.created_at,
      m.created_by,
      u.username AS created_by_username
    FROM base_contact_messages m
    LEFT JOIN base_info bi ON bi.id = m.topic_code
    LEFT JOIN base_users u ON u.id = m.created_by
  `);
}

async function cleanupStaleControlPlaneData(): Promise<void> {
  const nowMs = Date.now();
  await prisma().baseAuthRefreshToken.deleteMany({
    where: { expiresAt: { lte: BigInt(nowMs) } },
  });

  const auditKeep = await prisma().baseAuthAuditLog.findMany({
    orderBy: { id: 'desc' },
    take: 10_000,
    select: { id: true },
  });
  if (auditKeep.length === 10_000) {
    const minKeepId = auditKeep[auditKeep.length - 1]!.id;
    await prisma().baseAuthAuditLog.deleteMany({ where: { id: { lt: minKeepId } } });
  }

  const logKeep = await prisma().baseAppLog.findMany({
    orderBy: { id: 'desc' },
    take: 50_000,
    select: { id: true },
  });
  if (logKeep.length === 50_000) {
    const minKeepId = logKeep[logKeep.length - 1]!.id;
    await prisma().baseAppLog.deleteMany({ where: { id: { lt: minKeepId } } });
  }
}

export type ControlPlaneSeedOptions = {
  seedSampleData?: boolean;
};

export async function backfillBootstrapAdminAuditFields(adminId: number): Promise<void> {
  const actor = toUserId(adminId);

  await prisma().baseRole.updateMany({
    where: { createdBy: null },
    data: { createdBy: actor, updatedBy: actor },
  });
  await prisma().baseInfo.updateMany({
    where: { createdBy: null },
    data: { createdBy: actor, updatedBy: actor },
  });
  await prisma().baseSettingsAttribute.updateMany({
    where: { createdBy: null },
    data: { createdBy: actor, updatedBy: actor },
  });
  await prisma().baseRoleMcpGrant.updateMany({
    where: { createdBy: null },
    data: { createdBy: actor, updatedBy: actor },
  });
  await prisma().baseContactMessage.updateMany({
    where: { createdBy: null },
    data: { createdBy: actor, updatedBy: actor },
  });
  await prisma().baseSettingsSection.updateMany({
    where: { createdBy: null },
    data: { createdBy: actor, updatedBy: actor },
  });
}

export async function seedControlPlaneReferenceData(
  options: ControlPlaneSeedOptions = {},
): Promise<void> {
  const provider = readControlPlaneProvider();
  await configureControlPlaneAutoIncrement('base_roles', 'id', ROLE_ID_SEQUENCE_START, provider);
  await configureControlPlaneAutoIncrement('base_users', 'id', USER_ID_SEQUENCE_START, provider);

  const adminActorId = await ensureBootstrapAdminUser({ assignAdminRole: false });

  await seedBuiltinRoles(adminActorId);
  await assignBootstrapAdminRole(adminActorId);
  await seedBaseInfoLookups(adminActorId);
  await seedOrgGeoBaseInfo(adminActorId);
  await seedSettingsAttributes(adminActorId);
  // Ensure deprecated Cities / Contact Topics never remain after attribute upserts.
  await removeDeprecatedCitiesAndContactTopics();

  let resolvedAdminActorId = adminActorId;

  if (options.seedSampleData === true) {
    const seededAdminId = await seedSampleUsers();
    resolvedAdminActorId = seededAdminId ?? adminActorId;
    await configureControlPlaneAutoIncrement('base_users', 'id', USER_ID_SEQUENCE_START, provider);
    await seedRoleMcpGrantsPrisma(resolvedAdminActorId);
  } else {
    await configureControlPlaneAutoIncrement('base_users', 'id', USER_ID_SEQUENCE_START, provider);
    await seedRoleMcpGrantsPrisma(resolvedAdminActorId);
  }

  await configureControlPlaneAutoIncrement('base_roles', 'id', ROLE_ID_SEQUENCE_START, provider);
  await backfillBootstrapAdminAuditFields(resolvedAdminActorId);
  if (process.env.APPENDO_SKIP_SAMPLE_MOCK_SEED !== '1') {
    await seedSampleMockCatalog();
  }
  await ensureContactMessagesView(provider);
  await cleanupStaleControlPlaneData();
}
