import type {
  DesignerRoutePropagation,
  MountAuthProfile,
  MountExperienceConfig,
  PlatformMount,
  PlatformPageLoaderKind,
  PlatformPageModule,
  PlatformRouteBinding,
  PlatformRouteBindingAuth,
  PlatformRouteBindingNav,
  PlatformShell,
  PlatformShellRule,
} from '../../../shared/api/contracts/platform/types';

const parseJson = <T>(value: unknown): T | null => {
  if (value == null) return null;
  if (typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return null;
};

const auditSelect = `
  row.created_at,
  row.created_by,
  creator.username AS created_by_username,
  row.updated_at,
  row.updated_by,
  updater.username AS updated_by_username
`;

const auditJoins = `
  LEFT JOIN base_users creator ON creator.id = row.created_by
  LEFT JOIN base_users updater ON updater.id = row.updated_by
`;

export const PLATFORM_AUDIT_SELECT = auditSelect;
export const PLATFORM_AUDIT_JOINS = auditJoins;

export type PlatformMountRow = {
  id: string;
  path_prefix: string;
  name: string;
  enabled: boolean;
  default_route: string;
  theme_scope: string | null;
  designer_route_propagation: DesignerRoutePropagation;
  auth_json: unknown;
  experience_config_json: unknown;
  owner_plugin_id: string | null;
  owner_plugin_version: string | null;
  source: string | null;
  created_at: string;
  created_by: number | null;
  created_by_username: string | null;
  updated_at: string;
  updated_by: number | null;
  updated_by_username: string | null;
};

export type PlatformShellRow = {
  shell_key: string;
  name: string;
  entry: string;
  surface: string;
  enabled: boolean;
  owner_plugin_id: string | null;
  owner_plugin_version: string | null;
  source: string | null;
  created_at: string;
  created_by: number | null;
  created_by_username: string | null;
  updated_at: string;
  updated_by: number | null;
  updated_by_username: string | null;
};

export type PlatformPageModuleRow = {
  page_key: string;
  title: string;
  loader_kind: PlatformPageLoaderKind;
  loader_ref: string;
  default_roles_json: unknown;
  enabled: boolean;
  owner_plugin_id: string | null;
  owner_plugin_version: string | null;
  source: string | null;
  created_at: string;
  created_by: number | null;
  created_by_username: string | null;
  updated_at: string;
  updated_by: number | null;
  updated_by_username: string | null;
};

export type PlatformShellRuleRow = {
  id: number;
  mount_id: string;
  path_prefix: string;
  shell_key: string;
  priority: number;
  enabled: boolean;
  owner_plugin_id: string | null;
  owner_plugin_version: string | null;
  source: string | null;
  created_at: string;
  created_by: number | null;
  created_by_username: string | null;
  updated_at: string;
  updated_by: number | null;
  updated_by_username: string | null;
};

export type PlatformRouteBindingRow = {
  id: number;
  mount_id: string;
  route_pattern: string;
  page_key: string;
  enabled: boolean;
  auth_json: unknown;
  nav_json: unknown;
  owner_plugin_id: string | null;
  owner_plugin_version: string | null;
  source: string | null;
  created_at: string;
  created_by: number | null;
  created_by_username: string | null;
  updated_at: string;
  updated_by: number | null;
  updated_by_username: string | null;
};

export function mapMountRow(row: PlatformMountRow): PlatformMount {
  return {
    id: row.id,
    pathPrefix: row.path_prefix,
    name: row.name,
    enabled: row.enabled,
    defaultRoute: row.default_route,
    themeScope: row.theme_scope,
    designerRoutePropagation: row.designer_route_propagation,
    authProfile: parseJson<MountAuthProfile>(row.auth_json) ?? {},
    experienceConfig: parseJson<MountExperienceConfig>(row.experience_config_json),
    ownerPackageId: row.owner_plugin_id,
    ownerPluginVersion: row.owner_plugin_version,
    source: row.source,
    createdAt: row.created_at,
    createdBy: row.created_by,
    createdByUsername: row.created_by_username,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    updatedByUsername: row.updated_by_username,
  };
}

export function mapShellRow(row: PlatformShellRow): PlatformShell {
  return {
    shellKey: row.shell_key,
    name: row.name,
    entry: row.entry,
    surface: row.surface,
    enabled: row.enabled,
    ownerPackageId: row.owner_plugin_id,
    ownerPluginVersion: row.owner_plugin_version,
    source: row.source,
    createdAt: row.created_at,
    createdBy: row.created_by,
    createdByUsername: row.created_by_username,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    updatedByUsername: row.updated_by_username,
  };
}

export function mapPageModuleRow(row: PlatformPageModuleRow): PlatformPageModule {
  return {
    pageKey: row.page_key,
    title: row.title,
    loaderKind: row.loader_kind,
    loaderRef: row.loader_ref,
    defaultRoles: parseJson<string[]>(row.default_roles_json),
    enabled: row.enabled,
    ownerPackageId: row.owner_plugin_id,
    ownerPluginVersion: row.owner_plugin_version,
    source: row.source,
    createdAt: row.created_at,
    createdBy: row.created_by,
    createdByUsername: row.created_by_username,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    updatedByUsername: row.updated_by_username,
  };
}

export function mapShellRuleRow(row: PlatformShellRuleRow): PlatformShellRule {
  return {
    id: row.id,
    mountId: row.mount_id,
    pathPrefix: row.path_prefix,
    shellKey: row.shell_key,
    priority: row.priority,
    enabled: row.enabled,
    ownerPackageId: row.owner_plugin_id,
    ownerPluginVersion: row.owner_plugin_version,
    source: row.source,
    createdAt: row.created_at,
    createdBy: row.created_by,
    createdByUsername: row.created_by_username,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    updatedByUsername: row.updated_by_username,
  };
}

export function mapRouteBindingRow(row: PlatformRouteBindingRow): PlatformRouteBinding {
  return {
    id: row.id,
    mountId: row.mount_id,
    routePattern: row.route_pattern,
    pageKey: row.page_key,
    enabled: row.enabled,
    auth: parseJson<PlatformRouteBindingAuth>(row.auth_json),
    nav: parseJson<PlatformRouteBindingNav>(row.nav_json),
    ownerPackageId: row.owner_plugin_id,
    ownerPluginVersion: row.owner_plugin_version,
    source: row.source,
    createdAt: row.created_at,
    createdBy: row.created_by,
    createdByUsername: row.created_by_username,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    updatedByUsername: row.updated_by_username,
  };
}
