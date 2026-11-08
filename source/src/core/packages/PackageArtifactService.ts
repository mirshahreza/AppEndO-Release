/**
 * PackageArtifactService
 *
 * Orchestrates all CRUD operations for package artifacts (ZIP files):
 *   upload   – validate, hash-check, store, update index
 *   list     – read index + enrich with install status
 *   detail   – single package with full version list + install status
 *   delete   – policy-checked removal of artifact + manifest + index entry
 *
 * All state mutations go through PackageFileStore (file-based, atomic).
 * No database tables are used.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import { computePackageArtifactHashFromZip } from './packageArtifactHash';
import {
  packageArtifactSizeLimitError,
} from './packageArtifactLimits';
import { readManifestCapabilityArray } from './manifestCapabilityArrays';
import {
  packageDirs,
  readPackageIndex,
  writePackageIndex,
  readInstallState,
  isPackageActivelyInstalled,
  atomicWriteText,
  atomicWriteBinary,
  appendPackageEvent,
  acquirePackageLock,
  readPackageVersionUploadActor,
  releasePackageLock,
  type PackageIndex,
  type PackageIndexEntry,
  type PackageIndexVersion,
} from './PackageFileStore';
import { resolvePackageCreatedByDisplay } from './packageCreatedByDisplay';
import { validateManifest, stampManifestAuditFields, normalizeArtifactManifestForValidation, type AnyPackageManifest, type PackageManifest } from './PackageManifestValidator.js';
import { compareSemver, maxSemver } from '../../shared/lib/semver';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

function hasUnsafeZipEntryPath(entryName: string): boolean {
  if (!entryName || entryName.includes('\0')) return true;

  const normalizedPosix = path.posix.normalize(entryName.replace(/\\/g, '/'));
  if (normalizedPosix === '..' || normalizedPosix.startsWith('../')) return true;
  if (path.posix.isAbsolute(normalizedPosix)) return true;
  if (/^[a-zA-Z]:\//.test(normalizedPosix)) return true;

  const segments = normalizedPosix.split('/').filter(Boolean);
  if (segments.includes('..')) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type UploadArtifactResult =
  | { success: true; packageId: string; version: string; artifactSha256: string }
  | { success: false; error: string; details?: string[] };

export type DeleteArtifactResult =
  | { success: true }
  | { success: false; error: string };

export interface PluginListItem {
  packageId: string;
  displayName: string;
  version: string;
  installStatus: string;
  activeInstalledVersion: string | null;
  runtimeEnabled: boolean;
  pluginKind?: 'extension' | 'vertical-app' | null;
  deploymentStatus?: 'none' | 'pending' | 'applied';
  createdAt: string | null;
  createdBy: string | null;
}

export interface PackageDetail {
  packageId: string;
  displayName: string;
  version: string;
  installStatus: string;
  activeInstalledVersion: string | null;
  runtimeEnabled: boolean;
  bundleManifest: PackageManifest | null;
  installSql: string | null;
  uninstallSql: string | null;
  pluginKind?: 'extension' | 'vertical-app' | null;
  deploymentStatus?: 'none' | 'pending' | 'applied';
  /** All catalog versions for this package id (builder duplicate checks). */
  catalogVersions: string[];
}

function resolveStoragePath(relPath: string): string {
  return path.join(packageDirs.root, relPath.replace(/\\/g, '/'));
}

export function leftoverCatalogVersionEntry(packageId: string, version: string): PackageIndexVersion {
  const artifactRel = `artifacts/${packageId}/${version}.zip`;
  const manifestRel = `manifests/${packageId}/${version}.manifest.json`;
  const artifactAbs = resolveStoragePath(artifactRel);
  const manifestAbs = resolveStoragePath(manifestRel);
  const artifactExists = fs.existsSync(artifactAbs);
  const manifestExists = fs.existsSync(manifestAbs);
  let createdAt = '';
  if (artifactExists) {
    createdAt = fs.statSync(artifactAbs).mtime.toISOString();
  } else if (manifestExists) {
    createdAt = fs.statSync(manifestAbs).mtime.toISOString();
  }

  return {
    version,
    artifactPath: artifactExists ? artifactRel : '',
    manifestPath: manifestExists ? manifestRel : '',
    artifactSha256: '',
    requiredAppVersion: '>=1.0.0',
    createdAt,
  };
}

