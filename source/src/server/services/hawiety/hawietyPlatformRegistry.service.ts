/**
 * Hawiety platform registry — publish on package install, unpublish on rollback.
 * Default workspace must not expose Hawiety portal/nav until the package is installed.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  deleteNavigationFile,
  deletePageModuleFile,
  deleteRouteBindingFile,
  deleteShellFile,
  listPageModuleFiles,
  listRouteBindingFiles,
  readNavigationFile,
  touchPlatformRegistryIndex,
  writeNavigationFile,
  writePageModuleFile,
  writeRouteBindingFile,
  writeShellFile,
} from '../../../core/platform-registry/PlatformRegistryFileStore';
import { platformRegistryDirs } from '../../../core/platform-registry/platformRegistryPaths';
import {
  HAWIETY_PACKAGE_ID,
  HAWIETY_PORTAL_SEGMENT,
  isHawietyHostPageKey,
  isHawietyRoutePattern,
} from '../../../core/packages/hawietyPackage';
import type { NavigationManifest } from '../../../shared/api/contracts/platform/navigation';
import type { PlatformPageModule, PlatformRouteBinding, PlatformShell } from '../../../shared/api/contracts/platform/types';
import { invalidatePlatformRuntimeConfig } from '../platform/platformRuntimeConfig.service';

export const HAWIETY_REGISTRY_SNAPSHOT_ROOT = path.join(
  process.cwd(),
  'scripts/hawiety-pack/registry-snapshot',
);

function snapshotPath(...segments: string[]): string {
  return path.join(HAWIETY_REGISTRY_SNAPSHOT_ROOT, ...segments);
}

function isHawietyOwnedBinding(binding: PlatformRouteBinding): boolean {
  return binding.ownerPackageId === HAWIETY_PACKAGE_ID || isHawietyRoutePattern(binding.routePattern);
}

function stampOwner<T extends { ownerPackageId?: string | null; source?: string | null }>(row: T): T {
  return {
    ...row,
    ownerPackageId: HAWIETY_PACKAGE_ID,
    source: row.source ?? `package:${HAWIETY_PACKAGE_ID}`,
  };
}

/** Capture workspace Hawiety registry into `scripts/hawiety-pack/registry-snapshot/`. */
export function ensureHawietyRegistrySnapshotFromWorkspace(): void {
  const nav = readNavigationFile(HAWIETY_PORTAL_SEGMENT);
  if (nav) {
    fs.mkdirSync(snapshotPath('navigation'), { recursive: true });
    fs.writeFileSync(
      snapshotPath('navigation/hawiety.json'),
      `${JSON.stringify(stampOwner({ ...nav, id: nav.id ?? HAWIETY_PORTAL_SEGMENT }), null, 2)}\n`,
      'utf8',
    );
  }

  const shellPath = path.join(platformRegistryDirs.shells, 'hawiety.json');
  if (fs.existsSync(shellPath)) {
    const shell = JSON.parse(fs.readFileSync(shellPath, 'utf8')) as PlatformShell;
    fs.mkdirSync(snapshotPath('shells'), { recursive: true });
    fs.writeFileSync(snapshotPath('shells/hawiety.json'), `${JSON.stringify(stampOwner(shell), null, 2)}\n`, 'utf8');
  }

  fs.mkdirSync(snapshotPath('route-bindings'), { recursive: true });
  const activeBindingIds = new Set<string>();
  for (const binding of listRouteBindingFiles()) {
    if (!isHawietyOwnedBinding(binding)) continue;
    activeBindingIds.add(String(binding.id));
    fs.writeFileSync(
      snapshotPath('route-bindings', `${binding.id}.json`),
      `${JSON.stringify(stampOwner(binding), null, 2)}\n`,
      'utf8',
    );
  }
  for (const fileName of fs.readdirSync(snapshotPath('route-bindings'))) {
    if (!fileName.endsWith('.json')) continue;
    const id = fileName.replace(/\.json$/, '');
    if (!activeBindingIds.has(id)) {
      fs.unlinkSync(snapshotPath('route-bindings', fileName));
    }
  }

  fs.mkdirSync(snapshotPath('page-modules'), { recursive: true });
  const activePageModuleKeys = new Set<string>();
  for (const pageModule of listPageModuleFiles()) {
    if (!isHawietyHostPageKey(pageModule.pageKey)) continue;
    activePageModuleKeys.add(pageModule.pageKey);
    fs.writeFileSync(
      snapshotPath('page-modules', `${pageModule.pageKey}.json`),
      `${JSON.stringify(stampOwner(pageModule), null, 2)}\n`,
      'utf8',
    );
  }
  for (const fileName of fs.readdirSync(snapshotPath('page-modules'))) {
    if (!fileName.endsWith('.json')) continue;
    const pageKey = fileName.replace(/\.json$/, '');
    if (!activePageModuleKeys.has(pageKey)) {
      fs.unlinkSync(snapshotPath('page-modules', fileName));
    }
  }
}

