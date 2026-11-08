import fs from 'fs';
import path from 'path';
import {
  deletePackage,
  deletePackageVersion,
  getPackageDetail,
  listPackages,
  uploadPackageArtifact,
} from '../../core/packages/PackageArtifactService';
import type { PackageLifecycleResult } from '../domain/package-domain/types';
import { parsePackageUninstallPayload } from '../../shared/api/contracts/package/uninstall';
import { getDefaultPackageLifecycleCoordinator } from './package-runtime/packageLifecycle.service';
import { packageDirs, readPackageIndex } from '../../core/packages/PackageFileStore';
import { env } from '../config/env';
import { HttpError } from '../errors/HttpError';
import { listManagedFunctionCatalogRows } from '../domain/functions/functionRepository';
import type { RequestDbContext } from '../types/requestContext';
import type { SystemFunctionRoute } from '../utils/systemApiRoutes';
import { resolveUiComponentModule } from './package-runtime/packageUiRuntime.service';
import { resolvePackageStaticAsset } from './package-runtime/packageAssetsRuntime.service';
import { readPackageRegistryProposalPreview } from './package-runtime/extensionUiRoutes.service';
import { buildDesignerComponentExportBundle, enrichPackageArtifactBuffer } from './package/packageComponentExport.service';
import { listPackageBuilderShellCatalog } from './package/packageDesignerShellExport.service';
import { buildManagedFunctionExportBundle } from './package/packageFunctionExport.service';
import { compilePackageUiModuleFile } from './package-runtime/packageUiModuleCompile.service';
import { getWebFontsAssetsRootPath } from './platform/platformWebFonts.service';
import { listDesignerDrafts } from '../domain/component-designer/drafts';
import { isBuiltInComponentId } from '../../domain/component-designer/layout-presets/builtInComponents';
import { isSystemManagedShellLayoutDraft } from '../../shared/lib/designerShellEntry';
import { buildDesignerComponentPath } from '../../shared/lib/designerComponentPath';
import { reconcileDeletedEdgeCapabilities } from './data-api/edgeCapabilityDeleteCleanup';
import { reconcileDeletedDesignerArtifacts } from './component-designer/designerDeleteCleanup';
import {
  executePackageRepack,
  getPackageRepackItemDiff,
  parseRepackAdditions,
  parseRepackRemovals,
  previewPackageRepackDrift,
  revertPackageRepackItem,
} from './package/packageRepack.service';
import {
  deletePackageWorkspaceAsset,
  listPackageWorkspaceAssets,
  readPackageWorkspaceAsset,
  writePackageWorkspaceAsset,
} from './package/packageWorkspaceAssets.service';
import type { EdgeDbQueryFn } from './server-function.service';
import {
  captureSeedInserts,
  listCapturableSqlFiles,
  readCapturableSqlFile,
  captureCmsModule,
  type CaptureSeedInsertsInput,
  type CaptureCmsModuleInput,
} from './package/packageDbCapture.service';
import { listEdgeModels } from './data-api/edgeModelStore';
import { listEdgeApiDefinitions } from './data-api/edgeApiStore';
import { buildPackageEdgeDataExportEntries } from './package/packageEdgeDataExport.service';
import { buildPackageWorkflowExportEntries } from './package/packageWorkflowExport.service';
import { listWorkflowDefinitions } from '../domain/workflow/workflowDefinitionRepository';

export type PackagesServiceDeps = {
  discoverSystemRoutes: () => Promise<SystemFunctionRoute[]>;
  settingsPath?: string;
  edgeDbQuery?: EdgeDbQueryFn;
};

const parseBooleanLike = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  }
  return fallback;
};

export const isPackageBuilderEnabled = (): boolean => {
  const fallback = env.isProduction ? false : true;
  return parseBooleanLike(env.packageBuilderEnabledRaw, fallback);
};

export class PackagesService {
  constructor(private readonly deps: PackagesServiceDeps) {}

  getFeatureFlags() {
    return {
      body: {
        success: true as const,
        flags: {
          builderEnabled: isPackageBuilderEnabled(),
        },
      },
    };
  }

