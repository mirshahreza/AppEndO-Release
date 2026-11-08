#!/usr/bin/env tsx
/**
 * Deletes gitignored local artifacts (logs, QA runs, staging, tmp probes).
 * Safe to re-run; does not touch src/ or tracked files.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const REL_PATHS = [
  'build',
  'tmp-prof',
  'logs',
  'test-results',
  'dev-dist',
  'workspace/temp',
  'workspace/smoke-pass',
  'workspace/functional-pass',
  'workspace/optimization-pass/reports',
  '.appendo-release-staging',
  '.appendo-hawiety-staging',
];

function rmPath(abs: string): { ok: boolean; reason?: string } {
  if (!fs.existsSync(abs)) return { ok: true };
  try {
    fs.rmSync(abs, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    return { ok: !fs.existsSync(abs) };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

function main(): void {
  let removed = 0;
  let failed = 0;
  for (const rel of REL_PATHS) {
    const abs = path.join(REPO_ROOT, rel);
    const result = rmPath(abs);
    if (!fs.existsSync(abs)) {
      removed += 1;
      console.log(`removed ${rel}`);
    } else if (result.reason) {
      failed += 1;
      console.warn(`failed ${rel}: ${result.reason}`);
    } else {
      failed += 1;
      console.warn(`failed ${rel}`);
    }
  }
  fs.mkdirSync(path.join(REPO_ROOT, 'logs'), { recursive: true });
  console.log(`done: ${removed} trees cleared, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