export function publishHawietyPlatformRegistryFromSnapshot(): number {
  if (!fs.existsSync(HAWIETY_REGISTRY_SNAPSHOT_ROOT)) {
    ensureHawietyRegistrySnapshotFromWorkspace();
  }

  let written = 0;

  const navFile = snapshotPath('navigation/hawiety.json');
  if (fs.existsSync(navFile)) {
    const manifest = JSON.parse(fs.readFileSync(navFile, 'utf8')) as NavigationManifest;
    writeNavigationFile({ ...manifest, id: manifest.id ?? HAWIETY_PORTAL_SEGMENT });
    written += 1;
  }

  const shellFile = snapshotPath('shells/hawiety.json');
  if (fs.existsSync(shellFile)) {
    const shell = JSON.parse(fs.readFileSync(shellFile, 'utf8')) as PlatformShell;
    writeShellFile(stampOwner(shell));
    written += 1;
  }

  const bindingsDir = snapshotPath('route-bindings');
  if (fs.existsSync(bindingsDir)) {
    for (const fileName of fs.readdirSync(bindingsDir)) {
      if (!fileName.endsWith('.json')) continue;
      const binding = JSON.parse(fs.readFileSync(path.join(bindingsDir, fileName), 'utf8')) as PlatformRouteBinding;
      writeRouteBindingFile(stampOwner(binding));
      written += 1;
    }
  }

  const modulesDir = snapshotPath('page-modules');
  if (fs.existsSync(modulesDir)) {
    for (const fileName of fs.readdirSync(modulesDir)) {
      if (!fileName.endsWith('.json')) continue;
      const pageModule = JSON.parse(fs.readFileSync(path.join(modulesDir, fileName), 'utf8')) as PlatformPageModule;
      writePageModuleFile(stampOwner(pageModule));
      written += 1;
    }
  }

  touchPlatformRegistryIndex();
  invalidatePlatformRuntimeConfig();
  return written;
}

export function unpublishHawietyPlatformRegistry(): number {
  let removed = 0;

  if (readNavigationFile(HAWIETY_PORTAL_SEGMENT)) {
    deleteNavigationFile(HAWIETY_PORTAL_SEGMENT);
    removed += 1;
  }

  const shellPath = path.join(platformRegistryDirs.shells, 'hawiety.json');
  if (fs.existsSync(shellPath)) {
    deleteShellFile(HAWIETY_PORTAL_SEGMENT);
    removed += 1;
  }

  for (const binding of listRouteBindingFiles()) {
    if (!isHawietyOwnedBinding(binding)) continue;
    deleteRouteBindingFile(binding.id);
    removed += 1;
  }

  for (const pageModule of listPageModuleFiles()) {
    if (!isHawietyHostPageKey(pageModule.pageKey)) continue;
    deletePageModuleFile(pageModule.pageKey);
    removed += 1;
  }

  touchPlatformRegistryIndex();
  invalidatePlatformRuntimeConfig();
  return removed;
}
