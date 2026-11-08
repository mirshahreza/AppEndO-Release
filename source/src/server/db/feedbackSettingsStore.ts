import { readSettingsObject, writeSettingsObject } from '../config/settingsFile';
import { normalizePlatformFeedbackConfig } from '../../shared/api/contracts/feedback/normalizers';
import type { PlatformFeedbackConfig } from '../../shared/api/contracts/feedback/types';
import { DEFAULT_PLATFORM_FEEDBACK_POLICY } from '../../shared/api/contracts/feedback/constants';
import { readPlatformBlob, writePlatformBlob } from '../services/settings/platformSettingsStore';

const FEEDBACK_CONFIG_KEY = 'platformFeedback';

const DEFAULT_PLATFORM_FEEDBACK_CONFIG: PlatformFeedbackConfig = {
  policy: DEFAULT_PLATFORM_FEEDBACK_POLICY,
  routingRules: [],
};

export const getPlatformFeedbackConfigFromFile = (settingsPath: string): PlatformFeedbackConfig => {
  const settings = readSettingsObject(settingsPath);
  return normalizePlatformFeedbackConfig(settings[FEEDBACK_CONFIG_KEY]);
};

const normalizeFeedbackBlob = (raw: Record<string, unknown>): PlatformFeedbackConfig =>
  normalizePlatformFeedbackConfig(raw);

export const getPlatformFeedbackConfig = (settingsPath: string): PlatformFeedbackConfig =>
  readPlatformBlob(
    settingsPath,
    'platformFeedback',
    getPlatformFeedbackConfigFromFile,
    normalizeFeedbackBlob,
  );

export const savePlatformFeedbackConfigToFile = (
  settingsPath: string,
  config: PlatformFeedbackConfig,
): PlatformFeedbackConfig => {
  const normalized = normalizePlatformFeedbackConfig(config);
  const settings = readSettingsObject(settingsPath);
  settings[FEEDBACK_CONFIG_KEY] = normalized;
  writeSettingsObject(settingsPath, settings);
  return normalized;
};

export const savePlatformFeedbackConfig = (
  settingsPath: string,
  config: PlatformFeedbackConfig,
): PlatformFeedbackConfig => {
  const normalized = normalizePlatformFeedbackConfig(config);
  return writePlatformBlob(
    settingsPath,
    'platformFeedback',
    normalized as unknown as Record<string, unknown>,
    savePlatformFeedbackConfigToFile,
  ) as unknown as PlatformFeedbackConfig;
};

export const ensurePlatformFeedbackConfig = (settingsPath: string): PlatformFeedbackConfig => {
  const current = getPlatformFeedbackConfig(settingsPath);
  if (!current.policy) {
    return savePlatformFeedbackConfig(settingsPath, DEFAULT_PLATFORM_FEEDBACK_CONFIG);
  }
  return current;
};
