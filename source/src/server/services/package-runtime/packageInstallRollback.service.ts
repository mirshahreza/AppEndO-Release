import type { AnyPackageManifest } from '../../../core/packages/PackageManifestValidator';
import { isVerticalAppManifest } from '../../../core/packages/PackageManifestValidator';
import { removeObjectRegistry } from '../../domain/package-domain/objectRegistryRepository';
import { uninstallPackageCultureKeys } from '../package/packageCultureKeysInstall.service';
import { removePluginApiRuntime } from './packageApiRuntime.service';
import { runPluginUninstallDbScripts } from './packageDbScripts.service';
import { rollbackPluginDeployment } from './packageDeployment.service';
import {
  uninstallCreatedPackageEdgeData,
  type PackageEdgeDataCreatedIds,
} from './packageEdgeDataRuntime.service';
import { rollbackInstalledExtensionPlatformCapabilities } from './extensionPlatformCapabilitiesInstall.service';
import { uninstallPackageNavigationPatch } from './packageNavigationPatch.service';
import { uninstallPackageRecordPolicyData } from './packageRecordPolicyRuntime.service';
import { uninstallPackageQuerySurfaceData } from './packageQuerySurfaceRuntime.service';
import { removePluginUiRuntime } from './packageUiRuntime.service';
import { uninstallPackageWorkflows } from './packageWorkflowRuntime.service';
import type { PluginObjectRegistry } from '../../domain/package-domain/types';

export type ExtensionInstallProgress = {
  includeOptionalRecords: boolean;
  runtimeExtracted: boolean;
  dbInstallAttempted: boolean;
  createdEdge: PackageEdgeDataCreatedIds;
  recordPolicies: { policies: string[]; bindings: string[] };
  querySurfaces: { bindings: string[] };
  workflowsAttempted: boolean;
  registryCommitted: boolean;
  platformFinalizeAttempted: boolean;
};

export function emptyExtensionInstallProgress(
  includeOptionalRecords: boolean,
): ExtensionInstallProgress {
  return {
    includeOptionalRecords,
    runtimeExtracted: false,
    dbInstallAttempted: false,
    createdEdge: { models: [], apis: [], studioMeta: [] },
    recordPolicies: { policies: [], bindings: [] },
    querySurfaces: { bindings: [] },
    workflowsAttempted: false,
    registryCommitted: false,
    platformFinalizeAttempted: false,
  };
}

async function ignoreRollbackError(step: () => Promise<void> | void): Promise<void> {
  try {
    await step();
  } catch {
    // Best-effort: every step still runs so a failed install does not stay half-applied.
  }
}

/**
 * Reverse a failed extension install. Steps are idempotent and always attempted in reverse
 * of the install order so a failure in any later phase cannot leave schema, nav, or runtime behind.
 */
export async function rollbackFailedExtensionInstall(input: {
  packageId: string;
  version: string;
  manifest: AnyPackageManifest | null;
  targetDataSource: string;
  candidateRegistry: PluginObjectRegistry | null;
  progress: ExtensionInstallProgress;
}): Promise<void> {
  const { packageId, version, manifest, targetDataSource, candidateRegistry, progress } = input;

  await ignoreRollbackError(() => uninstallPackageNavigationPatch(packageId));
  await ignoreRollbackError(() => uninstallPackageCultureKeys(packageId));

  if (progress.platformFinalizeAttempted && manifest && !isVerticalAppManifest(manifest)) {
    await ignoreRollbackError(() => rollbackInstalledExtensionPlatformCapabilities(packageId, manifest));
  }

  await ignoreRollbackError(() => rollbackPluginDeployment(packageId));

  if (progress.workflowsAttempted && candidateRegistry) {
    await ignoreRollbackError(() => uninstallPackageWorkflows(candidateRegistry));
  }

  await ignoreRollbackError(() => uninstallPackageRecordPolicyData(progress.recordPolicies));
  await ignoreRollbackError(() => uninstallPackageQuerySurfaceData(progress.querySurfaces));
  await ignoreRollbackError(() => uninstallCreatedPackageEdgeData(progress.createdEdge));

  if (progress.dbInstallAttempted && manifest && !isVerticalAppManifest(manifest)) {
    await ignoreRollbackError(() => runPluginUninstallDbScripts(
      packageId,
      version,
      manifest,
      targetDataSource,
      { includeOptionalRecords: progress.includeOptionalRecords },
    ));
  }

  if (progress.registryCommitted) {
    await ignoreRollbackError(() => removeObjectRegistry(packageId));
  }

  if (progress.runtimeExtracted) {
    await ignoreRollbackError(() => {
      removePluginUiRuntime(packageId, version);
      removePluginApiRuntime(packageId, version);
    });
  }
}
