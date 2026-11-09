/**
 * Fail when production UI passes UiSelect preferNativeSelect (browser combo).
 *
 * Usage: npm run hygiene:prefer-native-select
 *
 * Policy: docs/standards/ui-core.md §Closed-set pickers · projectStandards id ui.form.select.heroui-menu
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCAN_ROOT = path.join(root, 'src');

const SKIP_DIR_NAMES = new Set(['node_modules', 'generated', '__tests__', 'test-support']);

/** Implementation + designer dialog native fallback only. */
const ALLOWLIST_RELATIVE = new Set([
  'src/shared/ui/HeroFieldControls.tsx',
  'src/domain/component-designer/DesignerRuntimeSelect.tsx',
]);

const PREFER_NATIVE_PROP = /\bpreferNativeSelect\b/;

const isAllowlisted = (relativePath: string): boolean =>
  ALLOWLIST_RELATIVE.has(relativePath.replace(/\\/g, '/'));

const isScannableFile = (fileName: string): boolean =>
  !/\.(test|spec)\.tsx$/.test(fileName) && /\.tsx$/.test(fileName);

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
    const absolute = path.join(dir, entry.name);
    const relative = path.relative(root, absolute);
    if (isAllowlisted(relative)) {
      continue;
    }
    const text = fs.readFileSync(absolute, 'utf8');
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!PREFER_NATIVE_PROP.test(line)) {
        continue;
      }
      const trimmed = line.trim();
      if (trimmed.startsWith('*') || trimmed.startsWith('//')) {
        continue;
      }
      violations.push({
        file: relative.replace(/\\/g, '/'),
        line: i + 1,
        preview: trimmed.slice(0, 120),
      });
    }
  }
}

const violations: Violation[] = [];
walk(SCAN_ROOT, violations);

if (violations.length > 0) {
  console.error('preferNativeSelect is forbidden on product UI — use HeroUI UiSelect menu (see ui-core §Closed-set pickers):\n');
  for (const item of violations) {
    console.error(`  ${item.file}:${item.line}  ${item.preview}`);
  }
  process.exit(1);
}

console.log('hygiene:prefer-native-select OK');
