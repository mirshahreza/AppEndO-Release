import type { LucideIcon } from 'lucide-react';
import type { NavigationItemRegion } from '../../shared/api/contracts/platform/navigation';
import type { PlatformRouteBindingMinViewport } from '../../shared/api/contracts/platform/types';
import type { AdminNavSeparatorOptions } from './nav/navSeparatorOptions';

export type AdminShellNavItem = {
  icon?: string;
  pageKey?: string;
  label?: string;
  /** Optional rail label when the sidebar is collapsed; falls back to the last 6 graphemes of `label`. */
  collapsedLabel?: string;
  description?: string;
  path?: string;
  color?: string;
  labelColor?: string;
  iconColor?: string;
  isCore?: boolean;
  isPlugin?: boolean;
  minViewport?: PlatformRouteBindingMinViewport;
  type?: 'separator';
  separatorOptions?: AdminNavSeparatorOptions;
  /** Shell chrome location. Omitted = main sidebar tree. */
  region?: NavigationItemRegion;
  children?: AdminShellNavItem[];
};

export type AdminShellNavGroup = {
  heading: string | null;
  icon?: string;
  /** Optional rail label when the sidebar is collapsed; falls back to the last 6 graphemes of the group heading. */
  collapsedLabel?: string;
  items: AdminShellNavItem[];
};

export type MenuJsonItem = {
  icon?: string;
  label?: string;
  description?: string;
  path?: string;
  color?: string;
  isCore?: boolean;
  type?: 'separator';
  separatorOptions?: AdminNavSeparatorOptions;
  children?: MenuJsonItem[];
};

export type MenuJsonGroup = {
  heading?: string | null;
  icon?: string;
  items: MenuJsonItem[];
};

// Legacy alias kept for header/module surfaces that still import LucideIcon.
export type { LucideIcon };
