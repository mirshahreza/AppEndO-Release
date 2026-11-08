#!/usr/bin/env tsx
/**
 * Removes deprecated releases/public/ from the private monorepo (best-effort, retries).
 */
import fs from 'node:fs';
import path from 'node:path';
import { releaseCutRepoRoot } from './versionManifest';

const target = path.join(releaseCutRepoRoot(), 'releases');

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function removeWithRetries(maxAttempts: number): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (!fs.existsSync(target)) return true;
    try {
      fs.rmSync(target, { recursive: true, force: true, maxRetries: 2, retryDelay: 200 });
      if (!fs.existsSync(target)) return true;
    } catch {
      // locked file — wait and retry
    }
    await sleep(400);
  }
  return !fs.existsSync(target);
}

async function main(): Promise<void> {
  if (!fs.existsSync(target)) {
    console.log('releases/: already gone');
    return;
  }
  const ok = await removeWithRetries(12);
  if (ok) {
    console.log('releases/: removed');
    process.exit(0);
  }
  console.error(
    `Could not remove ${target}. If handle64 shows Cursor.exe on default_app.asar: **Developer: Reload Window**, then re-run npm run release:cleanup-legacy`,
  );
  process.exit(1);
}

void main();
