import {
  APPENDO_BRAND_ASSET_ROOT,
  APPENDO_LOGO_SRC,
} from '../../../../config/appendoBrandAssets';

/** Per-portal identity shown in chrome, about, and loading surfaces. */

export type PortalBrand = {
  /** Public image URL. Empty/null uses the built-in AppEnd mark. */
  logoUrl?: string | null;
  /** Product title (chrome, logo alt). Empty uses AppEnd. */
  title?: string | null;
  /** Browser tab prefix; empty uses {@link PortalBrand.title}. */
  windowTitle?: string | null;
  /** About dialog headline. Empty uses the built-in AppEnd headline. */
  aboutTitle?: string | null;
  /** About dialog body. Empty uses the built-in AppEnd about copy. */
  aboutBody?: string | null;
};

export const PORTAL_BRAND_TITLE_MAX = 80;
export const PORTAL_BRAND_ABOUT_TITLE_MAX = 160;
export const PORTAL_BRAND_ABOUT_BODY_MAX = 8000;
export const PORTAL_BRAND_LOGO_URL_MAX = 500;

/** Built-in product title — used when a portal has not set `title`. */
export const DEFAULT_PORTAL_TITLE = 'AppEnd';

/** Built-in logo — used when a portal has not uploaded a custom mark. */
export const DEFAULT_PORTAL_LOGO_URL = APPENDO_LOGO_SRC;

/** Built-in About headline — used when a portal has not set `aboutTitle`. */
export const DEFAULT_PORTAL_ABOUT_TITLE =
  'AI-Assisted Framework for Rapid Application Development';

/** Built-in About body — used when a portal has not set `aboutBody`. */
export const DEFAULT_PORTAL_ABOUT_BODY =
  'AppEnd is a purpose-built administrative workspace designed for speed, modularity, and AI-native workflows. It serves as the definitive core for managing enterprise distributions through a clean, high-performance interface.';

export function defaultPortalBrand(): PortalBrand {
  return {
    logoUrl: DEFAULT_PORTAL_LOGO_URL,
    title: DEFAULT_PORTAL_TITLE,
    aboutTitle: DEFAULT_PORTAL_ABOUT_TITLE,
    aboutBody: DEFAULT_PORTAL_ABOUT_BODY,
  };
}

/** Fill empty identity fields so the Identity form and About dialog never go blank. */
export function withPortalBrandDefaults(brand: PortalBrand | null | undefined): PortalBrand {
  const windowTitle = brand?.windowTitle?.trim();
  return {
    logoUrl: brand?.logoUrl?.trim() || DEFAULT_PORTAL_LOGO_URL,
    title: brand?.title?.trim() || DEFAULT_PORTAL_TITLE,
    ...(windowTitle ? { windowTitle } : {}),
    aboutTitle: brand?.aboutTitle?.trim() || DEFAULT_PORTAL_ABOUT_TITLE,
    aboutBody: brand?.aboutBody?.trim() || DEFAULT_PORTAL_ABOUT_BODY,
  };
}

const PORTAL_BRAND_LOGO_PATH_RE = /^\/assets\/workspace\/portals\/[a-z0-9._-]+\/logo\.[a-z0-9]+$/i;
const HWY_PUBLIC_BRAND_LOGO_PATH_RE = /^\/assets\/hawiety\/(?:[a-z0-9._-]+\/)*[a-z0-9._-]+\.(png|webp|svg|jpe?g|gif)$/i;
const HWY_INSTITUTE_LOGO_API_PATH_RE = /^\/api\/hwy\/institutes\/\d+\/logo$/i;

export function isAllowedPortalBrandLogoUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > PORTAL_BRAND_LOGO_URL_MAX) {
    return false;
  }

  const pathOnly = trimmed.split('?')[0] ?? trimmed;
  if (pathOnly.includes('..') || pathOnly.includes('//', 1) || pathOnly.includes('<')) {
    return false;
  }

  if (pathOnly === DEFAULT_PORTAL_LOGO_URL || pathOnly.startsWith(`${APPENDO_BRAND_ASSET_ROOT}/`)) {
    return true;
  }

  if (HWY_PUBLIC_BRAND_LOGO_PATH_RE.test(pathOnly)) {
    return true;
  }

  if (HWY_INSTITUTE_LOGO_API_PATH_RE.test(pathOnly)) {
    return true;
  }

  return PORTAL_BRAND_LOGO_PATH_RE.test(pathOnly);
}

