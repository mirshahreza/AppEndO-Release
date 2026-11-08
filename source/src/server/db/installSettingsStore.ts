import { readSettingsObject, writeSettingsObject } from '../config/settingsFile';

import type { NodeCapability } from '../../shared/nodeCapabilities';



const INSTALL_SETTINGS_KEY = 'install';



export type StoredInstallSettings = {

  pending?: boolean;

  completedAt?: string;

  capabilities?: NodeCapability[];

  nodeName?: string;

  overrideExistingObjects?: boolean;

  databaseInitialized?: boolean;

  emailConfigured?: boolean;

  seedSampleData?: boolean;

};



export const readInstallSettings = (settingsPath: string): StoredInstallSettings => {

  const settings = readSettingsObject(settingsPath);

  const raw = settings[INSTALL_SETTINGS_KEY];

  if (!raw || typeof raw !== 'object') {

    return {};

  }

  return raw as StoredInstallSettings;

};



export const writeInstallSettings = (

  settingsPath: string,

  patch: Partial<StoredInstallSettings>,

): StoredInstallSettings => {

  const settings = readSettingsObject(settingsPath);

  const current = readInstallSettings(settingsPath);

  const next: StoredInstallSettings = { ...current, ...patch };

  settings[INSTALL_SETTINGS_KEY] = next;

  writeSettingsObject(settingsPath, settings);

  return next;

};



export const hasInstallSection = (settingsPath: string): boolean => {

  const settings = readSettingsObject(settingsPath);

  return Boolean(settings[INSTALL_SETTINGS_KEY] && typeof settings[INSTALL_SETTINGS_KEY] === 'object');

};



export const isInstallPending = (settingsPath: string): boolean => {

  const install = readInstallSettings(settingsPath);

  return install.pending === true && !install.completedAt;

};



export const isInstallComplete = (settingsPath: string): boolean => {

  const install = readInstallSettings(settingsPath);

  if (install.completedAt) {

    return true;

  }

  if (!hasInstallSection(settingsPath)) {

    return true;

  }

  return false;

};



export const toPublicInstallSettings = (settingsPath: string) => {

  const install = readInstallSettings(settingsPath);

  const completed = isInstallComplete(settingsPath);

  return {

    pending: install.pending === true && !completed,

    completed,

    completedAt: install.completedAt,

    capabilities: install.capabilities,

    nodeName: install.nodeName,

    overrideExistingObjects: install.overrideExistingObjects,

    databaseInitialized: install.databaseInitialized,

    emailConfigured: install.emailConfigured,

    seedSampleData: install.seedSampleData === true,

  };

};

