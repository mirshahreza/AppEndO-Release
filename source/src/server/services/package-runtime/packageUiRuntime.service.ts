import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import type { PackageManifest } from '../../../core/packages/PackageManifestValidator';
import { readManifestCapabilityArray } from '../../../core/packages/manifestCapabilityArrays';
import { buildPackageUiModuleUrl } from '../../../shared/api/contracts/package-manifest/extensionUiRoutes';
import { atomicWriteBinary, packageDirs, readPackageIndex } from '../../../core/packages/PackageFileStore';
import { readObjectRegistry } from '../../domain/package-domain/objectRegistryRepository';
import { getEnabledInstalledVersionsMap, getInstalledVersionsMap } from '../../domain/package-domain/installStateRepository';

export type ActiveSlotComponent = {
  slotId: string;
  packageId: string;
  componentKey: string;
  order: number;
  version: string;
  moduleUrl: string;
};

export type UiRuntimeExtractResult =
  | { ok: true; extractedCount: number }
  | { ok: false; error: string; details?: string[] };

export type UiModuleResolveResult =
  | { ok: true; absPath: string; contentType: string }
  | { ok: false; error: string; statusCode: number };

const UI_MODULE_CONTENT_TYPES: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.jsx': 'text/javascript; charset=utf-8',
  '.ts': 'text/javascript; charset=utf-8',
  '.tsx': 'text/javascript; charset=utf-8',
};

