/**
 * PackageFileStore
 *
 * Low-level file-system helpers for the Package Platform:
 *   - Directory bootstrap
 *   - Atomic write (tmp → rename)
 *   - File-based locking (PID + TTL)
 *   - Append-only JSONL event log
 *   - Index + install-state CRUD
 *
 * Persistence is 100% file-based; no DB tables are used.
 */

import fs from 'fs';
import path from 'path';
import { readRuntimeSettings } from '../../server/config/settingsFile';
import crypto from 'crypto';
import type { PackageDeploymentApplied } from '../../shared/api/contracts/package-manifest/deploymentApplied';
import { isPackageDeploymentApplied } from '../../shared/api/contracts/package-manifest/deploymentApplied';
import type { ExtensionPlatformCapabilitiesApplied } from '../../shared/api/contracts/package-manifest/extensionPlatformCapabilities';
import { isExtensionPlatformCapabilitiesApplied } from '../../shared/api/contracts/package-manifest/extensionPlatformCapabilities';

// ---------------------------------------------------------------------------
// Root layout
// ---------------------------------------------------------------------------

/** Default on-disk catalog directory name (relative to process cwd). */
export const PACKAGE_STORAGE_ROOT = 'packages-storage';

/**
 * Tests isolate the catalog with `PACKAGE_STORAGE_ROOT`. Production leaves it unset
 * so the store stays under `packages-storage`. Read at access time so a later env
 * override still wins after this module has loaded.
 */
export function resolvePackageStorageRoot(): string {
  const fromEnv = process.env.PACKAGE_STORAGE_ROOT?.trim();
  return fromEnv || PACKAGE_STORAGE_ROOT;
}

export const packageDirs = {
  get root() {
    return resolvePackageStorageRoot();
  },
  get artifacts() {
    return path.join(resolvePackageStorageRoot(), 'artifacts');
  },
  get manifests() {
    return path.join(resolvePackageStorageRoot(), 'manifests');
  },
  get installed() {
    return path.join(resolvePackageStorageRoot(), 'installed');
  },
  get deployments() {
    return path.join(resolvePackageStorageRoot(), 'deployments');
  },
  get objects() {
    return path.join(resolvePackageStorageRoot(), 'objects');
  },
  get runtimes() {
    return path.join(resolvePackageStorageRoot(), 'runtimes');
  },
  get dependencies() {
    return path.join(resolvePackageStorageRoot(), 'dependencies');
  },
  get events() {
    return path.join(resolvePackageStorageRoot(), 'events');
  },
  get locks() {
    return path.join(resolvePackageStorageRoot(), 'locks');
  },
  get tmp() {
    return path.join(resolvePackageStorageRoot(), 'tmp');
  },
  get snapshots() {
    return path.join(resolvePackageStorageRoot(), 'snapshots');
  },
};

export function ensurePackageStorageDirs(): void {
  for (const d of Object.values(packageDirs)) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Schema types
// ---------------------------------------------------------------------------

export interface PackageIndexVersion {
  version: string;
  artifactPath: string;
  manifestPath: string;
  artifactSha256: string;
  requiredAppVersion: string;
  createdAt: string;
  createdBy?: string;
}

export interface PackageIndexEntry {
  packageId: string;
  displayName: string;
  latestVersion: string;
  versions: PackageIndexVersion[];
}

export interface PackageIndex {
  schema: 'package-index';
  schemaVersion: '1.0.0';
  updatedAt: string;
  packages: PackageIndexEntry[];
}

export interface InstallState {
  schema: 'package-install-state';
  schemaVersion: '1.0.0';
  packageId: string;
  status: 'not_installed' | 'installing' | 'installed' | 'uninstalling' | 'failed';
  activeVersion: string | null;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Index helpers
// ---------------------------------------------------------------------------

function packageIndexPath(): string {
  return path.join(resolvePackageStorageRoot(), 'index.json');
}

function makeEmptyIndex(): PackageIndex {
  return {
    schema: 'package-index',
    schemaVersion: '1.0.0',
    updatedAt: new Date().toISOString(),
    packages: [],
  };
}

export function readPackageIndex(): PackageIndex {
  const indexPath = packageIndexPath();
  if (!fs.existsSync(indexPath)) return makeEmptyIndex();
  try {
    const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as PackageIndex & { plugins?: PackageIndexEntry[] };
    if (!Array.isArray(parsed.packages) && Array.isArray(parsed.plugins)) {
      parsed.packages = parsed.plugins;
      delete parsed.plugins;
    }
    if (!Array.isArray(parsed.packages)) {
      parsed.packages = [];
    }
    return parsed as PackageIndex;
  } catch {
    return makeEmptyIndex();
  }
}

export function buildPackageDisplayNameMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of readPackageIndex().packages) {
    map.set(entry.packageId, entry.displayName?.trim() || entry.packageId);
  }
  return map;
}

