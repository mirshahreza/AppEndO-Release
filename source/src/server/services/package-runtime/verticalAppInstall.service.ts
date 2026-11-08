import type { VerticalAppManifest } from '../../../shared/api/contracts/package-manifest/verticalApp';
import type { PluginDeploymentStatus } from '../../../shared/api/contracts/package-manifest/verticalApp';
import type { InstallPackageOptions, LifecycleStatusCode } from '../../domain/package-domain/types';
import { isVerticalAppManifest, type AnyPackageManifest } from '../../../core/packages/PackageManifestValidator';
import { validateVerticalAppManifest } from '../../../core/packages/verticalAppManifestValidator';
import { extractPackageApiRuntime, removePluginApiRuntime } from './packageApiRuntime.service';
import { runPackageInstallDbScripts, runPluginUninstallDbScripts } from './packageDbScripts.service';
import {
  applyPluginDeployment,
  collectDeploymentConflicts,
  confirmPluginDeployment,
  readDeploymentPreview,
  rollbackPluginDeployment,
} from './packageDeployment.service';
import { resolveVersionForInstall, parseManifestFile } from '../../domain/package-domain/manifestRepository';
import { readInstallStateV1 } from '../../domain/package-domain/installStateRepository';
import {
  extractPluginVerticalRuntime,
  manifestForRegistry,
  removePluginVerticalRuntime,
} from './packageVerticalRuntime.service';
import { runVerticalAppInstallSmokeTest } from './packageVerticalSmokeTest.service';

export type VerticalAppInstallContext = {
  packageId: string;
  version: string;
  manifest: VerticalAppManifest;
  targetDataSource: string;
  actorId: number | null;
  overridePolicy?: InstallPackageOptions['overridePolicy'];
  includeOptionalRecords?: boolean;
  /** When true, skip manifest db_objects install SQL (runtime + deployment only). */
  skipInstallDbScripts?: boolean;
};

export type VerticalAppInstallSuccess = {
  ok: true;
  deploymentStatus: PluginDeploymentStatus;
  smokeWarnings: string[];
};

export type VerticalAppInstallFailure = {
  ok: false;
  error: string;
  code: LifecycleStatusCode;
  details?: string[];
};

export type VerticalAppInstallResult = VerticalAppInstallSuccess | VerticalAppInstallFailure;

export function parseVerticalAppManifest(raw: unknown): VerticalAppInstallFailure | VerticalAppManifest {
  const validation = validateVerticalAppManifest(raw);
  if (!validation.valid || !validation.manifest || !isVerticalAppManifest(validation.manifest)) {
    return {
      ok: false,
      error: 'Vertical-app manifest validation failed.',
      code: 'invalid_manifest',
      details: validation.errors,
    };
  }
  return validation.manifest;
}

export async function runVerticalAppPreflight(
  packageId: string,
  manifest: VerticalAppManifest,
): Promise<VerticalAppInstallFailure | null> {
  if (manifest.id !== packageId) {
    return {
      ok: false,
      error: `Manifest id "${manifest.id}" does not match package "${packageId}".`,
      code: 'invalid_manifest',
    };
  }

  const conflicts = await collectDeploymentConflicts(packageId, manifest);
  if (conflicts.length > 0) {
    return {
      ok: false,
      error: 'Install blocked due to deployment conflicts.',
      code: 'conflict_denied',
      details: conflicts.map((item) => item.message),
    };
  }

  return null;
}

async function rollbackVerticalInstallArtifacts(
  packageId: string,
  version: string,
  manifest: VerticalAppManifest,
  targetDataSource: string,
  executedDbInstall: boolean,
  includeOptionalRecords = true,
): Promise<void> {
  await rollbackPluginDeployment(packageId);
  removePluginVerticalRuntime(packageId, version);
  removePluginApiRuntime(packageId, version);

  if (executedDbInstall) {
    await runPluginUninstallDbScripts(
      packageId,
      version,
      manifestForRegistry(manifest),
      targetDataSource,
      { includeOptionalRecords },
    ).catch(() => undefined);
  }
}