function catalogVersionEntriesForListing(
  entry: PackageIndexEntry,
  activeVersion: string | null,
): PackageIndexVersion[] {
  const versions = [...entry.versions];
  const trimmed = activeVersion?.trim() || '';
  if (!trimmed || versions.some((item) => item.version === trimmed)) {
    return versions;
  }
  versions.push(leftoverCatalogVersionEntry(entry.packageId, trimmed));
  return versions;
}

function resolveCatalogRowInstallStatus(
  state: ReturnType<typeof readInstallState> | null,
  rowVersion: string,
): string {
  if (!state) return 'not_installed';

  if (state.status === 'installed' && state.activeVersion === rowVersion) {
    return 'installed';
  }

  if (
    (state.status === 'installing' || state.status === 'uninstalling')
    && state.activeVersion === rowVersion
  ) {
    return state.status;
  }

  if (state.status === 'failed' && state.activeVersion === rowVersion) {
    return 'failed';
  }

  return 'not_installed';
}

function manifestFileExists(versionEntry: PackageIndexVersion): boolean {
  const relPath = versionEntry.manifestPath?.trim();
  if (!relPath) return false;
  return fs.existsSync(resolveStoragePath(relPath));
}

function cachedManifestMatchesArtifact(
  versionEntry: PackageIndexVersion,
  cachedManifest: unknown,
): boolean {
  const artifactAbs = resolveStoragePath(versionEntry.artifactPath);
  if (!fs.existsSync(artifactAbs)) return true;

  try {
    const zip = new AdmZip(artifactAbs);
    const zipManifest = JSON.parse(zip.readAsText('package.json')) as {
      capabilities?: unknown;
    };
    const zipCapabilities = JSON.stringify(zipManifest.capabilities ?? {});
    const cachedCapabilities = JSON.stringify(
      cachedManifest
      && typeof cachedManifest === 'object'
      && !Array.isArray(cachedManifest)
      && 'capabilities' in cachedManifest
        ? (cachedManifest as { capabilities?: unknown }).capabilities ?? {}
        : {},
    );
    return zipCapabilities === cachedCapabilities;
  } catch {
    return true;
  }
}

/**
 * Ensures a cached manifest exists outside the ZIP artifact.
 * If missing, extracts package.json from the artifact ZIP into packages-storage/manifests/.
 */
function isCachedManifestValid(versionEntry: PackageIndexVersion): boolean {
  const relPath = versionEntry.manifestPath?.trim();
  if (!relPath) return false;

  try {
    const parsed = JSON.parse(fs.readFileSync(resolveStoragePath(relPath), 'utf8')) as unknown;
    const validation = validateManifest(parsed);
    if (!validation.valid) return false;
    return cachedManifestMatchesArtifact(versionEntry, validation.manifest ?? parsed);
  } catch {
    return false;
  }
}

function ensureManifestCached(
  packageId: string,
  versionEntry: PackageIndexVersion,
): PackageIndexVersion | null {
  if (manifestFileExists(versionEntry) && isCachedManifestValid(versionEntry)) {
    return versionEntry;
  }

  const artifactAbs = resolveStoragePath(versionEntry.artifactPath);
  if (!fs.existsSync(artifactAbs)) {
    return null;
  }

  let zip: AdmZip;
  try {
    zip = new AdmZip(artifactAbs);
  } catch {
    return null;
  }

  for (const entry of zip.getEntries()) {
    if (hasUnsafeZipEntryPath(entry.entryName)) {
      return null;
    }
  }

  let manifestText: string;
  try {
    manifestText = zip.readAsText('package.json');
  } catch {
    return null;
  }
  if (!manifestText?.trim()) {
    return null;
  }

  let rawManifest: unknown;
  try {
    rawManifest = JSON.parse(manifestText);
  } catch {
    return null;
  }

  const validation = validateManifest(rawManifest);
  const manifest = validation.valid && validation.manifest
    ? validation.manifest
    : (rawManifest && typeof rawManifest === 'object' && !Array.isArray(rawManifest)
      ? rawManifest as PackageManifest
      : null);
  if (!manifest) {
    return null;
  }

  const manifestRelPath = `manifests/${packageId}/${versionEntry.version}.manifest.json`;
  const manifestAbs = resolveStoragePath(manifestRelPath);
  fs.mkdirSync(path.dirname(manifestAbs), { recursive: true });
  const manifestToCache = mergeManifestAuditFields(manifest, versionEntry);
  atomicWriteText(manifestAbs, JSON.stringify(manifestToCache, null, 2));

  return {
    ...versionEntry,
    manifestPath: manifestRelPath,
    requiredAppVersion: versionEntry.requiredAppVersion || manifest.requiredAppVersion || '',
  };
}

