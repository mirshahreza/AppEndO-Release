import { validateManifest, normalizeArtifactManifestForValidation } from '../../core/packages/PackageManifestValidator';
import { packageHasOptionalDbRecords } from '../../core/packages/packageDbObjectInstallMode';
import type { PackageBundleManifest } from '../../shared/api/contracts/package-manifest/types';
import type {
  PackageUninstallCapabilityScopeOptionKey,
  PackageUninstallRemoveScope,
  PackageUninstallScopeOptionKey,
  PackageUninstallScriptScopeOptionKey,
  ResolvedPackageUninstallRemoveScope,
} from '../../shared/api/contracts/package/uninstall';
import {
  DEFAULT_PACKAGE_UNINSTALL_REMOVE_SCOPE,
  PACKAGE_UNINSTALL_SCOPE_HINTS,
  PACKAGE_UNINSTALL_SCOPE_LABELS,
  PACKAGE_UNINSTALL_SCRIPT_SCOPE_OPTION_KEYS,
  resolvePackageUninstallRemoveScope,
} from '../../shared/api/contracts/package/uninstall';
import { formatDisplayDateYmd } from '../../shared/lib/gridDateFormat';
import { maxSemver } from '../../shared/lib/semver';
import type { PackageRow } from './types';

import {
  DEFAULT_PACKAGE_INSTALL_OVERRIDE_POLICY,
  type InstallPackagePayload,
} from '../../shared/api/contracts/package-manifest/types';

export const PACKAGE_INSTALL_OVERRIDE_POLICY: InstallPackagePayload['overridePolicy'] =
  DEFAULT_PACKAGE_INSTALL_OVERRIDE_POLICY;

export const formatGridDate = (value?: string | null) => formatDisplayDateYmd(value, '--');

export const validateManifestPreview = (manifest: unknown): string[] => {
  if (!manifest) return ['package.json was not found or could not be parsed.'];
  const result = validateManifest(normalizeArtifactManifestForValidation(manifest));
  return result.errors;
};

export const filterPackageRowsByVersionVisibility = (
  rows: PackageRow[],
  showOlderVersions: boolean,
): PackageRow[] => {
  if (showOlderVersions) return rows;

  const versionsByPackage = new Map<string, string[]>();
  for (const row of rows) {
    const versions = versionsByPackage.get(row.packageId) ?? [];
    versions.push(row.version);
    versionsByPackage.set(row.packageId, versions);
  }

  const latestByPackage = new Map<string, string>();
  for (const [packageId, versions] of versionsByPackage) {
    const latest = maxSemver(versions);
    if (latest) latestByPackage.set(packageId, latest);
  }

  return rows.filter((row) => {
    const latest = latestByPackage.get(row.packageId);
    return !latest || row.version === latest;
  });
};

export const isPackageVersionSwitch = (
  row: Pick<PackageRow, 'installStatus' | 'activeInstalledVersion' | 'version'>,
): boolean => (
  row.installStatus === 'not_installed'
  && Boolean(row.activeInstalledVersion)
  && row.activeInstalledVersion !== row.version
);

export type PackageUninstallSqlHints = {
  uninstallSql?: string | null;
};

export const packageHasOptionalRecords = (
  manifest: PackageBundleManifest | null | undefined,
): boolean => packageHasOptionalDbRecords(manifest);

export const packageHasInstallScripts = (
  manifest: PackageBundleManifest | null | undefined,
): boolean => {
  const dbObjects = manifest?.capabilities?.db_objects;
  if (!Array.isArray(dbObjects)) return false;
  return dbObjects.some(
    (obj) => typeof obj.installScript === 'string' && obj.installScript.trim().length > 0,
  );
};

export const packageHasUninstallScripts = (
  manifest: PackageBundleManifest | null | undefined,
  uninstallSql?: string | null,
): boolean => {
  if (typeof uninstallSql === 'string' && uninstallSql.trim().length > 0) {
    return true;
  }
  const dbObjects = manifest?.capabilities?.db_objects;
  if (!Array.isArray(dbObjects)) return false;
  return dbObjects.some(
    (obj) => typeof obj.uninstallScript === 'string' && obj.uninstallScript.trim().length > 0,
  );
};

export const packageHasPortalNavCapabilities = (
  manifest: PackageBundleManifest | null | undefined,
): boolean => {
  const capabilities = manifest?.capabilities as
    | {
        portals?: unknown[];
        navigations?: unknown[];
        navigation_patches?: unknown[];
        home_portal?: unknown;
      }
    | undefined;
  const portals = capabilities?.portals;
  const navigations = capabilities?.navigations;
  const navigationPatches = capabilities?.navigation_patches;
  return (Array.isArray(portals) && portals.length > 0)
    || (Array.isArray(navigations) && navigations.length > 0)
    || (Array.isArray(navigationPatches) && navigationPatches.length > 0)
    || Boolean(capabilities?.home_portal);
};

