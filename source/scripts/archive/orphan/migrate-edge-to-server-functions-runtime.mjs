#!/usr/bin/env node
/**
 * One-time out-of-band migration: runtime/edge-functions → workspace/server-functions
 * and on-disk metadata schema strings. Not wired into boot or setup.
 *
 * Usage: node scripts/migrate-edge-to-server-functions-runtime.mjs
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const LEGACY_ROOT = path.join(ROOT, 'runtime', 'edge-functions');
const TARGET_ROOT = path.join(ROOT, 'runtime', 'server-functions');

const SCHEMA_REPLACEMENTS = [
  ['append-edge-functions-index', 'append-server-functions-index'],
  ['append-edge-function-metadata', 'append-server-function-metadata'],
  ["schema\": \"append-edge-function\"", "schema\": \"append-server-function\""],
];

function rewriteJsonSchemas(filePath) {
  if (!filePath.endsWith('.json')) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let next = content;
  for (const [from, to] of SCHEMA_REPLACEMENTS) {
    next = next.split(from).join(to);
  }
  if (next !== content) {
    fs.writeFileSync(filePath, next, 'utf8');
    console.log(`updated schemas: ${path.relative(ROOT, filePath)}`);
  }
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

if (!fs.existsSync(LEGACY_ROOT)) {
  console.log('No legacy runtime/edge-functions directory — nothing to migrate.');
  if (fs.existsSync(TARGET_ROOT)) {
    walk(TARGET_ROOT).forEach(rewriteJsonSchemas);
  }
  process.exit(0);
}

if (fs.existsSync(TARGET_ROOT)) {
  console.error('Both runtime/edge-functions and workspace/server-functions exist. Merge manually, then re-run.');
  process.exit(1);
}

try {
  fs.renameSync(LEGACY_ROOT, TARGET_ROOT);
} catch {
  fs.cpSync(LEGACY_ROOT, TARGET_ROOT, { recursive: true });
  fs.rmSync(LEGACY_ROOT, { recursive: true, force: true });
}
console.log('Moved runtime/edge-functions → workspace/server-functions');

walk(TARGET_ROOT).forEach(rewriteJsonSchemas);
console.log('Runtime migration complete.');
