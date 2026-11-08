import type { SettingsAttributePayload, SettingsAttributeRecord } from '../../../shared/api/contracts/attributes/types';
import {
  isPlatformTransferSectionKey,
  PLATFORM_TRANSFER_BUNDLE_VERSION,
  type PlatformTransferBundle,
  type PlatformTransferSectionKey,
} from '../../../shared/api/contracts/settings/platformTransfer';
import type { AppSettingsSectionKey } from '../../../shared/api/contracts/settings/sections';
import { APP_SETTINGS_SECTION_KEYS } from '../../../shared/api/contracts/settings/sections';
import type { PlatformBlobSectionKey } from '../../../shared/api/contracts/settings/scopes';
import { HttpError } from '../../errors/HttpError';
import type { ActorContext } from '../../types/requestContext';
import {
  createSettingsAttribute,
  updateSettingsAttributeRecord,
} from '../attributes/settingsAttributes.service';
import { listSettingsAttributeRows } from '../../domain/attributes/settingsAttributesRepository';
import { listProfileFieldSettings, saveProfileFieldSettings } from '../profile/profileFieldsSettings.service';
import {
  getCachedPlatformBlob,
  replaceCachedPlatformBlob,
} from './platformSettingsCache';
import {
  getCachedSection,
  replaceCachedSections,
} from './appSettingsCache';

const PLATFORM_BLOB_KEYS = new Set<string>([
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
]);

const APP_SECTION_KEYS = new Set<string>(APP_SETTINGS_SECTION_KEYS);

const isPlatformBlobKey = (key: string): key is PlatformBlobSectionKey =>
  PLATFORM_BLOB_KEYS.has(key);

const isAppSectionKey = (key: string): key is AppSettingsSectionKey =>
  APP_SECTION_KEYS.has(key);

export const normalizeTransferSectionKeys = (value: unknown): PlatformTransferSectionKey[] => {
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'sections must be a non-empty array.');
  }

  const keys = value
    .map((item) => String(item ?? '').trim())
    .filter((item) => item.length > 0);

  if (keys.length === 0) {
    throw new HttpError(400, 'At least one section must be selected.');
  }

  const invalid = keys.filter((key) => !isPlatformTransferSectionKey(key));
  if (invalid.length > 0) {
    throw new HttpError(400, `Unknown transfer section(s): ${invalid.join(', ')}`);
  }

  return [...new Set(keys)] as PlatformTransferSectionKey[];
};

const exportSection = async (sectionKey: PlatformTransferSectionKey): Promise<unknown> => {
  if (isPlatformBlobKey(sectionKey)) {
    const blob = getCachedPlatformBlob(sectionKey);
    if (!blob) {
      throw new HttpError(409, `Platform blob "${sectionKey}" is not loaded.`);
    }
    return blob;
  }

  if (isAppSectionKey(sectionKey)) {
    return getCachedSection(sectionKey);
  }

  if (sectionKey === 'profile-fields') {
    const result = await listProfileFieldSettings();
    return { items: result.body.items };
  }

  if (sectionKey === 'user-attributes' || sectionKey === 'role-attributes') {
    const scope = sectionKey === 'user-attributes' ? 'USER' : 'ROLE';
    const items = await listSettingsAttributeRows(scope);
    return { items };
  }

  throw new HttpError(400, `Unsupported transfer section "${sectionKey}".`);
};

export const exportPlatformTransferBundle = async (
  sectionKeys: PlatformTransferSectionKey[],
): Promise<PlatformTransferBundle> => {
  const sections: Partial<Record<PlatformTransferSectionKey, unknown>> = {};

  for (const sectionKey of sectionKeys) {
    sections[sectionKey] = await exportSection(sectionKey);
  }

  return {
    version: PLATFORM_TRANSFER_BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    sections,
  };
};

const attributeRecordToPayload = (
  record: SettingsAttributeRecord,
  scope: 'USER' | 'ROLE',
): SettingsAttributePayload => ({
  key: record.key,
  label: record.label,
  scope,
  sourceType: record.source_type,
  baseInfoRootId: record.base_info_root_id,
  profileField: record.profile_field,
  dataType: record.data_type,
  cardinality: record.cardinality,
  minSelections: record.min_selections,
  maxSelections: record.max_selections,
  visibility: record.visibility,
  isRequired: record.is_required,
  isActive: record.is_active,
  userEditable: record.user_editable,
  userEditPolicy: record.user_edit_policy,
  viewOrder: record.view_order,
});