type ManifestCapabilitiesWithUiRoutes = PackageBundleManifest['capabilities'] & {
  ui_routes?: Array<{ pageKey: string; entry: string }>;
};

export type PackageUninstallScopeContext = {
  pluginKind?: 'extension' | 'vertical-app' | null;
  deploymentStatus?: 'none' | 'pending' | 'applied';
};

export const packageHasUiRoutes = (
  manifest: PackageBundleManifest | null | undefined,
): boolean => {
  const capabilities = manifest?.capabilities as ManifestCapabilitiesWithUiRoutes | undefined;
  return (capabilities?.ui_routes?.length ?? 0) > 0;
};

type ManifestCapabilitiesWithEdgeData = PackageBundleManifest['capabilities'] & {
  edge_models?: Array<{ id: string; entry: string }>;
  edge_apis?: Array<{ id: string; edgeModelId: string; entry: string }>;
};

/** Edge models/APIs share the "files" uninstall gate — no dedicated scope toggle (see packageUninstallScope.service.ts). */
export const packageHasEdgeData = (
  manifest: PackageBundleManifest | null | undefined,
): boolean => {
  const capabilities = manifest?.capabilities as ManifestCapabilitiesWithEdgeData | undefined;
  return (capabilities?.edge_models?.length ?? 0) > 0 || (capabilities?.edge_apis?.length ?? 0) > 0;
};

export const packageHasUninstallFileScope = (
  manifest: PackageBundleManifest | null | undefined,
  context?: PackageUninstallScopeContext,
): boolean => {
  if (packageHasUiRoutes(manifest)) return true;
  if (packageHasEdgeData(manifest)) return true;
  if (context?.pluginKind === 'vertical-app') return true;
  return context?.deploymentStatus === 'pending' || context?.deploymentStatus === 'applied';
};

export function buildDefaultPackageUninstallRemoveScope(
  manifest?: PackageBundleManifest | null,
  context?: PackageUninstallScopeContext,
  sqlHints?: PackageUninstallSqlHints,
): ResolvedPackageUninstallRemoveScope {
  if (!manifest) {
    return { ...DEFAULT_PACKAGE_UNINSTALL_REMOVE_SCOPE };
  }

  const visible = listVisiblePackageUninstallScopeOptions(manifest, context, sqlHints);
  const scope = { ...DEFAULT_PACKAGE_UNINSTALL_REMOVE_SCOPE };
  for (const key of Object.keys(scope) as PackageUninstallScopeOptionKey[]) {
    if (!visible.includes(key)) {
      scope[key] = false;
    }
  }
  if (visible.includes('runDbUninstallScripts')) {
    scope.runDbUninstallScripts = packageHasUninstallScripts(manifest, sqlHints?.uninstallSql);
  }
  return scope;
}

/** Wizard-aligned order: Portal → Server Functions → Client Components → deployment/runtime. */
export function listVisiblePackageUninstallCapabilityOptions(
  manifest: PackageBundleManifest | null | undefined,
  context?: PackageUninstallScopeContext,
): PackageUninstallCapabilityScopeOptionKey[] {
  if (!manifest) return [];

  const options: PackageUninstallCapabilityScopeOptionKey[] = [];

  if (packageHasPortalNavCapabilities(manifest)) {
    options.push('portal_nav');
  }
  if ((manifest.capabilities?.apis?.length ?? 0) > 0) {
    options.push('apis');
  }
  if ((manifest.capabilities?.ui_components?.length ?? 0) > 0) {
    options.push('ui_components');
  }
  if (packageHasUninstallFileScope(manifest, context)) {
    options.push('files');
  }

  return options;
}

/** Uninstall Scripts (always shown when manifest is available). */
export function listVisiblePackageUninstallScriptOptions(
  manifest: PackageBundleManifest | null | undefined,
): PackageUninstallScriptScopeOptionKey[] {
  if (!manifest) return [];
  return [...PACKAGE_UNINSTALL_SCRIPT_SCOPE_OPTION_KEYS];
}

export function isPackageUninstallScriptOptionRunnable(
  manifest: PackageBundleManifest | null | undefined,
  sqlHints?: PackageUninstallSqlHints,
): boolean {
  return packageHasUninstallScripts(manifest, sqlHints?.uninstallSql);
}

export function listVisiblePackageUninstallScopeOptions(
  manifest: PackageBundleManifest | null | undefined,
  context?: PackageUninstallScopeContext,
  _sqlHints?: PackageUninstallSqlHints,
): PackageUninstallScopeOptionKey[] {
  return [
    ...listVisiblePackageUninstallCapabilityOptions(manifest, context),
    ...listVisiblePackageUninstallScriptOptions(manifest),
  ];
}

