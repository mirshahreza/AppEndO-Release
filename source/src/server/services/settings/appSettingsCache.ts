import type { LoggingSettings } from '../../../core/logging/PinoRuntime';
import {
  mapLogDbPersistenceFromSettings,
  type LogDbPersistenceSettings,
} from '../../../core/logging/logPersistenceConfig';
import {
  APP_SETTINGS_SECTION_KEYS,
  defaultSectionValue,
  mergeSectionsToFlatPayload,
  splitFlatPayloadIntoSections,
  type AppSettingsSectionKey,
} from '../../../shared/api/contracts/settings/sections';
import { mapPwaSettings } from '../../../shared/api/contracts/settings/pwaMappers';
import { hydratePwaSettingsIconUrls } from '../pwaAssets.service';
import {
  listSettingsSections,
  upsertSettingsSection,
} from '../../domain/settings/settingsSectionRepository';
import {
  assertEmailSectionHasNoPlaintextSecret,
  clearSmtpPassword,
  syncSmtpPassword,
} from '../../domain/security/credentialVault/platformSettingsSecrets';
import { isBlankOrRedactedSecret } from '../../domain/security/credentialVault/platformSettingsVault';

const sectionCache = new Map<AppSettingsSectionKey, Record<string, unknown>>();
let initialized = false;

function normalizeSectionValue(
  sectionKey: AppSettingsSectionKey,
  value: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (sectionKey === 'pwa') {
    const defaults = defaultSectionValue('pwa');
    const incoming = value && typeof value === 'object' ? value : {};
    const defaultPwa = defaults.pwa && typeof defaults.pwa === 'object'
      ? defaults.pwa as Record<string, unknown>
      : {};
    const incomingPwa = incoming.pwa && typeof incoming.pwa === 'object'
      ? incoming.pwa as Record<string, unknown>
      : {};

    return {
      pwa: mapPwaSettings({
        ...defaultPwa,
        ...incomingPwa,
      }),
    };
  }

  return {
    ...defaultSectionValue(sectionKey),
    ...(value || {}),
  };
}

const stripEmailSectionInMemory = (value: Record<string, unknown>): Record<string, unknown> => {
  assertEmailSectionHasNoPlaintextSecret(value);
  return {
    ...value,
    smtpPass: '',
    smtpHasPassword: value.smtpHasPassword === true,
  };
};

const persistEmailSectionValue = async (
  nextValue: Record<string, unknown>,
  previous: Record<string, unknown> | undefined,
): Promise<Record<string, unknown>> => {
  const previousHas = previous?.smtpHasPassword === true;
  const blankPass = isBlankOrRedactedSecret(nextValue.smtpPass);
  if (nextValue.smtpHasPassword === false && blankPass) {
    await clearSmtpPassword();
    return {
      ...nextValue,
      smtpPass: '',
      smtpHasPassword: false,
    };
  }
  const hasPassword = await syncSmtpPassword(nextValue.smtpPass, previousHas);
  return {
    ...nextValue,
    smtpPass: '',
    smtpHasPassword: hasPassword,
  };
};

export function isAppSettingsCacheInitialized(): boolean {
  return initialized;
}

export function getCachedSection(sectionKey: AppSettingsSectionKey): Record<string, unknown> {
  if (!initialized) {
    throw new Error('App settings cache is not initialized.');
  }

  return { ...(sectionCache.get(sectionKey) || defaultSectionValue(sectionKey)) };
}

export function getCachedFlatSettings(): Record<string, unknown> {
  const sections = Object.fromEntries(
    APP_SETTINGS_SECTION_KEYS.map((sectionKey) => [sectionKey, getCachedSection(sectionKey)]),
  ) as Partial<Record<AppSettingsSectionKey, Record<string, unknown>>>;

  return {
    ...mergeSectionsToFlatPayload(sections),
    pwa: getCachedPwaSettings(),
  };
}

export function getCachedLogDbPersistenceSettings(): LogDbPersistenceSettings {
  const logsSection = getCachedSection('logs');
  return mapLogDbPersistenceFromSettings(logsSection);
}

