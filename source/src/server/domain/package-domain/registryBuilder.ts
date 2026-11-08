import type { AnyPackageManifest, PackageManifest } from '../../../core/packages/PackageManifestValidator';
import { isVerticalAppManifest } from '../../../core/packages/PackageManifestValidator';
import type { VerticalAppManifest } from '../../../shared/api/contracts/package-manifest/verticalApp';
import type { CapabilityUiRoute } from '../../../core/packages/PackageManifestValidator';
import { buildPackageMcpGlobalId } from '../../../core/packages/mcpServerIds';
import type {
  ConflictType,
  InstallPackageOptions,
  PluginObjectRegistry,
} from './types';
import { nowIso } from './utils';

/** Vertical apps declare Studio pages under capabilities.pages; runtime lookup uses uiRoutes. */
export function verticalAppPagesAsUiRoutes(manifest: VerticalAppManifest): CapabilityUiRoute[] {
  const mountId = manifest.deployment?.mount?.id?.trim();
  const routePatternByPageKey = new Map(
    (manifest.deployment?.routes ?? []).map((route) => [route.pageKey, route.routePattern]),
  );

  return (manifest.capabilities.pages ?? []).map((page) => ({
    pageKey: page.pageKey,
    entry: page.entry,
    ...(routePatternByPageKey.has(page.pageKey)
      ? { suggestedRoutePattern: routePatternByPageKey.get(page.pageKey) }
      : {}),
    ...(mountId ? { suggestedMountId: mountId } : {}),
  }));
}

/** Mutates registry in place so vertical-app package pages resolve at `/api/packages/.../ui/...`. */
export function syncVerticalAppUiRoutesOnRegistry(
  registry: PluginObjectRegistry,
  manifest: VerticalAppManifest,
): void {
  const routes = verticalAppPagesAsUiRoutes(manifest);
  if (routes.length === 0) {
    return;
  }
  const registeredAt = nowIso();
  registry.records.uiRoutes = routes.map((route) => ({
    conflictKey: `ui_route::${route.pageKey}`,
    pageKey: route.pageKey,
    entry: route.entry,
    suggestedRoutePattern: route.suggestedRoutePattern,
    suggestedMountId: route.suggestedMountId,
    registeredAt,
  }));
  registry.updatedAt = registeredAt;
}

export function manifestApiPathToHttpPath(manifestPath: string): string {
  const normalized = manifestPath.trim();
  if (normalized.startsWith('/api/')) {
    return normalized;
  }
  if (normalized.startsWith('/packages/')) {
    return `/api${normalized}`;
  }
  throw new Error(`Package API path must start with /api/ or /packages/: "${manifestPath}".`);
}

