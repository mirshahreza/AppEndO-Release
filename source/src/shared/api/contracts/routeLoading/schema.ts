import { z } from 'zod';

export const ROUTE_LOADING_SCHEMA_VERSION = 1 as const;

export const routeLoadingLogoSizeSchema = z.enum(['compact', 'default', 'large', 'xlarge']);
export type RouteLoadingLogoSize = z.infer<typeof routeLoadingLogoSizeSchema>;

export const routeLoadingProgressStyleSchema = z.enum(['ecg', 'simple-line', 'none']);
export type RouteLoadingProgressStyle = z.infer<typeof routeLoadingProgressStyleSchema>;

export const routeLoadingStackOrderSchema = z.enum(['logo-first', 'activity-first']);
export type RouteLoadingStackOrder = z.infer<typeof routeLoadingStackOrderSchema>;

export const routeLoadingVariantOverridesSchema = z.object({
  showLogo: z.boolean().optional(),
  logoSize: routeLoadingLogoSizeSchema.optional(),
  logoGlow: z.boolean().optional(),
  logoBreathe: z.boolean().optional(),
  stackOrder: routeLoadingStackOrderSchema.optional(),
  progressStyle: routeLoadingProgressStyleSchema.optional(),
  stackGapRem: z.number().min(0).max(4).optional(),
});

export type RouteLoadingVariantOverrides = z.infer<typeof routeLoadingVariantOverridesSchema>;

export const platformRouteLoadingConfigSchema = z.object({
  version: z.literal(ROUTE_LOADING_SCHEMA_VERSION),
  showLogo: z.boolean(),
  logoSize: routeLoadingLogoSizeSchema,
  logoGlow: z.boolean(),
  logoBreathe: z.boolean(),
  stackOrder: routeLoadingStackOrderSchema,
  progressStyle: routeLoadingProgressStyleSchema,
  stackGapRem: z.number().min(0).max(4).optional(),
  embedded: routeLoadingVariantOverridesSchema.optional(),
});

export type PlatformRouteLoadingConfig = z.infer<typeof platformRouteLoadingConfigSchema>;

export type EffectiveRouteLoadingExperience = {
  showLogo: boolean;
  logoSize: RouteLoadingLogoSize;
  logoGlow: boolean;
  logoBreathe: boolean;
  stackOrder: RouteLoadingStackOrder;
  progressStyle: RouteLoadingProgressStyle;
  stackGapRem: number;
};
