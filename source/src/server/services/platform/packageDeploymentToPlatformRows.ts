import { createHash } from 'crypto';
import type {
  PlatformMount,
  PlatformPageModule,
  PlatformRouteBinding,
  PlatformShell,
  PlatformShellRule,
} from '../../../shared/api/contracts/platform/types';
import type {
  ExtensionUiRoutesDeploymentApplied,
  PackageDeploymentApplied,
  VerticalAppDeploymentApplied,
} from '../../../shared/api/contracts/package-manifest/deploymentApplied';
import {
  isExtensionUiRoutesDeploymentApplied,
  isVerticalAppDeploymentApplied,
} from '../../../shared/api/contracts/package-manifest/deploymentApplied';
import {
  buildPackagePageLoaderRef,
  buildPackageShellLoaderRef,
} from '../../../shared/api/contracts/package-manifest/verticalApp';
import { listDeploymentAppliedRecords } from '../../../core/packages/PackageFileStore';
import { packageStudioSidebarChrome } from '../../../shared/lib/packageStudioSidebar';

export type PluginDeploymentPlatformRows = {
  mounts: PlatformMount[];
  shells: PlatformShell[];
  shellRules: PlatformShellRule[];
  pageModules: PlatformPageModule[];
  bindings: PlatformRouteBinding[];
};

function normalizeRoutePattern(value: string): string {
  return String(value || '').trim().replace(/^\/+/, '');
}

function syntheticId(seed: string): number {
  const hash = createHash('sha256').update(seed).digest();
  const num = hash.readInt32BE(0);
  return num === 0 ? -1 : -Math.abs(num);
}

function deploymentTimestamp(applied: PackageDeploymentApplied): string {
  return applied.appliedAt;
}

function verticalAppRows(applied: VerticalAppDeploymentApplied): PluginDeploymentPlatformRows {
  const { packageId, version, deployment, capabilities } = applied;
  const appliedAt = deploymentTimestamp(applied);
  const source = `package:${packageId}`;

  const shells: PlatformShell[] = [
    {
      shellKey: capabilities.shell.key,
      name: capabilities.shell.name,
      entry: buildPackageShellLoaderRef(packageId),
      surface: capabilities.shell.surface,
      enabled: true,
      ownerPackageId: packageId,
      ownerPluginVersion: version,
      source,
      createdAt: appliedAt,
      updatedAt: appliedAt,
    },
  ];

  const pageModules: PlatformPageModule[] = [];
  for (const page of capabilities.pages ?? []) {
    pageModules.push({
      pageKey: page.pageKey,
      title: page.title,
      loaderKind: 'package',
      loaderRef: buildPackagePageLoaderRef(packageId, page.pageKey),
      defaultRoles: page.defaultRoles ?? null,
      enabled: true,
      ownerPackageId: packageId,
      ownerPluginVersion: version,
      source,
      createdAt: appliedAt,
      updatedAt: appliedAt,
    });
  }
  for (const layout of capabilities.designer_layouts ?? []) {
    pageModules.push({
      pageKey: layout.slug,
      title: layout.title,
      loaderKind: 'designer',
      loaderRef: layout.slug,
      enabled: true,
      ownerPackageId: packageId,
      ownerPluginVersion: version,
      source,
      createdAt: appliedAt,
      updatedAt: appliedAt,
    });
  }

  const mounts: PlatformMount[] = applied.includeMount
    ? [
        {
          id: deployment.mount.id,
          pathPrefix: deployment.mount.pathPrefix,
          name: deployment.mount.name,
          enabled: true,
          defaultRoute: deployment.mount.defaultRoute,
          designerRoutePropagation: 'none',
          authProfile: deployment.mount.authProfile ?? {},
          experienceConfig: deployment.mount.experienceConfig ?? null,
          ownerPackageId: packageId,
          ownerPluginVersion: version,
          source,
          createdAt: appliedAt,
          updatedAt: appliedAt,
        },
      ]
    : [];

  const shellRules: PlatformShellRule[] = [
    {
      id: syntheticId(`${packageId}:shell-rule:${deployment.mount.id}:${deployment.shellRule.pathPrefix}`),
      mountId: deployment.mount.id,
      pathPrefix: deployment.shellRule.pathPrefix,
      shellKey: deployment.shellRule.shellKey,
      priority: deployment.shellRule.priority ?? 0,
      enabled: true,
      ownerPackageId: packageId,
      ownerPluginVersion: version,
      source,
      createdAt: appliedAt,
      updatedAt: appliedAt,
    },
  ];

  const bindings: PlatformRouteBinding[] = deployment.routes.map((route) => ({
    id: syntheticId(`${packageId}:route:${deployment.mount.id}:${normalizeRoutePattern(route.routePattern)}`),
    mountId: deployment.mount.id,
    routePattern: normalizeRoutePattern(route.routePattern),
    pageKey: route.pageKey,
    enabled: true,
    auth: route.auth ?? null,
    nav: route.nav ?? null,
    ownerPackageId: packageId,
    ownerPluginVersion: version,
    source,
    createdAt: appliedAt,
    updatedAt: appliedAt,
  }));

  return { mounts, shells, shellRules, pageModules, bindings };
}

