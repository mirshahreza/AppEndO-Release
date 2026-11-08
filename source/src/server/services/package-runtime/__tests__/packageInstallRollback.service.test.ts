import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PackageManifest } from '../../../../core/packages/PackageManifestValidator';
import type { PluginObjectRegistry } from '../../../domain/package-domain/types';
import {
  emptyExtensionInstallProgress,
  rollbackFailedExtensionInstall,
} from '../packageInstallRollback.service';

const uninstallPackageNavigationPatch = vi.fn(async () => undefined);
const uninstallPackageCultureKeys = vi.fn(async () => undefined);
const rollbackInstalledExtensionPlatformCapabilities = vi.fn(async () => undefined);
const rollbackPluginDeployment = vi.fn(async () => undefined);
const uninstallPackageWorkflows = vi.fn(async () => undefined);
const uninstallPackageRecordPolicyData = vi.fn();
const uninstallPackageQuerySurfaceData = vi.fn();
const uninstallCreatedPackageEdgeData = vi.fn();
const runPluginUninstallDbScripts = vi.fn(async () => ({ ok: true, executedScripts: [] }));
const removeObjectRegistry = vi.fn();
const removePluginUiRuntime = vi.fn();
const removePluginApiRuntime = vi.fn();

vi.mock('../../../domain/package-domain/objectRegistryRepository', () => ({
  removeObjectRegistry: (...args: unknown[]) => removeObjectRegistry(...args),
}));
vi.mock('../../package/packageCultureKeysInstall.service', () => ({
  uninstallPackageCultureKeys: (...args: unknown[]) => uninstallPackageCultureKeys(...args),
}));
vi.mock('../packageApiRuntime.service', () => ({
  removePluginApiRuntime: (...args: unknown[]) => removePluginApiRuntime(...args),
}));
vi.mock('../packageDbScripts.service', () => ({
  runPluginUninstallDbScripts: (...args: unknown[]) => runPluginUninstallDbScripts(...args),
}));
vi.mock('../packageDeployment.service', () => ({
  rollbackPluginDeployment: (...args: unknown[]) => rollbackPluginDeployment(...args),
}));
vi.mock('../packageEdgeDataRuntime.service', () => ({
  uninstallCreatedPackageEdgeData: (...args: unknown[]) => uninstallCreatedPackageEdgeData(...args),
}));
vi.mock('../extensionPlatformCapabilitiesInstall.service', () => ({
  rollbackInstalledExtensionPlatformCapabilities: (...args: unknown[]) => (
    rollbackInstalledExtensionPlatformCapabilities(...args)
  ),
}));
vi.mock('../packageNavigationPatch.service', () => ({
  uninstallPackageNavigationPatch: (...args: unknown[]) => uninstallPackageNavigationPatch(...args),
}));
vi.mock('../packageRecordPolicyRuntime.service', () => ({
  uninstallPackageRecordPolicyData: (...args: unknown[]) => uninstallPackageRecordPolicyData(...args),
}));
vi.mock('../packageQuerySurfaceRuntime.service', () => ({
  uninstallPackageQuerySurfaceData: (...args: unknown[]) => uninstallPackageQuerySurfaceData(...args),
}));
vi.mock('../packageUiRuntime.service', () => ({
  removePluginUiRuntime: (...args: unknown[]) => removePluginUiRuntime(...args),
}));
vi.mock('../packageWorkflowRuntime.service', () => ({
  uninstallPackageWorkflows: (...args: unknown[]) => uninstallPackageWorkflows(...args),
}));

function extensionManifest(): PackageManifest {
  return {
    $schemaVersion: '1.0',
    id: 'cms',
    name: 'CMS',
    version: '1.2.1',
    requiredAppVersion: '>=1.0.0',
    capabilities: {
      apis: [],
      ui_components: [],
      db_objects: [],
      mcp_servers: [],
      edge_models: [],
      edge_apis: [],
      edge_model_studio_meta: [],
      install_hooks: [],
    },
    overridePolicy: { apis: 'deny', ui_components: 'deny', db_objects: 'deny' },
    integrity: { algorithm: 'sha256', artifactHash: '0'.repeat(64) },
  };
}

