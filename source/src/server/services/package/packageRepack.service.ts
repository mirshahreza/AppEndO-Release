import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import {
  packageDirs,
  readPackageIndex,
  readPlatformCapabilitiesApplied,
  writePackageIndex,
  atomicWriteBinary,
  acquirePackageLock,
  releasePackageLock,
  type PackageIndexVersion,
} from '../../../core/packages/PackageFileStore';
import {
  readNavigationFile,
  withPlatformRegistryLock,
  writeNavigationFile,
} from '../../../core/platform-registry/PlatformRegistryFileStore';
import type { NavigationManifest } from '../../../shared/api/contracts/platform/navigation';
import {
  isVerticalAppManifest,
  type AnyPackageManifest,
} from '../../../core/packages/PackageManifestValidator';
import { resolveApiMetaEntryPath } from '../../../core/packages/packageApiMetaSidecar';
import { uploadPackageArtifact, applyPackageCatalogMerge } from '../../../core/packages/PackageArtifactService';
import { compareSemver, isValidSemver, maxSemver } from '../../../shared/lib/semver';
import {
  PACKAGE_DESCRIPTION_MAX_LENGTH,
  resolveRepackDescriptionText,
} from '../../../shared/lib/packageRepackDescription';
import type {
  PackageRepackAdditionFile,
  PackageRepackAdditionsPayload,
  PackageRepackChangedItem,
  PackageRepackDriftPreview,
  PackageRepackItemCategory,
  PackageRepackItemDiff,
  PackageRepackRemovalsPayload,
  PackageRepackResult,
} from '../../../shared/api/contracts/package/repack';
import { readManifestCapabilityArray } from '../../../core/packages/manifestCapabilityArrays';
import { parseManifestFile } from '../../domain/package-domain/manifestRepository';
import { readInstallStateV1 } from '../../domain/package-domain/installStateRepository';
import { getDefaultPackageLifecycleCoordinator } from '../package-runtime/packageLifecycle.service';
import { isSafeRelativeEntry, resolveRuntimeEntryPath } from '../package-runtime/packageUiRuntime.service';
import { enrichPackageArtifactBuffer, materializeUiComponentRepackAdditions } from './packageComponentExport.service';
import { DEFAULT_PACKAGE_INSTALL_OVERRIDE_POLICY } from '../../../shared/api/contracts/package-manifest/types';

const DIFF_MAX_CHARS = 120_000;
const DIFF_CONTEXT_LINES = 3;

type RepackFileRef = {
  itemId: string;
  category: PackageRepackItemCategory;
  label: string;
  entryPath: string;
};

type RepackContext =
  | {
      ok: true;
      packageId: string;
      version: string;
      manifest: AnyPackageManifest;
      artifactPath: string;
      artifactEntries: Map<string, Buffer>;
      pluginKind: 'extension' | 'vertical-app';
    }
  | { ok: false; error: string; statusCode: number };

function normalizeZipEntryName(entryName: string): string {
  return entryName.replace(/\\/g, '/').replace(/^\.\//, '');
}

function readArtifactEntryMap(artifactPath: string): Map<string, Buffer> | null {
  if (!fs.existsSync(artifactPath)) return null;
  const zip = new AdmZip(artifactPath);
  const entries = new Map<string, Buffer>();
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    entries.set(normalizeZipEntryName(entry.entryName), entry.getData());
  }
  return entries;
}

function resolveStoragePath(relPath: string): string {
  return path.join(packageDirs.root, relPath.replace(/\\/g, '/'));
}

function snapshotPackageVersions(packageId: string): PackageIndexVersion[] {
  const index = readPackageIndex();
  const entry = index.packages.find((pkg) => pkg.packageId === packageId);
  if (!entry) return [];
  return entry.versions.map((versionEntry) => ({ ...versionEntry }));
}

function snapshotArtifactBytes(versionEntry: PackageIndexVersion): Buffer | null {
  const artifactPath = resolveStoragePath(versionEntry.artifactPath);
  if (!fs.existsSync(artifactPath)) return null;
  return fs.readFileSync(artifactPath);
}

function snapshotManifestText(versionEntry: PackageIndexVersion): string | null {
  const manifestPath = resolveStoragePath(versionEntry.manifestPath);
  if (!fs.existsSync(manifestPath)) return null;
  return fs.readFileSync(manifestPath, 'utf8');
}

function restorePreservedStorageFiles(
  versionEntry: PackageIndexVersion,
  preservedArtifacts: Map<string, Buffer>,
  preservedManifests: Map<string, string>,
): void {
  const artifactBytes = preservedArtifacts.get(versionEntry.version);
  if (artifactBytes) {
    const artifactPath = resolveStoragePath(versionEntry.artifactPath);
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    const shouldRestoreArtifact = !fs.existsSync(artifactPath)
      || !fs.readFileSync(artifactPath).equals(artifactBytes);
    if (shouldRestoreArtifact) {
      atomicWriteBinary(artifactPath, artifactBytes);
    }
  }

  const manifestText = preservedManifests.get(versionEntry.version);
  if (manifestText) {
    const manifestPath = resolveStoragePath(versionEntry.manifestPath);
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    const shouldRestoreManifest = !fs.existsSync(manifestPath)
      || fs.readFileSync(manifestPath, 'utf8') !== manifestText;
    if (shouldRestoreManifest) {
      atomicWriteBinary(manifestPath, Buffer.from(manifestText, 'utf8'));
    }
  }
}

function commitRepackCatalogState(
  packageId: string,
  displayName: string,
  newVersion: string,
  preservedVersions: PackageIndexVersion[],
  preservedArtifacts: Map<string, Buffer>,
  preservedManifests: Map<string, string>,
): string[] {
  const indexLock = 'index';
  const pluginLock = `package-${packageId}`;

  if (!acquirePackageLock(indexLock)) {
    return listPackageVersionLabels(packageId);
  }
  if (!acquirePackageLock(pluginLock)) {
    releasePackageLock(indexLock);
    return listPackageVersionLabels(packageId);
  }

  try {
    for (const versionEntry of preservedVersions) {
      restorePreservedStorageFiles(versionEntry, preservedArtifacts, preservedManifests);
    }

    const index = readPackageIndex();
    const catalogVersions = index.packages
      .filter((entry) => entry.packageId === packageId)
      .flatMap((entry) => entry.versions);
    const newVersionEntry = catalogVersions.find((item) => item.version === newVersion);
    if (!newVersionEntry) {
      return listPackageVersionLabels(packageId);
    }

    const merged = applyPackageCatalogMerge(
      index,
      packageId,
      displayName,
      newVersionEntry,
      preservedVersions,
    );
    writePackageIndex(index);
    return merged.versions.map((item) => item.version);
  } finally {
    releasePackageLock(pluginLock);
    releasePackageLock(indexLock);
  }
}

function listPackageVersionLabels(packageId: string): string[] {
  const index = readPackageIndex();
  const entry = index.packages.find((pkg) => pkg.packageId === packageId);
  return entry?.versions.map((item) => item.version) ?? [];
}

function resolveArtifactPath(packageId: string, version: string): string | null {
  const index = readPackageIndex();
  const entry = index.packages.find((pkg) => pkg.packageId === packageId);
  const versionEntry = entry?.versions.find((item) => item.version === version);
  if (!versionEntry?.artifactPath) return null;
  const artifactPath = resolveStoragePath(versionEntry.artifactPath);
  return fs.existsSync(artifactPath) ? artifactPath : null;
}

function readBaselineContent(
  artifactEntries: Map<string, Buffer>,
  entryPath: string,
): Buffer | null {
  return artifactEntries.get(normalizeZipEntryName(entryPath)) ?? null;
}

function navigationIdFromRepackRef(ref: Pick<RepackFileRef, 'category' | 'itemId'>): string | null {
  if (ref.category !== 'navigations') return null;
  const prefix = 'navigation:';
  if (!ref.itemId.startsWith(prefix)) return null;
  const navigationId = ref.itemId.slice(prefix.length).trim();
  return navigationId || null;
}