const importAttributeItems = async (
  scope: 'USER' | 'ROLE',
  payload: unknown,
  actor: ActorContext,
): Promise<void> => {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { items?: unknown }).items)) {
    throw new HttpError(400, `${scope} attributes import requires an items array.`);
  }

  const items = (payload as { items: SettingsAttributeRecord[] }).items;
  const existing = await listSettingsAttributeRows(scope);
  const byKey = new Map(existing.map((row) => [row.key, row]));

  for (const item of items) {
    const key = String(item?.key ?? '').trim();
    if (!key) continue;

    const attributePayload = attributeRecordToPayload(item, scope);
    const current = byKey.get(key);
    if (current) {
      await updateSettingsAttributeRecord(actor, current.id, attributePayload);
      continue;
    }

    await createSettingsAttribute(actor, attributePayload);
  }
};

const importSection = async (
  sectionKey: PlatformTransferSectionKey,
  payload: unknown,
  actor: ActorContext | null,
): Promise<void> => {
  if (isPlatformBlobKey(sectionKey)) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new HttpError(400, `Invalid payload for platform blob "${sectionKey}".`);
    }
    await replaceCachedPlatformBlob(sectionKey, payload as Record<string, unknown>, actor?.userId ?? null);
    return;
  }

  if (isAppSectionKey(sectionKey)) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new HttpError(400, `Invalid payload for app section "${sectionKey}".`);
    }
    await replaceCachedSections({ [sectionKey]: payload as Record<string, unknown> }, actor?.userId ?? null);
    return;
  }

  if (sectionKey === 'profile-fields') {
    if (!actor) {
      throw new HttpError(401, 'Authentication required to import profile fields.');
    }
    await saveProfileFieldSettings(actor, payload);
    return;
  }

  if (sectionKey === 'user-attributes' || sectionKey === 'role-attributes') {
    if (!actor) {
      throw new HttpError(401, 'Authentication required to import attribute definitions.');
    }
    const scope = sectionKey === 'user-attributes' ? 'USER' : 'ROLE';
    await importAttributeItems(scope, payload, actor);
  }
};

export const importPlatformTransferBundle = async (
  bundle: unknown,
  sectionKeys: PlatformTransferSectionKey[],
  actor: ActorContext | null,
): Promise<{ imported: PlatformTransferSectionKey[] }> => {
  if (!bundle || typeof bundle !== 'object') {
    throw new HttpError(400, 'Import bundle is required.');
  }

  const parsed = bundle as Partial<PlatformTransferBundle>;
  if (parsed.version !== PLATFORM_TRANSFER_BUNDLE_VERSION) {
    throw new HttpError(400, `Unsupported bundle version "${String(parsed.version)}".`);
  }

  const sections = parsed.sections;
  if (!sections || typeof sections !== 'object' || Array.isArray(sections)) {
    throw new HttpError(400, 'Import bundle sections object is required.');
  }

  const imported: PlatformTransferSectionKey[] = [];

  for (const sectionKey of sectionKeys) {
    const payload = sections[sectionKey];
    if (payload === undefined) {
      throw new HttpError(400, `Bundle is missing section "${sectionKey}".`);
    }
    await importSection(sectionKey, payload, actor);
    imported.push(sectionKey);
  }

  return { imported };
};

/** Backward-compatible full platform blob export. */
export const exportAllPlatformBlobs = async (): Promise<PlatformTransferBundle> =>
  exportPlatformTransferBundle([
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
  ]);

export const importLegacyPlatformPayload = async (
  platform: Record<string, unknown>,
  actor: ActorContext | null,
): Promise<{ imported: string[] }> => {
  const keys = Object.keys(platform).filter(isPlatformBlobKey);
  const bundle: PlatformTransferBundle = {
    version: PLATFORM_TRANSFER_BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    sections: Object.fromEntries(keys.map((key) => [key, platform[key]])),
  };
  const result = await importPlatformTransferBundle(bundle, keys, actor);
  return { imported: result.imported };
};