/** Ensures a valid cached manifest exists; re-extracts from the artifact ZIP when missing or invalid. */
export function ensurePackageManifestCached(
  packageId: string,
  versionEntry: PackageIndexVersion,
): PackageIndexVersion | null {
  return ensureManifestCached(packageId, versionEntry);
}

function mergeManifestAuditFields(
  manifest: PackageManifest,
  versionEntry: PackageIndexVersion,
): PackageManifest {
  const createdAt = versionEntry.createdAt?.trim() || manifest.createdAt?.trim();
  const createdBy = versionEntry.createdBy?.trim() || manifest.createdBy?.trim();
  return {
    ...manifest,
    ...(createdAt ? { createdAt } : {}),
    ...(createdBy ? { createdBy } : {}),
  };
}

function backfillVersionCreatedAt(
  versionEntry: PackageIndexVersion,
  manifest: PackageManifest | null,
): PackageIndexVersion {
  if (versionEntry.createdAt?.trim()) {
    return versionEntry;
  }

  const manifestCreatedAt = manifest?.createdAt?.trim();
  if (manifestCreatedAt) {
    return { ...versionEntry, createdAt: manifestCreatedAt };
  }

  const artifactAbs = resolveStoragePath(versionEntry.artifactPath);
  if (!fs.existsSync(artifactAbs)) {
    return versionEntry;
  }

  try {
    const stat = fs.statSync(artifactAbs);
    return { ...versionEntry, createdAt: stat.mtime.toISOString() };
  } catch {
    return versionEntry;
  }
}

function backfillVersionCreatedBy(
  packageId: string,
  versionEntry: PackageIndexVersion,
  manifest: PackageManifest | null,
): PackageIndexVersion {
  if (versionEntry.createdBy?.trim()) {
    return versionEntry;
  }
  const createdBy = manifest?.createdBy?.trim()
    || readPackageVersionUploadActor(packageId, versionEntry.version)?.trim();
  if (!createdBy) {
    return versionEntry;
  }
  return { ...versionEntry, createdBy };
}

function getPackageListAudit(entry: PackageIndexEntry): { createdAt: string | null; createdBy: string | null } {
  if (entry.versions.length === 0) {
    return { createdAt: null, createdBy: null };
  }

  // versions[0] is the latest upload (prepended on upload); oldest is the package origin.
  const oldestVersion = entry.versions[entry.versions.length - 1];
  let createdAt = oldestVersion?.createdAt?.trim() || null;
  let createdBy = oldestVersion?.createdBy?.trim() || null;

  if ((!createdAt || !createdBy) && oldestVersion) {
    const manifest = readManifestForVersion(oldestVersion);
    if (!createdAt && manifest?.createdAt?.trim()) {
      createdAt = manifest.createdAt.trim();
    }
    if (!createdBy && manifest?.createdBy?.trim()) {
      createdBy = manifest.createdBy.trim();
    }
    if (!createdBy && oldestVersion.version) {
      createdBy = readPackageVersionUploadActor(entry.packageId, oldestVersion.version)?.trim() || null;
    }
  }

  return { createdAt, createdBy };
}