  async getBuilderCatalog(_ctx: RequestDbContext) {
    if (!isPackageBuilderEnabled()) {
      throw new HttpError(403, 'Package Builder is disabled by feature flag.');
    }

    reconcileDeletedEdgeCapabilities();
    reconcileDeletedDesignerArtifacts();

    const [managedItems, systemItemsRaw] = await Promise.all([
      listManagedFunctionCatalogRows(),
      this.deps.discoverSystemRoutes(),
    ]);

    const managedApis = (Array.isArray(managedItems) ? managedItems : []).map((item) => {
      const id = String(item.id || `${item.method || 'GET'}:${item.path || ''}`);
      const base = {
        id,
        name: String(item.name || item.path || 'managed-api'),
        folder: String(item.folder || ''),
        method: String(item.method || 'GET').toUpperCase(),
        path: String(item.path || '/'),
        source: 'managed' as const,
      };

      const exportBundle = buildManagedFunctionExportBundle(id);
      if (!exportBundle.ok) {
        return base;
      }

      return {
        ...base,
        exportBundle: {
          entry: exportBundle.entry,
          metaEntry: exportBundle.metaEntry,
          code: exportBundle.code,
          metaJson: exportBundle.metaJson,
          auth: exportBundle.auth,
          timeoutMs: exportBundle.timeoutMs,
        },
      };
    });

    const systemApis = (Array.isArray(systemItemsRaw) ? systemItemsRaw : []).map((item, index) => ({
      id: String(item.id || `system-${index}-${item.method || 'GET'}-${item.path || '/'}`),
      name: String(item.name || item.path || 'system-api'),
      folder: String(item.folder || ''),
      method: String(item.method || 'GET').toUpperCase(),
      path: String(item.path || '/'),
      source: 'system' as const,
    }));

    const apiDedup = new Map<string, {
      id: string;
      name: string;
      folder?: string;
      method: string;
      path: string;
      source: 'managed' | 'system';
      exportBundle?: {
        entry: string;
        metaEntry: string;
        code: string;
        metaJson: string;
        auth: 'public' | 'authenticated' | 'admin';
        timeoutMs: number;
      };
    }>();
    for (const api of [...managedApis, ...systemApis]) {
      const key = `${api.method} ${api.path}`;
      if (!apiDedup.has(key)) {
        apiDedup.set(key, api);
      }
    }

    const slotTargets = new Set<string>([
      'core.sidebar.navigation',
      'core.dashboard.widgets',
    ]);

    if (fs.existsSync(packageDirs.manifests)) {
      const pluginFolders = fs.readdirSync(packageDirs.manifests);
      for (const folder of pluginFolders) {
        const folderPath = path.join(packageDirs.manifests, folder);
        if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) continue;

        const files = fs.readdirSync(folderPath).filter((name) => name.endsWith('.manifest.json'));
        for (const fileName of files) {
          const manifestPath = path.join(folderPath, fileName);
          try {
            const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
            const manifest = JSON.parse(manifestRaw) as {
              capabilities?: { ui_components?: Array<{ slotId?: string }> };
            };
            const uiItems = Array.isArray(manifest?.capabilities?.ui_components)
              ? manifest.capabilities.ui_components
              : [];
            for (const item of uiItems) {
              if (typeof item?.slotId === 'string' && item.slotId.trim()) {
                slotTargets.add(item.slotId.trim());
              }
            }
          } catch {
            // Ignore malformed manifest entries from old artifacts.
          }
        }
      }
    }

    const uiComponents = listDesignerDrafts()
      .filter((draft) => !isBuiltInComponentId(draft.id) && !isSystemManagedShellLayoutDraft(draft))
      .map((draft) => {
        const exportBundle = buildDesignerComponentExportBundle(draft.id);
        if (exportBundle.ok) {
          return {
            id: draft.id,
            componentKey: exportBundle.componentKey,
            label: exportBundle.componentKey,
            exportBundle: {
              entry: exportBundle.entry,
              code: exportBundle.code,
              draftJson: exportBundle.draftJson,
              draftEntry: exportBundle.draftEntry,
            },
          };
        }

        const componentKey = buildDesignerComponentPath(draft.folder, draft.name);
        return {
          id: draft.id,
          componentKey,
          label: componentKey,
        };
      })
      .sort((left, right) => left.label.localeCompare(right.label));

