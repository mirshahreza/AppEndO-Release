import { z } from 'zod';

export const ROUTE_LOADING_SCHEMA_VERSION = 2 as const;

export const routeLoadingLogoSizeSchema = z.enum(['compact', 'default', 'large', 'xlarge']);
export type RouteLoadingLogoSize = z.infer<typeof routeLoadingLogoSizeSchema>;

export const routeLoadingVariantOverridesSchema = z.object({
  logoSize: routeLoadingLogoSizeSchema.optional(),
  logoGlow: z.boolean().optional(),
  logoBreathe: z.boolean().optional(),
  stackGapRem: z.number().min(0).max(4).optional(),
});

export type RouteLoadingVariantOverrides = z.infer<typeof routeLoadingVariantOverridesSchema>;

export const platformRouteLoadingConfigSchema = z.object({
  version: z.literal(ROUTE_LOADING_SCHEMA_VERSION),
  showLogo: z.boolean(),
  logoSize: routeLoadingLogoSizeSchema,
  logoGlow: z.boolean(),
  logoBreathe: z.boolean(),
  stackGapRem: z.number().min(0).max(4).optional(),
  embedded: routeLoadingVariantOverridesSchema.optional(),
});

export type PlatformRouteLoadingConfig = z.infer<typeof platformRouteLoadingConfigSchema>;

export type EffectiveRouteLoadingExperience = {
  showLogo: boolean;
  logoSize: RouteLoadingLogoSize;
  logoGlow: boolean;
  logoBreathe: boolean;
  stackGapRem: number;
};