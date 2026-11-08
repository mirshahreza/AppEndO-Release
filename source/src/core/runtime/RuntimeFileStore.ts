/**
 * RuntimeFileStore — shared atomic write, file locking, and tmp cleanup
 * for workspace artifact directories under project-root `workspace/` (use `runtimeDirs.workspaceTemp`).
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface LockFileData {
  ownerPid: number;
  startedAt: string;
  ttlMs: number;
}

const LOCK_TTL_MS = 60_000;

export function ensureRuntimeDirs(dirs: readonly string[]): void {
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/** Compare JSON files by parsed value (ignores formatting / key order). */
export function jsonPayloadSemanticallyEqual(existingContent: string, nextContent: string): boolean {
  try {
    return JSON.stringify(JSON.parse(existingContent)) === JSON.stringify(JSON.parse(nextContent));
  } catch {
    return existingContent.trim() === nextContent.trim();
  }
}

/** Write only when parsed JSON differs from the file on disk (or file is missing). */
export function atomicWriteTextIfChanged(targetPath: string, content: string, tmpDir: string): boolean {
  if (fs.existsSync(targetPath)) {
    try {
      const existing = fs.readFileSync(targetPath, 'utf8');
      if (jsonPayloadSemanticallyEqual(existing, content)) {
        return false;
      }
    } catch {
      // fall through to write
    }
  }
  atomicWriteText(targetPath, content, tmpDir);
  return true;
}

export function atomicWriteText(targetPath: string, content: string, tmpDir: string): void {
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const opId = crypto.randomBytes(8).toString('hex');
  const tmpPath = path.join(tmpDir, `${path.basename(targetPath)}.${opId}.tmp`);
  fs.writeFileSync(tmpPath, content, 'utf8');
  // Windows: rename fails with EPERM/EBUSY while another process/reader briefly holds the
  // target open. Retry a few times before giving up — the write itself is already durable
  // in the tmp file, so a short spin is safe.
  const maxAttempts = 12;
  for (let attempt = 1; ; attempt += 1) {
    try {
      fs.renameSync(tmpPath, targetPath);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (attempt >= maxAttempts || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) {
        throw error;
      }
      const waitUntil = Date.now() + 25 * attempt;
      while (Date.now() < waitUntil) {
        // busy-wait a few ms — callers are synchronous by contract
      }
    }
  }
}

function lockFilePath(locksDir: string, name: string): string {
  return path.join(locksDir, `${name}.lock`);
}

/** Returns true if lock was acquired, false if held by a live process. */
export function acquireRuntimeLock(locksDir: string, name: string): boolean {
  fs.mkdirSync(locksDir, { recursive: true });
  const p = lockFilePath(locksDir, name);

  if (fs.existsSync(p)) {
    try {
      const lock = JSON.parse(fs.readFileSync(p, 'utf8')) as LockFileData;
      const elapsed = Date.now() - new Date(lock.startedAt).getTime();
      if (elapsed < lock.ttlMs) {
        try {
          process.kill(lock.ownerPid, 0);
          return false;
        } catch {
          // owner process dead → steal
        }
      }
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

export function releaseRuntimeLock(locksDir: string, name: string): void {
  try {
    const p = lockFilePath(locksDir, name);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {
    // ignore
  }
}

/** Remove orphaned .tmp files older than 30 min from the tmp dir. */
export function cleanupRuntimeTmpFiles(tmpDir: string): void {
  if (!fs.existsSync(tmpDir)) return;
  const staleMs = 30 * 60 * 1000;
  const now = Date.now();
  try {
    for (const f of fs.readdirSync(tmpDir)) {
      const p = path.join(tmpDir, f);
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
