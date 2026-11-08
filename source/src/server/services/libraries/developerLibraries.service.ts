import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  CORE_LIBRARY_PACKAGES,
  isCoreLibraryPackage,
  isNpmPackageName,
  libraryVersionSatisfies,
  normalizeLibraryName,
  readPackageLibraries,
  type PackageLibraryRequirement,
} from '../../../core/packages/developerLibraries';
import { parseManifestFile, resolveVersionForInstall } from '../../domain/package-domain/manifestRepository';
import { getInstalledVersionsMap } from '../../domain/package-domain/installStateRepository';
import type {
  DeveloperLibraryRecord,
  DeveloperLibrarySearchHit,
} from '../../../shared/api/contracts/libraries/types';
import {
  ensureDeveloperLibrariesStore,
  getDeveloperLibrariesRoot,
  readDeveloperLibrariesManifest,
  readHostPackageDependencies,
  readInstalledPackageVersion,
} from './developerLibrariesStore';
import { clearPackageUiCompileCache } from '../package-runtime/packageUiModuleCompile.service';
import { retireAllSandboxWorkers } from '../../../core/api/sandboxWorkerPool';

const execFileAsync = promisify(execFile);
const NPM_TIMEOUT_MS = 120_000;

export type NpmCommandResult = { ok: true; stdout: string } | { ok: false; error: string };

export type DeveloperLibrariesServiceDeps = {
  projectRoot?: string;
  runNpm?: (args: string[], libsRoot: string) => Promise<NpmCommandResult>;
  searchRegistry?: (query: string) => Promise<DeveloperLibrarySearchHit[]>;
};

export type SatisfyLibrariesResult =
  | { ok: true }
  | { ok: false; error: string; details?: string[] };