export function buildRegistryFromManifest(
  packageId: string,
  manifest: PackageManifest | AnyPackageManifest,
  activeVersion: string,
  targetDataSource: string,
): PluginObjectRegistry {
  const registeredAt = nowIso();
  const registryManifest = isVerticalAppManifest(manifest)
    ? {
        ...manifest,
        capabilities: {
          apis: manifest.capabilities.apis,
          ui_components: [],
          ui_routes: verticalAppPagesAsUiRoutes(manifest),
          db_objects: manifest.capabilities.db_objects,
          mcp_servers: manifest.capabilities.mcp_servers ?? [],
          edge_models: [],
          edge_apis: [],
          edge_model_studio_meta: [],
          workflows: [],
          workflow_actions: [],
          install_hooks: [],
        },
      }
    : manifest;

  return {
    schema: 'package-object-registry',
    schemaVersion: '1.0.0',
    packageId,
    activeVersion,
    records: {
      apis: registryManifest.capabilities.apis.map((api) => ({
        apiId: api.id,
        conflictKey: `${api.method} ${api.path}`,
        method: api.method,
        path: api.path,
        httpPath: manifestApiPathToHttpPath(api.path),
        entry: api.entry,
        auth: api.auth ?? 'admin',
        timeoutMs: api.timeoutMs,
        registeredAt,
      })),
      uiComponents: registryManifest.capabilities.ui_components.map((ui) => ({
        conflictKey: `${ui.slotId}::${ui.componentKey}`,
        slotId: ui.slotId,
        componentKey: ui.componentKey,
        entry: ui.entry,
        ...(ui.draftEntry ? { draftEntry: ui.draftEntry } : {}),
        order: ui.order ?? 0,
        registeredAt,
      })),
      uiRoutes: (registryManifest.capabilities.ui_routes ?? []).map((route) => ({
        conflictKey: `ui_route::${route.pageKey}`,
        pageKey: route.pageKey,
        entry: route.entry,
        suggestedRoutePattern: route.suggestedRoutePattern,
        suggestedMountId: route.suggestedMountId,
        registeredAt,
      })),
      dbObjects: registryManifest.capabilities.db_objects.map((obj) => {
        const objDataSource = obj.targetDataSource?.trim() || targetDataSource;
        return {
          conflictKey: `${obj.objectType}::${obj.objectName}::${objDataSource}`,
          objectType: obj.objectType,
          objectName: obj.objectName,
          targetDataSource: objDataSource,
          installScript: obj.installScript,
          uninstallScript: obj.uninstallScript ?? null,
          seedScript: obj.seedScript ?? null,
          registeredAt,
        };
      }),
      mcpServers: registryManifest.capabilities.mcp_servers.map((server) => ({
        conflictKey: buildPackageMcpGlobalId(packageId, server.id),
        localId: server.id,
        label: server.label,
        enabled: server.enabled !== undefined ? Boolean(server.enabled) : true,
        transport: server.transport,
        command: server.command?.trim() || undefined,
        args: server.args?.length ? [...server.args] : undefined,
        url: server.url?.trim() || undefined,
        env: server.env && Object.keys(server.env).length > 0 ? { ...server.env } : undefined,
        allowedTools: server.allowedTools?.length ? [...server.allowedTools] : undefined,
        note: server.note?.trim() || undefined,
        registeredAt,
      })),
      edgeModels: (registryManifest.capabilities.edge_models ?? []).map((model) => ({
        conflictKey: `edge_model::${model.id}`,
        edgeModelId: model.id,
        entry: model.entry,
        registeredAt,
      })),
      edgeApis: (registryManifest.capabilities.edge_apis ?? []).map((api) => ({
        conflictKey: `edge_api::${api.id}`,
        edgeApiId: api.id,
        edgeModelId: api.edgeModelId,
        entry: api.entry,
        registeredAt,
      })),
      workflows: (registryManifest.capabilities.workflows ?? []).map((workflow) => ({
        conflictKey: `workflow::${workflow.scopeKey || 'global'}::${workflow.key}`,
        scopeKey: workflow.scopeKey || 'global',
        key: workflow.key,
        entry: workflow.entry,
        registeredAt,
      })),
      workflowActions: (registryManifest.capabilities.workflow_actions ?? []).map((action) => ({
        conflictKey: `workflow_action::${action.key}@${action.version}`,
        actionKey: action.key,
        actionVersion: action.version,
        definitionEntry: action.definitionEntry,
        scriptEntry: action.scriptEntry,
        registeredAt,
      })),
    },
    updatedAt: registeredAt,
  };
}

export function getEffectivePolicy(
  manifest: PackageManifest | AnyPackageManifest,
  overrides?: InstallPackageOptions['overridePolicy'],
): Record<ConflictType, 'allow' | 'deny'> {
  const overridePolicy = isVerticalAppManifest(manifest)
    ? {
        apis: manifest.overridePolicy.apis,
        ui_components: manifest.overridePolicy.ui_components ?? 'deny',
        db_objects: manifest.overridePolicy.db_objects,
        mcp_servers: manifest.overridePolicy.mcp_servers ?? 'deny',
      }
    : manifest.overridePolicy;

  return {
    apis: overrides?.apis ?? overridePolicy.apis,
    ui_components: overrides?.ui_components ?? overridePolicy.ui_components,
    db_objects: overrides?.db_objects ?? overridePolicy.db_objects,
    mcp_servers: overrides?.mcp_servers ?? overridePolicy.mcp_servers ?? 'deny',
    // No manifest-level override toggle for workflow_actions yet (p-99/WFT-1, no authoring UI
    // exists) — a colliding actionKey@version always blocks install, never silently overridden.
    workflow_actions: 'deny',
  };
}
