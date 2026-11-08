/** Sidebar nav rule styling (between menu items). */
export type AdminNavSeparatorEdgeStyle = 'inset' | 'outset';

/** Sidebar nav rule styling (between menu items). */
export type AdminNavSeparatorOptions = {
  /** Border thickness in px. Default 2. */
  thicknessPx?: number;
  /** Inset (narrower rule) vs full-bleed outset. Default inset. */
  edgeStyle?: AdminNavSeparatorEdgeStyle;
  /** @deprecated Prefer `edgeStyle`. When false, same as `edgeStyle: 'outset'`. */
  inset?: boolean;
  /** CSS color for the rule. Default uses `--admin-nav-separator-color`. */
  color?: string;
};

export const DEFAULT_ADMIN_NAV_SEPARATOR_OPTIONS: Required<
  Pick<AdminNavSeparatorOptions, 'thicknessPx' | 'color'>
> & {
  edgeStyle: AdminNavSeparatorEdgeStyle;
} = {
  thicknessPx: 2,
  edgeStyle: 'inset',
  color: 'var(--admin-nav-separator-color)',
};

export const resolveAdminNavSeparatorEdgeStyle = (
  options?: AdminNavSeparatorOptions,
): AdminNavSeparatorEdgeStyle => {
  if (options?.edgeStyle) {
    return options.edgeStyle;
  }
  if (options?.inset === false) {
    return 'outset';
  }
  return DEFAULT_ADMIN_NAV_SEPARATOR_OPTIONS.edgeStyle;
};

export const createAdminNavSeparatorItem = (
  options?: AdminNavSeparatorOptions,
): {
  type: 'separator';
  label: string;
  separatorOptions: AdminNavSeparatorOptions;
} => ({
  type: 'separator',
  label: 'separator',
  separatorOptions: {
    ...DEFAULT_ADMIN_NAV_SEPARATOR_OPTIONS,
    ...options,
  },
});
