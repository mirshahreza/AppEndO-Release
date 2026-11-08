import fs from 'node:fs';
import path from 'node:path';

function parseNpmSpecifier(specifier: string): { name: string; subpath: string } {
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    return {
      name: parts.slice(0, 2).join('/'),
      subpath: parts.slice(2).join('/'),
    };
  }
  const slash = specifier.indexOf('/');
  if (slash === -1) {
    return { name: specifier, subpath: '' };
  }
  return { name: specifier.slice(0, slash), subpath: specifier.slice(slash + 1) };
}

function pickImportTarget(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const rec = value as Record<string, unknown>;
  return pickImportTarget(rec.import)
    ?? pickImportTarget(rec.module)
    ?? pickImportTarget(rec.default);
}

function pickEsmEntry(pkg: Record<string, unknown>): string | null {
  const exportsField = pkg.exports;
  if (exportsField && typeof exportsField === 'object' && !Array.isArray(exportsField)) {
    const root = (exportsField as Record<string, unknown>)['.'] ?? exportsField;
    const fromExport = pickImportTarget(root);
    if (fromExport) {
      return fromExport;
    }
  }
  if (typeof pkg.module === 'string' && pkg.module.trim()) {
    return pkg.module.trim();
  }
  if (typeof pkg.main === 'string' && pkg.main.trim()) {
    return pkg.main.trim();
  }
  return null;
}

/**
 * Browser/Vite entry for a Remote Hubs client library in packages-storage/libs.
 * Prefers package.json `exports.import` / `module` so CJS UMD bundles are not loaded as ESM.
 */
export function resolveRemoteHubClientLibFromLibs(
  specifier: string,
  projectRoot = process.cwd(),
): string | null {
  const { name, subpath } = parseNpmSpecifier(specifier);
  const packageDir = path.join(projectRoot, 'packages-storage', 'libs', 'node_modules', ...name.split('/'));
  if (subpath) {
    const nested = path.join(packageDir, ...subpath.split('/'));
    return fs.existsSync(nested) ? nested : null;
  }
  const manifestPath = path.join(packageDir, 'package.json');
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  try {
    const pkg = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
    const entry = pickEsmEntry(pkg);
    if (!entry) {
      return null;
    }
    const resolved = path.resolve(packageDir, entry);
    return fs.existsSync(resolved) ? resolved : null;
  } catch {
    return null;
  }
}
