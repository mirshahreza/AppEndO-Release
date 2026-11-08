import { MASTER_TRANSLATION_BUNDLE_ID } from '../api/contracts/platform/cultureTranslations';
import { DEFAULT_PLATFORM_CULTURES_CONFIG } from '../api/contracts/platform/cultures';
import { resolveBaseInfoIqCanonicalTitle } from './baseInfoIqTitlesByEnglish';

export const BASE_INFO_TITLE_TRANSLATION_PREFIX = 'base_info.title.';
export const BASE_INFO_NOTE_TRANSLATION_PREFIX = 'base_info.note.';

export type BaseInfoCultureTextField = 'title' | 'note';

const prefixForField: Record<BaseInfoCultureTextField, string> = {
  title: BASE_INFO_TITLE_TRANSLATION_PREFIX,
  note: BASE_INFO_NOTE_TRANSLATION_PREFIX,
};

export function baseInfoTranslationKey(field: BaseInfoCultureTextField, baseInfoId: string): string {
  const id = String(baseInfoId || '').trim();
  return `${prefixForField[field]}${id}`;
}

export function isBaseInfoCultureTranslationKey(key: string): boolean {
  const normalized = String(key || '').trim();
  return normalized.startsWith(BASE_INFO_TITLE_TRANSLATION_PREFIX)
    || normalized.startsWith(BASE_INFO_NOTE_TRANSLATION_PREFIX);
}

/** Prefix ids along a hierarchical Base Info id (`100.2.3` → `100`, `100.2`, `100.2.3`). */
export const BASE_INFO_TITLE_PATH_SEPARATOR = ' | ';

export const joinBaseInfoTitlePathSegments = (segments: string[]): string => (
  segments
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .join(BASE_INFO_TITLE_PATH_SEPARATOR)
);

export function collectBaseInfoAncestorIds(nodeId: string): string[] {
  const trimmed = String(nodeId || '').trim();
  if (!trimmed) {
    return [];
  }
  const parts = trimmed.split('.').filter((part) => part.length > 0);
  const ids: string[] = [];
  for (let index = 1; index <= parts.length; index += 1) {
    ids.push(parts.slice(0, index).join('.'));
  }
  return ids;
}

export const BASE_INFO_DEFAULT_CULTURE_ID = DEFAULT_PLATFORM_CULTURES_CONFIG.defaultCultureId;

export function resolveBaseInfoCultureId(cultureOrLang: unknown): string {
  const normalized = String(cultureOrLang || '').trim().toLowerCase();
  if (!normalized) {
    return BASE_INFO_DEFAULT_CULTURE_ID;
  }
  if (normalized === 'en' || normalized.startsWith('en-')) {
    return 'us';
  }
  if (normalized === 'fa' || normalized.startsWith('fa')) {
    return 'ir';
  }
  if (normalized === 'ar' || normalized.startsWith('ar')) {
    return 'iq';
  }
  if (DEFAULT_PLATFORM_CULTURES_CONFIG.packs.some((pack) => pack.id === normalized)) {
    return normalized;
  }
  return BASE_INFO_DEFAULT_CULTURE_ID;
}

export type BaseInfoLocaleTexts = Partial<Record<string, { title?: string; note?: string }>>;

/**
 * Resolve display text for one field from merged culture bundle + canonical column.
 */
export function resolveBaseInfoLocalizedText(options: {
  cultureId: string;
  baseInfoId: string;
  field: BaseInfoCultureTextField;
  canonical: string | null | undefined;
  bundle: Record<string, string>;
}): string {
  const canonical = String(options.canonical ?? '').trim();
  const key = baseInfoTranslationKey(options.field, options.baseInfoId);
  const translated = String(options.bundle[key] ?? '').trim();
  const iqFromCanonical = resolveBaseInfoIqCanonicalTitle(options.cultureId, canonical);
  if (translated && translated !== key) {
    // Settings bundles often echo English canonical into `base_info.title.*` — prefer iq map.
    if (options.cultureId === 'iq' && iqFromCanonical && translated === canonical) {
      return iqFromCanonical;
    }
    return translated;
  }
  if (iqFromCanonical) {
    return iqFromCanonical;
  }

  if (canonical) {
    return canonical;
  }
  return options.baseInfoId.trim();
}

export { MASTER_TRANSLATION_BUNDLE_ID };