    const apiBackedModelIds = new Set(
      listEdgeApiDefinitions().map((definition) => definition.edgeModelId),
    );
    const seenModelKeys = new Set<string>();
    const edgeModels = listEdgeModels().flatMap((model) => {
      if (!apiBackedModelIds.has(model.id)) {
        return [];
      }
      const key = `${model.dataSourceId}::${model.objectType}::${model.objectName}`;
      if (seenModelKeys.has(key)) {
        return [];
      }
      seenModelKeys.add(key);
      return [{
        id: model.id,
        objectName: model.objectName,
        label: model.labels.title,
      }];
    });
    const seenApiKeys = new Set<string>();
    const edgeApis = listEdgeApiDefinitions().flatMap((definition) => {
      const key = `${definition.edgeModelId}::${definition.key}::${definition.basePath}`;
      if (seenApiKeys.has(key)) {
        return [];
      }
      seenApiKeys.add(key);
      return [{
        id: definition.id,
        edgeModelId: definition.edgeModelId,
        key: definition.key,
        label: definition.label,
        basePath: definition.basePath,
      }];
    });

    const workflows = (await listWorkflowDefinitions()).map((definition) => ({
      id: definition.id,
      scopeKey: definition.scopeKey,
      key: definition.key,
      label: `${definition.scopeKey}/${definition.key}`,
      lifecycleStatus: definition.lifecycleStatus,
      draftJson: definition.draftDefinitionJson,
    }));

    const shells = listPackageBuilderShellCatalog();

