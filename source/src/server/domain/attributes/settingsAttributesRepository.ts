import type { AttributeUserEditPolicy } from '../../../shared/api/contracts/attributes/editPolicy';
import { fromUserId, loadUsernameMap, orderByViewOrderThenKey, prisma, toUserId } from '../users/prismaHelpers';

export type SettingsAttributeRow = {
  id: number;
  key: string;
  label: string | null;
  scope: 'USER' | 'ROLE';
  source_type: 'BASE_INFO' | 'CUSTOM';
  base_info_root_id: string | null;
  profile_field: string | null;
  data_type: 'string' | 'number' | 'boolean' | 'json' | 'base_info_code' | null;
  cardinality: 'single' | 'multi';
  min_selections: number | null;
  max_selections: number | null;
  visibility: 'SERVER' | 'CLIENT' | 'BOTH' | 'NONE';
  is_required: boolean;
  is_active: boolean;
  is_builtin: boolean;
  user_editable: boolean;
  user_edit_policy: AttributeUserEditPolicy;
  view_order: number;
  created_at: string;
  created_by: number | null;
  created_by_username: string | null;
  updated_at: string;
  updated_by: number | null;
  updated_by_username: string | null;
};

export type SettingsAttributeWriteInput = {
  key: string;
  label: string | null;
  scope: 'USER' | 'ROLE';
  sourceType: 'BASE_INFO' | 'CUSTOM';
  baseInfoRootId: string | null;
  profileField: string | null;
  dataType: 'string' | 'number' | 'boolean' | 'json' | 'base_info_code' | null;
  cardinality: 'single' | 'multi';
  minSelections: number | null;
  maxSelections: number | null;
  visibility: 'SERVER' | 'CLIENT' | 'BOTH' | 'NONE';
  isRequired: boolean;
  isActive: boolean;
  userEditable: boolean;
  userEditPolicy: AttributeUserEditPolicy;
  viewOrder: number;
};

type AttributeDefinitionRow = {
  id: bigint;
  key: string;
  label: string | null;
  scope: string;
  sourceType: string;
  baseInfoRootId: string | null;
  profileField: string | null;
  dataType: string | null;
  cardinality: string;
  minSelections: number | null;
  maxSelections: number | null;
  visibility: string;
  isRequired: boolean;
  isActive: boolean;
  isBuiltin: boolean;
  userEditable: boolean;
  userEditPolicy: string;
  viewOrder: { toNumber?: () => number } | number | null;
  createdAt: Date | null;
  createdBy: bigint | null;
  updatedAt: Date | null;
  updatedBy: bigint | null;
};

const toIsoString = (value: Date | null | undefined): string =>
  value instanceof Date ? value.toISOString() : String(value ?? '');

const toViewOrderNumber = (value: { toNumber?: () => number } | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value.toNumber === 'function') return value.toNumber();
  return Number(value);
};

