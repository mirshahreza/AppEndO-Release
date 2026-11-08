export type WebFontFileFormat = 'woff2' | 'woff' | 'ttf' | 'otf';
export type WebFontPackagePolicy = 'embed' | 'reference-only';

export const WEB_FONT_SCRIPTS = ['en', 'fa', 'ar'] as const;

export type WebFontScript = typeof WEB_FONT_SCRIPTS[number];

export function isWebFontScript(value: unknown): value is WebFontScript {
  return typeof value === 'string' && (WEB_FONT_SCRIPTS as readonly string[]).includes(value);
}

export type PlatformWebFont = {
  id: string;
  label: string;
  family: string;
  format: WebFontFileFormat;
  fileName: string;
  url: string;
  uploadedAt: string;
  script: WebFontScript;
  /** SHA-256 of the locally stored font bytes. Missing values are not package-eligible. */
  contentHash?: string;
  mime?: string;
  fileSize?: number;
  packagePolicy?: WebFontPackagePolicy;
  licenseName?: string;
  licenseUrl?: string;
  licenseNotice?: string;
};

export type PackageEligiblePlatformWebFont = PlatformWebFont & {
  contentHash: string;
  mime: string;
  fileSize: number;
  packagePolicy: WebFontPackagePolicy;
  licenseName: string;
  licenseNotice: string;
};

export type PlatformWebFontsConfig = {
  fonts: PlatformWebFont[];
};

export type PlatformWebFontsResponse = {
  success: true;
  fonts: PlatformWebFont[];
};

export type UploadPlatformWebFontPayload = {
  label: string;
  family: string;
  packagePolicy?: WebFontPackagePolicy;
  licenseName?: string;
  licenseUrl?: string;
  licenseNotice?: string;
};

export type UploadPlatformWebFontResponse = {
  success: true;
  font: PlatformWebFont;
};

export type UpdatePlatformWebFontScriptPayload = {
  script: WebFontScript;
};

export type UpdatePlatformWebFontScriptResponse = {
  success: true;
  font: PlatformWebFont;
};

export const WEB_FONT_ID_PREFIX = 'web-';

export const WEB_FONT_ID_PATTERN = /^web-[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const EMPTY_PLATFORM_WEB_FONTS_CONFIG: PlatformWebFontsConfig = {
  fonts: [],
};