function repairPackageIndexForListing(index: PackageIndex): { index: PackageIndex; changed: boolean } {
  let changed = false;

  for (const entry of index.packages) {
    const repairedVersions: PackageIndexVersion[] = [];

    for (const versionEntry of entry.versions) {
      let repaired = versionEntry;

      const cached = ensureManifestCached(entry.packageId, repaired);
      if (cached) {
        if (
          cached.manifestPath !== repaired.manifestPath
          || cached.requiredAppVersion !== repaired.requiredAppVersion
        ) {
          changed = true;
        }
        repaired = cached;
      }

      let manifest = readManifestForVersion(repaired);

      const withCreatedAt = backfillVersionCreatedAt(repaired, manifest);
      if (withCreatedAt.createdAt !== repaired.createdAt) {
        changed = true;
      }
      repaired = withCreatedAt;

      const withCreatedBy = backfillVersionCreatedBy(entry.packageId, repaired, manifest);
      if (withCreatedBy.createdBy !== repaired.createdBy) {
        changed = true;
      }
      repaired = withCreatedBy;

      if (manifest && repaired.manifestPath?.trim()) {
        const merged = mergeManifestAuditFields(manifest, repaired);
        if (
          merged.createdAt !== manifest.createdAt
          || merged.createdBy !== manifest.createdBy
        ) {
          const manifestAbs = resolveStoragePath(repaired.manifestPath);
          atomicWriteText(manifestAbs, JSON.stringify(merged, null, 2));
          manifest = merged;
          changed = true;
        }
      }

      repairedVersions.push(repaired);
    }

    entry.versions = repairedVersions;
  }

  return { index, changed };
}

function readManifestForVersion(versionEntry: PackageIndexVersion): PackageManifest | null {
  const relPath = versionEntry.manifestPath || '';
  if (!relPath.trim()) return null;

  const absPath = resolveStoragePath(relPath);
  if (!fs.existsSync(absPath)) return null;

  try {
    const parsed = JSON.parse(fs.readFileSync(absPath, 'utf8')) as unknown;
    const validation = validateManifest(parsed);
    if (validation.valid && validation.manifest) {
      return validation.manifest;
    }

    // Detail view should still render package composition when the manifest is
    // readable but fails strict validation for install-time guarantees.
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      const cap = record.capabilities;
      if (cap && typeof cap === 'object' && !Array.isArray(cap)) {
        const capabilities = cap as Record<string, unknown>;
        return {
          ...(record as PackageManifest),
          capabilities: {
            ...(capabilities as PackageManifest['capabilities']),
            apis: readManifestCapabilityArray(capabilities.apis),
            ui_components: readManifestCapabilityArray(capabilities.ui_components),
            db_objects: readManifestCapabilityArray(capabilities.db_objects),
          },
        } as PackageManifest;
      }
      return parsed as PackageManifest;
    }

    return null;
  } catch {
    return null;
  }
}