export function getCachedLoggingSettings(): LoggingSettings {
  const loggingSection = getCachedSection('logging');
  const methodConfigs = loggingSection.methodConfigs;
  const output: LoggingSettings = {
    dbPersistence: getCachedLogDbPersistenceSettings(),
  };

  if (methodConfigs && typeof methodConfigs === 'object') {
    output.methodConfigs = methodConfigs as LoggingSettings['methodConfigs'];
  }

  return output;
}

export function getCachedEdgeAutoLogging(): boolean {
  const edgeSection = getCachedSection('server-functions');
  return typeof edgeSection.serverFunctionAutoLogging === 'boolean'
    ? edgeSection.serverFunctionAutoLogging
    : true;
}

export function getCachedPwaSettings() {
  const pwaSection = getCachedSection('pwa');
  return hydratePwaSettingsIconUrls(mapPwaSettings(pwaSection.pwa));
}

export async function initializeAppSettingsCache(actorId: number | null = null): Promise<void> {
  const rows = await listSettingsSections();
  const rowMap = new Map(rows.map((row) => [row.section_key as AppSettingsSectionKey, row.value]));

  await Promise.all(APP_SETTINGS_SECTION_KEYS.map(async (sectionKey) => {
    const existing = rowMap.get(sectionKey);
    if (existing) {
      const normalized = normalizeSectionValue(sectionKey, existing);
      sectionCache.set(
        sectionKey,
        sectionKey === 'email' ? stripEmailSectionInMemory(normalized) : normalized,
      );
      return;
    }

    const seededValue = normalizeSectionValue(sectionKey, defaultSectionValue(sectionKey));
    await upsertSettingsSection(sectionKey, seededValue, actorId);
    sectionCache.set(sectionKey, seededValue);
  }));

  initialized = true;
}

export async function replaceCachedSections(
  sections: Partial<Record<AppSettingsSectionKey, Record<string, unknown>>>,
  actorId: number | null,
): Promise<void> {
  if (!initialized) {
    throw new Error('App settings cache is not initialized.');
  }

  for (const sectionKey of APP_SETTINGS_SECTION_KEYS) {
    const nextValue = sections[sectionKey];
    if (!nextValue) continue;

    const previous = sectionCache.get(sectionKey);
    const base = normalizeSectionValue(sectionKey, nextValue);
    const normalized = sectionKey === 'email'
      ? await persistEmailSectionValue(base, previous)
      : base;
    await upsertSettingsSection(sectionKey, normalized, actorId);
    sectionCache.set(sectionKey, normalized);
  }
}

export async function mergeCachedFlatSettings(
  payload: Record<string, unknown>,
  actorId: number | null,
): Promise<Record<string, unknown>> {
  const currentFlat = getCachedFlatSettings();
  const mergedFlat = { ...currentFlat, ...payload };
  const sections = splitFlatPayloadIntoSections(mergedFlat);
  await replaceCachedSections(sections, actorId);
  return getCachedFlatSettings();
}

export async function replaceCachedLoggingMethodConfigs(
  methodConfigs: Record<string, unknown>,
  actorId: number | null,
): Promise<void> {
  const current = getCachedSection('logging');
  const nextValue = normalizeSectionValue('logging', {
    ...current,
    methodConfigs,
  });

  await upsertSettingsSection('logging', nextValue, actorId);
  sectionCache.set('logging', nextValue);
}

export async function reloadAppSettingsCacheFromDatabase(): Promise<void> {
  const rows = await listSettingsSections();

  for (const sectionKey of APP_SETTINGS_SECTION_KEYS) {
    const row = rows.find((item) => item.section_key === sectionKey);
    const normalized = normalizeSectionValue(sectionKey, row?.value);
    sectionCache.set(
      sectionKey,
      sectionKey === 'email' ? stripEmailSectionInMemory(normalized) : normalized,
    );
  }

  initialized = true;
}
