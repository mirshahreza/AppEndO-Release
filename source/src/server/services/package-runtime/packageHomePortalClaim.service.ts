/**
 * Lets a package claim the built-in `home-shell` while it is installed (public site)
 * and restores the shipped Studio redirect on uninstall.
 *
 * Built-in home cannot be published via `capabilities.portals` (`isBuiltInPortal`).
 * This sidecar is the reversible equivalent of `navigation_patches`.
 */
import fs from 'fs';
import path from 'path';
import { packageDirs, atomicWriteText } from '../../../core/packages/PackageFileStore';
import {
  applyHomeShellClaim,
  isPublicSitePackageId,
  parsePackageHomePortalPayload,
  type PackageHomePortalPayload,
} from '../../../core/packages/packageHomePortal';
import type { PackageManifest } from '../../../core/packages/PackageManifestValidator';
import { loadPlatformRegistryDefaultShells } from '../../../core/platform-registry/loadPlatformRegistryDefaults';
import {
  readShellFile,
  touchPlatformRegistryIndex,
  withPlatformRegistryLock,
  writeShellFile,
} from '../../../core/platform-registry/PlatformRegistryFileStore';
import type { PlatformRegistryActor } from '../../../core/platform-registry/platformRegistryAudit';
import { HOME_SHELL_KEY } from '../../../shared/api/contracts/platform/mountConstants';
import type { PlatformShell } from '../../../shared/api/contracts/platform/types';
import { readPackageZipTextEntry } from '../package/packageWorkspaceAssetInstall.service';
import { updatePlatformShell } from '../../domain/platform/shellRepository';
import { invalidatePlatformRuntimeConfig } from '../platform/platformRuntimeConfig.service';

type HomePortalClaimRecord = {
  schema: 'package-home-portal-claim';
  schemaVersion: '1.0.0';
  packageId: string;
  version: string;
  appliedAt: string;
};

function packageActor(packageId: string): PlatformRegistryActor {
  return { userId: null, username: `package:${packageId}` };
}

function claimPath(): string {
  return path.join(packageDirs.installed, 'home-portal.claim.json');
}

function readClaim(): HomePortalClaimRecord | null {
  const p = claimPath();
  if (!fs.existsSync(p)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8')) as HomePortalClaimRecord;
    if (parsed?.schema !== 'package-home-portal-claim' || !parsed.packageId?.trim()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeClaim(record: HomePortalClaimRecord): void {
  fs.mkdirSync(packageDirs.installed, { recursive: true });
  atomicWriteText(claimPath(), `${JSON.stringify(record, null, 2)}\n`);
}

function deleteClaim(): void {
  const p = claimPath();
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

function getBuiltInHomeShellDefault(): PlatformShell | undefined {
  return loadPlatformRegistryDefaultShells().find((shell) => shell.shellKey === HOME_SHELL_KEY);
}

async function writeHomeShell(
  next: PlatformShell,
  actor: PlatformRegistryActor,
): Promise<void> {
  const current = readShellFile(HOME_SHELL_KEY);
  if (!current) {
    withPlatformRegistryLock(() => {
      writeShellFile({
        ...next,
        shellKey: HOME_SHELL_KEY,
        ownerPackageId: null,
        ownerPluginVersion: null,
      });
      touchPlatformRegistryIndex();
    });
    return;
  }

  await updatePlatformShell(
    HOME_SHELL_KEY,
    {
      name: next.name,
      entry: next.entry,
      surface: next.surface,
      enabled: next.enabled,
      entryMode: next.entryMode ?? 'shell',
      redirectToSegment: next.redirectToSegment ?? null,
      redirectToCulture: next.redirectToCulture ?? null,
      auth: next.auth ?? current.auth ?? null,
      navigationRef: next.navigationRef ?? null,
      source: next.source ?? 'package-home-portal',
    },
    actor,
  );
}

async function restoreHomeShellToPlatformDefault(actor: PlatformRegistryActor): Promise<void> {
  const defaultShell = getBuiltInHomeShellDefault();
  if (!defaultShell) return;
  await writeHomeShell(defaultShell, actor);
}

export function hasPackageHomePortalCapability(manifest: PackageManifest): boolean {
  return (manifest.capabilities.home_portal?.length ?? 0) > 0;
}

export async function applyPackageHomePortalClaimFromManifest(
  packageId: string,
  version: string,
  manifest: PackageManifest,
): Promise<void> {
  const capability = manifest.capabilities.home_portal?.[0];
  if (!capability) return;

  const existing = readClaim();
  if (existing && existing.packageId !== packageId) {
    throw new Error(
      `Home portal is already claimed by package "${existing.packageId}". Uninstall that package first.`,
    );
  }

  const raw = readPackageZipTextEntry(packageId, version, capability.entry);
  if (!raw) {
    throw new Error(`Home portal entry "${capability.entry}" was missing from the package artifact.`);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`Home portal entry "${capability.entry}" is not valid JSON.`);
  }

  const payload = parsePackageHomePortalPayload(parsedJson);
  if (!payload) {
    throw new Error(
      `Home portal entry "${capability.entry}" must set home-shell to entryMode "shell" with a layout entry.`,
    );
  }

  await applyPackageHomePortalClaim(packageId, version, payload);
}

export async function applyPackageHomePortalClaim(
  packageId: string,
  version: string,
  payload: PackageHomePortalPayload,
): Promise<void> {
  const actor = packageActor(packageId);
  const current = readShellFile(HOME_SHELL_KEY);
  const next = applyHomeShellClaim(current, payload);
  await writeHomeShell({ ...next, source: 'package-home-portal' }, actor);
  writeClaim({
    schema: 'package-home-portal-claim',
    schemaVersion: '1.0.0',
    packageId,
    version,
    appliedAt: new Date().toISOString(),
  });
  invalidatePlatformRuntimeConfig();
}

export async function uninstallPackageHomePortalClaim(packageId: string): Promise<void> {
  const claim = readClaim();
  const ownsClaim = claim?.packageId === packageId;
  const restoreLegacyPublicSite = isPublicSitePackageId(packageId) && (!claim || ownsClaim);
  if (!ownsClaim && !restoreLegacyPublicSite) {
    return;
  }

  await restoreHomeShellToPlatformDefault(packageActor(packageId));
  if (ownsClaim || !claim) {
    deleteClaim();
  }
  invalidatePlatformRuntimeConfig();
}
