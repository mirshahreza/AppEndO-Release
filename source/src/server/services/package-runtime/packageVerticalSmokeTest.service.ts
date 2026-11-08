import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import type { VerticalAppManifest } from '../../../shared/api/contracts/package-manifest/verticalApp';
import { packageDirs, readPackageIndex } from '../../../core/packages/PackageFileStore';

export type VerticalAppSmokeCheck = {
  id: string;
  ok: boolean;
  message: string;
};

export type VerticalAppSmokeTestResult = {
  ok: boolean;
  checks: VerticalAppSmokeCheck[];
};

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

function zipHasEntry(entries: Set<string>, entryPath: string): boolean {
  return entries.has(normalizeZipEntryName(entryPath));
}

export function runVerticalAppInstallSmokeTest(
  manifest: VerticalAppManifest,
  packageId: string,
  version: string,
): VerticalAppSmokeTestResult {
  const checks: VerticalAppSmokeCheck[] = [];

  checks.push({
    id: 'manifest-id-match',
    ok: manifest.id === packageId,
    message: manifest.id === packageId
      ? 'Manifest id matches package artifact.'
      : `Manifest id "${manifest.id}" does not match "${packageId}".`,
  });

  checks.push({
    id: 'shell-entry',
    ok: Boolean(manifest.capabilities.shell.entry),
    message: manifest.capabilities.shell.entry
      ? `Shell entry "${manifest.capabilities.shell.entry}" is declared.`
      : 'Shell entry is missing.',
  });

  for (const page of manifest.capabilities.pages ?? []) {
    checks.push({
      id: `page-${page.pageKey}`,
      ok: Boolean(page.entry),
      message: page.entry
        ? `Page "${page.pageKey}" entry is declared.`
        : `Page "${page.pageKey}" entry is missing.`,
    });
  }

  const artifactPath = resolveArtifactPath(packageId, version);
  if (!artifactPath || !fs.existsSync(artifactPath)) {
    checks.push({
      id: 'artifact-exists',
      ok: false,
      message: 'Artifact ZIP was not found for smoke test.',
    });
    return { ok: checks.every((check) => check.ok), checks };
  }

  checks.push({
    id: 'artifact-exists',
    ok: true,
    message: 'Artifact ZIP is present.',
  });

  const zip = new AdmZip(artifactPath);
  const entries = new Set(
    zip.getEntries().map((entry) => normalizeZipEntryName(entry.entryName)),
  );

  checks.push({
    id: 'shell-entry-zip',
    ok: zipHasEntry(entries, manifest.capabilities.shell.entry),
    message: zipHasEntry(entries, manifest.capabilities.shell.entry)
      ? `Shell entry "${manifest.capabilities.shell.entry}" exists in artifact.`
      : `Shell entry "${manifest.capabilities.shell.entry}" is missing from artifact.`,
  });

  for (const page of manifest.capabilities.pages ?? []) {
    const exists = zipHasEntry(entries, page.entry);
    checks.push({
      id: `page-entry-${page.pageKey}`,
      ok: exists,
      message: exists
        ? `Page entry "${page.entry}" exists in artifact.`
        : `Page entry "${page.entry}" is missing from artifact.`,
    });
  }

  for (const api of manifest.capabilities.apis) {
    const exists = zipHasEntry(entries, api.entry);
    checks.push({
      id: `api-entry-${api.id}`,
      ok: exists,
      message: exists
        ? `API entry "${api.entry}" exists in artifact.`
        : `API entry "${api.entry}" is missing from artifact.`,
    });
  }

  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
}
