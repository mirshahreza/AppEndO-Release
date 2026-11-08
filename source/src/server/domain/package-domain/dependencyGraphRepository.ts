import fs from 'fs';
import {
  atomicWriteText,
  ensurePackageStorageDirs,
  packageDirs,
} from '../../../core/packages/PackageFileStore';
import {
  buildDependencyGraph,
  satisfiesVersionRange,
  type DependencyGraph,
  type InstalledPluginDependencyInput,
} from '../../../core/packages/DependencyResolver';
import { getInstalledVersionsMap } from './installStateRepository';
import { parseManifestFile, resolveVersionForInstall } from './manifestRepository';
import { GRAPH_PATH } from './storage';

export function getInstalledDependencyInputs(): InstalledPluginDependencyInput[] {
  const inputs: InstalledPluginDependencyInput[] = [];
  for (const [installedPluginId, installedVersion] of getInstalledVersionsMap()) {
    const selected = resolveVersionForInstall(installedPluginId, installedVersion);
    if (!selected) continue;
    const installedManifest = parseManifestFile(selected.manifestPath);
    if (!installedManifest) continue;
    inputs.push({
      packageId: installedPluginId,
      version: installedVersion,
      manifest: installedManifest,
    });
  }
  return inputs;
}

export function detectReverseDependencies(packageId: string, installedVersion: string): string[] {
  const blockers: string[] = [];
  const installed = getInstalledVersionsMap();

  for (const [ownerPackageId, ownerVersion] of installed.entries()) {
    if (ownerPackageId === packageId) continue;
    const selected = resolveVersionForInstall(ownerPackageId, ownerVersion);
    if (!selected) continue;
    const manifest = parseManifestFile(selected.manifestPath);
    if (!manifest) continue;
    for (const dep of manifest.dependencies ?? []) {
      if (dep.packageId !== packageId) continue;
      if (satisfiesVersionRange(installedVersion, dep.versionRange)) {
        blockers.push(ownerPackageId);
      }
    }
  }

  return blockers;
}

export function writeDependencyGraph(): void {
  fs.mkdirSync(packageDirs.dependencies, { recursive: true });
  atomicWriteText(GRAPH_PATH, JSON.stringify(buildDependencyGraph(getInstalledDependencyInputs()), null, 2));
}

export function getDependencyGraph(): DependencyGraph {
  ensurePackageStorageDirs();
  if (!fs.existsSync(GRAPH_PATH)) {
    writeDependencyGraph();
  }

  try {
    return JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8')) as DependencyGraph;
  } catch {
    const rebuilt = buildDependencyGraph(getInstalledDependencyInputs());
    atomicWriteText(GRAPH_PATH, JSON.stringify(rebuilt, null, 2));
    return rebuilt;
  }
}
