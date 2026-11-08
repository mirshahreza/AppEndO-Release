import type { PackageManifest } from '../../../core/packages/PackageManifestValidator';
import type { LifecycleStatusCode } from '../../domain/package-domain/types';
import {
  applyExtensionPlatformCapabilities,
  collectExtensionPlatformCapabilitiesConflicts,
  hasExtensionPlatformCapabilities,
  rollbackExtensionPlatformCapabilities,
} from './extensionPlatformCapabilities.service';
import { seedDesignerShellsFromManifest } from '../platform/designerShellInstall.service';
import { seedPackageWorkspaceAssetsFromZip, seedPackagePlatformFontsFromZip } from '../package/packageWorkspaceAssetInstall.service';
import { seedPackageCultureKeysFromZip, uninstallPackageCultureKeys } from '../package/packageCultureKeysInstall.service';
import {
  applyPackageNavigationPatchesFromManifest,
  uninstallPackageNavigationPatch,
} from './packageNavigationPatch.service';
import {
  applyPackageHomePortalClaimFromManifest,
  uninstallPackageHomePortalClaim,
} from './packageHomePortalClaim.service';

export type ExtensionPlatformCapabilitiesInstallFailure = {
  ok: false;
  error: string;
  code: LifecycleStatusCode;
  details?: string[];
};

export async function runExtensionPlatformCapabilitiesPreflight(
  packageId: string,
  manifest: PackageManifest,
): Promise<ExtensionPlatformCapabilitiesInstallFailure | null> {
  if (!hasExtensionPlatformCapabilities(manifest)) {
    return null;
  }

  const conflicts = collectExtensionPlatformCapabilitiesConflicts(packageId, manifest);
  if (conflicts.length > 0) {
    return {
      ok: false,
      error: 'Install blocked due to extension portal/navigation conflicts.',
      code: 'conflict_denied',
      details: conflicts.map((item) => item.message),
    };
  }

  return null;
}

export async function finalizeExtensionPlatformCapabilities(
  packageId: string,
  version: string,
  manifest: PackageManifest,
): Promise<ExtensionPlatformCapabilitiesInstallFailure | { ok: true }> {
  if (hasExtensionPlatformCapabilities(manifest)) {
    const result = await applyExtensionPlatformCapabilities(packageId, version, manifest);
    if (!result.ok) {
      return {
        ok: false,
        error: result.error,
        code: 'conflict_denied',
        details: result.details,
      };
    }
  }

  seedDesignerShellsFromManifest(packageId, version, manifest);
  seedPackageWorkspaceAssetsFromZip(packageId, version);
  seedPackagePlatformFontsFromZip(packageId, version);
  await seedPackageCultureKeysFromZip(packageId, version, manifest);
  try {
    await applyPackageNavigationPatchesFromManifest(packageId, version, manifest);
    await applyPackageHomePortalClaimFromManifest(packageId, version, manifest);
  } catch (error) {
    await uninstallPackageCultureKeys(packageId);
    await uninstallPackageNavigationPatch(packageId);
    await uninstallPackageHomePortalClaim(packageId);
    return {
      ok: false,
      error: (error as Error).message || 'Failed to apply package navigation patch.',
      code: 'conflict_denied',
    };
  }

  return { ok: true };
}

export async function rollbackInstalledExtensionPlatformCapabilities(
  packageId: string,
  manifest?: PackageManifest | null,
): Promise<void> {
  await rollbackExtensionPlatformCapabilities(packageId, manifest);
  await uninstallPackageHomePortalClaim(packageId);
}
