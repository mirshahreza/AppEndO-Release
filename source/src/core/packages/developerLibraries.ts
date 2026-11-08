import { compareSemver, parseSemver } from '../../shared/lib/semver';

/** npm packages the platform ships. Install / upgrade / reinstall is refused. */
export const CORE_LIBRARY_PACKAGES = [
  'react',
  'react-dom',
  'react-router-dom',
  '@heroui/react',
  '@heroui/styles',
] as const;

/** Resolve-time specifiers that must always map to the host copy (includes React JSX runtimes). */
export const CORE_LIBRARY_SPECIFIERS = [
  ...CORE_LIBRARY_PACKAGES,
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
] as const;

const CORE_PACKAGE_SET = new Set<string>(CORE_LIBRARY_PACKAGES);
const CORE_SPECIFIER_SET = new Set<string>(CORE_LIBRARY_SPECIFIERS);

/** npm package name, including scoped names such as `@heroui/react`. */
export const NPM_PACKAGE_NAME_RE = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

export type PackageLibraryRequirement = {
  name: string;
  versionRange?: string;
};

export function normalizeLibraryName(value: string): string {
  return value.trim();
}

export function isCoreLibraryPackage(name: string): boolean {
  return CORE_PACKAGE_SET.has(normalizeLibraryName(name));
}

export function isCoreLibrarySpecifier(specifier: string): boolean {
  return CORE_SPECIFIER_SET.has(normalizeLibraryName(specifier));
}

export function isNpmPackageName(value: string): boolean {
  const name = normalizeLibraryName(value);
  if (!name || name.length > 214) return false;
  return NPM_PACKAGE_NAME_RE.test(name);
}

export function readPackageLibraries(manifest: { libraries?: PackageLibraryRequirement[] } | null | undefined): PackageLibraryRequirement[] {
  if (!manifest || !Array.isArray(manifest.libraries)) return [];
  return manifest.libraries.map((item) => ({
    name: normalizeLibraryName(item.name),
    ...(item.versionRange?.trim() ? { versionRange: item.versionRange.trim() } : {}),
  }));
}

/**
 * True when `installed` already meets `range`.
 * Empty range = any installed version. Supports exact, ^, ~, >=, >, <=, <.
 */
export function libraryVersionSatisfies(installed: string, range?: string): boolean {
  const version = installed.trim();
  if (!parseSemver(version)) return false;
  const spec = range?.trim() ?? '';
  if (!spec) return true;

  const caret = spec.match(/^\^(\d+\.\d+\.\d+)$/);
  if (caret) {
    const base = caret[1];
    const parsedBase = parseSemver(base);
    const parsedInstalled = parseSemver(version);
    if (!parsedBase || !parsedInstalled) return false;
    return parsedInstalled[0] === parsedBase[0] && compareSemver(version, base) >= 0;
  }

  const tilde = spec.match(/^~(\d+\.\d+\.\d+)$/);
  if (tilde) {
    const base = tilde[1];
    const parsedBase = parseSemver(base);
    const parsedInstalled = parseSemver(version);
    if (!parsedBase || !parsedInstalled) return false;
    return parsedInstalled[0] === parsedBase[0]
      && parsedInstalled[1] === parsedBase[1]
      && compareSemver(version, base) >= 0;
  }

  const comparison = spec.match(/^(>=|>|<=|<)\s*(\d+\.\d+\.\d+)$/);
  if (comparison) {
    const [, op, target] = comparison;
    const delta = compareSemver(version, target);
    if (op === '>=') return delta >= 0;
    if (op === '>') return delta > 0;
    if (op === '<=') return delta <= 0;
    return delta < 0;
  }

  if (parseSemver(spec)) {
    return compareSemver(version, spec) === 0;
  }

  return true;
}

export function appendPackageLibrariesFieldErrors(raw: unknown, errors: string[]): void {
  if (raw === undefined) return;
  if (!Array.isArray(raw)) {
    errors.push('libraries must be an array.');
    return;
  }

  const seen = new Set<string>();
  raw.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`libraries[${index}] must be an object.`);
      return;
    }
    const row = item as Record<string, unknown>;
    if (typeof row.name !== 'string' || !isNpmPackageName(row.name)) {
      errors.push(`libraries[${index}].name must be a valid npm package name.`);
    } else {
      const name = normalizeLibraryName(row.name);
      if (seen.has(name)) {
        errors.push(`libraries[${index}].name "${name}" is duplicated.`);
      }
      seen.add(name);
    }
    if (row.versionRange !== undefined) {
      if (typeof row.versionRange !== 'string') {
        errors.push(`libraries[${index}].versionRange must be a string when provided.`);
      } else if (!row.versionRange.trim()) {
        errors.push(`libraries[${index}].versionRange must be a non-empty string when provided.`);
      }
    }
  });
}
