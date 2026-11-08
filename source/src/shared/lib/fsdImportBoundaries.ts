import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const FEATURES_ROOT = path.resolve(process.cwd(), 'src/features');
const FORBIDDEN_IMPORT_RE = /from\s+['"](?:\.\.\/)+pages(?:\/|['"])/;

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

export function findFsdBoundaryViolations(rootDir = FEATURES_ROOT): string[] {
  const violations: string[] = [];

  for (const filePath of collectSourceFiles(rootDir)) {
    const content = readFileSync(filePath, 'utf8');
    if (!FORBIDDEN_IMPORT_RE.test(content)) continue;
    violations.push(path.relative(process.cwd(), filePath));
  }

  return violations;
}
