import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.resolve(process.cwd(), 'src');
// Excludes hyphen-adjacent matches (e.g. "vite-plugin-pwa") — real third-party tool names,
// not the deprecated internal "plugin" terminology this gate exists to catch.
const LEGACY_NAMING_RE = /(?<![\w-])plugin(?![\w-])/;

/** Paths (relative to repo root) allowed to contain the legacy standalone word. */
const ALLOWED_REL_PATHS = new Set([
  'src/vite-env.d.ts',
  'src/config/projectStandards.ts',
  'src/shared/lib/packageNamingGate.ts',
  'src/shared/lib/__tests__/packageNamingGate.test.ts',
]);

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry)) {
      files.push(fullPath);
    }
  }

  return files;
}

export type PackageNamingViolation = {
  file: string;
  line: number;
  text: string;
};

export function findPackageNamingViolations(rootDir = SRC_ROOT): PackageNamingViolation[] {
  const violations: PackageNamingViolation[] = [];

  for (const filePath of collectSourceFiles(rootDir)) {
    const relPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    if (ALLOWED_REL_PATHS.has(relPath)) {
      continue;
    }

    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? '';
      if (!LEGACY_NAMING_RE.test(line)) {
        continue;
      }
      violations.push({
        file: relPath,
        line: index + 1,
        text: line.trim(),
      });
    }
  }

  return violations;
}