    return {
      body: {
        success: true as const,
        catalog: {
          apis: Array.from(apiDedup.values()),
          uiComponents,
          shells,
          slotTargets: Array.from(slotTargets.values()).sort((a, b) => a.localeCompare(b)),
          edgeModels,
          edgeApis,
          workflows,
        },
      },
    };
  }

  buildEdgeDataExport(input: { edgeModelIds?: unknown; edgeApiIds?: unknown }) {
    if (!isPackageBuilderEnabled()) {
      throw new HttpError(403, 'Package Builder is disabled by feature flag.');
    }

    const edgeModelIds = Array.isArray(input.edgeModelIds)
      ? input.edgeModelIds.map((id) => String(id))
      : [];
    const edgeApiIds = Array.isArray(input.edgeApiIds)
      ? input.edgeApiIds.map((id) => String(id))
      : [];

    const result = buildPackageEdgeDataExportEntries({ edgeModelIds, edgeApiIds });
    if ('ok' in result && result.ok === false) {
      return { statusCode: 422, body: { success: false as const, error: result.error, details: result.details } };
    }

    const success = result as Exclude<typeof result, { ok: false }>;
    return {
      body: {
        success: true as const,
        capabilities: success.capabilities,
        warnings: success.warnings,
        files: success.zipEntries.map((entry) => ({
          path: entry.path,
          content: entry.content.toString('utf8'),
        })),
      },
    };
  }

  async buildWorkflowExport(input: { workflowDefinitionIds?: unknown; workflowKeys?: unknown }) {
    if (!isPackageBuilderEnabled()) {
      throw new HttpError(403, 'Package Builder is disabled by feature flag.');
    }

    const workflowDefinitionIds = Array.isArray(input.workflowDefinitionIds)
      ? input.workflowDefinitionIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
      : [];
    const workflowKeys = Array.isArray(input.workflowKeys)
      ? input.workflowKeys
          .filter((item): item is { scopeKey?: string; key: string } => !!item && typeof item === 'object' && typeof (item as { key?: unknown }).key === 'string')
          .map((item) => ({ scopeKey: item.scopeKey, key: item.key }))
      : [];

    const result = await buildPackageWorkflowExportEntries({ workflowDefinitionIds, workflowKeys });
    if ('ok' in result && result.ok === false) {
      return { statusCode: 422, body: { success: false as const, error: result.error, details: result.details } };
    }

    const success = result as Exclude<typeof result, { ok: false }>;
    return {
      body: {
        success: true as const,
        capabilities: success.capabilities,
        warnings: success.warnings,
        files: success.zipEntries.map((entry) => ({
          path: entry.path,
          content: entry.content.toString('utf8'),
        })),
      },
    };
  }

  async uploadArtifact(
    buffer: Buffer,
    originalName: string,
    actor: string,
    options?: { createdBy?: string | null },
  ) {
    const enrichedBuffer = enrichPackageArtifactBuffer(buffer);
    const result = await uploadPackageArtifact(enrichedBuffer, originalName, actor, options);
    if (!result.success) {
      const status = 'details' in result && result.details ? 422 : 400;
      return { statusCode: status, body: result };
    }
    return { statusCode: 201, body: result };
  }

  async list() {
    await this.confirmLeftoverPendingExtensionRoutes();
    const items = listPackages();
    return { body: { success: true as const, items } };
  }

  private async confirmLeftoverPendingExtensionRoutes(): Promise<void> {
    const pendingIds = [...new Set(
      listPackages()
        .filter((item) => (
          item.installStatus === 'installed'
          && item.deploymentStatus === 'pending'
          && item.pluginKind !== 'vertical-app'
        ))
        .map((item) => item.packageId),
    )];
    for (const packageId of pendingIds) {
      await getDefaultPackageLifecycleCoordinator().applyDeployment(packageId, 'system', null);
    }
  }

  getDependencyGraph() {
    const graph = getDefaultPackageLifecycleCoordinator().getDependencyGraph();
    return { body: { success: true as const, graph } };
  }

  getDetail(packageId: string, version?: string) {
    const detail = getPackageDetail(packageId, version);
    if (!detail) {
      throw new HttpError(404, 'Package not found.');
    }
    return { body: { success: true as const, package: detail } };
  }

  resolveDownload(packageId: string, requestedVersion?: string) {
    const detail = getPackageDetail(packageId, requestedVersion);
    if (!detail) {
      throw new HttpError(404, 'Package not found.');
    }

    const resolvedVersion = requestedVersion?.trim() || detail.version;
    const index = readPackageIndex();
    const entry = index.packages.find((item) => item.packageId === packageId);
    const artifact = entry?.versions.find((item) => item.version === resolvedVersion);
    if (!artifact?.artifactPath) {
      throw new HttpError(404, 'Requested package version not found.');
    }

    const normalizedRelPath = artifact.artifactPath.replace(/\\/g, '/');
    const absRoot = path.resolve(packageDirs.root);
    const absArtifactPath = path.resolve(path.join(absRoot, normalizedRelPath));

    if (!absArtifactPath.startsWith(absRoot + path.sep) && absArtifactPath !== absRoot) {
      throw new HttpError(400, 'Invalid artifact path.');
    }

    if (!fs.existsSync(absArtifactPath)) {
      throw new HttpError(404, 'Artifact file not found on disk.');
    }

    const fileName = `${detail.packageId}-${resolvedVersion}.zip`;
    return { absArtifactPath, fileName };
  }

  delete(packageId: string, actor: string, version?: string) {
    const trimmedVersion = version?.trim();
    const result = trimmedVersion
      ? deletePackageVersion(packageId, trimmedVersion, actor)
      : deletePackage(packageId, actor);
    if (!result.success) {
      const message = 'error' in result ? String(result.error) : '';
      const status = message.includes('not found') ? 404 : 409;
      return { statusCode: status, body: result };
    }
    return { body: result };
  }

  async install(packageId: string, actor: string, body: Record<string, unknown>) {
    const result = await getDefaultPackageLifecycleCoordinator().install(packageId, actor, {
      version: typeof body.version === 'string' ? body.version : undefined,
      targetDataSource: typeof body.targetDataSource === 'string' ? body.targetDataSource : undefined,
      overridePolicy: typeof body.overridePolicy === 'object' && body.overridePolicy !== null
        ? body.overridePolicy as Record<string, unknown>
        : undefined,
      installOptionalRecords: typeof body.installOptionalRecords === 'boolean'
        ? body.installOptionalRecords
        : undefined,
    });
    return this.mapLifecycleResult(result);
  }

  async uninstall(packageId: string, actor: string, body: Record<string, unknown>) {
    const removeScope = parsePackageUninstallPayload(body);
    const result = await getDefaultPackageLifecycleCoordinator().uninstall(packageId, actor, {
      removeScope,
    });
    if (!result.success) {
      const failure = result as Extract<typeof result, { success: false }>;
      if (failure.code === 'script_execution_unsafe') {
        return { statusCode: 422, body: failure };
      }
      const status = failure.code === 'not_found' ? 404 : 409;
      return { statusCode: status, body: failure };
    }
    return { body: result };
  }

  async reinstall(packageId: string, actor: string, body: Record<string, unknown>) {
    const result = await getDefaultPackageLifecycleCoordinator().reinstall(packageId, actor, {
      version: typeof body.version === 'string' ? body.version : undefined,
      targetDataSource: typeof body.targetDataSource === 'string' ? body.targetDataSource : undefined,
      overridePolicy: typeof body.overridePolicy === 'object' && body.overridePolicy !== null
        ? body.overridePolicy as Record<string, unknown>
        : undefined,
      installOptionalRecords: typeof body.installOptionalRecords === 'boolean'
        ? body.installOptionalRecords
        : undefined,
    });
    return this.mapLifecycleResult(result);
  }

  getRepackDrift(packageId: string) {
    const result = previewPackageRepackDrift(packageId);
    if ('ok' in result && result.ok === false) {
      return { statusCode: result.statusCode, body: { success: false as const, error: result.error } };
    }
    return { body: { success: true as const, drift: result } };
  }

  getRepackDiff(packageId: string, itemId: string) {
    const result = getPackageRepackItemDiff(packageId, itemId);
    if ('ok' in result && result.ok === false) {
      return { statusCode: result.statusCode, body: { success: false as const, error: result.error } };
    }
    return { body: { success: true as const, diff: result } };
  }

  revertRepackItem(packageId: string, itemId: string) {
    const result = revertPackageRepackItem(packageId, itemId);
    if (!result.ok) {
      return { statusCode: result.statusCode, body: { success: false as const, error: result.error } };
    }
    return { body: { success: true as const } };
  }

  async repack(packageId: string, actor: string, body: Record<string, unknown>) {
    const descriptionMode = body.descriptionMode === 'append' ? 'append' : 'replace';
    const createdBy = typeof body.createdBy === 'string' ? body.createdBy : undefined;
    const result = await executePackageRepack(packageId, actor, {
      version: typeof body.version === 'string' ? body.version : '',
      description: typeof body.description === 'string' ? body.description : undefined,
      descriptionMode,
      createdBy,
      additions: parseRepackAdditions(body.additions),
      removals: parseRepackRemovals(body.removals),
    });
    if ('ok' in result && result.ok === false) {
      return {
        statusCode: result.statusCode,
        body: {
          success: false as const,
          error: result.error,
          details: result.details,
        },
      };
    }
    return {
      body: {
        success: true as const,
        repack: result,
        deploymentStatus: result.deploymentStatus,
        pluginKind: undefined,
      },
    };
  }

  enable(packageId: string, actor: string) {
    const result = getDefaultPackageLifecycleCoordinator().enable(packageId, actor);
    return this.mapLifecycleResult(result);
  }

  disable(packageId: string, actor: string) {
    const result = getDefaultPackageLifecycleCoordinator().disable(packageId, actor);
    return this.mapLifecycleResult(result);
  }

  async resolveUiModule(packageId: string, componentKey: string) {
    const resolved = resolveUiComponentModule(packageId, componentKey);
    if (!resolved.ok) {
      throw new HttpError(resolved.statusCode, resolved.error);
    }

    const stat = fs.statSync(resolved.absPath);
    const body = await compilePackageUiModuleFile(resolved.absPath, stat.mtimeMs);
    return {
      contentType: 'text/javascript; charset=utf-8',
      body,
    };
  }

  resolveStaticAsset(packageId: string, assetKey: string) {
    const resolved = resolvePackageStaticAsset(packageId, assetKey);
    if (!resolved.ok) {
      throw new HttpError(resolved.statusCode, resolved.error);
    }
    return resolved;
  }

  getDeploymentPreview(packageId: string) {
    const detail = getPackageDetail(packageId);
    if (!detail) {
      throw new HttpError(404, 'Package not found.');
    }
    if (detail.deploymentStatus !== 'pending') {
      throw new HttpError(404, 'No pending deployment proposal for this package.');
    }
    const preview = readPackageRegistryProposalPreview(packageId);
    if (!preview) {
      throw new HttpError(404, 'Deployment preview file was not found.');
    }
    return {
      body: {
        success: true as const,
        preview,
      },
    };
  }

  async applyDeployment(packageId: string, actor: string, actorId: number | null) {
    const result = await getDefaultPackageLifecycleCoordinator().applyDeployment(packageId, actor, actorId);
    return this.mapLifecycleResult(result);
  }

  listWorkspaceAssets() {
    if (!isPackageBuilderEnabled()) {
      throw new HttpError(403, 'Package Builder is disabled by feature flag.');
    }

    return {
      body: {
        success: true as const,
        assets: listPackageWorkspaceAssets(),
        rootPath: 'workspace/assets',
        urlPrefix: '/assets/workspace',
      },
    };
  }

  readWorkspaceAsset(relativePath: string) {
    if (!isPackageBuilderEnabled()) {
      throw new HttpError(403, 'Package Builder is disabled by feature flag.');
    }

    const result = readPackageWorkspaceAsset(relativePath);
    if (!result.ok) {
      throw new HttpError(404, result.error);
    }

    return result;
  }

  readPlatformFontAsset(relativePath: string) {
    if (!isPackageBuilderEnabled()) {
      throw new HttpError(403, 'Package Builder is disabled by feature flag.');
    }

    const normalized = relativePath.trim().replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized || normalized.includes('..')) {
      throw new HttpError(400, 'Invalid platform font path.');
    }

    const root = path.resolve(getWebFontsAssetsRootPath());
    const absPath = path.resolve(root, normalized);
    if (!absPath.startsWith(root) || !fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
      throw new HttpError(404, 'Platform font was not found.');
    }

    return { absPath, content: fs.readFileSync(absPath) };
  }

  uploadWorkspaceAsset(fileName: string, content: Buffer) {
    if (!isPackageBuilderEnabled()) {
      throw new HttpError(403, 'Package Builder is disabled by feature flag.');
    }

    const result = writePackageWorkspaceAsset(fileName, content);
    if (!result.ok) {
      throw new HttpError(400, result.error);
    }

    return {
      body: {
        success: true as const,
        asset: result.asset,
      },
    };
  }

  deleteWorkspaceAsset(relativePath: string) {
    if (!isPackageBuilderEnabled()) {
      throw new HttpError(403, 'Package Builder is disabled by feature flag.');
    }

    const result = deletePackageWorkspaceAsset(relativePath);
    if (!result.ok) {
      throw new HttpError(400, result.error);
    }

    return {
      body: {
        success: true as const,
      },
    };
  }

  listCapturableSqlFiles() {
    if (!isPackageBuilderEnabled()) {
      throw new HttpError(403, 'Package Builder is disabled by feature flag.');
    }

    return {
      body: {
        success: true as const,
        files: listCapturableSqlFiles(),
        rootPath: 'scripts',
      },
    };
  }

  readCapturableSqlFile(relativePath: string) {
    if (!isPackageBuilderEnabled()) {
      throw new HttpError(403, 'Package Builder is disabled by feature flag.');
    }

    const result = readCapturableSqlFile(relativePath);
    if (!result.ok) {
      throw new HttpError(400, result.error);
    }

    return {
      body: {
        success: true as const,
        path: result.path,
        content: result.content,
      },
    };
  }

  async captureSeedInserts(input: CaptureSeedInsertsInput) {
    if (!isPackageBuilderEnabled()) {
      throw new HttpError(403, 'Package Builder is disabled by feature flag.');
    }
    if (!this.deps.edgeDbQuery || !this.deps.settingsPath) {
      throw new HttpError(500, 'Database capture is unavailable — data source access is not configured.');
    }

    const result = await captureSeedInserts(
      { edgeDbQuery: this.deps.edgeDbQuery, settingsPath: this.deps.settingsPath },
      input,
    );

    return {
      body: {
        success: true as const,
        ...result,
      },
    };
  }

  async captureCmsModule(input: CaptureCmsModuleInput) {
    if (!isPackageBuilderEnabled()) {
      throw new HttpError(403, 'Package Builder is disabled by feature flag.');
    }
    if (!this.deps.edgeDbQuery || !this.deps.settingsPath) {
      throw new HttpError(500, 'Database capture is unavailable — data source access is not configured.');
    }

    const result = await captureCmsModule(
      { edgeDbQuery: this.deps.edgeDbQuery, settingsPath: this.deps.settingsPath },
      input,
    );

    return {
      body: {
        success: true as const,
        ...result,
      },
    };
  }

  private mapLifecycleResult(result: PackageLifecycleResult) {
    if (result.success === false) {
      const status = result.code === 'not_found'
        ? 404
        : result.code === 'dependency_missing'
          || result.code === 'dependency_conflict'
          || result.code === 'dependency_cycle'
          || result.code === 'conflict_denied'
          || result.code === 'script_execution_unsafe'
          ? 422
          : 409;
      return { statusCode: status, body: result };
    }
    return { body: result };
  }
}
