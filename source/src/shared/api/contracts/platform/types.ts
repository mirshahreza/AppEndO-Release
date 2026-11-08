import type { FunctionAccessControl } from '../server-functions/accessControl';
import type { HomeWidgetDefinition } from '../home-widgets';
import type { PortalBrand } from './portalBrand';

export type DesignerRoutePropagation = 'none' | 'auto';

export type MountAuthProfile = {
  requireAuth?: boolean;
  allowedRoles?: string[];
};

export type MountExperienceCalendar = 'gregorian' | 'jalali' | 'hijri' | 'hebrew';

export type MountExperienceDirection = 'rtl' | 'ltr';

export type MountExperienceConfig = {
  locale?: string;
  calendar?: MountExperienceCalendar;
  direction?: MountExperienceDirection;
  timezone?: string;
};

export type MountCultureBinding = {
  cultureId: string;
  timezoneOverride?: string;
};

export type PortalEntryMode = 'shell' | 'redirect';

export type PlatformMount = {
  id: string;
  pathPrefix: string;
  name: string;
  enabled: boolean;
  defaultRoute: string;
  themeScope?: string | null;
  designerRoutePropagation: DesignerRoutePropagation;
  authProfile: MountAuthProfile;
  /** Canonical culture pack id — resolves UI locale, direction, calendar, and translation bundle. */
  cultureId?: string;
  timezoneOverride?: string;
  experienceConfig?: MountExperienceConfig | null;
  ownerPackageId?: string | null;
  ownerPluginVersion?: string | null;
  source?: string | null;
  createdAt?: string;
  createdBy?: number | null;
  createdByUsername?: string | null;
  updatedAt?: string;
  updatedBy?: number | null;
  updatedByUsername?: string | null;
};

export type PlatformShell = {
  shellKey: string;
  name: string;
  entry: string;
  surface: string;
  enabled: boolean;
  entryMode?: PortalEntryMode | null;
  redirectToSegment?: string | null;
  /** Culture pack id used when entryMode is redirect (e.g. `/us/studio`). */
  redirectToCulture?: string | null;
  /**
   * Designer component loaderRef (`folder/name` or `folder/name@vN`) rendered for
   * unknown routes inside this portal. When null/empty, the hardcoded RouteNotFoundPage is used.
   */
  notFoundPageRef?: string | null;
  /** Per-portal identity (logo, title, about). Null/omitted uses built-in AppEnd identity. */
  brand?: PortalBrand | null;
  auth?: PlatformRouteBindingAuth | null;
  /** Navigation manifest id in platform-registry/navigation */
  navigationRef?: string | null;
  ownerPackageId?: string | null;
  ownerPluginVersion?: string | null;
  source?: string | null;
  createdAt?: string;
  createdBy?: number | null;
  createdByUsername?: string | null;
  updatedAt?: string;
  updatedBy?: number | null;
  updatedByUsername?: string | null;
};

export type PlatformPageLoaderKind = 'core' | 'designer' | 'package';

export type PlatformPageModule = {
  pageKey: string;
  title: string;
  loaderKind: PlatformPageLoaderKind;
  loaderRef: string;
  defaultRoles?: string[] | null;
  enabled: boolean;
  homeWidgets?: HomeWidgetDefinition[];
  ownerPackageId?: string | null;
  ownerPluginVersion?: string | null;
  source?: string | null;
  createdAt?: string;
  createdBy?: number | null;
  createdByUsername?: string | null;
  updatedAt?: string;
  updatedBy?: number | null;
  updatedByUsername?: string | null;
};

export type PlatformShellRule = {
  id: number;
  mountId: string;
  pathPrefix: string;
  shellKey: string;
  priority: number;
  enabled: boolean;
  ownerPackageId?: string | null;
  ownerPluginVersion?: string | null;
  source?: string | null;
  createdAt?: string;
  createdBy?: number | null;
  createdByUsername?: string | null;
  updatedAt?: string;
  updatedBy?: number | null;
  updatedByUsername?: string | null;
};

export type PlatformRouteBindingMinViewport = 'tablet' | 'desktop';

export type PlatformRouteBindingNav = {
  label: string;
  icon?: string;
  group?: string;
  order?: number;
  description?: string;
  color?: string;
  separatorBefore?: boolean;
  minViewport?: PlatformRouteBindingMinViewport;
};


export type PlatformRouteBindingAuth = FunctionAccessControl;

export type PlatformRouteBinding = {
  id: number;
  mountId: string;
  routePattern: string;
  pageKey: string;
  enabled: boolean;
  source?: string | null;
  auth?: PlatformRouteBindingAuth | null;
  nav?: PlatformRouteBindingNav | null;
  ownerPackageId?: string | null;
  ownerPluginVersion?: string | null;
  createdAt?: string;
  createdBy?: number | null;
  createdByUsername?: string | null;
  updatedAt?: string;
  updatedBy?: number | null;
  updatedByUsername?: string | null;
};

import type { NavigationManifest } from './navigation';

export type PlatformRuntimeConfig = {
  mounts: PlatformMount[];
  shells: PlatformShell[];
  shellRules: PlatformShellRule[];
  pageModules: PlatformPageModule[];
  bindings: PlatformRouteBinding[];
  navigations: NavigationManifest[];
  version: string;
};

export type CreatePlatformMountPayload = {
  id: string;
  pathPrefix: string;
  name: string;
  enabled?: boolean;
  defaultRoute: string;
  themeScope?: string | null;
  designerRoutePropagation?: DesignerRoutePropagation;
  authProfile?: MountAuthProfile;
  cultureId?: string;
  timezoneOverride?: string;
  experienceConfig?: MountExperienceConfig | null;
  source?: string | null;
};

export type UpdatePlatformMountPayload = Partial<Omit<CreatePlatformMountPayload, 'id'>>;

export type CreatePlatformShellPayload = {
  shellKey: string;
  name: string;
  entry: string;
  surface: string;
  enabled?: boolean;
  navigationRef?: string | null;
  source?: string | null;
};

export type UpdatePlatformShellPayload = Partial<Omit<CreatePlatformShellPayload, 'shellKey'>>;

export type CreatePlatformPageModulePayload = {
  pageKey: string;
  title: string;
  loaderKind: PlatformPageLoaderKind;
  loaderRef: string;
  defaultRoles?: string[] | null;
  enabled?: boolean;
  homeWidgets?: HomeWidgetDefinition[];
  source?: string | null;
};

export type UpdatePlatformPageModulePayload = Partial<Omit<CreatePlatformPageModulePayload, 'pageKey'>>;

export type CreatePlatformShellRulePayload = {
  mountId: string;
  pathPrefix: string;
  shellKey: string;
  priority?: number;
  enabled?: boolean;
  source?: string | null;
};

export type UpdatePlatformShellRulePayload = Partial<Omit<CreatePlatformShellRulePayload, 'mountId'>>;

export type CreatePlatformRouteBindingPayload = {
  mountId: string;
  routePattern: string;
  pageKey: string;
  enabled?: boolean;
  source?: string | null;
  auth?: PlatformRouteBindingAuth | null;
  nav?: PlatformRouteBindingNav | null;
};

export type UpdatePlatformRouteBindingPayload = Partial<Omit<CreatePlatformRouteBindingPayload, 'mountId'>>;