export function resolvePackageDisplayName(
  packageId: string,
  displayNames: ReadonlyMap<string, string> = buildPackageDisplayNameMap(),
): string {
  const trimmed = packageId.trim();
  if (!trimmed) {
    return '';
  }
  return displayNames.get(trimmed) ?? trimmed;
}

export function writePackageIndex(index: PackageIndex): void {
  index.updatedAt = new Date().toISOString();
  atomicWriteText(packageIndexPath(), JSON.stringify(index, null, 2));
}

// ---------------------------------------------------------------------------
// Install-state helpers
// ---------------------------------------------------------------------------

export function readInstallState(packageId: string): InstallState | null {
  const p = path.join(packageDirs.installed, `${packageId}.install-state.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as InstallState;
  } catch {
    return null;
  }
}

export function isPackageActivelyInstalled(packageId: string): boolean {
  const state = readInstallState(packageId);
  if (!state) return false;
  return state.status === 'installed' || state.status === 'installing' || state.status === 'uninstalling';
}

// ---------------------------------------------------------------------------
// Atomic write
// ---------------------------------------------------------------------------

export function atomicWriteText(targetPath: string, content: string): void {
  const opId = crypto.randomBytes(8).toString('hex');
  const tmpPath = path.join(packageDirs.tmp, `${path.basename(targetPath)}.${opId}.tmp`);
  fs.mkdirSync(packageDirs.tmp, { recursive: true });
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, targetPath);
}

export function atomicWriteBinary(targetPath: string, content: Buffer): void {
  const opId = crypto.randomBytes(8).toString('hex');
  const tmpPath = path.join(packageDirs.tmp, `${path.basename(targetPath)}.${opId}.tmp`);
  fs.mkdirSync(packageDirs.tmp, { recursive: true });
  fs.writeFileSync(tmpPath, content);
  fs.renameSync(tmpPath, targetPath);
}

// ---------------------------------------------------------------------------
// File-based locking
// ---------------------------------------------------------------------------

interface LockFileData {
  ownerPid: number;
  startedAt: string;
  ttlMs: number;
}

const LOCK_TTL_MS = 60_000; // 60 s

function lockFilePath(name: string): string {
  return path.join(packageDirs.locks, `${name}.lock`);
}

/** Returns true if lock was acquired, false if held by a live process. */
export function acquirePackageLock(name: string): boolean {
  fs.mkdirSync(packageDirs.locks, { recursive: true });
  const p = lockFilePath(name);

  if (fs.existsSync(p)) {
    try {
      const lock = JSON.parse(fs.readFileSync(p, 'utf8')) as LockFileData;
      const elapsed = Date.now() - new Date(lock.startedAt).getTime();
      if (elapsed < lock.ttlMs) {
        try {
          process.kill(lock.ownerPid, 0); // signal 0 = existence check
          return false; // lock is live
        } catch {
          // owner process dead → steal
        }
      }
      // stale lock
      appendPackageEvent({
        type: 'package.lock.stale_stolen',
        actor: 'system',
        payload: { lockName: name, stalePid: lock.ownerPid },
      });
    } catch {
      // corrupt lock file → steal
    }
  }

  const lock: LockFileData = {
    ownerPid: process.pid,
    startedAt: new Date().toISOString(),
    ttlMs: LOCK_TTL_MS,
  };
  fs.writeFileSync(p, JSON.stringify(lock), 'utf8');
  return true;
}

export function releasePackageLock(name: string): void {
  try {
    const p = lockFilePath(name);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Append-only JSONL event log
// ---------------------------------------------------------------------------

export interface PackageEventInput {
  type: string;
  packageId?: string;
  version?: string;
  actor: string;
  correlationId?: string;
  payload?: Record<string, unknown>;
}

type PackageEventLevel = 'info' | 'warn' | 'error';
type PackageEventOutcome = 'success' | 'failure' | 'unknown';

interface PackageEventStandardized {
  schema: 'package-event';
  schemaVersion: '1.1.0';
  eventId: string;
  timestamp: string;
  type: string;
  category: 'package-platform';
  action: string;
  level: PackageEventLevel;
  outcome: PackageEventOutcome;
  packageId: string | null;
  version: string | null;
  actor: string;
  correlationId: string | null;
  retentionClass: 'audit';
  payload: Record<string, unknown> | null;
}

function deriveEventLevel(type: string): PackageEventLevel {
  if (type.includes('.failed') || type.includes('.error')) return 'error';
  if (type.includes('.blocked') || type.includes('.stale_stolen') || type.includes('.retention.')) return 'warn';
  return 'info';
}

function deriveEventOutcome(type: string): PackageEventOutcome {
  if (type.includes('.succeeded') || type.includes('.uploaded') || type.includes('.deleted')) return 'success';
  if (type.includes('.failed') || type.includes('.blocked') || type.includes('.denied')) return 'failure';
  return 'unknown';
}

function deriveEventAction(type: string): string {
  const last = type.split('.').pop() || 'unknown';
  return last;
}

function sanitizeEventPayload(payload: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!payload) return null;
  const raw = JSON.stringify(payload);
  if (Buffer.byteLength(raw, 'utf8') <= 16 * 1024) {
    return payload;
  }
  return {
    note: 'payload_truncated',
    originalSizeBytes: Buffer.byteLength(raw, 'utf8'),
  };
}

function createStandardizedEvent(
  evt: PackageEventInput,
  eventId: string,
  timestamp: string,
): PackageEventStandardized {
  return {
    schema: 'package-event',
    schemaVersion: '1.1.0',
    eventId,
    timestamp,
    type: evt.type,
    category: 'package-platform',
    action: deriveEventAction(evt.type),
    level: deriveEventLevel(evt.type),
    outcome: deriveEventOutcome(evt.type),
    packageId: evt.packageId ?? null,
    version: evt.version ?? null,
    actor: evt.actor,
    correlationId: evt.correlationId ?? null,
    retentionClass: 'audit',
    payload: sanitizeEventPayload(evt.payload),
  };
}

export function appendPackageEvent(evt: PackageEventInput): void {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const eventPath = path.join(packageDirs.events, `events-${month}.jsonl`);
  const eventId = `evt-${now.getTime()}-${crypto.randomBytes(4).toString('hex')}`;

  const line = JSON.stringify(createStandardizedEvent(evt, eventId, now.toISOString()));

  fs.mkdirSync(packageDirs.events, { recursive: true });
  fs.appendFileSync(eventPath, line + '\n', 'utf8');
}

/** Returns the upload actor for a package version from the append-only event log. */
export function readPackageVersionUploadActor(packageId: string, version: string): string | null {
  const normalizedPackageId = packageId.trim();
  const normalizedVersion = version.trim();
  if (!normalizedPackageId || !normalizedVersion) return null;

  for (const file of parseEventFiles()) {
    let raw: string;
    try {
      raw = fs.readFileSync(file.fullPath, 'utf8');
    } catch {
      continue;
    }

    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line) as {
          type?: string;
          packageId?: string | null;
          version?: string | null;
          actor?: string;
        };
        if (event.type !== 'package.artifact.uploaded') continue;
        if (event.packageId !== normalizedPackageId) continue;
        if (event.version !== normalizedVersion) continue;
        const actor = typeof event.actor === 'string' ? event.actor.trim() : '';
        if (actor) return actor;
      } catch {
        // ignore malformed event lines
      }
    }
  }

  return null;
}

interface EventFileInfo {
  fileName: string;
  fullPath: string;
  yearMonth: string;
  bytes: number;
}

function parseEventFiles(): EventFileInfo[] {
  if (!fs.existsSync(packageDirs.events)) return [];

  const monthFileRe = /^events-(\d{4}-\d{2})\.jsonl$/;
  const files: EventFileInfo[] = [];
  for (const fileName of fs.readdirSync(packageDirs.events)) {
    const m = monthFileRe.exec(fileName);
    if (!m) continue;
    const fullPath = path.join(packageDirs.events, fileName);
    try {
      const stat = fs.statSync(fullPath);
      files.push({ fileName, fullPath, yearMonth: m[1], bytes: stat.size });
    } catch {
      // ignore unreadable file entries
    }
  }

  files.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
  return files;
}

function clampRetentionMonths(value: number): number {
  if (!Number.isFinite(value)) return 6;
  return Math.max(1, Math.min(36, Math.floor(value)));
}

function clampRetentionBytes(value: number): number {
  if (!Number.isFinite(value)) return 100 * 1024 * 1024;
  return Math.max(5 * 1024 * 1024, Math.min(500 * 1024 * 1024, Math.floor(value)));
}

/**
 * Retention policy for event logs:
 * - Keep only the latest N monthly files.
 * - Enforce a max total bytes cap by dropping oldest months first.
 */
export function enforcePackageEventRetention(): { deletedFiles: string[]; keptFiles: string[] } {
  fs.mkdirSync(packageDirs.events, { recursive: true });

  const runtime = readRuntimeSettings();
  const keepMonths = clampRetentionMonths(runtime.packageEventRetentionMonths);
  const maxTotalBytes = clampRetentionBytes(runtime.packageEventRetentionMaxTotalBytes);

  const files = parseEventFiles();
  const deleted: string[] = [];
  const kept = [...files];

  // Drop by month retention first.
  while (kept.length > keepMonths) {
    const oldest = kept.shift();
    if (!oldest) break;
    try {
      fs.rmSync(oldest.fullPath, { force: true });
      deleted.push(oldest.fileName);
    } catch {
      // ignore per-file deletion failures
    }
  }

  // Enforce total bytes cap by dropping oldest remaining files.
  let totalBytes = kept.reduce((sum, item) => sum + item.bytes, 0);
  while (kept.length > 1 && totalBytes > maxTotalBytes) {
    const oldest = kept.shift();
    if (!oldest) break;
    try {
      fs.rmSync(oldest.fullPath, { force: true });
      deleted.push(oldest.fileName);
      totalBytes -= oldest.bytes;
    } catch {
      // ignore per-file deletion failures
    }
  }

  if (deleted.length > 0) {
    appendPackageEvent({
      type: 'package.events.retention.pruned',
      actor: 'system',
      payload: {
        keepMonths,
        maxTotalBytes,
        deletedFiles: deleted,
      },
    });
  }

  return {
    deletedFiles: deleted,
    keptFiles: kept.map((item) => item.fileName),
  };
}

// ---------------------------------------------------------------------------
// Applied deployment helpers
// ---------------------------------------------------------------------------

function deploymentAppliedPath(packageId: string): string {
  return path.join(packageDirs.deployments, `${packageId}.deployment-applied.json`);
}

function platformCapabilitiesAppliedPath(packageId: string): string {
  return path.join(packageDirs.deployments, `${packageId}.platform-capabilities-applied.json`);
}

export function readDeploymentApplied(packageId: string): PackageDeploymentApplied | null {
  const p = deploymentAppliedPath(packageId);
  if (!fs.existsSync(p)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8')) as unknown;
    return isPackageDeploymentApplied(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeDeploymentApplied(applied: PackageDeploymentApplied): string {
  const p = deploymentAppliedPath(applied.packageId);
  fs.mkdirSync(packageDirs.deployments, { recursive: true });
  atomicWriteText(p, `${JSON.stringify(applied, null, 2)}\n`);
  return p;
}

export function removeDeploymentApplied(packageId: string): void {
  const p = deploymentAppliedPath(packageId);
  if (fs.existsSync(p)) {
    fs.rmSync(p, { force: true });
  }
}

export function listDeploymentAppliedPackageIds(): string[] {
  if (!fs.existsSync(packageDirs.deployments)) return [];
  return fs
    .readdirSync(packageDirs.deployments)
    .filter((name) => name.endsWith('.deployment-applied.json'))
    .map((name) => name.replace(/\.deployment-applied\.json$/, ''))
    .sort();
}

export function listDeploymentAppliedRecords(): PackageDeploymentApplied[] {
  const records: PackageDeploymentApplied[] = [];
  for (const packageId of listDeploymentAppliedPackageIds()) {
    const record = readDeploymentApplied(packageId);
    if (record) records.push(record);
  }
  return records;
}

export function readPlatformCapabilitiesApplied(
  packageId: string,
): ExtensionPlatformCapabilitiesApplied | null {
  const p = platformCapabilitiesAppliedPath(packageId);
  if (!fs.existsSync(p)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8')) as unknown;
    return isExtensionPlatformCapabilitiesApplied(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writePlatformCapabilitiesApplied(
  applied: ExtensionPlatformCapabilitiesApplied,
): string {
  const p = platformCapabilitiesAppliedPath(applied.packageId);
  fs.mkdirSync(packageDirs.deployments, { recursive: true });
  atomicWriteText(p, `${JSON.stringify(applied, null, 2)}\n`);
  return p;
}

export function removePlatformCapabilitiesApplied(packageId: string): void {
  const p = platformCapabilitiesAppliedPath(packageId);
  if (fs.existsSync(p)) {
    fs.rmSync(p, { force: true });
  }
}

/** Maps portal segment → owning package id from extension platform-capabilities apply records. */
export function buildPackagePortalSegmentOwnerMap(): Map<string, string> {
  const map = new Map<string, string>();
  if (!fs.existsSync(packageDirs.deployments)) {
    return map;
  }

  for (const fileName of fs.readdirSync(packageDirs.deployments)) {
    if (!fileName.endsWith('.platform-capabilities-applied.json')) {
      continue;
    }

    const packageId = fileName.replace(/\.platform-capabilities-applied\.json$/, '');
    const applied = readPlatformCapabilitiesApplied(packageId);
    for (const segment of applied?.portals ?? []) {
      const trimmed = segment.trim();
      if (trimmed) {
        map.set(trimmed, packageId);
      }
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// Startup maintenance
// ---------------------------------------------------------------------------

/** Remove orphaned .tmp files older than 30 min from the tmp dir. */
export function cleanupPackageTmpFiles(): void {
  if (!fs.existsSync(packageDirs.tmp)) return;
  const staleMs = 30 * 60 * 1000;
  const now = Date.now();
  try {
    for (const f of fs.readdirSync(packageDirs.tmp)) {
      const p = path.join(packageDirs.tmp, f);
      try {
        const stat = fs.statSync(p);
        if (now - stat.mtimeMs > staleMs) fs.unlinkSync(p);
      } catch {
        // ignore per-file errors
      }
    }
  } catch {
    // ignore if dir not readable
  }
}