function normalizeZipEntryName(entryName: string): string {
  return entryName.replace(/\\/g, '/').replace(/^\.\//, '');
}

function readSqlFromArtifact(artifactPath: string, scriptPath: string): string | null {
  if (!fs.existsSync(artifactPath)) return null;

  try {
    const zip = new AdmZip(artifactPath);
    const normalized = normalizeZipEntryName(scriptPath);
    const entry = zip.getEntries().find(
      (item) => normalizeZipEntryName(item.entryName) === normalized,
    );
    if (!entry || entry.isDirectory) return null;
    return entry.getData().toString('utf8');
  } catch {
    return null;
  }
}

function collectPackageSqlScripts(
  versionEntry: PackageIndexVersion,
  manifest: PackageManifest | null,
): { installSql: string | null; uninstallSql: string | null } {
  const artifactRelPath = versionEntry.artifactPath?.trim();
  if (!artifactRelPath) {
    return { installSql: null, uninstallSql: null };
  }

  const artifactPath = resolveStoragePath(artifactRelPath);
  const installPaths: string[] = [];
  const uninstallPaths: string[] = [];

  for (const obj of manifest?.capabilities.db_objects ?? []) {
    if (typeof obj.installScript === 'string' && obj.installScript.trim()) {
      installPaths.push(obj.installScript.trim());
    }
    if (typeof obj.uninstallScript === 'string' && obj.uninstallScript.trim()) {
      uninstallPaths.push(obj.uninstallScript.trim());
    }
  }

  const readCombined = (paths: string[]) => {
    const chunks: string[] = [];
    const seen = new Set<string>();
    for (const scriptPath of paths) {
      if (seen.has(scriptPath)) continue;
      seen.add(scriptPath);
      const content = readSqlFromArtifact(artifactPath, scriptPath);
      if (content?.trim()) {
        chunks.push(content.trim());
      }
    }
    return chunks.length > 0 ? `${chunks.join('\n\n')}\n` : null;
  };

  return {
    installSql: readCombined(installPaths),
    uninstallSql: readCombined(uninstallPaths),
  };
}

// ---------------------------------------------------------------------------
// Catalog merge (multi-version packages)
// ---------------------------------------------------------------------------

function collectPackageCatalogVersions(
  index: PackageIndex,
  packageId: string,
): Map<string, PackageIndexVersion> {
  const versionMap = new Map<string, PackageIndexVersion>();
  for (const entry of index.packages) {
    if (entry.packageId !== packageId) continue;
    for (const versionEntry of entry.versions) {
      versionMap.set(versionEntry.version, { ...versionEntry });
    }
  }
  return versionMap;
}

export function mergePackageCatalogVersions(
  index: PackageIndex,
  packageId: string,
  displayName: string,
  versionEntry: PackageIndexVersion,
  additionalVersions: PackageIndexVersion[] = [],
): PackageIndexEntry {
  const versionMap = collectPackageCatalogVersions(index, packageId);

  for (const preserved of additionalVersions) {
    if (!versionMap.has(preserved.version)) {
      versionMap.set(preserved.version, { ...preserved });
    }
  }

  versionMap.set(versionEntry.version, { ...versionEntry });

  const versions = Array.from(versionMap.values()).sort(
    (left, right) => compareSemver(right.version, left.version),
  );
  const latestVersion = maxSemver(versions.map((item) => item.version)) ?? versionEntry.version;

  return {
    packageId,
    displayName,
    latestVersion,
    versions,
  };
}

export function applyPackageCatalogMerge(
  index: PackageIndex,
  packageId: string,
  displayName: string,
  versionEntry: PackageIndexVersion,
  additionalVersions: PackageIndexVersion[] = [],
): PackageIndexEntry {
  const merged = mergePackageCatalogVersions(
    index,
    packageId,
    displayName,
    versionEntry,
    additionalVersions,
  );
  index.packages = [
    merged,
    ...index.packages.filter((entry) => entry.packageId !== packageId),
  ];
  return merged;
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

/**
 * Validates and stores a package ZIP artifact.
 *
 * Security checks performed:
 *   1. File size ≤ 512 MB
 *   2. Extension must be .zip
 *   3. ZIP entries scanned for path traversal (zip-slip)
 *   4. package.json must be present in ZIP root
 *   5. Manifest schema validation (all required fields + cross-field rules)
 *   6. integrity.artifactHash must match the computed SHA-256 of the upload
 *   7. Duplicate packageId+version is rejected
 */
export async function uploadPackageArtifact(
  buffer: Buffer,
  originalName: string,
  actor: string,
  options?: { createdBy?: string | null },
): Promise<UploadArtifactResult> {
  // 1. Size guard
  const sizeError = packageArtifactSizeLimitError(buffer.length);
  if (sizeError) {
    return { success: false, error: sizeError };
  }

  // 2. Extension guard
  if (!originalName.toLowerCase().endsWith('.zip')) {
    return { success: false, error: 'File must have .zip extension.' };
  }

  // 3. Compute SHA-256 before doing anything else
  const artifactSha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  // 4. Parse ZIP
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    return { success: false, error: 'Could not parse ZIP file. The file may be corrupt.' };
  }

  // 5. Zip-slip + path hardening scan
  for (const entry of zip.getEntries()) {
    if (hasUnsafeZipEntryPath(entry.entryName)) {
      return { success: false, error: `ZIP contains unsafe entry path: "${entry.entryName}".` };
    }
  }

  // 6. Read package.json from ZIP root
  let manifestText: string;
  try {
    manifestText = zip.readAsText('package.json');
  } catch {
    return { success: false, error: 'ZIP does not contain package.json in its root.' };
  }
  if (!manifestText || !manifestText.trim()) {
    return { success: false, error: 'ZIP does not contain package.json in its root.' };
  }

  // 7. Parse manifest JSON
  let rawManifest: unknown;
  try {
    rawManifest = JSON.parse(manifestText);
  } catch {
    return { success: false, error: 'package.json is not valid JSON.' };
  }

  // 8. Validate manifest schema (audit fields are stamped after upload, not in artifact ZIP)
  const validation = validateManifest(normalizeArtifactManifestForValidation(rawManifest));
  if (!validation.valid || !validation.manifest) {
    return { success: false, error: 'package.json validation failed.', details: validation.errors };
  }
  const uploadedAt = new Date().toISOString();
  const manifest = stampManifestAuditFields(
    validation.manifest as AnyPackageManifest,
    actor,
    uploadedAt,
    { createdBy: options?.createdBy },
  );

  const declaredHash = typeof manifest.integrity?.artifactHash === 'string'
    ? manifest.integrity.artifactHash.trim().toLowerCase()
    : '';
  const manifestContentHash = computePackageArtifactHashFromZip(zip);
  if (declaredHash && declaredHash !== manifestContentHash) {
    return {
      success: false,
      error: 'integrity.artifactHash does not match the uploaded ZIP contents.',
    };
  }

  const { id: packageId, version, name: displayName } = manifest;

  // 10. Acquire locks (index first, then package — lexicographic order per policy)
  const indexLock = 'index';
  const pluginLock = `package-${packageId}`;

  if (!acquirePackageLock(indexLock)) {
    return { success: false, error: 'System index is locked. Please retry.' };
  }
  if (!acquirePackageLock(pluginLock)) {
    releasePackageLock(indexLock);
    return { success: false, error: 'Package is locked by another operation. Please retry.' };
  }

  try {
    // 11. Reject duplicate version
    const index = readPackageIndex();
    const existing = index.packages.find(p => p.packageId === packageId);
    if (existing?.versions.some(v => v.version === version)) {
      return {
        success: false,
        error: `Package "${packageId}" version "${version}" already exists. Upload a different version.`,
      };
    }

    // 12. Store artifact (binary, atomic)
    const artifactDir = path.join(packageDirs.artifacts, packageId);
    fs.mkdirSync(artifactDir, { recursive: true });
    const artifactFilePath = path.join(artifactDir, `${version}.zip`);
    atomicWriteBinary(artifactFilePath, buffer);

    // 12.1 Storage integrity verification (hash verification)
    const persisted = fs.readFileSync(artifactFilePath);
    const persistedSha256 = crypto.createHash('sha256').update(persisted).digest('hex');
    if (persistedSha256 !== artifactSha256) {
      fs.rmSync(artifactFilePath, { force: true });
      return {
        success: false,
        error: 'Stored artifact hash verification failed. Upload aborted.',
      };
    }

    // 13. Store normalized manifest (text, atomic)
    const manifestDir = path.join(packageDirs.manifests, packageId);
    fs.mkdirSync(manifestDir, { recursive: true });
    const manifestFilePath = path.join(manifestDir, `${version}.manifest.json`);
    atomicWriteText(manifestFilePath, JSON.stringify(manifest, null, 2));

    // 14. Update index
    const versionEntry: PackageIndexVersion = {
      version,
      artifactPath: `artifacts/${packageId}/${version}.zip`,
      manifestPath: `manifests/${packageId}/${version}.manifest.json`,
      artifactSha256,
      requiredAppVersion: manifest.requiredAppVersion,
      createdAt: manifest.createdAt,
      createdBy: manifest.createdBy,
    };

    applyPackageCatalogMerge(index, packageId, displayName, versionEntry);
    writePackageIndex(index);

    // 15. Log event
    appendPackageEvent({
      type: 'package.artifact.uploaded',
      packageId,
      version,
      actor,
      payload: {
        artifactSha256,
        manifestDeclaredHash: manifest.integrity.artifactHash,
        artifactSizeBytes: buffer.length,
        originalName,
      },
    });

    return { success: true, packageId, version, artifactSha256 };
  } finally {
    releasePackageLock(pluginLock);
    releasePackageLock(indexLock);
  }
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/** Returns one catalog row per package version, enriched with install status. */
export function listPackages(): PluginListItem[] {
  const rawIndex = readPackageIndex();
  const { index, changed } = repairPackageIndexForListing(rawIndex);
  if (changed) {
    writePackageIndex(index);
  }

  return index.packages.flatMap((entry) => {
    const state = readInstallState(entry.packageId) as (ReturnType<typeof readInstallState> & {
      pluginKind?: 'extension' | 'vertical-app';
      deploymentStatus?: 'none' | 'pending' | 'applied';
    }) | null;
    const activeVersion = state?.activeVersion ?? null;
    const rowInstallStatus = (version: string) => resolveCatalogRowInstallStatus(state, version);
    const isRowInstalled = (version: string) => rowInstallStatus(version) === 'installed';

    return catalogVersionEntriesForListing(entry, activeVersion).map((versionEntry) => ({
      packageId: entry.packageId,
      displayName: entry.displayName,
      version: versionEntry.version,
      installStatus: rowInstallStatus(versionEntry.version),
      activeInstalledVersion: activeVersion,
      runtimeEnabled: isRowInstalled(versionEntry.version) && state?.enabled !== false,
      pluginKind: state?.pluginKind ?? null,
      deploymentStatus: isRowInstalled(versionEntry.version)
        ? (state?.deploymentStatus ?? 'none')
        : 'none',
      createdAt: versionEntry.createdAt?.trim() || null,
      createdBy: resolvePackageCreatedByDisplay(
        versionEntry.createdBy?.trim() || null,
        readPackageVersionUploadActor(entry.packageId, versionEntry.version),
      ),
    }));
  });
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

/** Returns detail for a single catalog version. */
export function getPackageDetail(packageId: string, requestedVersion?: string): PackageDetail | null {
  const rawIndex = readPackageIndex();
  const { index, changed } = repairPackageIndexForListing(rawIndex);
  if (changed) {
    writePackageIndex(index);
  }
  const entry = index.packages.find(p => p.packageId === packageId);
  if (!entry) return null;

  const state = readInstallState(packageId) as (ReturnType<typeof readInstallState> & {
    pluginKind?: 'extension' | 'vertical-app';
    deploymentStatus?: 'none' | 'pending' | 'applied';
  }) | null;
  const catalogVersions = catalogVersionEntriesForListing(entry, state?.activeVersion ?? null);
  const trimmedVersion = requestedVersion?.trim();
  const selectedVersion = trimmedVersion
    ? catalogVersions.find((item) => item.version === trimmedVersion)
    : catalogVersions[0];
  if (!selectedVersion) return null;

  const installStatus = resolveCatalogRowInstallStatus(state, selectedVersion.version);
  const isInstalled = installStatus === 'installed';
  const bundleManifest = readManifestForVersion(selectedVersion);
  const sqlScripts = collectPackageSqlScripts(selectedVersion, bundleManifest);

  return {
    packageId: entry.packageId,
    displayName: entry.displayName,
    version: selectedVersion.version,
    installStatus,
    activeInstalledVersion: state?.activeVersion ?? null,
    runtimeEnabled: isInstalled && state?.enabled !== false,
    bundleManifest,
    installSql: sqlScripts.installSql,
    uninstallSql: sqlScripts.uninstallSql,
    pluginKind: state?.pluginKind ?? null,
    deploymentStatus: isInstalled ? (state?.deploymentStatus ?? 'none') : 'none',
    catalogVersions: catalogVersions.map((item) => item.version),
  };
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Deletes one catalog version (artifact + manifest + index entry).
 *
 * Policy: rejected when that version is actively installed or the package is busy.
 */
export function deletePackageVersion(
  packageId: string,
  version: string,
  actor: string,
): DeleteArtifactResult {
  const trimmedVersion = version.trim();
  if (!trimmedVersion) {
    return { success: false, error: 'Version is required.' };
  }

  const state = readInstallState(packageId);
  if (state?.status === 'installed' && state.activeVersion === trimmedVersion) {
    return {
      success: false,
      error: `Version "${trimmedVersion}" is currently installed. Uninstall it before deleting.`,
    };
  }
  if (state?.status === 'installing' || state?.status === 'uninstalling') {
    return {
      success: false,
      error: `Package "${packageId}" is currently busy (${state.status}).`,
    };
  }

  const indexLock = 'index';
  const pluginLock = `package-${packageId}`;

  if (!acquirePackageLock(indexLock)) {
    return { success: false, error: 'System index is locked. Please retry.' };
  }
  if (!acquirePackageLock(pluginLock)) {
    releasePackageLock(indexLock);
    return { success: false, error: 'Package is locked by another operation. Please retry.' };
  }

  try {
    const index = readPackageIndex();
    const entry = index.packages.find((item) => item.packageId === packageId);
    if (!entry) {
      return { success: false, error: `Package "${packageId}" not found.` };
    }

    const versionIdx = entry.versions.findIndex((item) => item.version === trimmedVersion);
    if (versionIdx === -1) {
      return { success: false, error: `Version "${trimmedVersion}" was not found for package "${packageId}".` };
    }

    const versionEntry = entry.versions[versionIdx];
    const artifactPath = resolveStoragePath(versionEntry.artifactPath);
    if (fs.existsSync(artifactPath)) {
      fs.rmSync(artifactPath, { force: true });
    }

    const manifestPath = resolveStoragePath(versionEntry.manifestPath);
    if (fs.existsSync(manifestPath)) {
      fs.rmSync(manifestPath, { force: true });
    }

    entry.versions.splice(versionIdx, 1);

    if (entry.versions.length === 0) {
      index.packages = index.packages.filter((item) => item.packageId !== packageId);
    } else {
      entry.latestVersion = maxSemver(entry.versions.map((item) => item.version)) ?? entry.versions[0].version;
    }

    writePackageIndex(index);

    appendPackageEvent({
      type: 'package.artifact.deleted',
      packageId,
      version: trimmedVersion,
      actor,
    });

    return { success: true };
  } finally {
    releasePackageLock(pluginLock);
    releasePackageLock(indexLock);
  }
}

/**
 * Deletes a package and ALL its versions from the file store.
 *
 * Policy: deletion is rejected if the package has an active install
 * (status is "installed", "installing", or "uninstalling").
 */
export function deletePackage(packageId: string, actor: string): DeleteArtifactResult {
  // Check install state before locking
  if (isPackageActivelyInstalled(packageId)) {
    return {
      success: false,
      error: `Package "${packageId}" is currently installed. Uninstall it before deleting.`,
    };
  }

  const indexLock = 'index';
  const pluginLock = `package-${packageId}`;

  if (!acquirePackageLock(indexLock)) {
    return { success: false, error: 'System index is locked. Please retry.' };
  }
  if (!acquirePackageLock(pluginLock)) {
    releasePackageLock(indexLock);
    return { success: false, error: 'Package is locked by another operation. Please retry.' };
  }

  try {
    const index = readPackageIndex();
    const entryIdx = index.packages.findIndex(p => p.packageId === packageId);

    if (entryIdx === -1) {
      return { success: false, error: `Package "${packageId}" not found.` };
    }

    // Re-check install state inside lock
    if (isPackageActivelyInstalled(packageId)) {
      return {
        success: false,
        error: `Package "${packageId}" is currently installed. Uninstall it before deleting.`,
      };
    }

    // Remove artifact files
    const artifactDir = path.join(packageDirs.artifacts, packageId);
    if (fs.existsSync(artifactDir)) {
      fs.rmSync(artifactDir, { recursive: true, force: true });
    }

    // Remove manifest files
    const manifestDir = path.join(packageDirs.manifests, packageId);
    if (fs.existsSync(manifestDir)) {
      fs.rmSync(manifestDir, { recursive: true, force: true });
    }

    // Remove from index
    index.packages.splice(entryIdx, 1);
    writePackageIndex(index);

    // Log event
    appendPackageEvent({
      type: 'package.artifact.deleted',
      packageId,
      actor,
    });

    return { success: true };
  } finally {
    releasePackageLock(pluginLock);
    releasePackageLock(indexLock);
  }
}