export const mapSettingsAttributeRow = (
  row: AttributeDefinitionRow,
  usernameById: Map<number, string>,
): SettingsAttributeRow => ({
  id: fromUserId(row.id),
  key: row.key,
  label: row.label,
  scope: row.scope as SettingsAttributeRow['scope'],
  source_type: row.sourceType as SettingsAttributeRow['source_type'],
  base_info_root_id: row.baseInfoRootId,
  profile_field: row.profileField,
  data_type: row.dataType as SettingsAttributeRow['data_type'],
  cardinality: row.cardinality as SettingsAttributeRow['cardinality'],
  min_selections: row.minSelections,
  max_selections: row.maxSelections,
  visibility: row.visibility as SettingsAttributeRow['visibility'],
  is_required: row.isRequired,
  is_active: row.isActive,
  is_builtin: row.isBuiltin,
  user_editable: row.userEditable,
  user_edit_policy: row.userEditPolicy as AttributeUserEditPolicy,
  view_order: toViewOrderNumber(row.viewOrder),
  created_at: toIsoString(row.createdAt),
  created_by: row.createdBy !== null ? fromUserId(row.createdBy) : null,
  created_by_username: row.createdBy !== null ? usernameById.get(fromUserId(row.createdBy)) ?? null : null,
  updated_at: toIsoString(row.updatedAt),
  updated_by: row.updatedBy !== null ? fromUserId(row.updatedBy) : null,
  updated_by_username: row.updatedBy !== null ? usernameById.get(fromUserId(row.updatedBy)) ?? null : null,
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

const loadMappedAttributeRows = async (
  rows: AttributeDefinitionRow[],
): Promise<SettingsAttributeRow[]> => {
  const usernameById = await loadUsernameMap(rows.flatMap((row) => [row.createdBy, row.updatedBy]));
  return rows.map((row) => mapSettingsAttributeRow(row, usernameById));
};

const toCreateData = (input: SettingsAttributeWriteInput, actorId: number | null) => ({
  key: input.key,
  label: input.label,
  scope: input.scope,
  sourceType: input.sourceType,
  baseInfoRootId: input.baseInfoRootId,
  profileField: input.profileField,
  dataType: input.dataType,
  cardinality: input.cardinality,
  minSelections: input.minSelections,
  maxSelections: input.maxSelections,
  visibility: input.visibility,
  isRequired: input.isRequired,
  isActive: input.isActive,
  userEditable: input.userEditable,
  userEditPolicy: input.userEditPolicy,
  viewOrder: input.viewOrder,
  ...(actorId !== null ? { updatedBy: toUserId(actorId) } : {}),
});

const toUpdateData = (input: SettingsAttributeWriteInput, actorId: number | null) => ({
  key: input.key,
  label: input.label,
  sourceType: input.sourceType,
  baseInfoRootId: input.baseInfoRootId,
  profileField: input.profileField,
  dataType: input.dataType,
  cardinality: input.cardinality,
  minSelections: input.minSelections,
  maxSelections: input.maxSelections,
  visibility: input.visibility,
  isRequired: input.isRequired,
  isActive: input.isActive,
  userEditable: input.userEditable,
  userEditPolicy: input.userEditPolicy,
  viewOrder: input.viewOrder,
  ...(actorId !== null ? { updatedBy: toUserId(actorId) } : {}),
});

export async function listSettingsAttributeRows(scope: 'USER' | 'ROLE') {
  const rows = await prisma().baseSettingsAttribute.findMany({
    where: { scope },
    select: attributeDefinitionSelect,
    orderBy: attributeOrderBy,
  });
  return loadMappedAttributeRows(rows);
}

export async function findSettingsAttributeById(id: number) {
  const row = await prisma().baseSettingsAttribute.findUnique({
    where: { id: toUserId(id) },
    select: attributeDefinitionSelect,
  });
  if (!row) return undefined;
  const [mapped] = await loadMappedAttributeRows([row]);
  return mapped;
}

export async function findSettingsAttributeByScopeAndKey(scope: 'USER' | 'ROLE', key: string) {
  const row = await prisma().baseSettingsAttribute.findFirst({
    where: { scope, key, isActive: true },
    select: attributeDefinitionSelect,
  });
  if (!row) return undefined;
  const [mapped] = await loadMappedAttributeRows([row]);
  return mapped;
}

export async function findSettingsAttributeKeyConflict(
  scope: 'USER' | 'ROLE',
  key: string,
  excludeId = 0,
) {
  const row = await prisma().baseSettingsAttribute.findFirst({
    where: {
      scope,
      key,
      ...(excludeId > 0 ? { id: { not: toUserId(excludeId) } } : {}),
    },
    select: { id: true },
  });
  return row ? { id: fromUserId(row.id) } : undefined;
}

export async function insertSettingsAttribute(input: SettingsAttributeWriteInput, actorId: number | null) {
  const actor = actorId !== null ? toUserId(actorId) : null;
  const row = await prisma().baseSettingsAttribute.create({
    data: {
      ...toCreateData(input, actorId),
      createdBy: actor,
      updatedBy: actor,
    },
    select: { id: true },
  });
  return fromUserId(row.id);
}

export async function updateSettingsAttribute(
  id: number,
  input: SettingsAttributeWriteInput,
  actorId: number | null,
) {
  await prisma().baseSettingsAttribute.updateMany({
    where: { id: toUserId(id), scope: input.scope },
    data: {
      ...toUpdateData(input, actorId),
      updatedAt: new Date(),
    },
  });
}

export async function updateSettingsAttributeVisibility(
  id: number,
  visibility: SettingsAttributeRow['visibility'],
  actorId: number | null,
) {
  const actor = actorId !== null ? toUserId(actorId) : null;
  await prisma().baseSettingsAttribute.update({
    where: { id: toUserId(id) },
    data: {
      visibility,
      updatedBy: actor,
      updatedAt: new Date(),
    },
  });
}

export async function ensureBuiltinUserJsonAttribute(
  key: string,
  label: string,
  actorId: number | null,
): Promise<number> {
  const actor = actorId !== null ? toUserId(actorId) : null;
  const row = await prisma().baseSettingsAttribute.upsert({
    where: { scope_key: { scope: 'USER', key } },
    update: {
      isActive: true,
      visibility: 'CLIENT',
      dataType: 'json',
      cardinality: 'single',
      isBuiltin: true,
      userEditable: false,
      userEditPolicy: 'NONE',
      updatedAt: new Date(),
      ...(actor ? { updatedBy: actor } : {}),
    },
    create: {
      key,
      label,
      scope: 'USER',
      sourceType: 'CUSTOM',
      dataType: 'json',
      cardinality: 'single',
      visibility: 'CLIENT',
      isRequired: false,
      isActive: true,
      userEditable: false,
      userEditPolicy: 'NONE',
      isBuiltin: true,
      viewOrder: 0,
      createdBy: actor,
      updatedBy: actor,
    },
    select: { id: true },
  });
  return fromUserId(row.id);
}

export async function deleteSettingsAttribute(id: number, scope: 'USER' | 'ROLE') {
  await prisma().baseSettingsAttribute.deleteMany({
    where: { id: toUserId(id), scope },
  });
}

export async function reorderSettingsAttributes(
  scope: 'USER' | 'ROLE',
  orderedIds: number[],
  actorId: number | null,
) {
  const actor = actorId !== null ? toUserId(actorId) : null;
  for (let index = 0; index < orderedIds.length; index += 1) {
    await prisma().baseSettingsAttribute.updateMany({
      where: { id: toUserId(orderedIds[index]), scope },
      data: {
        viewOrder: index * 10,
        updatedBy: actor,
        updatedAt: new Date(),
      },
    });
  }
}
