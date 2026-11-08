import fs from 'node:fs';
import path from 'node:path';
import { PACKAGE_STORAGE_ROOT } from '../../../core/packages/PackageFileStore';

export const DEVELOPER_LIBRARIES_DIRNAME = 'libs';
export const DEVELOPER_LIBRARIES_MANIFEST_NAME = 'package.json';

const EMPTY_LIBS_MANIFEST = {
  name: 'appendo-developer-libraries',
  private: true,
  description: 'Developer-installed npm libraries for this AppEndO node.',
  dependencies: {} as Record<string, string>,
};

export type DeveloperLibrariesManifest = {
  name: string;
  private: boolean;
  description?: string;
  dependencies: Record<string, string>;
};

export function getDeveloperLibrariesRoot(projectRoot = process.cwd()): string {
  return path.join(projectRoot, PACKAGE_STORAGE_ROOT, DEVELOPER_LIBRARIES_DIRNAME);
}

export function getDeveloperLibrariesManifestPath(projectRoot = process.cwd()): string {
  return path.join(getDeveloperLibrariesRoot(projectRoot), DEVELOPER_LIBRARIES_MANIFEST_NAME);
}

export function ensureDeveloperLibrariesStore(projectRoot = process.cwd()): string {
  const root = getDeveloperLibrariesRoot(projectRoot);
  fs.mkdirSync(root, { recursive: true });
  const manifestPath = getDeveloperLibrariesManifestPath(projectRoot);
  if (!fs.existsSync(manifestPath)) {
    fs.writeFileSync(manifestPath, `${JSON.stringify(EMPTY_LIBS_MANIFEST, null, 2)}\n`, 'utf8');
  }
  return root;
}

export function readDeveloperLibrariesManifest(projectRoot = process.cwd()): DeveloperLibrariesManifest {
  ensureDeveloperLibrariesStore(projectRoot);
  try {
    const parsed = JSON.parse(fs.readFileSync(getDeveloperLibrariesManifestPath(projectRoot), 'utf8')) as Partial<DeveloperLibrariesManifest>;
    return {
      name: typeof parsed.name === 'string' ? parsed.name : EMPTY_LIBS_MANIFEST.name,
      private: true,
      description: typeof parsed.description === 'string' ? parsed.description : EMPTY_LIBS_MANIFEST.description,
      dependencies: parsed.dependencies && typeof parsed.dependencies === 'object' && !Array.isArray(parsed.dependencies)
        ? { ...parsed.dependencies }
        : {},
    };
  } catch {
    return { ...EMPTY_LIBS_MANIFEST, dependencies: {} };
  }
}

export function readInstalledPackageVersion(packageName: string, fromRoot: string): string {
  const pkgPath = path.join(fromRoot, 'node_modules', ...packageName.split('/'), 'package.json');
  try {
    const parsed = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: unknown };
    return typeof parsed.version === 'string' ? parsed.version : '';
  } catch {
    return '';
  }
}

function readDependencyMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [name, range] of Object.entries(value as Record<string, unknown>)) {
    if (typeof range === 'string' && range.trim()) {
      out[name] = range.trim();
    }
  }
  return out;
}

/** Runtime packages declared on the host AppEndO `package.json` (dependencies + optionalDependencies). */
export function readHostPackageDependencies(projectRoot = process.cwd()): Record<string, string> {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')) as {
      dependencies?: unknown;
      optionalDependencies?: unknown;
    };
    return {
      ...readDependencyMap(parsed.dependencies),
      ...readDependencyMap(parsed.optionalDependencies),
    };
  } catch {
    return {};
  }
}
