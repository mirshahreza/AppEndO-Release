import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import type { PackageManifest } from '../../../core/packages/PackageManifestValidator';
import { packageDirs, readPackageIndex } from '../../../core/packages/PackageFileStore';
import { normalizeQuerySurfaceBindingDocument } from '../../../shared/api/contracts/data-api';
import { deleteQuerySurfaceBinding, saveQuerySurfaceBinding } from '../query-surface/querySurfaceBindingStore';

export type PackageQuerySurfaceInstallResult =
  | { ok: true; installed: { bindings: string[] } }
  | { ok: false; error: string; details: string[]; installed: { bindings: string[] } };

function normalizeZipEntryName(entryName: string): string {
  return entryName.replace(/\\/g, '/').replace(/^\.\//, '');
}

function resolveArtifactPath(packageId: string, version: string): string | null {
  const index = readPackageIndex();
  const entry = index.packages.find((pkg) => pkg.packageId === packageId);
  const versionEntry = entry?.versions.find((item) => item.version === version);
  if (!versionEntry?.artifactPath) return null;
  return path.join(packageDirs.root, versionEntry.artifactPath.replace(/\\/g, '/'));
}

function readJsonFromArtifact(artifactPath: string, entryPath: string): unknown {
  const zip = new AdmZip(artifactPath);
  const normalized = normalizeZipEntryName(entryPath);
  const entry = zip.getEntries().find((item) => normalizeZipEntryName(item.entryName) === normalized);
  if (!entry || entry.isDirectory) return undefined;
  return JSON.parse(entry.getData().toString('utf8'));
}

export async function installPackageQuerySurfaceData(
  packageId: string,
  version: string,
  manifest: PackageManifest,
): Promise<PackageQuerySurfaceInstallResult> {
  const bindings = manifest.capabilities.query_surface_bindings ?? [];
  if (bindings.length === 0) {
    return { ok: true, installed: { bindings: [] } };
  }

  const artifactPath = resolveArtifactPath(packageId, version);
  if (!artifactPath || !fs.existsSync(artifactPath)) {
    return {
      ok: false,
      error: `Artifact for package "${packageId}"@${version} was not found.`,
      details: [],
      installed: { bindings: [] },
    };
  }

  const details: string[] = [];
  const installedBindings: string[] = [];

  for (const item of bindings) {
    const raw = readJsonFromArtifact(artifactPath, item.entry);
    if (raw === undefined) {
      details.push(`Query surface binding entry "${item.entry}" is missing from artifact.`);
      continue;
    }
    const normalized = normalizeQuerySurfaceBindingDocument(raw);
    if (!normalized.ok) {
      details.push(`Query surface binding "${item.edgeModelId}" failed: ${normalized.message}`);
      continue;
    }
    try {
      saveQuerySurfaceBinding(normalized.binding);
      installedBindings.push(normalized.binding.edgeModelId);
    } catch (error: unknown) {
      details.push(`Query surface binding "${item.edgeModelId}" failed: ${error instanceof Error ? error.message : 'save error'}`);
    }
  }

  if (details.length > 0) {
    return {
      ok: false,
      error: 'One or more query surface bindings failed to install.',
      details,
      installed: { bindings: installedBindings },
    };
  }

  return { ok: true, installed: { bindings: installedBindings } };
}

export function uninstallPackageQuerySurfaceData(installed: { bindings: string[] }): void {
  for (const edgeModelId of installed.bindings) {
    deleteQuerySurfaceBinding(edgeModelId);
  }
}