function extensionUiRoutesRows(applied: ExtensionUiRoutesDeploymentApplied): PluginDeploymentPlatformRows {
  const { packageId, version, routes } = applied;
  const appliedAt = deploymentTimestamp(applied);
  const source = `package:${packageId}`;

  const pageModules: PlatformPageModule[] = routes.map((route) => {
    const chrome = packageStudioSidebarChrome(route.pageKey);
    return {
      pageKey: route.pageKey,
      title: chrome?.label ?? route.title,
      loaderKind: 'package',
      loaderRef: route.loaderRef,
      defaultRoles: ['admin'],
      enabled: true,
      ownerPackageId: packageId,
      ownerPluginVersion: version,
      source,
      createdAt: appliedAt,
      updatedAt: appliedAt,
    };
  });

  const bindings: PlatformRouteBinding[] = routes.map((route) => {
    const chrome = packageStudioSidebarChrome(route.pageKey);
    const routePattern = normalizeRoutePattern(chrome?.routePattern ?? route.routePattern);
    return {
      id: syntheticId(`${packageId}:route:${route.mountId}:${routePattern}`),
      mountId: route.mountId,
      routePattern,
      pageKey: route.pageKey,
      enabled: true,
      auth: { accessMode: 'specific', allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] },
      nav: {
        label: chrome?.label ?? route.title,
        icon: chrome?.icon ?? 'Puzzle',
        group: chrome?.group ?? 'Plugins',
        order: 90,
      },
      ownerPackageId: packageId,
      ownerPluginVersion: version,
      source,
      createdAt: appliedAt,
      updatedAt: appliedAt,
    };
  });

  return {
    mounts: [],
    shells: [],
    shellRules: [],
    pageModules,
    bindings,
  };
}

export function deploymentAppliedToPlatformRows(
  applied: PackageDeploymentApplied,
): PluginDeploymentPlatformRows {
  if (isVerticalAppDeploymentApplied(applied)) {
    return verticalAppRows(applied);
  }
  if (isExtensionUiRoutesDeploymentApplied(applied)) {
    return extensionUiRoutesRows(applied);
  }
  return { mounts: [], shells: [], shellRules: [], pageModules: [], bindings: [] };
}

export function mergeDeploymentPlatformRows(
  base: PluginDeploymentPlatformRows,
  overlay: PluginDeploymentPlatformRows,
): PluginDeploymentPlatformRows {
  const mountIds = new Set(base.mounts.map((item) => item.id));
  const shellKeys = new Set(base.shells.map((item) => item.shellKey));
  const pageKeys = new Set(base.pageModules.map((item) => item.pageKey));
  const shellRuleKeys = new Set(
    base.shellRules.map((item) => `${item.mountId}::${item.pathPrefix}::${item.shellKey}`),
  );
  const bindingKeys = new Set(
    base.bindings.map((item) => `${item.mountId}::${item.routePattern}`),
  );

  return {
    mounts: [
      ...base.mounts,
      ...overlay.mounts.filter((item) => !mountIds.has(item.id)),
    ],
    shells: [
      ...base.shells,
      ...overlay.shells.filter((item) => !shellKeys.has(item.shellKey)),
    ],
    shellRules: [
      ...base.shellRules,
      ...overlay.shellRules.filter(
        (item) => !shellRuleKeys.has(`${item.mountId}::${item.pathPrefix}::${item.shellKey}`),
      ),
    ],
    pageModules: (() => {
      const overlayByPageKey = new Map(overlay.pageModules.map((item) => [item.pageKey, item]));
      const baseWithoutOverlayKeys = base.pageModules.filter((item) => !overlayByPageKey.has(item.pageKey));
      return [...baseWithoutOverlayKeys, ...overlay.pageModules];
    })(),
    bindings: [
      ...base.bindings,
      ...overlay.bindings.filter(
        (item) => !bindingKeys.has(`${item.mountId}::${item.routePattern}`),
      ),
    ],
  };
}

export function loadAllDeploymentPlatformRows(): PluginDeploymentPlatformRows {
  let merged: PluginDeploymentPlatformRows = {
    mounts: [],
    shells: [],
    shellRules: [],
    pageModules: [],
    bindings: [],
  };

  for (const applied of listDeploymentAppliedRecords()) {
    merged = mergeDeploymentPlatformRows(merged, deploymentAppliedToPlatformRows(applied));
  }

  return merged;
}

export function loadDeploymentPlatformRowsForPlugin(
  packageId: string,
): PluginDeploymentPlatformRows | null {
  const applied = listDeploymentAppliedRecords().find((item) => item.packageId === packageId);
  if (!applied) return null;
  return deploymentAppliedToPlatformRows(applied);
}