export function resolvePackageUninstallScopeLabel(
  key: PackageUninstallScopeOptionKey,
  manifest?: PackageBundleManifest | null,
  context?: PackageUninstallScopeContext,
): string {
  if (key === 'files') {
    const hasUiRoutes = packageHasUiRoutes(manifest);
    const hasEdgeData = packageHasEdgeData(manifest);
    if (hasUiRoutes && hasEdgeData) return 'UI routes & Edge data';
    if (hasEdgeData) return 'Edge data';
    if (hasUiRoutes) return 'UI routes';
    if (context?.pluginKind === 'vertical-app') return 'App runtime';
    return PACKAGE_UNINSTALL_SCOPE_LABELS.files;
  }
  return PACKAGE_UNINSTALL_SCOPE_LABELS[key];
}

export function resolvePackageUninstallScopeHint(
  key: PackageUninstallScopeOptionKey,
  manifest?: PackageBundleManifest | null,
  context?: PackageUninstallScopeContext,
  sqlHints?: PackageUninstallSqlHints,
): string {
  if (key === 'runDbUninstallScripts'
    && !packageHasUninstallScripts(manifest, sqlHints?.uninstallSql)) {
    return 'This package does not include uninstall SQL scripts.';
  }
  if (key === 'files') {
    const hasUiRoutes = packageHasUiRoutes(manifest);
    const hasEdgeData = packageHasEdgeData(manifest);
    if (hasUiRoutes && hasEdgeData) {
      return 'Removes extension UI route sources, edge models/APIs (and their generated Data API functions), and rolls back pending or applied route deployments.';
    }
    if (hasEdgeData) {
      return 'Removes this package’s edge models/APIs (and their generated Data API functions) from Data Studio.';
    }
    if (hasUiRoutes) {
      return 'Removes extension UI route sources and rolls back pending or applied route deployments.';
    }
    if (context?.pluginKind === 'vertical-app') {
      return 'Removes vertical-app pages, shell, layouts, static assets, and related runtime files.';
    }
    return PACKAGE_UNINSTALL_SCOPE_HINTS.files;
  }
  return PACKAGE_UNINSTALL_SCOPE_HINTS[key];
}

export function resolvePackageUninstallScopeForSubmit(
  scope: PackageUninstallRemoveScope,
  manifest?: PackageBundleManifest | null,
  context?: PackageUninstallScopeContext,
  sqlHints?: PackageUninstallSqlHints,
): ResolvedPackageUninstallRemoveScope {
  const resolved = resolvePackageUninstallRemoveScope(scope);
  if (!manifest) return resolved;

  const visible = new Set(listVisiblePackageUninstallScopeOptions(manifest, context, sqlHints));
  for (const key of Object.keys(resolved) as PackageUninstallScopeOptionKey[]) {
    if (!visible.has(key)) {
      resolved[key] = false;
    }
  }
  if (!packageHasUninstallScripts(manifest, sqlHints?.uninstallSql)) {
    resolved.runDbUninstallScripts = false;
  }
  return resolved;
}

const PACKAGE_ERROR_TOAST_DETAIL_LIMIT = 4;

function pushUniqueErrorLines(target: string[], seen: Set<string>, value: unknown): void {
  if (typeof value !== 'string') {
    if (value == null) return;
    pushUniqueErrorLines(target, seen, String(value));
    return;
  }
  for (const part of value.split(/\r?\n/)) {
    const trimmed = part.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    target.push(trimmed);
  }
}

export function readPackageFailureLines(err: unknown, fallback: string): string[] {
  const error = err as Error & { details?: unknown; cause?: unknown };
  const lines: string[] = [];
  const seen = new Set<string>();
  pushUniqueErrorLines(lines, seen, (error.message || fallback).trim() || fallback);

  if (Array.isArray(error.details)) {
    for (const item of error.details) {
      pushUniqueErrorLines(lines, seen, item);
    }
  }

  let cause = error.cause;
  for (let depth = 0; cause && depth < 4; depth += 1) {
    if (cause instanceof Error) {
      pushUniqueErrorLines(lines, seen, cause.message);
      cause = (cause as Error & { cause?: unknown }).cause;
      continue;
    }
    if (typeof cause === 'string') {
      pushUniqueErrorLines(lines, seen, cause);
    }
    break;
  }

  return lines.length > 0 ? lines : [fallback];
}

export function formatPackageFailureToastText(lines: string[]): string {
  if (lines.length <= PACKAGE_ERROR_TOAST_DETAIL_LIMIT + 1) {
    return lines.join('\n');
  }
  const shown = lines.slice(0, PACKAGE_ERROR_TOAST_DETAIL_LIMIT + 1);
  const hidden = lines.length - shown.length;
  return `${shown.join('\n')}\n… and ${hidden} more in the dialog.`;
}
