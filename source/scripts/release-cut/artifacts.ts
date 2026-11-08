import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function globToRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '<<STARSTAR>>')
    .replace(/\*/g, '[^/\\\\]*')
    .replace(/<<STARSTAR>>/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function scanDir(dir: string, files: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(full, files);
    } else {
      files.push(full);
    }
  }
}

function searchRootsForPattern(repoRoot: string, globPattern: string): string[] {
  const norm = globPattern.replace(/\\/g, '/');
  const firstStar = norm.indexOf('*');
  const prefix = firstStar === -1 ? norm : norm.slice(0, firstStar).replace(/\/$/, '');
  if (!prefix) return [repoRoot];
  const candidate = path.join(repoRoot, prefix);
  if (fs.existsSync(candidate)) {
    const stat = fs.statSync(candidate);
    if (stat.isDirectory()) return [candidate];
    return [path.dirname(candidate)];
  }
  return [path.join(repoRoot, prefix.split('/').slice(0, -1).join('/') || '.')];
}

export function resolveLatestArtifact(repoRoot: string, globPattern: string): string | undefined {
  const files: string[] = [];
  for (const root of searchRootsForPattern(repoRoot, globPattern)) {
    scanDir(root, files);
  }
  const re = globToRegex(globPattern.replace(/\\/g, '/'));
  const matches = files.filter((file) => re.test(path.relative(repoRoot, file).replace(/\\/g, '/')));
  if (matches.length === 0) return undefined;
  matches.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return matches[0];
}

export function sha256File(filePath: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

export function copyFileEnsured(src: string, dest: string): void {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}