function registry(): PluginObjectRegistry {
  return {
    schema: 'package-object-registry',
    schemaVersion: '1.0.0',
    packageId: 'cms',
    activeVersion: '1.2.1',
    records: {
      apis: [],
      uiComponents: [],
      uiRoutes: [],
      dbObjects: [],
      mcpServers: [],
      edgeModels: [],
      edgeApis: [],
    },
    updatedAt: new Date().toISOString(),
  };
}

describe('rollbackFailedExtensionInstall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not run uninstall SQL or drop runtime when this attempt never reached those steps', async () => {
    await rollbackFailedExtensionInstall({
      packageId: 'cms',
      version: '1.2.1',
      manifest: extensionManifest(),
      targetDataSource: 'default',
      candidateRegistry: registry(),
      progress: emptyExtensionInstallProgress(false),
    });

    expect(runPluginUninstallDbScripts).not.toHaveBeenCalled();
    expect(removePluginUiRuntime).not.toHaveBeenCalled();
    expect(removePluginApiRuntime).not.toHaveBeenCalled();
    expect(removeObjectRegistry).not.toHaveBeenCalled();
    expect(rollbackInstalledExtensionPlatformCapabilities).not.toHaveBeenCalled();
    expect(uninstallPackageWorkflows).not.toHaveBeenCalled();
    expect(uninstallPackageNavigationPatch).toHaveBeenCalledWith('cms');
  });

  it('reverses DB, created edge data, registry, and runtime after a later-step failure', async () => {
    const progress = emptyExtensionInstallProgress(true);
    progress.runtimeExtracted = true;
    progress.dbInstallAttempted = true;
    progress.createdEdge = { models: ['em_new'], apis: ['ea_new'], studioMeta: ['em_new'] };
    progress.recordPolicies = { policies: ['rp_1'], bindings: ['rb_1'] };
    progress.querySurfaces = { bindings: ['em_qs_1'] };
    progress.workflowsAttempted = true;
    progress.registryCommitted = true;
    progress.platformFinalizeAttempted = true;

    const candidateRegistry = registry();
    const manifest = extensionManifest();

    await rollbackFailedExtensionInstall({
      packageId: 'cms',
      version: '1.2.1',
      manifest,
      targetDataSource: 'default-db',
      candidateRegistry,
      progress,
    });

    expect(rollbackInstalledExtensionPlatformCapabilities).toHaveBeenCalledWith('cms', manifest);
    expect(uninstallPackageWorkflows).toHaveBeenCalledWith(candidateRegistry);
    expect(uninstallPackageRecordPolicyData).toHaveBeenCalledWith({ policies: ['rp_1'], bindings: ['rb_1'] });
    expect(uninstallPackageQuerySurfaceData).toHaveBeenCalledWith({ bindings: ['em_qs_1'] });
    expect(uninstallCreatedPackageEdgeData).toHaveBeenCalledWith({
      models: ['em_new'],
      apis: ['ea_new'],
      studioMeta: ['em_new'],
    });
    expect(runPluginUninstallDbScripts).toHaveBeenCalledWith(
      'cms',
      '1.2.1',
      manifest,
      'default-db',
      { includeOptionalRecords: true },
    );
    expect(removeObjectRegistry).toHaveBeenCalledWith('cms');
    expect(removePluginUiRuntime).toHaveBeenCalledWith('cms', '1.2.1');
    expect(removePluginApiRuntime).toHaveBeenCalledWith('cms', '1.2.1');
  });

  it('continues remaining reverse steps when one rollback step throws', async () => {
    uninstallPackageNavigationPatch.mockRejectedValueOnce(new Error('nav sidecar locked'));
    const progress = emptyExtensionInstallProgress(false);
    progress.runtimeExtracted = true;
    progress.dbInstallAttempted = true;

    await rollbackFailedExtensionInstall({
      packageId: 'cms',
      version: '1.2.1',
      manifest: extensionManifest(),
      targetDataSource: 'default',
      candidateRegistry: registry(),
      progress,
    });

    expect(runPluginUninstallDbScripts).toHaveBeenCalled();
    expect(removePluginUiRuntime).toHaveBeenCalledWith('cms', '1.2.1');
    expect(removePluginApiRuntime).toHaveBeenCalledWith('cms', '1.2.1');
  });
});