function isPackageAppliedNavigation(packageId: string, navigationId: string): boolean {
  const applied = readPlatformCapabilitiesApplied(packageId);
  return applied?.navigations?.includes(navigationId) ?? false;
}

function serializeNavigationManifestContent(manifest: NavigationManifest): Buffer {
  return Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function readPackageNavigationRegistryContent(packageId: string, navigationId: string): Buffer | null {
  if (!isPackageAppliedNavigation(packageId, navigationId)) return null;
  const manifest = readNavigationFile(navigationId);
  if (!manifest) return null;
  return serializeNavigationManifestContent(manifest);
}

function readCurrentContent(
  packageId: string,
  version: string,
  artifactEntries: Map<string, Buffer>,
  entryPath: string,
  ref?: Pick<RepackFileRef, 'category' | 'itemId'>,
): Buffer | null {
  if (!isSafeRelativeEntry(entryPath)) return null;

  const navigationId = ref ? navigationIdFromRepackRef(ref) : null;
  if (navigationId) {
    const registryContent = readPackageNavigationRegistryContent(packageId, navigationId);
    if (registryContent) return registryContent;
  }

  const runtimePath = resolveRuntimeEntryPath(packageId, version, entryPath);
  if (runtimePath && fs.existsSync(runtimePath)) {
    return fs.readFileSync(runtimePath);
  }
  return readBaselineContent(artifactEntries, entryPath);
}

function buffersEqual(left: Buffer | null, right: Buffer | null): boolean {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return left.equals(right);
}

function pushFileRef(
  refs: RepackFileRef[],
  seen: Set<string>,
  ref: RepackFileRef,
): void {
  const key = `${ref.itemId}:${ref.entryPath}`;
  if (seen.has(key)) return;
  seen.add(key);
  refs.push(ref);
}

function collectManifestFileRefs(manifest: AnyPackageManifest): RepackFileRef[] {
  const refs: RepackFileRef[] = [];
  const seen = new Set<string>();
  const capabilities = manifest.capabilities as Record<string, unknown>;

  for (const api of readManifestCapabilityArray<AnyPackageManifest['capabilities']['apis'][number]>(capabilities.apis)) {
    pushFileRef(refs, seen, {
      itemId: `api:${api.id}`,
      category: 'apis',
      label: `${api.method} ${api.path}`,
      entryPath: api.entry,
    });
    pushFileRef(refs, seen, {
      itemId: `api-meta:${api.id}`,
      category: 'apis',
      label: `${api.id} metadata`,
      entryPath: resolveApiMetaEntryPath(api.entry),
    });
  }

  for (const ui of readManifestCapabilityArray<{ componentKey: string; entry: string }>(capabilities.ui_components)) {
    pushFileRef(refs, seen, {
      itemId: `ui:${ui.componentKey}`,
      category: 'ui_components',
      label: ui.componentKey,
      entryPath: ui.entry,
    });
  }

  for (const route of manifest.capabilities.ui_routes ?? []) {
    pushFileRef(refs, seen, {
      itemId: `ui-route:${route.pageKey}`,
      category: 'ui_routes',
      label: route.pageKey,
      entryPath: route.entry,
    });
  }

  for (const portal of manifest.capabilities.portals ?? []) {
    pushFileRef(refs, seen, {
      itemId: `portal:${portal.segment}`,
      category: 'portals',
      label: portal.segment,
      entryPath: portal.entry,
    });
  }

  for (const navigation of manifest.capabilities.navigations ?? []) {
    pushFileRef(refs, seen, {
      itemId: `navigation:${navigation.id}`,
      category: 'navigations',
      label: navigation.id,
      entryPath: navigation.entry,
    });
  }

  for (const workflow of manifest.capabilities.workflows ?? []) {
    pushFileRef(refs, seen, {
      itemId: `workflow:${workflow.scopeKey}/${workflow.key}`,
      category: 'workflows',
      label: `${workflow.scopeKey}/${workflow.key}`,
      entryPath: workflow.entry,
    });
  }

  for (const patch of (manifest.capabilities as { navigation_patches?: Array<{ navigationId: string; entry: string }> }).navigation_patches ?? []) {
    pushFileRef(refs, seen, {
      itemId: `nav-patch:${patch.navigationId}`,
      category: 'navigations',
      label: `Navigation patch (${patch.navigationId})`,
      entryPath: patch.entry,
    });
  }

  for (const keys of (manifest.capabilities as { culture_keys?: Array<{ entry: string }> }).culture_keys ?? []) {
    pushFileRef(refs, seen, {
      itemId: `culture-keys:${keys.entry}`,
      category: 'experience',
      label: 'Culture keys',
      entryPath: keys.entry,
    });
  }

  for (const homePortal of (manifest.capabilities as { home_portal?: Array<{ entry: string }> }).home_portal ?? []) {
    pushFileRef(refs, seen, {
      itemId: `home-portal:${homePortal.entry}`,
      category: 'shell',
      label: 'Home portal',
      entryPath: homePortal.entry,
    });
  }

  for (const dbObject of readManifestCapabilityArray<AnyPackageManifest['capabilities']['db_objects'][number]>(capabilities.db_objects)) {
    const scripts: Array<{ suffix: string; path?: string }> = [
      { suffix: 'install', path: dbObject.installScript },
      { suffix: 'uninstall', path: dbObject.uninstallScript },
      { suffix: 'seed', path: dbObject.seedScript },
    ];
    for (const script of scripts) {
      if (!script.path?.trim()) continue;
      pushFileRef(refs, seen, {
        itemId: `db:${dbObject.objectName}:${script.suffix}`,
        category: 'db_objects',
        label: `${dbObject.objectName} (${script.suffix})`,
        entryPath: script.path,
      });
    }
  }

  if (isVerticalAppManifest(manifest)) {
    for (const page of manifest.capabilities.pages ?? []) {
      pushFileRef(refs, seen, {
        itemId: `page:${page.pageKey}`,
        category: 'pages',
        label: page.pageKey,
        entryPath: page.entry,
      });
    }

    if (manifest.capabilities.shell?.entry) {
      pushFileRef(refs, seen, {
        itemId: 'shell:main',
        category: 'shell',
        label: manifest.capabilities.shell.key || 'shell',
        entryPath: manifest.capabilities.shell.entry,
      });
    }

    for (const layout of manifest.capabilities.designer_layouts ?? []) {
      pushFileRef(refs, seen, {
        itemId: `designer-layout:${layout.slug}`,
        category: 'designer_layouts',
        label: layout.slug,
        entryPath: layout.entry,
      });
    }

    for (const shell of manifest.capabilities.designer_shells ?? []) {
      pushFileRef(refs, seen, {
        itemId: `designer-shell:${shell.shellKey}`,
        category: 'designer_shells',
        label: shell.shellKey,
        entryPath: shell.entry,
      });
    }

    for (const asset of manifest.capabilities.static_assets ?? []) {
      pushFileRef(refs, seen, {
        itemId: `asset:${asset.assetKey}`,
        category: 'static_assets',
        label: asset.assetKey,
        entryPath: asset.path,
      });
    }

    const navigationEntry = manifest.capabilities.shell.navigationEntry;
    if (navigationEntry) {
      pushFileRef(refs, seen, {
        itemId: 'experience:navigation',
        category: 'experience',
        label: 'Navigation manifest',
        entryPath: navigationEntry,
      });
    }

    if (manifest.experience) {
      pushFileRef(refs, seen, {
        itemId: 'experience:block',
        category: 'experience',
        label: 'Experience manifest',
        entryPath: 'experience/experience.json',
      });
    }
  }

  return refs;
}

function emptyChangedByCategory(): Record<PackageRepackItemCategory, PackageRepackChangedItem[]> {
  return {
    apis: [],
    ui_components: [],
    ui_routes: [],
    db_objects: [],
    static_assets: [],
    portals: [],
    navigations: [],
    pages: [],
    shell: [],
    designer_layouts: [],
    designer_shells: [],
    experience: [],
    workflows: [],
  };
}

function resolveRepackContext(packageId: string): RepackContext {
  const trimmedId = packageId.trim();
  if (!trimmedId) {
    return { ok: false, error: 'Package id is required.', statusCode: 400 };
  }

  const state = readInstallStateV1(trimmedId);
  if (!state || state.status !== 'installed' || !state.activeVersion) {
    return { ok: false, error: 'Package is not installed.', statusCode: 409 };
  }

  const index = readPackageIndex();
  const entry = index.packages.find((pkg) => pkg.packageId === trimmedId);
  const versionEntry = entry?.versions.find((item) => item.version === state.activeVersion);
  if (!versionEntry?.manifestPath) {
    return { ok: false, error: 'Installed package manifest was not found.', statusCode: 404 };
  }

  const manifest = parseManifestFile(versionEntry.manifestPath);
  if (!manifest) {
    return { ok: false, error: 'Installed package manifest is invalid.', statusCode: 422 };
  }

  const artifactPath = resolveArtifactPath(trimmedId, state.activeVersion);
  if (!artifactPath) {
    return { ok: false, error: 'Installed package artifact was not found.', statusCode: 404 };
  }

  const artifactEntries = readArtifactEntryMap(artifactPath);
  if (!artifactEntries) {
    return { ok: false, error: 'Installed package artifact could not be read.', statusCode: 422 };
  }

  return {
    ok: true,
    packageId: trimmedId,
    version: state.activeVersion,
    manifest,
    artifactPath,
    artifactEntries,
    pluginKind: isVerticalAppManifest(manifest) ? 'vertical-app' : 'extension',
  };
}

function findChangedItems(context: Extract<RepackContext, { ok: true }>): PackageRepackChangedItem[] {
  const refs = collectManifestFileRefs(context.manifest);
  const changed: PackageRepackChangedItem[] = [];

  for (const ref of refs) {
    const baseline = readBaselineContent(context.artifactEntries, ref.entryPath);
    const current = readCurrentContent(
      context.packageId,
      context.version,
      context.artifactEntries,
      ref.entryPath,
      ref,
    );
    if (buffersEqual(baseline, current)) continue;
    changed.push({
      itemId: ref.itemId,
      category: ref.category,
      label: ref.label,
      entryPath: ref.entryPath,
    });
  }

  return changed;
}

function findFileRef(context: Extract<RepackContext, { ok: true }>, itemId: string): RepackFileRef | null {
  const refs = collectManifestFileRefs(context.manifest);
  return refs.find((ref) => ref.itemId === itemId) ?? null;
}

function bufferToDisplayText(buffer: Buffer | null): string {
  if (!buffer) return '';
  return buffer.toString('utf8');
}

function buildUnifiedDiff(entryPath: string, before: string, after: string): { diff: string; truncated: boolean } {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const output: string[] = [`--- ${entryPath} (package)`, `+++ ${entryPath} (installed)`];
  let truncated = false;
  let emitted = output.join('\n').length;

  const maxLines = Math.max(beforeLines.length, afterLines.length);
  let index = 0;
  while (index < maxLines) {
    const beforeLine = beforeLines[index] ?? null;
    const afterLine = afterLines[index] ?? null;
    if (beforeLine === afterLine) {
      index += 1;
      continue;
    }

    let runEnd = index;
    while (runEnd < maxLines && beforeLines[runEnd] !== afterLines[runEnd]) {
      runEnd += 1;
    }

    const hunkStart = Math.max(0, index - DIFF_CONTEXT_LINES);
    const hunkEnd = Math.min(maxLines, runEnd + DIFF_CONTEXT_LINES);
    const oldCount = hunkEnd - hunkStart;
    const newCount = hunkEnd - hunkStart;
    output.push(`@@ -${hunkStart + 1},${oldCount} +${hunkStart + 1},${newCount} @@`);

    for (let lineIndex = hunkStart; lineIndex < hunkEnd; lineIndex += 1) {
      const left = beforeLines[lineIndex];
      const right = afterLines[lineIndex];
      if (left === right) {
        output.push(` ${left ?? ''}`);
      } else {
        if (left !== undefined) output.push(`-${left}`);
        if (right !== undefined) output.push(`+${right}`);
      }
      emitted += 64;
      if (emitted >= DIFF_MAX_CHARS) {
        output.push('... diff truncated ...');
        truncated = true;
        return { diff: output.join('\n'), truncated };
      }
    }

    index = runEnd;
  }

  if (output.length === 2) {
    return { diff: 'No textual differences.', truncated: false };
  }

  return { diff: output.join('\n'), truncated };
}

function computeArtifactHash(entries: Array<{ path: string; content: Buffer }>): string {
  const payload = entries
    .filter((entry) => entry.path !== 'package.json')
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((entry) => `${entry.path}\0${entry.content.toString('base64')}`)
    .join('\n');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export function previewPackageRepackDrift(packageId: string): PackageRepackDriftPreview | { ok: false; error: string; statusCode: number } {
  const context = resolveRepackContext(packageId);
  if (!context.ok) {
    return { ok: false, error: context.error, statusCode: context.statusCode };
  }

  const changedItems = findChangedItems(context);
  const changedByCategory = emptyChangedByCategory();
  for (const item of changedItems) {
    changedByCategory[item.category].push(item);
  }

  const baseDescription = typeof context.manifest.description === 'string'
    ? context.manifest.description.trim() || null
    : null;

  return {
    packageId: context.packageId,
    baseVersion: context.version,
    baseDescription,
    pluginKind: context.pluginKind,
    changedItems,
    changedByCategory,
    hasChanges: changedItems.length > 0,
  };
}

export function getPackageRepackItemDiff(
  packageId: string,
  itemId: string,
): PackageRepackItemDiff | { ok: false; error: string; statusCode: number } {
  const context = resolveRepackContext(packageId);
  if (!context.ok) {
    return { ok: false, error: context.error, statusCode: context.statusCode };
  }

  const ref = findFileRef(context, itemId.trim());
  if (!ref) {
    return { ok: false, error: 'Repack item was not found.', statusCode: 404 };
  }

  const baselineBuffer = readBaselineContent(context.artifactEntries, ref.entryPath);
  const currentBuffer = readCurrentContent(
    context.packageId,
    context.version,
    context.artifactEntries,
    ref.entryPath,
    ref,
  );
  const baseline = bufferToDisplayText(baselineBuffer);
  const current = bufferToDisplayText(currentBuffer);
  const { diff, truncated } = buildUnifiedDiff(ref.entryPath, baseline, current);

  return {
    itemId: ref.itemId,
    label: ref.label,
    entryPath: ref.entryPath,
    baseline,
    current,
    diff,
    truncated,
  };
}

export function revertPackageRepackItem(
  packageId: string,
  itemId: string,
): { ok: true } | { ok: false; error: string; statusCode: number } {
  const context = resolveRepackContext(packageId);
  if (!context.ok) {
    return { ok: false, error: context.error, statusCode: context.statusCode };
  }

  const ref = findFileRef(context, itemId.trim());
  if (!ref) {
    return { ok: false, error: 'Repack item was not found.', statusCode: 404 };
  }

  const baseline = readBaselineContent(context.artifactEntries, ref.entryPath);
  if (!baseline) {
    return { ok: false, error: 'Baseline package content was not found for this item.', statusCode: 404 };
  }

  const navigationId = navigationIdFromRepackRef(ref);
  if (navigationId && isPackageAppliedNavigation(context.packageId, navigationId)) {
    try {
      const manifest = JSON.parse(baseline.toString('utf8')) as NavigationManifest;
      withPlatformRegistryLock(() => {
        writeNavigationFile(manifest);
      });
    } catch {
      return { ok: false, error: 'Baseline navigation content is invalid.', statusCode: 422 };
    }
    return { ok: true };
  }

  const runtimePath = resolveRuntimeEntryPath(context.packageId, context.version, ref.entryPath);
  if (!runtimePath) {
    return { ok: false, error: 'Runtime path is invalid for this item.', statusCode: 400 };
  }

  fs.mkdirSync(path.dirname(runtimePath), { recursive: true });
  atomicWriteBinary(runtimePath, baseline);
  return { ok: true };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseRepackAdditions(value: unknown): PackageRepackAdditionsPayload | null {
  if (!isRecord(value)) return null;

  const filesRaw = Array.isArray(value.files) ? value.files : [];
  const files = filesRaw
    .map((file) => {
      if (!isRecord(file)) return null;
      const entryPath = typeof file.entryPath === 'string' ? file.entryPath.trim() : '';
      const content = typeof file.content === 'string' ? file.content : '';
      const contentBase64 = typeof file.contentBase64 === 'string' && file.contentBase64.trim()
        ? file.contentBase64.trim()
        : undefined;
      if (!entryPath || !isSafeRelativeEntry(entryPath)) return null;
      if (!content && !contentBase64) return null;
      return { entryPath: normalizeZipEntryName(entryPath), content, ...(contentBase64 ? { contentBase64 } : {}) };
    })
    .filter((file): file is PackageRepackAdditionFile => file !== null);

  const parseApis = () => {
    if (!Array.isArray(value.apis)) return undefined;
    const apis = value.apis
      .map((api) => {
        if (!isRecord(api)) return null;
        const id = typeof api.id === 'string' ? api.id.trim() : '';
        const method = api.method;
        const pathValue = typeof api.path === 'string' ? api.path.trim() : '';
        const entry = typeof api.entry === 'string' ? api.entry.trim() : '';
        const timeoutMs = typeof api.timeoutMs === 'number' ? api.timeoutMs : 10000;
        const auth = api.auth;
        if (!id || !pathValue || !entry || !isSafeRelativeEntry(entry)) return null;
        if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method))) return null;
        if (!['public', 'authenticated', 'admin'].includes(String(auth))) return null;
        return {
          id,
          method: method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
          path: pathValue,
          entry: normalizeZipEntryName(entry),
          timeoutMs,
          auth: auth as 'public' | 'authenticated' | 'admin',
        };
      })
      .filter((api): api is NonNullable<typeof api> => api !== null);
    return apis.length > 0 ? apis : undefined;
  };

  const parseUiComponents = () => {
    if (!Array.isArray(value.ui_components)) return undefined;
    const items = value.ui_components
      .map((item) => {
        if (!isRecord(item)) return null;
        const componentKey = typeof item.componentKey === 'string' ? item.componentKey.trim() : '';
        const slotId = typeof item.slotId === 'string' ? item.slotId.trim() : '';
        const entry = typeof item.entry === 'string' ? item.entry.trim() : '';
        const order = typeof item.order === 'number' ? item.order : 100;
        const designerDraftId = typeof item.designerDraftId === 'string' ? item.designerDraftId.trim() : '';
        const draftEntry = typeof item.draftEntry === 'string' ? item.draftEntry.trim() : '';
        if (!componentKey || !slotId || !entry || !isSafeRelativeEntry(entry)) return null;
        if (draftEntry && !isSafeRelativeEntry(draftEntry)) return null;
        return {
          componentKey,
          slotId,
          entry: normalizeZipEntryName(entry),
          order,
          ...(designerDraftId ? { designerDraftId } : {}),
          ...(draftEntry ? { draftEntry: normalizeZipEntryName(draftEntry) } : {}),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    return items.length > 0 ? items : undefined;
  };

  const parsePortals = () => {
    if (!Array.isArray(value.portals)) return undefined;
    const items = value.portals
      .map((portal) => {
        if (!isRecord(portal)) return null;
        const segment = typeof portal.segment === 'string' ? portal.segment.trim() : '';
        const entry = typeof portal.entry === 'string' ? portal.entry.trim() : '';
        if (!segment || !entry || !isSafeRelativeEntry(entry)) return null;
        return { segment, entry: normalizeZipEntryName(entry) };
      })
      .filter((portal): portal is NonNullable<typeof portal> => portal !== null);
    return items.length > 0 ? items : undefined;
  };

  const parseNavigations = () => {
    if (!Array.isArray(value.navigations)) return undefined;
    const items = value.navigations
      .map((navigation) => {
        if (!isRecord(navigation)) return null;
        const id = typeof navigation.id === 'string' ? navigation.id.trim() : '';
        const entry = typeof navigation.entry === 'string' ? navigation.entry.trim() : '';
        if (!id || !entry || !isSafeRelativeEntry(entry)) return null;
        return { id, entry: normalizeZipEntryName(entry) };
      })
      .filter((navigation): navigation is NonNullable<typeof navigation> => navigation !== null);
    return items.length > 0 ? items : undefined;
  };

  const parseWorkflows = () => {
    if (!Array.isArray(value.workflows)) return undefined;
    const items = value.workflows
      .map((workflow) => {
        if (!isRecord(workflow)) return null;
        const scopeKey = typeof workflow.scopeKey === 'string' && workflow.scopeKey.trim()
          ? workflow.scopeKey.trim()
          : 'global';
        const key = typeof workflow.key === 'string' ? workflow.key.trim() : '';
        const entry = typeof workflow.entry === 'string' ? workflow.entry.trim() : '';
        if (!key || !entry || !isSafeRelativeEntry(entry)) return null;
        return { scopeKey, key, entry: normalizeZipEntryName(entry) };
      })
      .filter((workflow): workflow is NonNullable<typeof workflow> => workflow !== null);
    return items.length > 0 ? items : undefined;
  };

  const parseDbObjects = () => {
    if (!Array.isArray(value.db_objects)) return undefined;
    const items = value.db_objects
      .map((dbObject) => {
        if (!isRecord(dbObject)) return null;
        const objectType = dbObject.objectType;
        const objectName = typeof dbObject.objectName === 'string' ? dbObject.objectName.trim() : '';
        const installScript = typeof dbObject.installScript === 'string' ? dbObject.installScript.trim() : '';
        const uninstallScript = typeof dbObject.uninstallScript === 'string'
          ? dbObject.uninstallScript.trim()
          : undefined;
        if (!objectName || !installScript || !isSafeRelativeEntry(installScript)) return null;
        if (uninstallScript && !isSafeRelativeEntry(uninstallScript)) return null;
        if (!['table', 'view', 'index', 'function', 'trigger', 'seed'].includes(String(objectType))) return null;
        return {
          objectType: objectType as 'table' | 'view' | 'index' | 'function' | 'trigger' | 'seed',
          objectName,
          installScript: normalizeZipEntryName(installScript),
          uninstallScript: uninstallScript ? normalizeZipEntryName(uninstallScript) : undefined,
          ...(dbObject.installMode === 'optional' || dbObject.installMode === 'required'
            ? { installMode: dbObject.installMode }
            : {}),
        };
      })
      .filter((dbObject): dbObject is NonNullable<typeof dbObject> => dbObject !== null);
    return items.length > 0 ? items : undefined;
  };

  const parseUiRoutes = () => {
    if (!Array.isArray(value.ui_routes)) return undefined;
    const items = value.ui_routes
      .map((route) => {
        if (!isRecord(route)) return null;
        const pageKey = typeof route.pageKey === 'string' ? route.pageKey.trim() : '';
        const entry = typeof route.entry === 'string' ? route.entry.trim() : '';
        const suggestedRoutePattern = typeof route.suggestedRoutePattern === 'string'
          ? route.suggestedRoutePattern.trim()
          : undefined;
        const suggestedMountId = typeof route.suggestedMountId === 'string'
          ? route.suggestedMountId.trim()
          : undefined;
        if (!pageKey || !entry || !isSafeRelativeEntry(entry)) return null;
        return {
          pageKey,
          entry: normalizeZipEntryName(entry),
          ...(suggestedRoutePattern ? { suggestedRoutePattern } : {}),
          ...(suggestedMountId ? { suggestedMountId } : {}),
        };
      })
      .filter((route): route is NonNullable<typeof route> => route !== null);
    return items.length > 0 ? items : undefined;
  };

  const parseNavigationPatches = () => {
    if (!Array.isArray(value.navigation_patches)) return undefined;
    const items = value.navigation_patches
      .map((patch) => {
        if (!isRecord(patch)) return null;
        const navigationId = typeof patch.navigationId === 'string' ? patch.navigationId.trim() : '';
        const entry = typeof patch.entry === 'string' ? patch.entry.trim() : '';
        if (!navigationId || !entry || !isSafeRelativeEntry(entry)) return null;
        return { navigationId, entry: normalizeZipEntryName(entry) };
      })
      .filter((patch): patch is NonNullable<typeof patch> => patch !== null);
    return items.length > 0 ? items : undefined;
  };

  const parseCultureKeys = () => {
    if (!Array.isArray(value.culture_keys)) return undefined;
    const items = value.culture_keys
      .map((item) => {
        if (!isRecord(item)) return null;
        const entry = typeof item.entry === 'string' ? item.entry.trim() : '';
        if (!entry || !isSafeRelativeEntry(entry)) return null;
        return { entry: normalizeZipEntryName(entry) };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    return items.length > 0 ? items : undefined;
  };

  const parseHomePortal = () => {
    if (!Array.isArray(value.home_portal)) return undefined;
    const items = value.home_portal
      .map((item) => {
        if (!isRecord(item)) return null;
        const entry = typeof item.entry === 'string' ? item.entry.trim() : '';
        if (!entry || !isSafeRelativeEntry(entry)) return null;
        return { entry: normalizeZipEntryName(entry) };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    return items.length > 0 ? items.slice(0, 1) : undefined;
  };

  const parseIdEntry = (field: string) => {
    if (!Array.isArray(value[field])) return undefined;
    const items = value[field]
      .map((item) => {
        if (!isRecord(item)) return null;
        const id = typeof item.id === 'string' ? item.id.trim() : '';
        const entry = typeof item.entry === 'string' ? item.entry.trim() : '';
        if (!id || !entry || !isSafeRelativeEntry(entry)) return null;
        return { id, entry: normalizeZipEntryName(entry) };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    return items.length > 0 ? items : undefined;
  };

  const parseEdgeApis = () => {
    if (!Array.isArray(value.edge_apis)) return undefined;
    const items = value.edge_apis
      .map((item) => {
        if (!isRecord(item)) return null;
        const id = typeof item.id === 'string' ? item.id.trim() : '';
        const edgeModelId = typeof item.edgeModelId === 'string' ? item.edgeModelId.trim() : '';
        const entry = typeof item.entry === 'string' ? item.entry.trim() : '';
        if (!id || !edgeModelId || !entry || !isSafeRelativeEntry(entry)) return null;
        return { id, edgeModelId, entry: normalizeZipEntryName(entry) };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    return items.length > 0 ? items : undefined;
  };

  const parseEdgeModelStudioMeta = () => {
    if (!Array.isArray(value.edge_model_studio_meta)) return undefined;
    const items = value.edge_model_studio_meta
      .map((item) => {
        if (!isRecord(item)) return null;
        const edgeModelId = typeof item.edgeModelId === 'string' ? item.edgeModelId.trim() : '';
        const entry = typeof item.entry === 'string' ? item.entry.trim() : '';
        if (!edgeModelId || !entry || !isSafeRelativeEntry(entry)) return null;
        return { edgeModelId, entry: normalizeZipEntryName(entry) };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    return items.length > 0 ? items : undefined;
  };

  const parseRecordPolicies = () => {
    if (!Array.isArray(value.record_policies)) return undefined;
    const items = value.record_policies
      .map((item) => {
        if (!isRecord(item)) return null;
        const id = typeof item.id === 'string' ? item.id.trim() : '';
        const edgeModelId = typeof item.edgeModelId === 'string' ? item.edgeModelId.trim() : '';
        const entry = typeof item.entry === 'string' ? item.entry.trim() : '';
        if (!id || !edgeModelId || !entry || !isSafeRelativeEntry(entry)) return null;
        return { id, edgeModelId, entry: normalizeZipEntryName(entry) };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    return items.length > 0 ? items : undefined;
  };

  const parseRecordPolicyBindings = () => {
    if (!Array.isArray(value.record_policy_bindings)) return undefined;
    const items = value.record_policy_bindings
      .map((item) => {
        if (!isRecord(item)) return null;
        const edgeModelId = typeof item.edgeModelId === 'string' ? item.edgeModelId.trim() : '';
        const entry = typeof item.entry === 'string' ? item.entry.trim() : '';
        if (!edgeModelId || !entry || !isSafeRelativeEntry(entry)) return null;
        return { edgeModelId, entry: normalizeZipEntryName(entry) };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    return items.length > 0 ? items : undefined;
  };

  const parseScopeDimensions = () => {
    if (!Array.isArray(value.scope_dimensions)) return undefined;
    const items = value.scope_dimensions
      .map((item) => {
        if (!isRecord(item)) return null;
        const key = typeof item.key === 'string' ? item.key.trim() : '';
        const entry = typeof item.entry === 'string' ? item.entry.trim() : '';
        if (!key || !entry || !isSafeRelativeEntry(entry)) return null;
        return { key, entry: normalizeZipEntryName(entry) };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    return items.length > 0 ? items : undefined;
  };

  const apis = parseApis();
  const ui_components = parseUiComponents();
  const ui_routes = parseUiRoutes();
  const navigation_patches = parseNavigationPatches();
  const culture_keys = parseCultureKeys();
  const home_portal = parseHomePortal();
  const portals = parsePortals();
  const navigations = parseNavigations();
  const workflows = parseWorkflows();
  const db_objects = parseDbObjects();
  const edge_models = parseIdEntry('edge_models');
  const edge_apis = parseEdgeApis();
  const edge_model_studio_meta = parseEdgeModelStudioMeta();
  const record_policies = parseRecordPolicies();
  const record_policy_bindings = parseRecordPolicyBindings();
  const scope_dimensions = parseScopeDimensions();

  const additions: PackageRepackAdditionsPayload = {
    ...(apis ? { apis } : {}),
    ...(ui_components ? { ui_components } : {}),
    ...(ui_routes ? { ui_routes } : {}),
    ...(navigation_patches ? { navigation_patches } : {}),
    ...(culture_keys ? { culture_keys } : {}),
    ...(home_portal ? { home_portal } : {}),
    ...(portals ? { portals } : {}),
    ...(navigations ? { navigations } : {}),
    ...(workflows ? { workflows } : {}),
    ...(db_objects ? { db_objects } : {}),
    ...(edge_models ? { edge_models } : {}),
    ...(edge_apis ? { edge_apis } : {}),
    ...(edge_model_studio_meta ? { edge_model_studio_meta } : {}),
    ...(record_policies ? { record_policies } : {}),
    ...(record_policy_bindings ? { record_policy_bindings } : {}),
    ...(scope_dimensions ? { scope_dimensions } : {}),
    files,
  };

  if (!hasRepackAdditions(additions)) return null;
  return additions;
}

export function hasRepackAdditions(additions: PackageRepackAdditionsPayload | null | undefined): boolean {
  if (!additions) return false;
  return Boolean(
    additions.apis?.length
    || additions.ui_components?.length
    || additions.ui_routes?.length
    || additions.navigation_patches?.length
    || additions.culture_keys?.length
    || additions.home_portal?.length
    || additions.portals?.length
    || additions.navigations?.length
    || additions.workflows?.length
    || additions.db_objects?.length
    || additions.edge_models?.length
    || additions.edge_apis?.length
    || additions.edge_model_studio_meta?.length
    || additions.record_policies?.length
    || additions.record_policy_bindings?.length
    || additions.scope_dimensions?.length
    || additions.files?.length,
  );
}

export function parseRepackRemovals(value: unknown): PackageRepackRemovalsPayload | null {
  if (!isRecord(value)) return null;

  const parseStringArray = (field: string): string[] | undefined => {
    if (!Array.isArray(value[field])) return undefined;
    const items = value[field]
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);
    return items.length > 0 ? items : undefined;
  };

  const removals: PackageRepackRemovalsPayload = {
    ...(parseStringArray('apis') ? { apis: parseStringArray('apis') } : {}),
    ...(parseStringArray('ui_components') ? { ui_components: parseStringArray('ui_components') } : {}),
    ...(parseStringArray('portals') ? { portals: parseStringArray('portals') } : {}),
    ...(parseStringArray('navigations') ? { navigations: parseStringArray('navigations') } : {}),
    ...(parseStringArray('workflows') ? { workflows: parseStringArray('workflows') } : {}),
  };

  if (!hasRepackRemovals(removals)) return null;
  return removals;
}

export function hasRepackRemovals(removals: PackageRepackRemovalsPayload | null | undefined): boolean {
  if (!removals) return false;
  return Boolean(
    removals.apis?.length
    || removals.ui_components?.length
    || removals.portals?.length
    || removals.navigations?.length
    || removals.workflows?.length,
  );
}

function applyRepackRemovals(
  manifest: AnyPackageManifest & Record<string, unknown>,
  zipEntries: Map<string, Buffer>,
  removals: PackageRepackRemovalsPayload,
): { ok: true } | { ok: false; error: string } {
  const capabilities = manifest.capabilities as Record<string, unknown>;
  const entryPathsToRemove = new Set<string>();

  if (removals.apis?.length) {
    const removeIds = new Set(removals.apis);
    capabilities.apis = (capabilities.apis as Array<{ id: string; entry: string }>)
      .filter((api) => {
        if (removeIds.has(api.id)) {
          entryPathsToRemove.add(normalizeZipEntryName(api.entry));
          entryPathsToRemove.add(normalizeZipEntryName(resolveApiMetaEntryPath(api.entry)));
          return false;
        }
        return true;
      });
  }

  if (removals.ui_components?.length) {
    const removeKeys = new Set(removals.ui_components);
    capabilities.ui_components = readManifestCapabilityArray<{ componentKey: string; entry: string }>(
      capabilities.ui_components,
    ).filter((item) => {
        if (removeKeys.has(item.componentKey)) {
          entryPathsToRemove.add(normalizeZipEntryName(item.entry));
          return false;
        }
        return true;
      });
  }

  if (removals.portals?.length) {
    const removeSegments = new Set(removals.portals);
    capabilities.portals = (capabilities.portals as Array<{ segment: string; entry: string }> | undefined ?? [])
      .filter((portal) => {
        if (removeSegments.has(portal.segment)) {
          entryPathsToRemove.add(normalizeZipEntryName(portal.entry));
          return false;
        }
        return true;
      });
  }

  if (removals.navigations?.length) {
    const removeIds = new Set(removals.navigations);
    capabilities.navigations = (capabilities.navigations as Array<{ id: string; entry: string }> | undefined ?? [])
      .filter((navigation) => {
        if (removeIds.has(navigation.id)) {
          entryPathsToRemove.add(normalizeZipEntryName(navigation.entry));
          return false;
        }
        return true;
      });
  }

  if (removals.workflows?.length) {
    const removeIds = new Set(removals.workflows);
    capabilities.workflows = (capabilities.workflows as Array<{ scopeKey: string; key: string; entry: string }> | undefined ?? [])
      .filter((workflow) => {
        const identity = `${workflow.scopeKey}/${workflow.key}`;
        if (removeIds.has(identity)) {
          entryPathsToRemove.add(normalizeZipEntryName(workflow.entry));
          return false;
        }
        return true;
      });
  }

  for (const entryPath of entryPathsToRemove) {
    zipEntries.delete(entryPath);
  }

  return { ok: true };
}

function applyRepackAdditions(
  manifest: AnyPackageManifest & Record<string, unknown>,
  zipEntries: Map<string, Buffer>,
  additions: PackageRepackAdditionsPayload,
): { ok: true } | { ok: false; error: string } {
  const capabilities = manifest.capabilities as Record<string, unknown>;

  const existingApiIds = new Set((capabilities.apis as Array<{ id: string }> ?? []).map((api) => api.id));
  const existingApiPaths = new Set((capabilities.apis as Array<{ path: string }> ?? []).map((api) => api.path));
  const existingComponentKeys = new Set(
    readManifestCapabilityArray<{ componentKey: string }>(capabilities.ui_components)
      .map((item) => item.componentKey),
  );
  const existingPortalSegments = new Set(
    (capabilities.portals as Array<{ segment: string }> | undefined ?? []).map((portal) => portal.segment),
  );
  const existingNavigationIds = new Set(
    (capabilities.navigations as Array<{ id: string }> | undefined ?? []).map((navigation) => navigation.id),
  );
  const existingWorkflowIds = new Set(
    (capabilities.workflows as Array<{ scopeKey: string; key: string }> | undefined ?? [])
      .map((workflow) => `${workflow.scopeKey}/${workflow.key}`),
  );
  const existingDbObjectNames = new Set(
    (capabilities.db_objects as Array<{ objectName: string }> ?? []).map((item) => item.objectName),
  );
  const existingUiRoutePageKeys = new Set(
    (capabilities.ui_routes as Array<{ pageKey: string }> | undefined ?? []).map((route) => route.pageKey),
  );
  const existingEdgeModelIds = new Set(
    (capabilities.edge_models as Array<{ id: string }> | undefined ?? []).map((item) => item.id),
  );
  const existingEdgeApiIds = new Set(
    (capabilities.edge_apis as Array<{ id: string }> | undefined ?? []).map((item) => item.id),
  );
  const existingStudioMetaModelIds = new Set(
    (capabilities.edge_model_studio_meta as Array<{ edgeModelId: string }> | undefined ?? [])
      .map((item) => item.edgeModelId),
  );
  const existingRecordPolicyIds = new Set(
    (capabilities.record_policies as Array<{ id: string }> | undefined ?? []).map((item) => item.id),
  );
  const existingRecordPolicyBindingModelIds = new Set(
    (capabilities.record_policy_bindings as Array<{ edgeModelId: string }> | undefined ?? [])
      .map((item) => item.edgeModelId),
  );
  const existingScopeDimensionKeys = new Set(
    (capabilities.scope_dimensions as Array<{ key: string }> | undefined ?? []).map((item) => item.key),
  );

  for (const api of additions.apis ?? []) {
    if (existingApiIds.has(api.id) || existingApiPaths.has(api.path)) {
      return { ok: false, error: `Package already includes API ${api.path}.` };
    }
    (capabilities.apis as unknown[]).push(api);
    existingApiIds.add(api.id);
    existingApiPaths.add(api.path);
  }

  for (const item of additions.ui_components ?? []) {
    if (existingComponentKeys.has(item.componentKey)) {
      return { ok: false, error: `Package already includes UI component ${item.componentKey}.` };
    }
    if (!Array.isArray(capabilities.ui_components)) {
      capabilities.ui_components = [];
    }
    const { designerDraftId: _designerDraftId, ...manifestUi } = item;
    (capabilities.ui_components as unknown[]).push(manifestUi);
    existingComponentKeys.add(manifestUi.componentKey);
  }

  if (additions.portals?.length) {
    if (!Array.isArray(capabilities.portals)) {
      capabilities.portals = [];
    }
    for (const portal of additions.portals) {
      if (existingPortalSegments.has(portal.segment)) {
        return { ok: false, error: `Package already includes portal ${portal.segment}.` };
      }
      (capabilities.portals as unknown[]).push(portal);
      existingPortalSegments.add(portal.segment);
    }
  }

  if (additions.navigations?.length) {
    if (!Array.isArray(capabilities.navigations)) {
      capabilities.navigations = [];
    }
    for (const navigation of additions.navigations) {
      if (existingNavigationIds.has(navigation.id)) {
        return { ok: false, error: `Package already includes navigation ${navigation.id}.` };
      }
      (capabilities.navigations as unknown[]).push(navigation);
      existingNavigationIds.add(navigation.id);
    }
  }

  if (additions.workflows?.length) {
    if (!Array.isArray(capabilities.workflows)) {
      capabilities.workflows = [];
    }
    for (const workflow of additions.workflows) {
      const identity = `${workflow.scopeKey}/${workflow.key}`;
      if (existingWorkflowIds.has(identity)) {
        return { ok: false, error: `Package already includes workflow ${identity}.` };
      }
      (capabilities.workflows as unknown[]).push(workflow);
      existingWorkflowIds.add(identity);
    }
  }

  for (const dbObject of additions.db_objects ?? []) {
    if (existingDbObjectNames.has(dbObject.objectName)) {
      return { ok: false, error: `Package already includes database object ${dbObject.objectName}.` };
    }
    (capabilities.db_objects as unknown[]).push(dbObject);
    existingDbObjectNames.add(dbObject.objectName);
  }

  if (additions.ui_routes?.length) {
    if (!Array.isArray(capabilities.ui_routes)) {
      capabilities.ui_routes = [];
    }
    for (const route of additions.ui_routes) {
      if (existingUiRoutePageKeys.has(route.pageKey)) continue;
      (capabilities.ui_routes as unknown[]).push(route);
      existingUiRoutePageKeys.add(route.pageKey);
    }
  }

  if (additions.navigation_patches?.length) {
    if (!Array.isArray(capabilities.navigation_patches)) {
      capabilities.navigation_patches = [];
    }
    const existingPatchIds = new Set(
      (capabilities.navigation_patches as Array<{ navigationId: string }>).map((patch) => patch.navigationId),
    );
    for (const patch of additions.navigation_patches) {
      if (existingPatchIds.has(patch.navigationId)) {
        capabilities.navigation_patches = (capabilities.navigation_patches as Array<{ navigationId: string; entry: string }>)
          .map((existing) => (existing.navigationId === patch.navigationId ? patch : existing));
        continue;
      }
      (capabilities.navigation_patches as unknown[]).push(patch);
      existingPatchIds.add(patch.navigationId);
    }
  }

  if (additions.culture_keys?.length) {
    capabilities.culture_keys = additions.culture_keys;
  }

  if (additions.home_portal?.length) {
    capabilities.home_portal = additions.home_portal.slice(0, 1);
  }

  if (additions.edge_models?.length) {
    if (!Array.isArray(capabilities.edge_models)) {
      capabilities.edge_models = [];
    }
    for (const model of additions.edge_models) {
      if (existingEdgeModelIds.has(model.id)) continue;
      (capabilities.edge_models as unknown[]).push(model);
      existingEdgeModelIds.add(model.id);
    }
  }

  if (additions.edge_apis?.length) {
    if (!Array.isArray(capabilities.edge_apis)) {
      capabilities.edge_apis = [];
    }
    for (const api of additions.edge_apis) {
      if (existingEdgeApiIds.has(api.id)) continue;
      (capabilities.edge_apis as unknown[]).push(api);
      existingEdgeApiIds.add(api.id);
    }
  }

  if (additions.edge_model_studio_meta?.length) {
    if (!Array.isArray(capabilities.edge_model_studio_meta)) {
      capabilities.edge_model_studio_meta = [];
    }
    for (const meta of additions.edge_model_studio_meta) {
      if (existingStudioMetaModelIds.has(meta.edgeModelId)) continue;
      (capabilities.edge_model_studio_meta as unknown[]).push(meta);
      existingStudioMetaModelIds.add(meta.edgeModelId);
    }
  }

  if (additions.record_policies?.length) {
    if (!Array.isArray(capabilities.record_policies)) {
      capabilities.record_policies = [];
    }
    for (const policy of additions.record_policies) {
      if (existingRecordPolicyIds.has(policy.id)) continue;
      (capabilities.record_policies as unknown[]).push(policy);
      existingRecordPolicyIds.add(policy.id);
    }
  }

  if (additions.record_policy_bindings?.length) {
    if (!Array.isArray(capabilities.record_policy_bindings)) {
      capabilities.record_policy_bindings = [];
    }
    for (const binding of additions.record_policy_bindings) {
      if (existingRecordPolicyBindingModelIds.has(binding.edgeModelId)) continue;
      (capabilities.record_policy_bindings as unknown[]).push(binding);
      existingRecordPolicyBindingModelIds.add(binding.edgeModelId);
    }
  }

  if (additions.scope_dimensions?.length) {
    if (!Array.isArray(capabilities.scope_dimensions)) {
      capabilities.scope_dimensions = [];
    }
    for (const dimension of additions.scope_dimensions) {
      if (existingScopeDimensionKeys.has(dimension.key)) continue;
      (capabilities.scope_dimensions as unknown[]).push(dimension);
      existingScopeDimensionKeys.add(dimension.key);
    }
  }

  const requiredEntryPaths = new Set<string>();
  for (const api of additions.apis ?? []) {
    requiredEntryPaths.add(normalizeZipEntryName(api.entry));
    requiredEntryPaths.add(normalizeZipEntryName(resolveApiMetaEntryPath(api.entry)));
  }
  for (const item of additions.ui_components ?? []) {
    requiredEntryPaths.add(normalizeZipEntryName(item.entry));
    if (item.draftEntry) {
      requiredEntryPaths.add(normalizeZipEntryName(item.draftEntry));
    }
  }
  for (const route of additions.ui_routes ?? []) {
    requiredEntryPaths.add(normalizeZipEntryName(route.entry));
  }
  for (const patch of additions.navigation_patches ?? []) {
    requiredEntryPaths.add(normalizeZipEntryName(patch.entry));
  }
  for (const keys of additions.culture_keys ?? []) {
    requiredEntryPaths.add(normalizeZipEntryName(keys.entry));
  }
  for (const homePortal of additions.home_portal ?? []) {
    requiredEntryPaths.add(normalizeZipEntryName(homePortal.entry));
  }
  for (const portal of additions.portals ?? []) {
    requiredEntryPaths.add(normalizeZipEntryName(portal.entry));
  }
  for (const navigation of additions.navigations ?? []) {
    requiredEntryPaths.add(normalizeZipEntryName(navigation.entry));
  }
  for (const workflow of additions.workflows ?? []) {
    requiredEntryPaths.add(normalizeZipEntryName(workflow.entry));
  }
  for (const dbObject of additions.db_objects ?? []) {
    requiredEntryPaths.add(normalizeZipEntryName(dbObject.installScript));
    if (dbObject.uninstallScript) {
      requiredEntryPaths.add(normalizeZipEntryName(dbObject.uninstallScript));
    }
  }
  for (const model of additions.edge_models ?? []) {
    requiredEntryPaths.add(normalizeZipEntryName(model.entry));
  }
  for (const api of additions.edge_apis ?? []) {
    requiredEntryPaths.add(normalizeZipEntryName(api.entry));
  }
  for (const meta of additions.edge_model_studio_meta ?? []) {
    requiredEntryPaths.add(normalizeZipEntryName(meta.entry));
  }
  for (const policy of additions.record_policies ?? []) {
    requiredEntryPaths.add(normalizeZipEntryName(policy.entry));
  }
  for (const binding of additions.record_policy_bindings ?? []) {
    requiredEntryPaths.add(normalizeZipEntryName(binding.entry));
  }
  for (const dimension of additions.scope_dimensions ?? []) {
    requiredEntryPaths.add(normalizeZipEntryName(dimension.entry));
  }

  const packedPaths = new Set<string>();
  for (const file of additions.files) {
    const entryPath = normalizeZipEntryName(file.entryPath);
    packedPaths.add(entryPath);
    zipEntries.set(
      entryPath,
      file.contentBase64
        ? Buffer.from(file.contentBase64, 'base64')
        : Buffer.from(file.content, 'utf8'),
    );
  }

  for (const entryPath of requiredEntryPaths) {
    if (!zipEntries.has(entryPath) && !packedPaths.has(entryPath)) {
      return { ok: false, error: `Repack addition file is missing for ${entryPath}.` };
    }
  }

  return { ok: true };
}

export async function executePackageRepack(
  packageId: string,
  actor: string,
  input: {
    version: string;
    description?: string;
    descriptionMode?: 'replace' | 'append';
    createdBy?: string;
    additions?: PackageRepackAdditionsPayload | null;
    removals?: PackageRepackRemovalsPayload | null;
  },
): Promise<PackageRepackResult | { ok: false; error: string; statusCode: number; details?: string[] }> {
  const context = resolveRepackContext(packageId);
  if (!context.ok) {
    return { ok: false, error: context.error, statusCode: context.statusCode };
  }

  const nextVersion = input.version.trim();
  if (!isValidSemver(nextVersion)) {
    return { ok: false, error: 'Version must be SemVer (x.y.z).', statusCode: 400 };
  }

  if (compareSemver(nextVersion, context.version) <= 0) {
    return {
      ok: false,
      error: `Version must be higher than the installed base version (${context.version}).`,
      statusCode: 400,
    };
  }

  const preservedVersions = snapshotPackageVersions(context.packageId);
  const preservedArtifacts = new Map<string, Buffer>();
  const preservedManifests = new Map<string, string>();
  for (const versionEntry of preservedVersions) {
    const artifactBytes = snapshotArtifactBytes(versionEntry);
    if (artifactBytes) {
      preservedArtifacts.set(versionEntry.version, artifactBytes);
    }
    const manifestText = snapshotManifestText(versionEntry);
    if (manifestText) {
      preservedManifests.set(versionEntry.version, manifestText);
    }
  }

  const existingVersions = preservedVersions.map((item) => item.version);
  if (existingVersions.includes(nextVersion)) {
    return { ok: false, error: `Version ${nextVersion} already exists for this package.`, statusCode: 409 };
  }

  const changedItems = findChangedItems(context);
  const additions = materializeUiComponentRepackAdditions(input.additions ?? null);
  const removals = input.removals ?? null;
  if (changedItems.length === 0 && !hasRepackAdditions(additions) && !hasRepackRemovals(removals)) {
    return { ok: false, error: 'No changed items or new capabilities were found to repack.', statusCode: 409 };
  }

  const zipEntries = new Map<string, Buffer>();
  for (const [entryPath, content] of context.artifactEntries.entries()) {
    zipEntries.set(entryPath, content);
  }

  const refs = collectManifestFileRefs(context.manifest);
  for (const ref of refs) {
    const current = readCurrentContent(
      context.packageId,
      context.version,
      context.artifactEntries,
      ref.entryPath,
      ref,
    );
    if (current) {
      zipEntries.set(normalizeZipEntryName(ref.entryPath), current);
    }
  }

  const descriptionMode = input.descriptionMode === 'append' ? 'append' : 'replace';
  const resolvedDescription = resolveRepackDescriptionText(
    typeof context.manifest.description === 'string' ? context.manifest.description : undefined,
    nextVersion,
    input.description,
    descriptionMode,
  );
  if (resolvedDescription && resolvedDescription.length > PACKAGE_DESCRIPTION_MAX_LENGTH) {
    return {
      ok: false,
      error: `Description must be up to ${PACKAGE_DESCRIPTION_MAX_LENGTH} characters.`,
      statusCode: 400,
    };
  }

  const manifestClone = JSON.parse(JSON.stringify(context.manifest)) as AnyPackageManifest & Record<string, unknown>;
  manifestClone.version = nextVersion;
  const manifestCapabilities = manifestClone.capabilities as Record<string, unknown>;
  if (!Array.isArray(manifestCapabilities.ui_components)) {
    manifestCapabilities.ui_components = [];
  }
  if (removals && hasRepackRemovals(removals)) {
    const removalResult = applyRepackRemovals(manifestClone, zipEntries, removals);
    if (!removalResult.ok) {
      return { ok: false, error: removalResult.error, statusCode: 400 };
    }
  }
  if (additions && hasRepackAdditions(additions)) {
    const mergeResult = applyRepackAdditions(manifestClone, zipEntries, additions);
    if (!mergeResult.ok) {
      return { ok: false, error: mergeResult.error, statusCode: 400 };
    }
  }
  if (resolvedDescription) {
    manifestClone.description = resolvedDescription;
  } else if (descriptionMode === 'replace') {
    delete manifestClone.description;
  }
  manifestClone.createdAt = new Date().toISOString();
  const auditCreatedBy = input.createdBy?.trim() || actor;
  manifestClone.createdBy = auditCreatedBy;
  manifestClone.integrity = {
    algorithm: 'sha256',
    artifactHash: '0'.repeat(64),
  };

  const manifestBuffer = Buffer.from(`${JSON.stringify(manifestClone, null, 2)}\n`, 'utf8');
  const hashEntries = [
    ...Array.from(zipEntries.entries()).map(([entryPath, content]) => ({ path: entryPath, content })),
    { path: 'package.json', content: manifestBuffer },
  ];
  const artifactHash = computeArtifactHash(hashEntries);
  manifestClone.integrity = { algorithm: 'sha256', artifactHash };
  const finalManifestBuffer = Buffer.from(`${JSON.stringify(manifestClone, null, 2)}\n`, 'utf8');
  zipEntries.set('package.json', finalManifestBuffer);

  const zip = new AdmZip();
  for (const [entryPath, content] of zipEntries.entries()) {
    zip.addFile(entryPath, content);
  }

  const uploadResult = await uploadPackageArtifact(
    enrichPackageArtifactBuffer(zip.toBuffer()),
    `${context.packageId}-${nextVersion}.zip`,
    actor,
    { createdBy: auditCreatedBy },
  );
  if (!uploadResult.success) {
    return {
      ok: false,
      error: uploadResult.error,
      statusCode: 'details' in uploadResult && uploadResult.details ? 422 : 400,
      details: 'details' in uploadResult ? uploadResult.details : undefined,
    };
  }

  let preservedVersionLabels = commitRepackCatalogState(
    context.packageId,
    context.manifest.name,
    nextVersion,
    preservedVersions,
    preservedArtifacts,
    preservedManifests,
  );

  const lifecycle = getDefaultPackageLifecycleCoordinator();
  const reinstallResult = await lifecycle.reinstall(context.packageId, actor, {
    version: nextVersion,
    overridePolicy: DEFAULT_PACKAGE_INSTALL_OVERRIDE_POLICY,
  });
  if (!reinstallResult.success) {
    const failure = reinstallResult as Extract<typeof reinstallResult, { success: false }>;
    return {
      ok: false,
      error: failure.error || 'Repack artifact was created, but reinstall failed.',
      statusCode: 409,
      details: failure.details,
    };
  }

  preservedVersionLabels = commitRepackCatalogState(
    context.packageId,
    context.manifest.name,
    nextVersion,
    preservedVersions,
    preservedArtifacts,
    preservedManifests,
  );

  const updatedState = readInstallStateV1(context.packageId);
  return {
    packageId: context.packageId,
    version: nextVersion,
    baseVersion: context.version,
    preservedVersions: preservedVersionLabels,
    installed: updatedState?.status === 'installed' && updatedState.activeVersion === nextVersion,
    deploymentStatus: updatedState?.deploymentStatus,
  };
}

export function resolveHighestPackageVersion(packageId: string): string | null {
  const index = readPackageIndex();
  const entry = index.packages.find((pkg) => pkg.packageId === packageId);
  if (!entry) return null;
  return maxSemver(entry.versions.map((item) => item.version));
}
