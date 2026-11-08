import { DEFAULT_PWA_SETTINGS, type PwaSettings } from './pwa';

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const readString = (record: Record<string, unknown>, key: keyof PwaSettings, fallback: string): string => {
  const value = record[key as string];
  return typeof value === 'string' && value.trim() ? value : fallback;
};

const readBoolean = (record: Record<string, unknown>, key: keyof PwaSettings, fallback: boolean): boolean => {
  const value = record[key as string];
  return typeof value === 'boolean' ? value : fallback;
};

export const mapPwaSettings = (value: unknown): PwaSettings => {
  const record = asRecord(value);
  if (!record) {
    return { ...DEFAULT_PWA_SETTINGS };
  }

  return {
    enabled: readBoolean(record, 'enabled', DEFAULT_PWA_SETTINGS.enabled),
    name: readString(record, 'name', DEFAULT_PWA_SETTINGS.name),
    shortName: readString(record, 'shortName', DEFAULT_PWA_SETTINGS.shortName),
    description: readString(record, 'description', DEFAULT_PWA_SETTINGS.description),
    themeColor: readString(record, 'themeColor', DEFAULT_PWA_SETTINGS.themeColor),
    backgroundColor: readString(record, 'backgroundColor', DEFAULT_PWA_SETTINGS.backgroundColor),
    faviconUrl: readString(record, 'faviconUrl', DEFAULT_PWA_SETTINGS.faviconUrl),
    icon192Url: readString(record, 'icon192Url', DEFAULT_PWA_SETTINGS.icon192Url),
    icon512Url: readString(record, 'icon512Url', DEFAULT_PWA_SETTINGS.icon512Url),
    maskableIcon512Url: readString(record, 'maskableIcon512Url', DEFAULT_PWA_SETTINGS.maskableIcon512Url),
    iconSourceRef: readString(record, 'iconSourceRef', DEFAULT_PWA_SETTINGS.iconSourceRef),
    display: readString(record, 'display', DEFAULT_PWA_SETTINGS.display) as PwaSettings['display'],
    orientation: readString(record, 'orientation', DEFAULT_PWA_SETTINGS.orientation) as PwaSettings['orientation'],
    startUrl: readString(record, 'startUrl', DEFAULT_PWA_SETTINGS.startUrl),
    scope: readString(record, 'scope', DEFAULT_PWA_SETTINGS.scope),
    showInstallPrompt: readBoolean(record, 'showInstallPrompt', DEFAULT_PWA_SETTINGS.showInstallPrompt),
    installPromptTitle: readString(record, 'installPromptTitle', DEFAULT_PWA_SETTINGS.installPromptTitle),
    installPromptMessage: readString(record, 'installPromptMessage', DEFAULT_PWA_SETTINGS.installPromptMessage),
    installButtonLabel: readString(record, 'installButtonLabel', DEFAULT_PWA_SETTINGS.installButtonLabel),
    dismissButtonLabel: readString(record, 'dismissButtonLabel', DEFAULT_PWA_SETTINGS.dismissButtonLabel),
    installReadyMessage: readString(record, 'installReadyMessage', DEFAULT_PWA_SETTINGS.installReadyMessage),
    updateAvailableMessage: readString(record, 'updateAvailableMessage', DEFAULT_PWA_SETTINGS.updateAvailableMessage),
    updateButtonLabel: readString(record, 'updateButtonLabel', DEFAULT_PWA_SETTINGS.updateButtonLabel),
  };
};
