import type { ProfileFieldDefinition } from '../../../shared/profile/profileFieldRegistry';
import { loadConfigurableProfileFields } from '../../services/attributes/profileFields';
import { fromUserId, loadUsernameMap, orderByViewOrderThenKey, prisma, toUserId } from '../users/prismaHelpers';
import {
  mapSettingsAttributeRow,
  type SettingsAttributeRow,
} from './settingsAttributesRepository';

export type AttributeValueRow = {
  value_id: number | null;
  value_text: string | null;
};

export type SettingsAttributeWithValueRow = SettingsAttributeRow & AttributeValueRow;

const normalizeNumericId = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};

const normalizeSettingsAttributeRow = (
  row: SettingsAttributeWithValueRow,
): SettingsAttributeWithValueRow => ({
  ...row,
  id: normalizeNumericId(row.id),
  is_builtin: Boolean(row.is_builtin),
  value_id: row.value_id === null || row.value_id === undefined ? null : normalizeNumericId(row.value_id),
});

const attributeDefinitionSelect = {
  id: true,
  key: true,
  label: true,
  scope: true,
  sourceType: true,
  baseInfoRootId: true,
  profileField: true,
  dataType: true,
  cardinality: true,
  minSelections: true,
  maxSelections: true,
  visibility: true,
  isRequired: true,
  isActive: true,
  isBuiltin: true,
  userEditable: true,
  userEditPolicy: true,
  viewOrder: true,
  createdAt: true,
  createdBy: true,
  updatedAt: true,
  updatedBy: true,
} as const;

const attributeOrderBy = orderByViewOrderThenKey();

const mapDefinitionWithValue = (
  definition: Parameters<typeof mapSettingsAttributeRow>[0],
  usernameById: Map<number, string>,
  value: { id: bigint; valueText: string | null } | undefined,
): SettingsAttributeWithValueRow => ({
  ...mapSettingsAttributeRow(definition, usernameById),
  value_id: value ? fromUserId(value.id) : null,
  value_text: value?.valueText ?? null,
});

const loadUserScopedAttributeRows = async (
  userId: number,
  where: {
    scope: 'USER';
    isActive: boolean;
    sourceType?: { in: Array<'BASE_INFO' | 'CUSTOM'> };
    userEditPolicy?: { not: string };
  },
) => {
  const definitions = await prisma().baseSettingsAttribute.findMany({
    where,
    select: {
      ...attributeDefinitionSelect,
      userValues: {
        where: { userId: toUserId(userId) },
        select: { id: true, valueText: true },
        take: 1,
      },
    },
    orderBy: attributeOrderBy,
  });

  const usernameById = await loadUsernameMap(
    definitions.flatMap((row) => [row.createdBy, row.updatedBy]),
  );

  return definitions.map((definition) => {
    const { userValues, ...rest } = definition;
    return mapDefinitionWithValue(rest, usernameById, userValues[0]);
  });
};

const loadRoleScopedAttributeRows = async (roleName: string) => {
  const definitions = await prisma().baseSettingsAttribute.findMany({
    where: { scope: 'ROLE', isActive: true },
    select: {
      ...attributeDefinitionSelect,
      roleValues: {
        where: { roleName },
        select: { id: true, valueText: true },
        take: 1,
      },
    },
    orderBy: attributeOrderBy,
  });

  const usernameById = await loadUsernameMap(
    definitions.flatMap((row) => [row.createdBy, row.updatedBy]),
  );

  return definitions.map((definition) => {
    const { roleValues, ...rest } = definition;
    return mapDefinitionWithValue(rest, usernameById, roleValues[0]);
  });
};

export async function listUserAttributeRows(userId: number) {
  const rows = await loadUserScopedAttributeRows(userId, {
    scope: 'USER',
    isActive: true,
    sourceType: { in: ['BASE_INFO', 'CUSTOM'] },
  });
  return rows.map(normalizeSettingsAttributeRow);
}

