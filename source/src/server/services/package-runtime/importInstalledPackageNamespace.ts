import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Load a package from this install's node_modules by file URL.
 *
 * The production server bundle aliases browser packages such as `react-router-dom` to
 * empty CJS stubs so static imports do not execute in Node. A literal `import('react-router-dom')`
 * inside that bundle therefore sees no `Link` / `useSearchParams`, and package UI compile
 * fails with "No matching export". Resolving the real entry on disk avoids that alias.
 */
function entryFromExports(exportsField: unknown, depth = 0): string | null {
  if (depth > 8 || exportsField == null) return null;
  if (typeof exportsField === 'string') {
    return exportsField.endsWith('.d.ts') ? null : exportsField;
  }
  if (Array.isArray(exportsField)) {
    for (const item of exportsField) {
      const found = entryFromExports(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof exportsField !== 'object') return null;
  const record = exportsField as Record<string, unknown>;
  for (const key of ['import', 'node', 'default', 'module', 'browser', 'require', '.']) {
    if (!(key in record)) continue;
    const found = entryFromExports(record[key], depth + 1);
    if (found) return found;
  }
  return null;
}

export function resolveInstalledPackageEntry(specifier: string): string {
  const packageDir = path.join(process.cwd(), 'node_modules', specifier);
  const packageJsonPath = path.join(packageDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`Installed package "${specifier}" was not found at ${packageDir}.`);
  }

  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
    exports?: unknown;
    module?: unknown;
    main?: unknown;
  };
  const relativeEntry = entryFromExports(pkg.exports)
    ?? (typeof pkg.module === 'string' ? pkg.module : null)
    ?? (typeof pkg.main === 'string' ? pkg.main : null)
    ?? 'index.js';
  return path.resolve(packageDir, relativeEntry);
}

export async function importInstalledPackageNamespace(
  specifier: string,
): Promise<Record<string, unknown>> {
  const resolved = resolveInstalledPackageEntry(specifier);
  const href = pathToFileURL(resolved).href;
  return await import(href) as Record<string, unknown>;
}
