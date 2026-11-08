/**
 * Fail CI when Arabic-script characters appear in production source outside allowlisted paths.
 *
 * Usage: npm run hygiene:english-copy
 *
 * Policy: docs/standards/ui-core.md §English-only (production)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARABIC_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEEE]/;

const SCAN_ROOTS = [
  path.join(root, 'src'),
  path.join(root, 'public'),
];

const SKIP_DIR_NAMES = new Set(['node_modules', 'generated', '__tests__', 'test-support']);

const ALLOWLIST_RELATIVE = new Set([
  'src/shared/lib/rtlScriptPreviewSamples.ts',
  'src/core/db/database.ts',
]);

const isAllowlisted = (relativePath: string): boolean => {
  const normalized = relativePath.replace(/\\/g, '/');
  if (ALLOWLIST_RELATIVE.has(normalized)) {
    return true;
  }
  if (normalized.includes('src/core/culture/translations/')) {
    return true;
  }
  if (normalized.includes('src/core/system-extensions/culture-packs/')) {
    return true;
  }
  return false;
};

const isScannableFile = (fileName: string): boolean => {
  if (/\.(test|spec)\.(tsx?|jsx?)$/.test(fileName)) {
    return false;
  }
  return /\.(tsx?|jsx?|json)$/.test(fileName);
};

type Violation = { file: string; line: number; preview: string };

function walk(dir: string, violations: Violation[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) {
        continue;
      }
      walk(path.join(dir, entry.name), violations);
      continue;
    }
    if (!isScannableFile(entry.name)) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    const relative = path.relative(root, fullPath);
    if (isAllowlisted(relative)) {
      continue;
    }
    const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      if (ARABIC_SCRIPT.test(line)) {
        violations.push({
          file: relative.replace(/\\/g, '/'),
          line: index + 1,
          preview: line.trim().slice(0, 120),
        });
      }
    });
  }
}

const violations: Violation[] = [];
for (const scanRoot of SCAN_ROOTS) {
  if (fs.existsSync(scanRoot)) {
    walk(scanRoot, violations);
  }
}

if (violations.length === 0) {
  console.log('[hygiene:english-copy] OK — no Arabic-script characters outside allowlisted paths.');
  process.exit(0);
}

console.error(`[hygiene:english-copy] ${violations.length} violation(s):`);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  ${v.preview}`);
}
console.error('');
console.error('Policy: docs/standards/ui-core.md §English-only (production).');
console.error('Allowlisted: culture translations/packs, database multilingual seeds, rtlScriptPreviewSamples.ts');
process.exit(1);
