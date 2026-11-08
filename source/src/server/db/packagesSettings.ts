import fs from 'fs';

const PACKAGES_SETTINGS_KEY = 'plugins';

const readSettingsObject = (settingsPath: string): Record<string, unknown> => {
  if (!fs.existsSync(settingsPath)) return {};
  try {
    const raw = fs.readFileSync(settingsPath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
};

const writeSettingsObject = (settingsPath: string, value: Record<string, unknown>) => {
  fs.writeFileSync(settingsPath, JSON.stringify(value, null, 2));
};

export const ensurePackagesSettings = (settingsPath: string) => {
  const settings = readSettingsObject(settingsPath);
  if (!Array.isArray(settings[PACKAGES_SETTINGS_KEY])) {
    settings[PACKAGES_SETTINGS_KEY] = [];
    writeSettingsObject(settingsPath, settings);
  }
};
