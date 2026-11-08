import {
  DEFAULT_PLATFORM_ROUTE_LOADING_CONFIG,
  ROUTE_LOADING_LOGO_SIZE_SCALE,
} from './constants';
import {
  platformRouteLoadingConfigSchema,
  routeLoadingLogoSizeSchema,
  routeLoadingProgressStyleSchema,
  routeLoadingStackOrderSchema,
  type EffectiveRouteLoadingExperience,
  type PlatformRouteLoadingConfig,
  type RouteLoadingLogoSize,
  type RouteLoadingVariantOverrides,
} from './schema';

const LOGO_SIZES = new Set(routeLoadingLogoSizeSchema.options);
const PROGRESS_STYLES = new Set(routeLoadingProgressStyleSchema.options);
const STACK_ORDERS = new Set(routeLoadingStackOrderSchema.options);

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readLogoSize(value: unknown, fallback: RouteLoadingLogoSize): RouteLoadingLogoSize {
  return typeof value === 'string' && LOGO_SIZES.has(value as RouteLoadingLogoSize)
    ? (value as RouteLoadingLogoSize)
    : fallback;
}

function readProgressStyle(
  value: unknown,
  fallback: EffectiveRouteLoadingExperience['progressStyle'],
): EffectiveRouteLoadingExperience['progressStyle'] {
  return typeof value === 'string' && PROGRESS_STYLES.has(value as EffectiveRouteLoadingExperience['progressStyle'])
    ? (value as EffectiveRouteLoadingExperience['progressStyle'])
    : fallback;
}

function readStackOrder(
  value: unknown,
  fallback: EffectiveRouteLoadingExperience['stackOrder'],
): EffectiveRouteLoadingExperience['stackOrder'] {
  return typeof value === 'string' && STACK_ORDERS.has(value as EffectiveRouteLoadingExperience['stackOrder'])
    ? (value as EffectiveRouteLoadingExperience['stackOrder'])
    : fallback;
}

function readGapRem(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(4, Math.max(0, value));
}

function normalizeVariantOverrides(raw: unknown): RouteLoadingVariantOverrides | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  const source = raw as Record<string, unknown>;
  const next: RouteLoadingVariantOverrides = {};
  if (typeof source.showLogo === 'boolean') {
    next.showLogo = source.showLogo;
  }
  if (typeof source.logoGlow === 'boolean') {
    next.logoGlow = source.logoGlow;
  }
  if (typeof source.logoBreathe === 'boolean') {
    next.logoBreathe = source.logoBreathe;
  }
  if (typeof source.logoSize === 'string' && LOGO_SIZES.has(source.logoSize as RouteLoadingLogoSize)) {
    next.logoSize = source.logoSize as RouteLoadingLogoSize;
  }
  if (typeof source.stackOrder === 'string' && STACK_ORDERS.has(source.stackOrder as EffectiveRouteLoadingExperience['stackOrder'])) {
    next.stackOrder = source.stackOrder as EffectiveRouteLoadingExperience['stackOrder'];
  }
  if (typeof source.progressStyle === 'string' && PROGRESS_STYLES.has(source.progressStyle as EffectiveRouteLoadingExperience['progressStyle'])) {
    next.progressStyle = source.progressStyle as EffectiveRouteLoadingExperience['progressStyle'];
  }
  if (typeof source.stackGapRem === 'number') {
    next.stackGapRem = readGapRem(source.stackGapRem, 1.25);
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export function normalizePlatformRouteLoadingConfig(raw: unknown): PlatformRouteLoadingConfig {
  const defaults = DEFAULT_PLATFORM_ROUTE_LOADING_CONFIG;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...defaults };
  }

  const source = raw as Record<string, unknown>;
  const merged: PlatformRouteLoadingConfig = {
    version: 1,
    showLogo: readBoolean(source.showLogo, defaults.showLogo),
    logoSize: readLogoSize(source.logoSize, defaults.logoSize),
    logoGlow: readBoolean(source.logoGlow, defaults.logoGlow),
    logoBreathe: readBoolean(source.logoBreathe, defaults.logoBreathe),
    stackOrder: readStackOrder(source.stackOrder, defaults.stackOrder),
    progressStyle: readProgressStyle(source.progressStyle, defaults.progressStyle),
    stackGapRem: typeof source.stackGapRem === 'number'
      ? readGapRem(source.stackGapRem, defaults.stackGapRem ?? 1.25)
      : defaults.stackGapRem,
    embedded: normalizeVariantOverrides(source.embedded) ?? defaults.embedded,
  };

  const parsed = platformRouteLoadingConfigSchema.safeParse(merged);
  return parsed.success ? parsed.data : { ...defaults };
}

export function resolveEffectiveRouteLoadingExperience(
  config: PlatformRouteLoadingConfig,
  variant: 'fullscreen' | 'embedded',
): EffectiveRouteLoadingExperience {
  const overrides = variant === 'embedded' ? config.embedded : undefined;
  const baseGap = config.stackGapRem ?? (variant === 'embedded' ? 0.75 : 1.25);

  return {
    showLogo: overrides?.showLogo ?? config.showLogo,
    logoSize: overrides?.logoSize ?? config.logoSize,
    logoGlow: overrides?.logoGlow ?? config.logoGlow,
    logoBreathe: overrides?.logoBreathe ?? config.logoBreathe,
    stackOrder: overrides?.stackOrder ?? config.stackOrder,
    progressStyle: overrides?.progressStyle ?? config.progressStyle,
    stackGapRem: overrides?.stackGapRem ?? baseGap,
  };
}

export function routeLoadingLogoScale(size: RouteLoadingLogoSize): number {
  return ROUTE_LOADING_LOGO_SIZE_SCALE[size] ?? 1;
}
