import type { PlatformBlobSectionKey } from '../../../shared/api/contracts/settings/scopes';
import { upsertPlatformBlobSection } from '../../domain/settings/platformBlobSectionRepository';
import {
  aiSettingsBlobNeedsCatalogRepair,
  repairAiSettingsBlob,
} from '../ai/aiSettingsCatalogRepair';

const blobCache = new Map<PlatformBlobSectionKey, Record<string, unknown>>();
const blobWriteTails = new Map<PlatformBlobSectionKey, Promise<void>>();
let initialized = false;

function enqueuePlatformBlobWrite(
  sectionKey: PlatformBlobSectionKey,
  value: Record<string, unknown>,
  actorId: number | null,
): Promise<void> {
  const previous = blobWriteTails.get(sectionKey) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() => upsertPlatformBlobSection(sectionKey, value, actorId));
  blobWriteTails.set(sectionKey, next);
  return next;
}

export async function flushPlatformBlobWrites(): Promise<void> {
  await Promise.all([...blobWriteTails.values()].map((pending) => pending.catch(() => undefined)));
}

export function isPlatformSettingsCacheInitialized(): boolean {
  return initialized;
}

export function getCachedPlatformBlob(sectionKey: PlatformBlobSectionKey): Record<string, unknown> | undefined {
  if (!initialized) return undefined;
  return blobCache.get(sectionKey);
}

function setCachedPlatformBlobSync(
  sectionKey: PlatformBlobSectionKey,
  value: Record<string, unknown>,
): void {
  blobCache.set(sectionKey, value);
  initialized = true;
}

export async function replaceCachedPlatformBlob(
  sectionKey: PlatformBlobSectionKey,
  value: Record<string, unknown>,
  actorId: number | null,
): Promise<void> {
  setCachedPlatformBlobSync(sectionKey, value);
  await enqueuePlatformBlobWrite(sectionKey, value, actorId);
}

const PLATFORM_BLOB_SECTION_KEYS = [
  'ai',
  'cache',
  'platformCultures',
  'platformCultureTranslations',
  'platformWebFonts',
  'platformFeedback',
  'platformRouteLoading',
  'identity-providers',
  'security',
  'scheduler',
  'git',
] as const satisfies readonly PlatformBlobSectionKey[];

export async function initializePlatformSettingsCache(
  seeds: Partial<Record<PlatformBlobSectionKey, Record<string, unknown>>>,
  actorId: number | null = null,
): Promise<void> {
  const { getPlatformBlobSection } = await import('../../domain/settings/platformBlobSectionRepository');

  await Promise.all(PLATFORM_BLOB_SECTION_KEYS.map(async (sectionKey) => {
    const existing = await getPlatformBlobSection(sectionKey);
    if (existing) {
      if (sectionKey === 'ai' && aiSettingsBlobNeedsCatalogRepair(existing.value)) {
        const repaired = repairAiSettingsBlob(existing.value);
        const repairedRecord = repaired as unknown as Record<string, unknown>;
        await upsertPlatformBlobSection(sectionKey, repairedRecord, actorId);
        blobCache.set(sectionKey, repairedRecord);
        console.log('[AppEndO] AI settings catalog repaired — embedding presets merged.');
        return;
      }

      blobCache.set(sectionKey, existing.value);
      return;
    }

    const seed = seeds[sectionKey];
    if (!seed) {
      return;
    }

    await upsertPlatformBlobSection(sectionKey, seed, actorId);
    blobCache.set(sectionKey, seed);
  }));

  initialized = true;
}

export async function reloadPlatformSettingsCacheFromDatabase(): Promise<void> {
  const { getPlatformBlobSection } = await import('../../domain/settings/platformBlobSectionRepository');
  blobCache.clear();

  for (const sectionKey of [
    'ai',
    'cache',
    'platformCultures',
    'platformCultureTranslations',
    'platformWebFonts',
    'platformFeedback',
    'platformRouteLoading',
    'identity-providers',
    'security',
    'scheduler',
    'git',
  ] as const) {
    const row = await getPlatformBlobSection(sectionKey);
    if (row) {
      if (sectionKey === 'ai' && aiSettingsBlobNeedsCatalogRepair(row.value)) {
        const repaired = repairAiSettingsBlob(row.value);
        const repairedRecord = repaired as unknown as Record<string, unknown>;
        await upsertPlatformBlobSection(sectionKey, repairedRecord, null);
        blobCache.set(sectionKey, repairedRecord);
        console.log('[AppEndO] AI settings catalog repaired — embedding presets merged.');
        continue;
      }

      blobCache.set(sectionKey, row.value);
    }
  }

  initialized = true;
}

export const buildPlatformSettingsExportPayload = (): Record<string, unknown> => {
  const output: Record<string, unknown> = {};
  blobCache.forEach((value, key) => {
    output[key] = value;
  });
  return output;
};

/** Persist a platform blob — updates in-memory cache immediately, then DB. */
export const persistPlatformBlob = (
  sectionKey: PlatformBlobSectionKey,
  value: Record<string, unknown>,
  actorId: number | null = null,
): Record<string, unknown> => {
  setCachedPlatformBlobSync(sectionKey, value);
  void enqueuePlatformBlobWrite(sectionKey, value, actorId);
  return value;
};
