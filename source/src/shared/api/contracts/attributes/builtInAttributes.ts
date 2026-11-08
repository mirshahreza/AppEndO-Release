/** Canonical keys for system-owned settings attributes (seeded, non-deletable). */
export const BUILTIN_USER_ATTRIBUTE_KEYS = {
  accentTheme: 'accent_theme',
  themePresets: 'theme_presets',
  shellExperience: 'shell_experience',
  gridColumnLayouts: 'grid_column_layouts',
  dashboardLayout: 'dashboard_layout',
} as const;

export type BuiltinUserAttributeKey = typeof BUILTIN_USER_ATTRIBUTE_KEYS[keyof typeof BUILTIN_USER_ATTRIBUTE_KEYS];

export const ACCENT_THEME_CONTEXT_KEY = 'user.accent_theme';
export const THEME_PRESETS_CONTEXT_KEY = 'user.theme_presets';
export const SHELL_EXPERIENCE_BUILTIN_CONTEXT_KEY = 'user.shell_experience';
export const GRID_COLUMN_LAYOUTS_CONTEXT_KEY = 'user.grid_column_layouts';
export const DASHBOARD_LAYOUT_CONTEXT_KEY = 'user.dashboard_layout';

/** Attributes managed by dedicated UI controls rather than the generic preferences form. */
export const UI_MANAGED_USER_ATTRIBUTE_KEYS = new Set<string>([
  BUILTIN_USER_ATTRIBUTE_KEYS.accentTheme,
  BUILTIN_USER_ATTRIBUTE_KEYS.shellExperience,
]);

/** Built-in attributes written only by system flows; never editable in admin/profile forms. */
export const SYSTEM_MANAGED_USER_ATTRIBUTE_KEYS = new Set<string>([
  BUILTIN_USER_ATTRIBUTE_KEYS.themePresets,
  BUILTIN_USER_ATTRIBUTE_KEYS.gridColumnLayouts,
  BUILTIN_USER_ATTRIBUTE_KEYS.dashboardLayout,
]);

export const isUiManagedUserAttributeKey = (key: string): boolean =>
  UI_MANAGED_USER_ATTRIBUTE_KEYS.has(key);

export const isSystemManagedUserAttributeKey = (key: string): boolean =>
  SYSTEM_MANAGED_USER_ATTRIBUTE_KEYS.has(key);

export const isBuiltinSettingsAttribute = (record: { is_builtin?: boolean }): boolean =>
  Boolean(record.is_builtin);
