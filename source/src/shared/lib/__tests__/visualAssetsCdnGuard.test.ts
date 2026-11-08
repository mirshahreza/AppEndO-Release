import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = path.resolve(process.cwd(), 'src');
const INDEX_HTML = path.resolve(process.cwd(), 'index.html');

const FORBIDDEN_RUNTIME_PATTERNS = [
  /api\.iconify\.design/,
  /fonts\.googleapis\.com/,
  /fonts\.gstatic\.com/,
  /cdnjs\.cloudflare\.com/,
  /unpkg\.com/,
];

function collectSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') {
        continue;
      }
      collectSourceFiles(absPath, files);
      continue;
    }

    if (/\.(ts|tsx|js|jsx|html)$/.test(entry.name)) {
      files.push(absPath);
    }
  }
  return files;
}

describe('visual assets CDN guard (VIS-4)', () => {
  it('does not reference forbidden external icon/font CDNs in app source or index.html', () => {
    const files = [...collectSourceFiles(SOURCE_ROOT), INDEX_HTML];
    const violations: string[] = [];

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf8');
      for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
        if (pattern.test(content)) {
          violations.push(`${path.relative(process.cwd(), filePath)} → ${pattern}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