function resolveNpmCli(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

async function defaultRunNpm(args: string[], libsRoot: string): Promise<NpmCommandResult> {
  try {
    const { stdout, stderr } = await execFileAsync(resolveNpmCli(), args, {
      cwd: libsRoot,
      timeout: NPM_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
      // Node refuses to spawn .cmd/.bat without a shell (Windows EINVAL).
      shell: process.platform === 'win32',
      env: { ...process.env, npm_config_fund: 'false', npm_config_audit: 'false' },
    });
    return { ok: true, stdout: `${stdout}\n${stderr}` };
  } catch (error: unknown) {
    const err = error as { message?: string; stderr?: string; stdout?: string };
    const detail = [err.stderr, err.stdout, err.message].filter(Boolean).join('\n').trim();
    return { ok: false, error: detail || 'npm command failed.' };
  }
}

type NpmSearchObject = {
  package?: {
    name?: string;
    version?: string;
    description?: string;
  };
};

async function defaultSearchRegistry(query: string): Promise<DeveloperLibrarySearchHit[]> {
  const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=20`;
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`npm registry search failed (${response.status}).`);
  }
  const payload = await response.json() as { objects?: NpmSearchObject[] };
  const objects = Array.isArray(payload.objects) ? payload.objects : [];
  return objects.flatMap((item) => {
    const name = typeof item.package?.name === 'string' ? item.package.name : '';
    if (!name) return [];
    return [{
      name,
      version: typeof item.package?.version === 'string' ? item.package.version : '',
      description: typeof item.package?.description === 'string' ? item.package.description : '',
      core: isCoreLibraryPackage(name),
    }];
  });
}

function listRequestersByLoadingManifests(): Map<string, string[]> {
  const requesters = new Map<string, string[]>();
  for (const [packageId, version] of getInstalledVersionsMap()) {
    const selected = resolveVersionForInstall(packageId, version);
    if (!selected) continue;
    const manifest = parseManifestFile(selected.manifestPath);
    for (const library of readPackageLibraries(manifest ?? undefined)) {
      const current = requesters.get(library.name) ?? [];
      current.push(packageId);
      requesters.set(library.name, current);
    }
  }
  return requesters;
}

export class DeveloperLibrariesService {
  private readonly projectRoot: string;
  private readonly runNpm: NonNullable<DeveloperLibrariesServiceDeps['runNpm']>;
  private readonly searchRegistry: NonNullable<DeveloperLibrariesServiceDeps['searchRegistry']>;

  constructor(deps: DeveloperLibrariesServiceDeps = {}) {
    this.projectRoot = deps.projectRoot ?? process.cwd();
    this.runNpm = deps.runNpm ?? defaultRunNpm;
    this.searchRegistry = deps.searchRegistry ?? defaultSearchRegistry;
  }

  private libsRoot(): string {
    return ensureDeveloperLibrariesStore(this.projectRoot);
  }

  private bumpRuntimes(): void {
    retireAllSandboxWorkers();
    clearPackageUiCompileCache();
  }

  list(): DeveloperLibraryRecord[] {
    const requesters = listRequestersByLoadingManifests();
    const hostRoot = this.projectRoot;
    const libsRoot = this.libsRoot();
    const hostDeps = readHostPackageDependencies(this.projectRoot);
    const developerDeps = readDeveloperLibrariesManifest(this.projectRoot).dependencies;
    const rows = new Map<string, DeveloperLibraryRecord>();

    const hostNames = new Set<string>([...CORE_LIBRARY_PACKAGES, ...Object.keys(hostDeps)]);
    for (const name of hostNames) {
      const version = readInstalledPackageVersion(name, hostRoot)
        || hostDeps[name]
        || (isCoreLibraryPackage(name) ? 'bundled' : '');
      rows.set(name, {
        name,
        version,
        core: true,
        requestedBy: requesters.get(name) ?? [],
      });
    }

    for (const name of Object.keys(developerDeps)) {
      if (rows.has(name)) continue;
      const version = readInstalledPackageVersion(name, libsRoot) || developerDeps[name] || '';
      rows.set(name, {
        name,
        version,
        core: false,
        requestedBy: requesters.get(name) ?? [],
      });
    }

    return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async search(query: string): Promise<DeveloperLibrarySearchHit[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];
    const hits = await this.searchRegistry(trimmed);
    const hostDeps = readHostPackageDependencies(this.projectRoot);
    return hits.map((hit) => {
      const name = normalizeLibraryName(hit.name);
      return {
        ...hit,
        name,
        core: isCoreLibraryPackage(name) || Object.prototype.hasOwnProperty.call(hostDeps, name),
      };
    });
  }

  async install(name: string, versionRange?: string): Promise<{ ok: true; library: DeveloperLibraryRecord } | { ok: false; error: string; statusCode: number }> {
    const packageName = normalizeLibraryName(name);
    if (!isNpmPackageName(packageName)) {
      return { ok: false, error: 'Library name must be a valid npm package name.', statusCode: 400 };
    }
    if (isCoreLibraryPackage(packageName)) {
      return { ok: false, error: `"${packageName}" is provided by the platform and cannot be installed.`, statusCode: 409 };
    }
    const spec = versionRange?.trim() ? `${packageName}@${versionRange.trim()}` : packageName;
    const result = await this.runNpm(
      ['install', spec, '--prefix', this.libsRoot(), '--omit=dev', '--no-fund', '--no-audit'],
      this.libsRoot(),
    );
    if (!result.ok) {
      return { ok: false, error: result.error, statusCode: 502 };
    }
    this.bumpRuntimes();
    const library = this.list().find((row) => row.name === packageName);
    return {
      ok: true,
      library: library ?? { name: packageName, version: versionRange?.trim() || '', core: false, requestedBy: [] },
    };
  }

  async upgrade(name: string): Promise<{ ok: true; library: DeveloperLibraryRecord } | { ok: false; error: string; statusCode: number }> {
    const packageName = normalizeLibraryName(name);
    if (isCoreLibraryPackage(packageName)) {
      return { ok: false, error: `"${packageName}" is provided by the platform and cannot be upgraded.`, statusCode: 409 };
    }
    const listed = this.list().find((row) => row.name === packageName);
    if (listed?.core) {
      return { ok: false, error: `"${packageName}" is provided by the platform and cannot be upgraded.`, statusCode: 409 };
    }
    if (!listed) {
      return { ok: false, error: `Library "${packageName}" is not installed.`, statusCode: 404 };
    }
    return this.install(packageName, 'latest');
  }

  async uninstall(name: string): Promise<{ ok: true } | { ok: false; error: string; statusCode: number }> {
    const packageName = normalizeLibraryName(name);
    if (isCoreLibraryPackage(packageName)) {
      return { ok: false, error: `"${packageName}" is provided by the platform and cannot be uninstalled.`, statusCode: 409 };
    }
    const installed = this.list().find((row) => row.name === packageName);
    if (installed?.core) {
      return { ok: false, error: `"${packageName}" is provided by the platform and cannot be uninstalled.`, statusCode: 409 };
    }
    if (!installed) {
      return { ok: false, error: `Library "${packageName}" is not installed.`, statusCode: 404 };
    }
    if (installed.requestedBy.length > 0) {
      return {
        ok: false,
        error: `Library "${packageName}" is required by: ${installed.requestedBy.join(', ')}.`,
        statusCode: 409,
      };
    }
    const result = await this.runNpm(
      ['uninstall', packageName, '--prefix', this.libsRoot(), '--no-fund', '--no-audit'],
      this.libsRoot(),
    );
    if (!result.ok) {
      return { ok: false, error: result.error, statusCode: 502 };
    }
    this.bumpRuntimes();
    return { ok: true };
  }

  /**
   * npm-uninstalls developer libraries that no remaining installed package declares.
   * Host `package.json` / CORE libraries are never touched.
   */
  async pruneUnreferencedLibraries(names: string[]): Promise<void> {
    const unique = [...new Set(names.map(normalizeLibraryName).filter(Boolean))];
    if (unique.length === 0) {
      return;
    }
    const requesters = listRequestersByLoadingManifests();
    for (const name of unique) {
      if (isCoreLibraryPackage(name)) {
        continue;
      }
      if ((requesters.get(name) ?? []).length > 0) {
        continue;
      }
      const listed = this.list().find((row) => row.name === name);
      if (!listed || listed.core) {
        continue;
      }
      const result = await this.uninstall(name);
      if (!result.ok && result.statusCode !== 404) {
        throw new Error(`Failed to prune library "${name}": ${result.error}`);
      }
    }
  }

  async satisfy(requirements: PackageLibraryRequirement[]): Promise<SatisfyLibrariesResult> {
    const details: string[] = [];
    for (const requirement of requirements) {
      const name = normalizeLibraryName(requirement.name);
      if (isCoreLibraryPackage(name)) {
        continue;
      }
      const developerVersion = readInstalledPackageVersion(name, this.libsRoot())
        || readDeveloperLibrariesManifest(this.projectRoot).dependencies[name]
        || '';
      if (developerVersion && libraryVersionSatisfies(developerVersion, requirement.versionRange)) {
        continue;
      }
      const result = await this.install(name, requirement.versionRange);
      if (!result.ok) {
        details.push(`"${name}": ${result.error}`);
      }
    }
    if (details.length > 0) {
      return {
        ok: false,
        error: 'Failed to deploy required libraries before package install.',
        details,
      };
    }
    return { ok: true };
  }
}

let defaultService: DeveloperLibrariesService | null = null;

export function getDeveloperLibrariesService(): DeveloperLibrariesService {
  if (!defaultService) {
    defaultService = new DeveloperLibrariesService();
  }
  return defaultService;
}

export function createDeveloperLibrariesService(deps?: DeveloperLibrariesServiceDeps): DeveloperLibrariesService {
  return new DeveloperLibrariesService(deps);
}
