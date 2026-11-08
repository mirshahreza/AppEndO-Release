import type { AttributeUserEditPolicy } from '../../../shared/api/contracts/attributes/editPolicy';
import type { AttributeVisibility } from '../../../shared/api/contracts/attributes/types';
import { fromUserId, orderByViewOrderAsc, prisma, toUserId } from '../users/prismaHelpers';

export type ProfileFieldSettingRow = {
  profile_field: string;
  context_key: string;
  label_en: string | null;
  is_active: boolean;
  user_edit_policy: AttributeUserEditPolicy;
  visibility: AttributeVisibility;
  view_order: number;
  created_at: string;
  created_by: number | null;
  updated_at: string;
  updated_by: number | null;
};

export type ProfileFieldSettingWriteInput = {
  profileField: string;
  contextKey: string;
  labelEn: string | null;
  isActive: boolean;
  userEditPolicy: AttributeUserEditPolicy;
  visibility: AttributeVisibility;
  viewOrder: number;
};

const toIsoString = (value: Date | null | undefined): string =>
  value instanceof Date ? value.toISOString() : String(value ?? '');

const toViewOrderNumber = (value: { toNumber?: () => number } | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value.toNumber === 'function') return value.toNumber();
  return Number(value);
};

const mapProfileFieldRow = (row: {
  profileField: string;
  contextKey: string;
  labelEn: string | null;
  isActive: boolean;
  userEditPolicy: string;
  visibility: string;
  viewOrder: { toNumber?: () => number } | number | null;
  createdAt: Date | null;
  createdBy: bigint | null;
  updatedAt: Date | null;
  updatedBy: bigint | null;
}): ProfileFieldSettingRow => ({
  profile_field: row.profileField,
  context_key: row.contextKey,
  label_en: row.labelEn,
  is_active: row.isActive,
  user_edit_policy: row.userEditPolicy as AttributeUserEditPolicy,
  visibility: row.visibility as AttributeVisibility,
  view_order: toViewOrderNumber(row.viewOrder),
  created_at: toIsoString(row.createdAt),
  created_by: row.createdBy !== null ? fromUserId(row.createdBy) : null,
  updated_at: toIsoString(row.updatedAt),
  updated_by: row.updatedBy !== null ? fromUserId(row.updatedBy) : null,
});

const profileFieldOrderBy = [
  ...orderByViewOrderAsc(),
  { profileField: 'asc' as const },
];

const ACTIVE_PROFILE_FIELD_SETTINGS_TTL_MS = 60_000;
let cachedActiveProfileFieldSettings: ProfileFieldSettingRow[] | null = null;
let cachedActiveProfileFieldSettingsAt = 0;

export const invalidateActiveProfileFieldSettingsCache = (): void => {
  cachedActiveProfileFieldSettings = null;
  cachedActiveProfileFieldSettingsAt = 0;
};

export async function listProfileFieldSettingRows() {
  const rows = await prisma().baseSettingsProfileField.findMany({
    orderBy: profileFieldOrderBy,
  });
  return rows.map(mapProfileFieldRow);
}

export async function listActiveProfileFieldSettingRows() {
  const now = Date.now();
  if (
    cachedActiveProfileFieldSettings
    && now - cachedActiveProfileFieldSettingsAt < ACTIVE_PROFILE_FIELD_SETTINGS_TTL_MS
  ) {
    return cachedActiveProfileFieldSettings;
  }

  const rows = await prisma().baseSettingsProfileField.findMany({
    where: { isActive: true },
    orderBy: profileFieldOrderBy,
  });
  cachedActiveProfileFieldSettings = rows.map(mapProfileFieldRow);
  cachedActiveProfileFieldSettingsAt = now;
  return cachedActiveProfileFieldSettings;
}

export async function listEditableProfileFieldSettingRows() {
  const rows = await prisma().baseSettingsProfileField.findMany({
    where: { isActive: true, userEditPolicy: { not: 'NONE' } },
    orderBy: profileFieldOrderBy,
  });
  return rows.map(mapProfileFieldRow);
}

export async function findProfileFieldSettingRow(profileField: string) {
  const row = await prisma().baseSettingsProfileField.findUnique({
    where: { profileField },
  });
  return row ? mapProfileFieldRow(row) : undefined;
}

export async function upsertProfileFieldSetting(
  input: ProfileFieldSettingWriteInput,
  actorId: number | null,
) {
  const actor = actorId !== null ? toUserId(actorId) : null;
  await prisma().baseSettingsProfileField.upsert({
    where: { profileField: input.profileField },
    create: {
      profileField: input.profileField,
      contextKey: input.contextKey,
      labelEn: input.labelEn,
      isActive: input.isActive,
      userEditPolicy: input.userEditPolicy,
      visibility: input.visibility,
      viewOrder: input.viewOrder,
      createdBy: actor,
      updatedBy: actor,
    },
    update: {
      contextKey: input.contextKey,
      labelEn: input.labelEn,
      isActive: input.isActive,
      userEditPolicy: input.userEditPolicy,
      visibility: input.visibility,
      viewOrder: input.viewOrder,
      updatedBy: actor,
      updatedAt: new Date(),
    },
  });
  invalidateActiveProfileFieldSettingsCache();
}

export async function hasActiveProfileFieldSettingsForFields(profileFields: string[]) {
  if (profileFields.length === 0) return false;

  const row = await prisma().baseSettingsProfileField.findFirst({
    where: {
      isActive: true,
      profileField: { in: profileFields },
    },
    select: { profileField: true },
  });
  return Boolean(row);
}
