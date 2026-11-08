import type { PwaIconSlot } from '../../../lib/pwaAssets';

export type PwaDisplayMode = 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';

export type PwaOrientation = 'any' | 'natural' | 'portrait' | 'landscape';

export interface PwaSettings {
  enabled: boolean;
  name: string;
  shortName: string;
  description: string;
  themeColor: string;
  backgroundColor: string;
  faviconUrl: string;
  icon192Url: string;
  icon512Url: string;
  maskableIcon512Url: string;
  /** Navigation icon ref used to generate the current PWA icon set, when applicable. */
  iconSourceRef: string;
  display: PwaDisplayMode;
  orientation: PwaOrientation;
  startUrl: string;
  scope: string;
  showInstallPrompt: boolean;
  installPromptTitle: string;
  installPromptMessage: string;
  installButtonLabel: string;
  dismissButtonLabel: string;
  installReadyMessage: string;
  updateAvailableMessage: string;
  updateButtonLabel: string;
}

export const DEFAULT_PWA_SETTINGS: PwaSettings = {
  enabled: true,
  name: 'AppEndO',
  shortName: 'AppEndO',
  description: 'Extensible admin platform for building and managing portals.',
  themeColor: '#00A28A',
  backgroundColor: '#FFFFFF',
  faviconUrl: '',
  icon192Url: '',
  icon512Url: '',
  maskableIcon512Url: '',
  iconSourceRef: '',
  display: 'standalone',
  orientation: 'any',
  startUrl: '/',
  scope: '/',
  showInstallPrompt: true,
  installPromptTitle: 'Install AppEndO',
  installPromptMessage:
    'Install AppEndO on this device. Open it from your home screen with no address bar—just the app.',
  installButtonLabel: 'Install',
  dismissButtonLabel: 'Not now',
  installReadyMessage:
    'AppEndO is ready to install. Add it to your home screen to open full screen—no browser toolbar or URL bar.',
  updateAvailableMessage: 'A new version is available.',
  updateButtonLabel: 'Reload',
};

export const PWA_BUILTIN_ICON_PATHS = {
  favicon32: '/pwa-64x64.png',
  icon64: '/pwa-64x64.png',
  icon192: '/pwa-192x192.png',
  icon512: '/pwa-512x512.png',
  maskable512: '/maskable-icon-512x512.png',
} as const;

export type PwaManifestIcon = {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
};

const manifestSrc = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed) {
    return trimmed;
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

const mimeTypeFromUrl = (url: string): string => {
  const normalized = url.trim().toLowerCase();
  if (normalized.endsWith('.webp')) return 'image/webp';
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg';
  if (normalized.endsWith('.svg')) return 'image/svg+xml';
  return 'image/png';
};

const trimPwaString = (value: string | undefined): string => (
  typeof value === 'string' ? value.trim() : ''
);

export const resolvePwaFaviconUrl = (
  settings: Partial<Pick<PwaSettings, 'faviconUrl' | 'icon192Url'>>,
): string => trimPwaString(settings.faviconUrl)
  || trimPwaString(settings.icon192Url)
  || PWA_BUILTIN_ICON_PATHS.favicon32;

export const resolvePwaIcon192Url = (settings: Partial<Pick<PwaSettings, 'icon192Url'>>): string =>
  trimPwaString(settings.icon192Url) || PWA_BUILTIN_ICON_PATHS.icon192;

export const resolvePwaIcon512Url = (settings: Partial<Pick<PwaSettings, 'icon512Url'>>): string =>
  trimPwaString(settings.icon512Url) || PWA_BUILTIN_ICON_PATHS.icon512;

export const resolvePwaMaskableIcon512Url = (
  settings: Partial<Pick<PwaSettings, 'maskableIcon512Url'>>,
): string => trimPwaString(settings.maskableIcon512Url) || PWA_BUILTIN_ICON_PATHS.maskable512;

export const resolvePwaIconUrlForSlot = (
  settings: Partial<PwaSettings>,
  slot: PwaIconSlot,
): string => {
  switch (slot) {
    case '32':
      return resolvePwaFaviconUrl(settings);
    case '192':
      return resolvePwaIcon192Url(settings);
    case '512':
      return resolvePwaIcon512Url(settings);
    case 'maskable':
      return resolvePwaMaskableIcon512Url(settings);
    default:
      return resolvePwaIcon192Url(settings);
  }
};

export const buildPwaIconPreviewSrc = (
  slot: PwaIconSlot,
  settings: Partial<PwaSettings>,
  cacheBust?: string | number,
): string => {
  const resolvedUrl = resolvePwaIconUrlForSlot(settings, slot);
  const params = new URLSearchParams({ url: resolvedUrl });
  if (cacheBust != null && String(cacheBust).length > 0) {
    params.set('v', String(cacheBust));
  }
  return `/api/pwa/icons/${slot}/file?${params.toString()}`;
};

export const isAllowedPwaIconAssetUrl = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) {
    return false;
  }

  if (trimmed.startsWith('/assets/platform/pwa/')) {
    return true;
  }

  return Object.values(PWA_BUILTIN_ICON_PATHS).includes(trimmed as typeof PWA_BUILTIN_ICON_PATHS[keyof typeof PWA_BUILTIN_ICON_PATHS]);
};

export const buildPwaManifestIcons = (settings: PwaSettings): PwaManifestIcon[] => {
  const favicon = resolvePwaFaviconUrl(settings);
  const icon192 = resolvePwaIcon192Url(settings);
  const icon512 = resolvePwaIcon512Url(settings);
  const maskable512 = resolvePwaMaskableIcon512Url(settings);
  const hasCustomIcons = Boolean(
    trimPwaString(settings.faviconUrl)
    || trimPwaString(settings.icon192Url)
    || trimPwaString(settings.icon512Url)
    || trimPwaString(settings.maskableIcon512Url),
  );
  const icon64 = hasCustomIcons ? favicon : PWA_BUILTIN_ICON_PATHS.icon64;

  return [
    { src: manifestSrc(icon64), sizes: '64x64', type: mimeTypeFromUrl(icon64) },
    { src: manifestSrc(icon192), sizes: '192x192', type: mimeTypeFromUrl(icon192) },
    { src: manifestSrc(icon512), sizes: '512x512', type: mimeTypeFromUrl(icon512) },
    {
      src: manifestSrc(maskable512),
      sizes: '512x512',
      type: mimeTypeFromUrl(maskable512),
      purpose: 'maskable',
    },
  ];
};

export type PwaWebManifest = {
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  scope: string;
  display: PwaDisplayMode;
  orientation: PwaOrientation;
  theme_color: string;
  background_color: string;
  lang: string;
  icons: Array<{
    src: string;
    sizes: string;
    type: string;
    purpose?: string;
  }>;
};

export const buildPwaWebManifest = (settings: PwaSettings): PwaWebManifest => ({
  name: settings.name,
  short_name: settings.shortName,
  description: settings.description,
  start_url: settings.startUrl,
  scope: settings.scope,
  display: settings.display,
  orientation: settings.orientation,
  theme_color: settings.themeColor,
  background_color: settings.backgroundColor,
  lang: 'en',
  icons: buildPwaManifestIcons(settings).map((icon) => ({
    src: icon.src,
    sizes: icon.sizes,
    type: icon.type,
    ...(icon.purpose ? { purpose: icon.purpose } : {}),
  })),
});
