/** Theme Designer tokens for sidebar/header frost and optional chrome textures. */

export const SIDEBAR_FILL_TOKEN_KEY = '--app-sidebar-fill-opacity';
export const HEADER_FILL_TOKEN_KEY = '--app-header-fill-opacity';
export const MENU_TEXTURE_TOKEN_KEY = '--app-menu-texture-opacity';
export const HEADER_TEXTURE_TOKEN_KEY = '--app-header-texture-opacity';

export const CHROME_OPACITY_TOKEN_KEYS = [
  SIDEBAR_FILL_TOKEN_KEY,
  HEADER_FILL_TOKEN_KEY,
  MENU_TEXTURE_TOKEN_KEY,
  HEADER_TEXTURE_TOKEN_KEY,
] as const;

export const CHROME_OPACITY_DEFAULT = '0%';

const PERCENT_TOKEN = /^(\d{1,3})%$/;

export const clampChromeOpacityPercent = (value: number): number => (
  Math.min(100, Math.max(0, Math.round(value)))
);

export const formatChromeOpacityToken = (percent: number): string => (
  `${clampChromeOpacityPercent(percent)}%`
);

export const parseChromeOpacityToken = (value: string | undefined | null): number => {
  const match = value?.trim().match(PERCENT_TOKEN);
  if (!match) {
    return 0;
  }
  return clampChromeOpacityPercent(Number.parseInt(match[1], 10));
};
