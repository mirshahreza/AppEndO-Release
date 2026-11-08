import {
  BASE_INFO_TITLE_TRANSLATION_PREFIX,
  resolveBaseInfoLocalizedText,
} from '../../../shared/lib/baseInfoCultureTranslations';
import { logger } from '../../../core/logging/Logger';
import { SETTINGS_PATH } from '../../config/settingsFile';
import { getPlatformCulturesConfig } from '../../db/platformCultureSettingsStore';
import {
  deleteBaseInfoCultureTextForIds,
  upsertBaseInfoCultureTextTitles,
} from './baseInfoCultureTextSequelizeModel';
import type { BaseInfoLocaleTexts } from '../../../shared/lib/baseInfoCultureTranslations';
import {
  buildMergedCultureBundle,
} from './baseInfoCultureTranslationStore';

const NON_DEFAULT_CULTURE_IDS = ['ir', 'iq'] as const;

export function syncBaseInfoCultureTextFromLocales(
  baseInfoId: string,
  canonicalTitle: string | null | undefined,
  locales: BaseInfoLocaleTexts | undefined,
): void {
  const id = baseInfoId.trim();
  if (!id) {
    return;
  }

  const entries: Array<{ baseInfoId: string; cultureId: string; title: string }> = [];

  for (const cultureId of NON_DEFAULT_CULTURE_IDS) {
    const override = locales?.[cultureId]?.title?.trim();
    if (!override) {
      continue;
    }
    const canonical = String(canonicalTitle ?? '').trim();
    if (override === canonical) {
      continue;
    }
    entries.push({ baseInfoId: id, cultureId, title: override });
  }

  if (entries.length > 0) {
    void upsertBaseInfoCultureTextTitles(entries).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('BaseInfoCultureText', `Async SQL mirror upsert failed: ${message}`);
    });
  }
}

export async function rebuildAllBaseInfoCultureTextFromTranslationStore(): Promise<number> {
  const culturesConfig = getPlatformCulturesConfig(SETTINGS_PATH);
  const entries: Array<{ baseInfoId: string; cultureId: string; title: string }> = [];

  for (const pack of culturesConfig.packs) {
    if (pack.id === 'us') {
      continue;
    }
    const bundle = buildMergedCultureBundle(pack.id);
    for (const [key, value] of Object.entries(bundle)) {
      if (!key.startsWith(BASE_INFO_TITLE_TRANSLATION_PREFIX)) {
        continue;
      }
      const baseInfoId = key.slice(BASE_INFO_TITLE_TRANSLATION_PREFIX.length).trim();
      const title = String(value ?? '').trim();
      if (!baseInfoId || !title || title === key) {
        continue;
      }
      entries.push({ baseInfoId, cultureId: pack.id, title });
    }
  }

  if (entries.length === 0) {
    return 0;
  }

  await upsertBaseInfoCultureTextTitles(entries);
  return entries.length;
}

export function resolveDisplayTitleForSqlMirror(options: {
  cultureId: string;
  baseInfoId: string;
  canonicalTitle: string | null | undefined;
}): string {
  const bundle = buildMergedCultureBundle(options.cultureId);
  return resolveBaseInfoLocalizedText({
    cultureId: options.cultureId,
    baseInfoId: options.baseInfoId,
    field: 'title',
    canonical: options.canonicalTitle,
    bundle,
  });
}

export { deleteBaseInfoCultureTextForIds };