export async function listUserEditableAttributeRows(userId: number) {
  const rows = await loadUserScopedAttributeRows(userId, {
    scope: 'USER',
    isActive: true,
    sourceType: { in: ['BASE_INFO', 'CUSTOM'] },
    userEditPolicy: { not: 'NONE' },
  });
  return rows.map(normalizeSettingsAttributeRow);
}

export async function listRoleAttributeRows(roleName: string) {
  const rows = await loadRoleScopedAttributeRows(roleName);
  return rows.map(normalizeSettingsAttributeRow);
}

export async function countUserValuesForSettingsAttribute(settingsAttributeId: number) {
  const count = await prisma().baseUserAttribute.count({
    where: { definitionId: toUserId(settingsAttributeId) },
  });
  return count;
}

export async function countRoleValuesForSettingsAttribute(settingsAttributeId: number) {
  const count = await prisma().baseRoleAttribute.count({
    where: { definitionId: toUserId(settingsAttributeId) },
  });
  return count;
}

export async function upsertUserAttributeValue(
  settingsAttributeId: number,
  userId: number,
  valueText: string,
  actorId: number | null,
) {
  const actor = actorId !== null ? toUserId(actorId) : null;
  await prisma().baseUserAttribute.upsert({
    where: {
      definitionId_userId: {
        definitionId: toUserId(settingsAttributeId),
        userId: toUserId(userId),
      },
    },
    create: {
      definitionId: toUserId(settingsAttributeId),
      userId: toUserId(userId),
      valueText,
      createdBy: actor,
      updatedBy: actor,
    },
    update: {
      valueText,
      updatedBy: actor,
      updatedAt: new Date(),
    },
  });
}

export async function deleteUserAttributeValue(settingsAttributeId: number, userId: number) {
  await prisma().baseUserAttribute.deleteMany({
    where: {
      definitionId: toUserId(settingsAttributeId),
      userId: toUserId(userId),
    },
  });
}

export async function upsertRoleAttributeValue(
  settingsAttributeId: number,
  roleName: string,
  valueText: string,
  actorId: number | null,
) {
  const actor = actorId !== null ? toUserId(actorId) : null;
  await prisma().baseRoleAttribute.upsert({
    where: {
      definitionId_roleName: {
        definitionId: toUserId(settingsAttributeId),
        roleName,
      },
    },
    create: {
      definitionId: toUserId(settingsAttributeId),
      roleName,
      valueText,
      createdBy: actor,
      updatedBy: actor,
    },
    update: {
      valueText,
      updatedBy: actor,
      updatedAt: new Date(),
    },
  });
}

export async function deleteRoleAttributeValue(settingsAttributeId: number, roleName: string) {
  await prisma().baseRoleAttribute.deleteMany({
    where: {
      definitionId: toUserId(settingsAttributeId),
      roleName,
    },
  });
}

const DB_COLUMN_TO_PRISMA_FIELD: Record<string, string> = {
  firstname: 'firstname',
  lastname: 'lastname',
  fathername: 'fathername',
  grandfathername: 'grandfathername',
  phone: 'phone',
  nickname: 'nickname',
  national_code: 'nationalCode',
  birth_year: 'birthYear',
  birth_month: 'birthMonth',
  birth_day: 'birthDay',
  gender_code: 'genderCode',
  person_type_code: 'personTypeCode',
  company_name: 'companyName',
  registration_number: 'registrationNumber',
  website: 'website',
};

const buildProfileSelect = (definitions: ProfileFieldDefinition[]) => {
  const select: Record<string, boolean> = {};
  const includedDbColumns = new Set<string>();

  for (const definition of definitions) {
    if (definition.profileField === 'profile_image') {
      select.profileImageBody = true;
      select.profileImageMime = true;
      select.profileImageBodyXs = true;
      continue;
    }

    if (!definition.dbColumn || includedDbColumns.has(definition.dbColumn)) {
      continue;
    }

    const prismaField = DB_COLUMN_TO_PRISMA_FIELD[definition.dbColumn];
    if (prismaField) {
      select[prismaField] = true;
      includedDbColumns.add(definition.dbColumn);
    }
  }

  return select;
};

