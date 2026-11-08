import { z } from 'zod';

export const SHELL_EXPERIENCE_SCHEMA_VERSION = 1 as const;

export const sidebarCollapsePolicySchema = z.enum(['rail', 'hidden']);
export type SidebarCollapsePolicy = z.infer<typeof sidebarCollapsePolicySchema>;

export const shellLayoutWidthPreferenceSchema = z.enum(['fluid', 'bounded']);
export type ShellLayoutWidthPreference = z.infer<typeof shellLayoutWidthPreferenceSchema>;

/** Per-user override stored in USER attribute `shell_experience`. */
export const userShellExperienceSchema = z.object({
  version: z.literal(SHELL_EXPERIENCE_SCHEMA_VERSION),
  sidebarCollapsed: z.boolean().nullable().optional(),
  layoutWidth: shellLayoutWidthPreferenceSchema.nullable().optional(),
  navExpandedGroups: z.array(z.string().min(1)).nullable().optional(),
});

export type UserShellExperience = z.infer<typeof userShellExperienceSchema>;

/** Portal/mount defaults (platform blob + admin Appearance). */
export const portalShellAppearanceDefaultsSchema = z.object({
  version: z.literal(SHELL_EXPERIENCE_SCHEMA_VERSION),
  sidebarDefaultCollapsed: z.boolean().optional(),
  sidebarCollapsePolicy: sidebarCollapsePolicySchema.optional(),
  allowUserSidebarPreference: z.boolean().optional(),
  /** Expanded sidebar width (px) for this portal mount. Collapsed rail stays 81px. */
  sidebarExpandedWidthPx: z.number().int().min(220).max(360).optional(),
  layoutWidth: shellLayoutWidthPreferenceSchema.optional(),
  layoutWidthUserControl: z.boolean().optional(),
});

export type PortalShellAppearanceDefaults = z.infer<typeof portalShellAppearanceDefaultsSchema>;

export const portalAppearanceDefaultsBlobSchema = z.object({
  version: z.literal(SHELL_EXPERIENCE_SCHEMA_VERSION),
  mounts: z.record(z.string(), portalShellAppearanceDefaultsSchema),
});

export type PortalAppearanceDefaultsBlob = z.infer<typeof portalAppearanceDefaultsBlobSchema>;

export const appearanceSessionResponseSchema = z.object({
  success: z.literal(true),
  mountId: z.string(),
  portalDefaults: portalShellAppearanceDefaultsSchema,
  userExperience: userShellExperienceSchema.nullable(),
  effective: z.object({
    sidebarCollapsed: z.boolean(),
    sidebarCollapsePolicy: sidebarCollapsePolicySchema,
    allowUserSidebarPreference: z.boolean(),
    sidebarExpandedWidthPx: z.number().int().min(220).max(360),
    layoutWidth: shellLayoutWidthPreferenceSchema,
    layoutWidthUserControl: z.boolean(),
    navExpandedGroups: z.array(z.string()),
  }),
  isAdmin: z.boolean(),
});

export type AppearanceSessionResponse = z.infer<typeof appearanceSessionResponseSchema>;