function normalizeZipEntryName(entryName: string): string {
  return entryName.replace(/\\/g, '/').replace(/^\.\//, '');
}

export function isSafeRelativeEntry(entry: string): boolean {
  const normalized = normalizeZipEntryName(entry.trim());
  if (!normalized) return false;
  if (path.posix.isAbsolute(normalized)) return false;
  if (normalized === '..' || normalized.startsWith('../')) return false;
  const segments = normalized.split('/').filter(Boolean);
  return !segments.includes('..');
}

export function getPackageRuntimeRoot(packageId: string, version: string): string {
  return path.join(packageDirs.runtimes, packageId, version);
}

export { buildPackageUiModuleUrl } from '../../../shared/api/contracts/package-manifest/extensionUiRoutes';

function resolveArtifactPath(packageId: string, version: string): string | null {
  const index = readPackageIndex();
  const entry = index.packages.find((pkg) => pkg.packageId === packageId);
  const versionEntry = entry?.versions.find((item) => item.version === version);
  if (!versionEntry?.artifactPath) return null;
  return path.join(packageDirs.root, versionEntry.artifactPath.replace(/\\/g, '/'));
}

export function resolveRuntimeEntryPath(packageId: string, version: string, entry: string): string | null {
  if (!isSafeRelativeEntry(entry)) return null;
  const normalizedEntry = normalizeZipEntryName(entry);
  const runtimeRoot = getPackageRuntimeRoot(packageId, version);
  const absPath = path.resolve(runtimeRoot, normalizedEntry);
  const relative = path.relative(runtimeRoot, absPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return absPath;
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

function collectUiRuntimeEntries(manifest: PackageManifest): Array<{ key: string; entry: string }> {
  const entries: Array<{ key: string; entry: string }> = [];

  for (const ui of readManifestCapabilityArray(manifest.capabilities.ui_components)) {
    entries.push({ key: ui.componentKey, entry: ui.entry });
    if (ui.draftEntry?.trim()) {
      entries.push({ key: `${ui.componentKey}:draft`, entry: ui.draftEntry.trim() });
    }
  }

  for (const route of manifest.capabilities.ui_routes ?? []) {
    entries.push({ key: route.pageKey, entry: route.entry });
  }

  return entries;
}

export function extractPackageUiRuntime(
  packageId: string,
  version: string,
  manifest: PackageManifest,
): UiRuntimeExtractResult {
  const runtimeEntries = collectUiRuntimeEntries(manifest);
  if (runtimeEntries.length === 0) {
    return { ok: true, extractedCount: 0 };
  }

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

  for (const ui of runtimeEntries) {
    const entry = normalizeZipEntryName(ui.entry);
    if (!isSafeRelativeEntry(entry)) {
      details.push(`Unsafe UI entry path "${ui.entry}" for key "${ui.key}".`);
      continue;
    }

    const payload = zipEntries.get(entry);
    if (!payload) {
      details.push(`UI entry "${ui.entry}" is missing from artifact for key "${ui.key}".`);
      continue;
    }

    const targetPath = resolveRuntimeEntryPath(packageId, version, entry);
    if (!targetPath) {
      details.push(`UI entry "${ui.entry}" resolved outside runtime root for key "${ui.key}".`);
      continue;
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    atomicWriteBinary(targetPath, payload);
    extractedCount += 1;
  }

  if (details.length > 0) {
    return {
      ok: false,
      error: 'Failed to extract one or more package UI runtime entries.',
      details,
    };
  }

  return { ok: true, extractedCount };
}

export function removePluginUiRuntime(packageId: string, version?: string): void {
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

function pruneEmptyRuntimeDirectories(runtimeRoot: string): void {
  if (!fs.existsSync(runtimeRoot)) return;

  const entries = fs.readdirSync(runtimeRoot);
  if (entries.length === 0) {
    fs.rmSync(runtimeRoot, { recursive: true, force: true });
    return;
  }

  for (const entry of entries) {
    const absPath = path.join(runtimeRoot, entry);
    if (!fs.statSync(absPath).isDirectory()) continue;
    pruneEmptyRuntimeDirectories(absPath);
  }

  if (fs.existsSync(runtimeRoot) && fs.readdirSync(runtimeRoot).length === 0) {
    fs.rmSync(runtimeRoot, { recursive: true, force: true });
  }
}

export function removePackageRuntimeEntries(
  packageId: string,
  version: string,
  entries: string[],
): void {
  if (entries.length === 0) return;

  for (const entry of entries) {
    const absPath = resolveRuntimeEntryPath(packageId, version, entry);
    if (!absPath || !fs.existsSync(absPath)) continue;
    fs.rmSync(absPath, { force: true });
  }

  pruneRuntimeTree(packageId, version);
}

function listRelativeRuntimeFiles(runtimeRoot: string, relativeDir = ''): string[] {
  const absoluteDir = relativeDir ? path.join(runtimeRoot, relativeDir) : runtimeRoot;
  if (!fs.existsSync(absoluteDir)) return [];

  const files: string[] = [];
  for (const entry of fs.readdirSync(absoluteDir)) {
    const relativePath = relativeDir ? `${relativeDir}/${entry}` : entry;
    const absolutePath = path.join(runtimeRoot, relativePath);
    if (fs.statSync(absolutePath).isDirectory()) {
      files.push(...listRelativeRuntimeFiles(runtimeRoot, relativePath.replace(/\\/g, '/')));
      continue;
    }
    files.push(relativePath.replace(/\\/g, '/'));
  }
  return files;
}

function pruneRuntimeTree(packageId: string, version: string): void {
  const runtimeRoot = getPackageRuntimeRoot(packageId, version);
  pruneEmptyRuntimeDirectories(runtimeRoot);

  const pluginRuntimeRoot = path.join(packageDirs.runtimes, packageId);
  if (fs.existsSync(pluginRuntimeRoot) && fs.readdirSync(pluginRuntimeRoot).length === 0) {
    fs.rmSync(pluginRuntimeRoot, { recursive: true, force: true });
  }
}

export function removeUnprotectedPackageRuntimeFiles(
  packageId: string,
  version: string,
  protectedRelativeEntries: Iterable<string>,
): number {
  const runtimeRoot = getPackageRuntimeRoot(packageId, version);
  if (!fs.existsSync(runtimeRoot)) return 0;

  const protectedEntries = new Set(
    [...protectedRelativeEntries].map((entry) => normalizeZipEntryName(entry)),
  );

  let removedCount = 0;
  for (const relativePath of listRelativeRuntimeFiles(runtimeRoot)) {
    const normalizedPath = normalizeZipEntryName(relativePath);
    if (protectedEntries.has(normalizedPath)) continue;

    const absPath = path.join(runtimeRoot, normalizedPath);
    if (!fs.existsSync(absPath)) continue;
    fs.rmSync(absPath, { force: true });
    removedCount += 1;
  }

  pruneRuntimeTree(packageId, version);
  return removedCount;
}

export function ensurePluginUiRuntimeExtracted(
  packageId: string,
  version: string,
  manifest: PackageManifest,
): UiRuntimeExtractResult {
  const runtimeEntries = collectUiRuntimeEntries(manifest);
  if (runtimeEntries.length === 0) {
    return { ok: true, extractedCount: 0 };
  }

  const runtimeRoot = getPackageRuntimeRoot(packageId, version);
  const missing = runtimeEntries.some((ui) => {
    const absPath = resolveRuntimeEntryPath(packageId, version, ui.entry);
    return !absPath || !fs.existsSync(absPath);
  });

  if (!missing) {
    return { ok: true, extractedCount: runtimeEntries.length };
  }

  if (fs.existsSync(runtimeRoot)) {
    fs.rmSync(runtimeRoot, { recursive: true, force: true });
  }

  return extractPackageUiRuntime(packageId, version, manifest);
}

export function resolveUiComponentModule(
  packageId: string,
  componentKey: string,
): UiModuleResolveResult {
  const installedMap = getInstalledVersionsMap();
  const version = installedMap.get(packageId);
  if (!version) {
    return { ok: false, error: `Package "${packageId}" is not installed.`, statusCode: 404 };
  }

  const enabledMap = getEnabledInstalledVersionsMap();
  if (!enabledMap.has(packageId)) {
    return { ok: false, error: `Package "${packageId}" is disabled.`, statusCode: 404 };
  }

  const registry = readObjectRegistry(packageId);
  const uiRecord = registry?.records.uiComponents.find((item) => item.componentKey === componentKey);
  const routeRecord = (registry?.records.uiRoutes ?? []).find((item) => item.pageKey === componentKey);
  const runtimeRecord = uiRecord ?? routeRecord;
  if (!runtimeRecord) {
    return {
      ok: false,
      error: `UI module "${componentKey}" is not registered for package "${packageId}".`,
      statusCode: 404,
    };
  }

  const absPath = resolveRuntimeEntryPath(packageId, version, runtimeRecord.entry);
  if (!absPath || !fs.existsSync(absPath)) {
    return {
      ok: false,
      error: `UI runtime entry "${runtimeRecord.entry}" is not available for package "${packageId}".`,
      statusCode: 404,
    };
  }

  const ext = path.extname(absPath).toLowerCase();
  const contentType = UI_MODULE_CONTENT_TYPES[ext] ?? 'text/javascript; charset=utf-8';
  return { ok: true, absPath, contentType };
}

export function listActiveSlotComponents(): ActiveSlotComponent[] {
  const installedMap = getEnabledInstalledVersionsMap();
  const items: ActiveSlotComponent[] = [];

  for (const [packageId, version] of installedMap.entries()) {
    const registry = readObjectRegistry(packageId);
    if (!registry) continue;

    const routedEntries = new Set(
      (registry.records.uiRoutes ?? [])
        .map((route) => route.entry.trim())
        .filter(Boolean),
    );

    for (const ui of registry.records.uiComponents) {
      if (routedEntries.has(ui.entry.trim())) {
        continue;
      }
      items.push({
        slotId: ui.slotId,
        packageId,
        componentKey: ui.componentKey,
        order: ui.order,
        version,
        moduleUrl: buildPackageUiModuleUrl(packageId, ui.componentKey, version),
      });
    }
  }

  return items.sort((left, right) => (
    left.slotId.localeCompare(right.slotId)
    || left.order - right.order
    || left.packageId.localeCompare(right.packageId)
    || left.componentKey.localeCompare(right.componentKey)
  ));
}
