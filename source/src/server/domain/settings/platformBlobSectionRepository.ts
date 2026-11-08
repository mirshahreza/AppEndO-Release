import type { PlatformBlobSectionKey } from '../../../shared/api/contracts/settings/scopes';
import { fromUserId, prisma, toUserId } from '../users/prismaHelpers';

export type PlatformBlobSectionRow = {
  section_key: PlatformBlobSectionKey;
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

const mapRow = (row: {
  sectionKey: string;
  value: string;
  createdAt: Date | null;
  createdBy: bigint | null;
  updatedAt: Date | null;
  updatedBy: bigint | null;
}): PlatformBlobSectionRow => ({
  section_key: row.sectionKey as PlatformBlobSectionKey,
  value: parseSectionValue(row.value),
  created_at: toIsoString(row.createdAt),
  created_by: row.createdBy !== null ? fromUserId(row.createdBy) : null,
  updated_at: toIsoString(row.updatedAt),
  updated_by: row.updatedBy !== null ? fromUserId(row.updatedBy) : null,
});

export async function listPlatformBlobSections(): Promise<PlatformBlobSectionRow[]> {
  const rows = await prisma().baseSettingsSection.findMany({
    where: {
      sectionKey: {
        in: [
          'ai',
          'cache',
          'platformCultures',
          'platformCultureTranslations',
          'platformWebFonts',
          'platformFeedback',
          'identity-providers',
          'security',
          'scheduler',
          'git',
          'appearancePortalDefaults',
          'platformRouteLoading',
        ],
      },
    },
    orderBy: { sectionKey: 'asc' },
  });
  return rows.map(mapRow);
}

export async function getPlatformBlobSection(
  sectionKey: PlatformBlobSectionKey,
): Promise<PlatformBlobSectionRow | undefined> {
  const row = await prisma().baseSettingsSection.findUnique({
    where: { sectionKey },
  });
  if (!row) return undefined;
  return mapRow(row);
}

export async function upsertPlatformBlobSection(
  sectionKey: PlatformBlobSectionKey,
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

export async function deletePlatformBlobSection(sectionKey: PlatformBlobSectionKey): Promise<void> {
  await prisma().baseSettingsSection.deleteMany({
    where: { sectionKey },
  });
}
