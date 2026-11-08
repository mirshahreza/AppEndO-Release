import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import type { VerticalAppManifest } from '../../../shared/api/contracts/package-manifest/verticalApp';
import type { PackageManifest } from '../../../core/packages/PackageManifestValidator';
import { isVerticalAppManifest } from '../../../core/packages/PackageManifestValidator';
import { atomicWriteBinary, packageDirs, readPackageIndex } from '../../../core/packages/PackageFileStore';
import {
  getPackageRuntimeRoot,
  isSafeRelativeEntry,
  resolveRuntimeEntryPath,
} from './packageUiRuntime.service';

function normalizeZipEntryName(entryName: string): string {
  return entryName.replace(/\\/g, '/').replace(/^\.\//, '');
}

export type VerticalRuntimeExtractResult =
  | { ok: true; extractedCount: number }
  | { ok: false; error: string; details?: string[] };

function resolveArtifactPath(packageId: string, version: string): string | null {
  const index = readPackageIndex();
  const entry = index.packages.find((pkg) => pkg.packageId === packageId);
  const versionEntry = entry?.versions.find((item) => item.version === version);
  if (!versionEntry?.artifactPath) return null;
  return path.join(packageDirs.root, versionEntry.artifactPath.replace(/\\/g, '/'));
}

function readZipEntryMap(artifactPath: string): Map<string, Buffer> | null {
  if (!fs.existsSync(artifactPath)) return null;
  const zip = new AdmZip(artifactPath);
  const entries = new Map<string, Buffer>();
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    entries.set(normalizeZipEntryName(entry.entryName), entry.getData());
  }
  return entries;
}

function collectVerticalRuntimeEntries(manifest: VerticalAppManifest): string[] {
  const entries = new Set<string>();
  entries.add(normalizeZipEntryName(manifest.capabilities.shell.entry));

  for (const page of manifest.capabilities.pages ?? []) {
    entries.add(normalizeZipEntryName(page.entry));
  }
  for (const layout of manifest.capabilities.designer_layouts ?? []) {
    entries.add(normalizeZipEntryName(layout.entry));
  }
  for (const asset of manifest.capabilities.static_assets ?? []) {
    entries.add(normalizeZipEntryName(asset.path));
  }

  const navigationEntry = manifest.capabilities.shell.navigationEntry;
  if (navigationEntry) {
    entries.add(normalizeZipEntryName(navigationEntry));
  }
  if (manifest.experience) {
    entries.add('experience/experience.json');
  }

  return [...entries];
}

export function extractPluginVerticalRuntime(
  packageId: string,
  version: string,
  manifest: VerticalAppManifest,
): VerticalRuntimeExtractResult {
  const artifactPath = resolveArtifactPath(packageId, version);
  if (!artifactPath) {
    return { ok: false, error: `Artifact for package "${packageId}"@${version} was not found.` };
  }

  const zipEntries = readZipEntryMap(artifactPath);
  if (!zipEntries) {
    return { ok: false, error: `Artifact for package "${packageId}"@${version} could not be read.` };
  }

  const runtimeRoot = getPackageRuntimeRoot(packageId, version);
  fs.mkdirSync(runtimeRoot, { recursive: true });

  const details: string[] = [];
  let extractedCount = 0;

  for (const entry of collectVerticalRuntimeEntries(manifest)) {
    if (!isSafeRelativeEntry(entry)) {
      details.push(`Unsafe runtime entry path "${entry}".`);
      continue;
    }

    const payload = zipEntries.get(entry);
    if (!payload) {
      details.push(`Runtime entry "${entry}" is missing from artifact.`);
      continue;
    }

    const targetPath = resolveRuntimeEntryPath(packageId, version, entry);
    if (!targetPath) {
      details.push(`Runtime entry "${entry}" resolved outside runtime root.`);
      continue;
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    atomicWriteBinary(targetPath, payload);
    extractedCount += 1;
  }

  if (details.length > 0) {
    return {
      ok: false,
      error: 'Failed to extract one or more vertical-app runtime entries.',
      details,
    };
  }

  return { ok: true, extractedCount };
}

export function removePluginVerticalRuntime(packageId: string, version?: string): void {
  if (version) {
    const runtimeRoot = getPackageRuntimeRoot(packageId, version);
    if (fs.existsSync(runtimeRoot)) {
      fs.rmSync(runtimeRoot, { recursive: true, force: true });
    }
    return;
  }

  const pluginRuntimeRoot = path.join(packageDirs.runtimes, packageId);
  if (fs.existsSync(pluginRuntimeRoot)) {
    fs.rmSync(pluginRuntimeRoot, { recursive: true, force: true });
  }
}

export function manifestForRegistry(manifest: PackageManifest | VerticalAppManifest): PackageManifest {
  if (!isVerticalAppManifest(manifest)) {
    return manifest;
  }

  return {
    $schemaVersion: manifest.$schemaVersion,
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    createdBy: manifest.createdBy,
    requiredAppVersion: manifest.requiredAppVersion,
    dependencies: manifest.dependencies,
    capabilities: {
      apis: manifest.capabilities.apis,
      ui_components: [],
      db_objects: manifest.capabilities.db_objects,
      mcp_servers: manifest.capabilities.mcp_servers ?? [],
      edge_models: [],
      edge_apis: [],
      edge_model_studio_meta: [],
      install_hooks: [],
    },
    overridePolicy: {
      apis: manifest.overridePolicy.apis,
      ui_components: manifest.overridePolicy.ui_components ?? 'deny',
      db_objects: manifest.overridePolicy.db_objects,
      mcp_servers: manifest.overridePolicy.mcp_servers ?? 'deny',
    },
    integrity: manifest.integrity,
  };
}