const mapProfileContextRow = (
  row: {
    firstname?: string | null;
    lastname?: string | null;
    fathername?: string | null;
    grandfathername?: string | null;
    phone?: string | null;
    nickname?: string | null;
    nationalCode?: string | null;
    birthYear?: string | null;
    birthMonth?: string | null;
    birthDay?: string | null;
    genderCode?: string | null;
    personTypeCode?: string | null;
    companyName?: string | null;
    registrationNumber?: string | null;
    website?: string | null;
    profileImageBody?: Uint8Array | Buffer | null;
    profileImageBodyXs?: Uint8Array | Buffer | null;
    profileImageMime?: string | null;
  } | null,
  definitions: ProfileFieldDefinition[],
): UserProfileContextRow | null => {
  if (!row) return null;

  const context: UserProfileContextRow = {};
  for (const definition of definitions) {
    if (definition.profileField === 'profile_image') {
      if ('profileImageBody' in row) {
        context.profile_image = row.profileImageBody !== null && row.profileImageBody !== undefined;
      }
      if ('profileImageMime' in row) {
        context.profile_image_mime = row.profileImageMime ?? null;
      }
      if ('profileImageBodyXs' in row) {
        context.profile_image_body_xs = row.profileImageBodyXs ?? null;
      }
      continue;
    }

    if (!definition.dbColumn) continue;
    const prismaField = DB_COLUMN_TO_PRISMA_FIELD[definition.dbColumn];
    if (!prismaField || !(prismaField in row)) continue;
    context[definition.profileField] = (row as Record<string, unknown>)[prismaField] ?? null;
  }

  return context;
};

export type UserProfileContextRow = Record<string, unknown>;

export async function getUserProfileContextRow(userId: number) {
  const definitions = await loadConfigurableProfileFields();
  const select = buildProfileSelect(definitions);
  if (Object.keys(select).length === 0) {
    select.userId = true;
  }
  const row = await prisma().baseUserProfile.findUnique({
    where: { userId: toUserId(userId) },
    select: select as {
      userId: true;
      firstname?: true;
      lastname?: true;
      fathername?: true;
      grandfathername?: true;
      phone?: true;
      nickname?: true;
      nationalCode?: true;
      birthYear?: true;
      birthMonth?: true;
      birthDay?: true;
      genderCode?: true;
      personTypeCode?: true;
      companyName?: true;
      registrationNumber?: true;
      website?: true;
      profileImageBody?: true;
      profileImageBodyXs?: true;
      profileImageMime?: true;
    },
  });
  return mapProfileContextRow(row, definitions);
}

export async function listUserIdsByRoleName(roleName: string): Promise<number[]> {
  const rows = await prisma().baseUserRole.findMany({
    where: { roleName },
    select: { userId: true },
    distinct: ['userId'],
  });
  return rows.map((row) => fromUserId(row.userId)).filter((id) => id > 0);
}

export async function listUserIdsAffectedBySettingsAttribute(
  settingsAttributeId: number,
): Promise<number[]> {
  const definitionId = toUserId(settingsAttributeId);
  const [userRows, roleRows] = await Promise.all([
    prisma().baseUserAttribute.findMany({
      where: { definitionId },
      select: { userId: true },
      distinct: ['userId'],
    }),
    prisma().baseUserRole.findMany({
      where: {
        role: {
          attributeValues: {
            some: { definitionId },
          },
        },
      },
      select: { userId: true },
      distinct: ['userId'],
    }),
  ]);

  const ids = new Set<number>();
  for (const row of userRows) {
    const id = fromUserId(row.userId);
    if (id > 0) ids.add(id);
  }
  for (const row of roleRows) {
    const id = fromUserId(row.userId);
    if (id > 0) ids.add(id);
  }
  return Array.from(ids);
}