export async function prepareVerticalAppRuntime(
  ctx: VerticalAppInstallContext,
): Promise<VerticalAppInstallFailure | { ok: true; executedDbInstall: boolean }> {
  const { packageId, version, manifest, targetDataSource, includeOptionalRecords, skipInstallDbScripts } = ctx;

  const verticalExtract = extractPluginVerticalRuntime(packageId, version, manifest);
  if (verticalExtract.ok === false) {
    return {
      ok: false,
      error: verticalExtract.error,
      code: 'invalid_manifest',
      details: verticalExtract.details,
    };
  }

  const registryManifest = manifestForRegistry(manifest);
  let executedDbInstall = false;
  if (!skipInstallDbScripts) {
    const dbResult = await runPackageInstallDbScripts(
      packageId,
      version,
      registryManifest,
      targetDataSource,
      { includeOptionalRecords: includeOptionalRecords !== false },
    );
    if (dbResult.ok === false) {
      await rollbackVerticalInstallArtifacts(
        packageId,
        version,
        manifest,
        targetDataSource,
        true,
        includeOptionalRecords !== false,
      );
      return {
        ok: false,
        error: dbResult.error,
        code: 'script_execution_unsafe',
        details: dbResult.details,
      };
    }
    executedDbInstall = dbResult.executedScripts.length > 0;
  }

  const apiExtract = extractPackageApiRuntime(packageId, version, registryManifest);
  if (apiExtract.ok === false) {
    await rollbackVerticalInstallArtifacts(
      packageId,
      version,
      manifest,
      targetDataSource,
      executedDbInstall,
      includeOptionalRecords !== false,
    );
    return {
      ok: false,
      error: apiExtract.error,
      code: 'invalid_manifest',
      details: apiExtract.details,
    };
  }

  return { ok: true, executedDbInstall };
}

export async function finalizeVerticalAppDeployment(
  ctx: VerticalAppInstallContext,
): Promise<VerticalAppInstallResult> {
  const { packageId, version, manifest, actorId } = ctx;

  const deploymentResult = await applyPluginDeployment(packageId, version, manifest, actorId);
  if (deploymentResult.ok === false) {
    return {
      ok: false,
      error: deploymentResult.error,
      code: 'conflict_denied',
      details: deploymentResult.details,
    };
  }

  const smoke = runVerticalAppInstallSmokeTest(manifest, packageId, version);
  const smokeWarnings = smoke.checks
    .filter((check) => !check.ok)
    .map((check) => check.message);

  return {
    ok: true,
    deploymentStatus: deploymentResult.status,
    smokeWarnings,
  };
}

export async function runVerticalAppInstallOrchestration(
  ctx: VerticalAppInstallContext,
): Promise<VerticalAppInstallResult> {
  const prepared = await prepareVerticalAppRuntime(ctx);
  if (prepared.ok === false) {
    return prepared;
  }

  return finalizeVerticalAppDeployment(ctx);
}

export async function rollbackFailedVerticalAppInstall(
  packageId: string,
  version: string,
  manifest: AnyPackageManifest,
  targetDataSource: string,
): Promise<void> {
  if (!isVerticalAppManifest(manifest)) return;
  await rollbackVerticalInstallArtifacts(
    packageId,
    version,
    manifest,
    targetDataSource,
    true,
  );
}

export function isVerticalAppPackage(manifest: AnyPackageManifest | null): manifest is VerticalAppManifest {
  return Boolean(manifest && isVerticalAppManifest(manifest));
}

export async function applyPendingVerticalAppDeployment(
  packageId: string,
  actorId: number | null,
): Promise<VerticalAppInstallFailure | { ok: true }> {
  const state = readInstallStateV1(packageId);
  if (!state || state.status !== 'installed' || !state.activeVersion) {
    return {
      ok: false,
      error: `Package "${packageId}" is not installed.`,
      code: 'not_found',
    };
  }

  if (state.deploymentStatus !== 'pending') {
    return {
      ok: false,
      error: `Package "${packageId}" does not have a pending deployment proposal.`,
      code: 'conflict_denied',
    };
  }

  const preview = readDeploymentPreview(packageId);
  if (!preview) {
    return {
      ok: false,
      error: `Deployment preview for package "${packageId}" was not found.`,
      code: 'not_found',
    };
  }

  const selection = resolveVersionForInstall(packageId, state.activeVersion);
  if (!selection) {
    return {
      ok: false,
      error: `Installed version for package "${packageId}" could not be resolved.`,
      code: 'not_found',
    };
  }

  const manifest = parseManifestFile(selection.manifestPath);
  if (!manifest || !isVerticalAppManifest(manifest)) {
    return {
      ok: false,
      error: `Package "${packageId}" manifest is not a vertical-app package.`,
      code: 'invalid_manifest',
    };
  }

  const deploymentResult = await confirmPluginDeployment(
    packageId,
    state.activeVersion,
    manifest,
    actorId,
  );
  if (deploymentResult.ok === false) {
    return {
      ok: false,
      error: deploymentResult.error,
      code: 'conflict_denied',
      details: deploymentResult.details,
    };
  }

  return { ok: true };
}
