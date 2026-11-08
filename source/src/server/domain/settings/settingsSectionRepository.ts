import type { AppSettingsSectionKey } from '../../../shared/api/contracts/settings/sections';
import { fromUserId, prisma, toUserId } from '../users/prismaHelpers';

export type SettingsSectionRow = {
  section_key: string;
  value: Record<string, unknown>;
  created_at: string;
  created_by: number | null;
  updated_at: string;
  updated_by: number | null;
};

const parseSectionValue = (raw: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  return {};
};

const toIsoString = (value: Date | null | undefined): string =>
  value instanceof Date ? value.toISOString() : String(value ?? '');

const mapSectionRow = (row: {
  sectionKey: string;
  value: string;
  createdAt: Date | null;
  createdBy: bigint | null;
  updatedAt: Date | null;
  updatedBy: bigint | null;
}): SettingsSectionRow => ({
  section_key: row.sectionKey,
  value: parseSectionValue(row.value),
  created_at: toIsoString(row.createdAt),
  created_by: row.createdBy !== null ? fromUserId(row.createdBy) : null,
  updated_at: toIsoString(row.updatedAt),
  updated_by: row.updatedBy !== null ? fromUserId(row.updatedBy) : null,
});

export async function listSettingsSections(): Promise<SettingsSectionRow[]> {
  const rows = await prisma().baseSettingsSection.findMany({
    orderBy: { sectionKey: 'asc' },
  });
  return rows.map(mapSectionRow);
}

export async function getSettingsSection(sectionKey: AppSettingsSectionKey): Promise<SettingsSectionRow | undefined> {
  const row = await prisma().baseSettingsSection.findUnique({
    where: { sectionKey },
  });
  if (!row) return undefined;
  return mapSectionRow(row);
}

export async function upsertSettingsSection(
  sectionKey: AppSettingsSectionKey,
  value: Record<string, unknown>,
  actorId: number | null,
): Promise<void> {
  const actor = actorId !== null ? toUserId(actorId) : null;
  await prisma().baseSettingsSection.upsert({
    where: { sectionKey },
    create: {
      sectionKey,
      value: JSON.stringify(value),
      createdBy: actor,
      updatedBy: actor,
    },
    update: {
      value: JSON.stringify(value),
      updatedBy: actor,
      updatedAt: new Date(),
    },
  });
}