function readOptionalBrandString(
  value: unknown,
  maxLength: number,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

export function normalizePortalBrand(raw: unknown): PortalBrand | null {
  if (raw == null) {
    return null;
  }

  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const item = raw as Record<string, unknown>;
  const logoRaw = readOptionalBrandString(item.logoUrl, PORTAL_BRAND_LOGO_URL_MAX);
  const logoUrl = logoRaw && isAllowedPortalBrandLogoUrl(logoRaw) ? logoRaw.split('?')[0] : null;
  const title = readOptionalBrandString(item.title, PORTAL_BRAND_TITLE_MAX) ?? null;
  const windowTitle = readOptionalBrandString(item.windowTitle, PORTAL_BRAND_TITLE_MAX) ?? null;
  const aboutTitle = readOptionalBrandString(item.aboutTitle, PORTAL_BRAND_ABOUT_TITLE_MAX) ?? null;
  const aboutBody = readOptionalBrandString(item.aboutBody, PORTAL_BRAND_ABOUT_BODY_MAX) ?? null;

  if (!logoUrl && !title && !windowTitle && !aboutTitle && !aboutBody) {
    return null;
  }

  return {
    logoUrl,
    title,
    windowTitle,
    aboutTitle,
    aboutBody,
  };
}

export function parsePortalBrandField(
  raw: unknown,
): { ok: true; brand: PortalBrand | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null) {
    return { ok: true, brand: null };
  }

  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'brand must be an object when provided.' };
  }

  const item = raw as Record<string, unknown>;
  if (item.logoUrl != null && typeof item.logoUrl !== 'string') {
    return { ok: false, error: 'brand.logoUrl must be a string when provided.' };
  }
  if (item.title != null && typeof item.title !== 'string') {
    return { ok: false, error: 'brand.title must be a string when provided.' };
  }
  if (item.windowTitle != null && typeof item.windowTitle !== 'string') {
    return { ok: false, error: 'brand.windowTitle must be a string when provided.' };
  }
  if (item.aboutTitle != null && typeof item.aboutTitle !== 'string') {
    return { ok: false, error: 'brand.aboutTitle must be a string when provided.' };
  }
  if (item.aboutBody != null && typeof item.aboutBody !== 'string') {
    return { ok: false, error: 'brand.aboutBody must be a string when provided.' };
  }

  const logoRaw = typeof item.logoUrl === 'string' ? item.logoUrl.trim() : '';
  if (logoRaw && !isAllowedPortalBrandLogoUrl(logoRaw)) {
    return { ok: false, error: 'brand.logoUrl must be a portal logo asset path or the built-in AppEnd logo.' };
  }

  if (typeof item.title === 'string' && item.title.trim().length > PORTAL_BRAND_TITLE_MAX) {
    return { ok: false, error: `brand.title must be at most ${PORTAL_BRAND_TITLE_MAX} characters.` };
  }
  if (typeof item.windowTitle === 'string' && item.windowTitle.trim().length > PORTAL_BRAND_TITLE_MAX) {
    return { ok: false, error: `brand.windowTitle must be at most ${PORTAL_BRAND_TITLE_MAX} characters.` };
  }
  if (typeof item.aboutTitle === 'string' && item.aboutTitle.trim().length > PORTAL_BRAND_ABOUT_TITLE_MAX) {
    return { ok: false, error: `brand.aboutTitle must be at most ${PORTAL_BRAND_ABOUT_TITLE_MAX} characters.` };
  }
  if (typeof item.aboutBody === 'string' && item.aboutBody.trim().length > PORTAL_BRAND_ABOUT_BODY_MAX) {
    return { ok: false, error: `brand.aboutBody must be at most ${PORTAL_BRAND_ABOUT_BODY_MAX} characters.` };
  }

  return { ok: true, brand: normalizePortalBrand(raw) };
}

export type ResolvedPortalBrand = {
  logoUrl?: string;
  title?: string;
  /** Browser tab prefix; falls back to {@link ResolvedPortalBrand.title}. */
  windowTitle?: string;
  aboutTitle?: string;
  aboutBody?: string;
  /** True when the portal persisted any identity field. Fallback names do not count. */
  hasCustomBrand?: boolean;
};

export function resolvePortalBrand(
  brand: PortalBrand | null | undefined,
  fallbackTitle?: string | null,
): ResolvedPortalBrand {
  const normalized = normalizePortalBrand(brand);
  const title = normalized?.title?.trim() || DEFAULT_PORTAL_TITLE || fallbackTitle?.trim();
  const windowTitle = normalized?.windowTitle?.trim() || title;
  const aboutTitle = normalized?.aboutTitle?.trim() || DEFAULT_PORTAL_ABOUT_TITLE;
  const aboutBody = normalized?.aboutBody?.trim() || DEFAULT_PORTAL_ABOUT_BODY;
  const logoUrl = normalized?.logoUrl?.trim() || DEFAULT_PORTAL_LOGO_URL;

  return {
    logoUrl,
    title,
    windowTitle,
    aboutTitle,
    aboutBody,
    hasCustomBrand: Boolean(normalized),
  };
}

export function portalBrandHasCustomAbout(brand: ResolvedPortalBrand | PortalBrand | null | undefined): boolean {
  if (!brand) {
    return false;
  }

  if (typeof (brand as ResolvedPortalBrand).hasCustomBrand === 'boolean') {
    return Boolean((brand as ResolvedPortalBrand).hasCustomBrand);
  }

  return Boolean(normalizePortalBrand(brand));
}
