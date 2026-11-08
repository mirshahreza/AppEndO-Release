import type { PackageManifest } from '../../../core/packages/PackageManifestValidator';
import type { LifecycleStatusCode } from '../../domain/package-domain/types';
import { isVerticalAppManifest } from '../../../core/packages/PackageManifestValidator';
import { resolveVersionForInstall, parseManifestFile } from '../../domain/package-domain/manifestRepository';
import { readInstallStateV1 } from '../../domain/package-domain/installStateRepository';
import {
  applyExtensionUiRoutes,
  collectExtensionUiRoutesConflicts,
  confirmExtensionUiRoutes,
  hasExtensionUiRoutes,
} from './extensionUiRoutes.service';
import { readPackageRegistryProposalPreview } from './extensionUiRoutes.service';
import { isExtensionUiRoutesPreview } from '../../../shared/api/contracts/package-manifest/deploymentPreview';

export type ExtensionUiRoutesInstallFailure = {
  ok: false;
  error: string;
  code: LifecycleStatusCode;
  details?: string[];
};

export async function runExtensionUiRoutesPreflight(
  packageId: string,
  manifest: PackageManifest,
): Promise<ExtensionUiRoutesInstallFailure | null> {
  if (!hasExtensionUiRoutes(manifest)) {
    return null;
  }

  const conflicts = await collectExtensionUiRoutesConflicts(packageId, manifest);
  if (conflicts.length > 0) {
    return {
      ok: false,
      error: 'Install blocked due to extension UI route conflicts.',
      code: 'conflict_denied',
      details: conflicts.map((item) => item.message),
    };
  }

  return null;
}

export async function finalizeExtensionUiRoutes(
  packageId: string,
  version: string,
  manifest: PackageManifest,
  actorId: number | null,
): Promise<ExtensionUiRoutesInstallFailure | { ok: true; deploymentStatus: 'none' | 'pending' | 'applied' }> {
  if (!hasExtensionUiRoutes(manifest)) {
    return { ok: true, deploymentStatus: 'none' };
  }

  const proposed = await applyExtensionUiRoutes(packageId, version, manifest, actorId);
  if (proposed.ok === false) {
    return {
      ok: false,
      error: proposed.error,
      code: 'conflict_denied',
      details: proposed.details,
    };
  }

  if (proposed.status === 'applied') {
    return { ok: true, deploymentStatus: 'applied' };
  }

  const confirmed = await confirmExtensionUiRoutes(packageId, version, manifest, actorId);
  if (confirmed.ok === false) {
    return {
      ok: false,
      error: confirmed.error,
      code: 'conflict_denied',
      details: confirmed.details,
    };
  }

  return { ok: true, deploymentStatus: 'applied' };
}

export async function applyPendingExtensionUiRoutes(
  packageId: string,
  actorId: number | null,
): Promise<ExtensionUiRoutesInstallFailure | { ok: true }> {
  const state = readInstallStateV1(packageId);
  if (!state || state.status !== 'installed' || !state.activeVersion) {
    return {
      ok: false,
      error: `Package "${packageId}" is not installed.`,
      code: 'not_found',
    };
  }

  if (state.deploymentStatus === 'applied') {
    return { ok: true };
  }

  if (state.deploymentStatus !== 'pending') {
    return {
      ok: false,
      error: `Package "${packageId}" does not have a pending deployment proposal.`,
      code: 'conflict_denied',
    };
  }

  const preview = readPackageRegistryProposalPreview(packageId);
  if (!preview || !isExtensionUiRoutesPreview(preview)) {
    return {
      ok: false,
      error: `UI routes preview for package "${packageId}" was not found.`,
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
  if (!manifest || isVerticalAppManifest(manifest)) {
    return {
      ok: false,
      error: `Package "${packageId}" manifest is not an extension package.`,
      code: 'invalid_manifest',
    };
  }

  const result = await confirmExtensionUiRoutes(
    packageId,
    state.activeVersion,
    manifest,
    actorId,
  );
  if (result.ok === false) {
    return {
      ok: false,
      error: result.error,
      code: 'conflict_denied',
      details: result.details,
    };
  }

  return { ok: true };
}
