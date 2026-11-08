/**
 * p-14 exit criteria — reference inventory vertical-app.
 * Consolidates 10 acceptance scenarios from the historical reference-vertical-app package plan.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  REFERENCE_INVENTORY_VERTICAL_APP_SPEC,
  buildVerticalAppManifest,
  buildVerticalAppZipBuffer,
} from '../testkit/verticalAppPackageBuilder';
import {
  buildPackagePageLoaderRef,
  buildPackageShellLoaderRef,
} from '../../../shared/api/contracts/package-manifest/verticalApp';
import type { PlatformRuntimeConfig } from '../../../shared/api/contracts/platform/types';
import {
  resolveMountCalendar,
  resolveRouteBindingForRelativePath,
  resolveShellRuleForPath,
} from '../../../app/platform/platformConfigHelpers';
import { formatGridDateForCalendar } from '../../../shared/lib/gridDateFormat';
import {
  deploymentAppliedPath,
  readAppliedDeploymentRows,
} from '../testkit/deploymentAppliedAssertions';

const PLUGIN_ID = REFERENCE_INVENTORY_VERTICAL_APP_SPEC.packageId;
const PATH_PREFIX = REFERENCE_INVENTORY_VERTICAL_APP_SPEC.pathPrefix;
const SAMPLE_UTC = '2026-06-15T14:30:00.000Z';

const dbScriptCalls = vi.hoisted(() => ({
  install: [] as string[],
  uninstall: [] as string[],
}));

vi.mock('../../../server/services/package-runtime/deploymentConflictScan', () => ({
  findEffectiveShellOwner: async () => null,
  findEffectivePageModuleOwner: async () => null,
  findEffectiveMountIdByPathPrefix: async () => null,
  findEffectiveMountOwnerById: async () => null,
  findEffectiveRouteBindingOwner: async () => null,
  listEffectiveMountPathPrefixes: async () => [],
  mountExistsInCoreOrDeployments: async () => false,
  CORE_PLATFORM_OWNER: '__core__',
}));

vi.mock('../../../server/domain/platform/mountRepository', () => ({
  findPlatformMountById: async () => undefined,
}));

vi.mock('../../../server/services/platform/platformRuntimeConfig.service', () => ({
  invalidatePlatformRuntimeConfig: vi.fn(),
}));

vi.mock('../../../server/services/package-runtime/packageDbScripts.service', () => ({
  runPackageInstallDbScripts: vi.fn(
    async (_packageId: string, _version: string, manifest: { capabilities: { db_objects: Array<{ installScript: string }> } }) => {
      const executedScripts = manifest.capabilities.db_objects.map((item) => item.installScript);
      dbScriptCalls.install.push(...executedScripts);
      return { ok: true as const, executedScripts };
    },
  ),
  runPluginUninstallDbScripts: vi.fn(
    async (_packageId: string, _version: string, manifest: { capabilities: { db_objects: Array<{ uninstallScript?: string }> } }) => {
      const executedScripts = manifest.capabilities.db_objects
        .map((item) => item.uninstallScript)
        .filter((item): item is string => Boolean(item));
      dbScriptCalls.uninstall.push(...executedScripts);
      return { ok: true as const, executedScripts };
    },
  ),
}));

let tmpDir = '';
let origCwd = '';

function resetDbScriptCalls() {
  dbScriptCalls.install = [];
  dbScriptCalls.uninstall = [];
}

function appliedRows(packageId: string) {
  const rows = readAppliedDeploymentRows(packageId);
  return {
    mounts: rows?.mounts ?? [],
    shells: rows?.shells ?? [],
    shellRules: rows?.shellRules ?? [],
    routeBindings: rows?.bindings ?? [],
    pageModules: rows?.pageModules ?? [],
  };
}

function buildRuntimeConfigFromApplied(packageId: string): PlatformRuntimeConfig {
  const rows = readAppliedDeploymentRows(packageId);
  if (!rows) {
    return {
      mounts: [],
      shells: [],
      shellRules: [],
      pageModules: [],
      bindings: [],
      navigations: [],
      version: 'v-p14-test',
    };
  }

  return {
    mounts: rows.mounts,
    shells: rows.shells,
    shellRules: rows.shellRules,
    pageModules: rows.pageModules,
    bindings: rows.bindings,
    navigations: [],
    version: 'v-p14-test',
  };
}

function listSourceFiles(dir: string, hits: string[] = []): string[] {
  if (!fs.existsSync(dir)) return hits;
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (entry === '__tests__' || entry === 'testkit' || entry === 'node_modules') continue;
      listSourceFiles(fullPath, hits);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry)) {
      hits.push(fullPath);
    }
  }
  return hits;
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p14-exit-test-'));
  origCwd = process.cwd();
  process.chdir(tmpDir);
  resetDbScriptCalls();
  vi.resetModules();
});

afterEach(async () => {
  process.chdir(origCwd);
  try {
    const lifecycleModule = await import('../../../server/services/package-runtime/packageLifecycle.service');
    lifecycleModule.resetDefaultPackageLifecycleCoordinator();
  } catch {
    // module may not be loaded
  }
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {
    // Windows may briefly lock package-storage handles
  }
  vi.resetModules();
});

async function loadLifecycleModules() {
  const artifact = await import('../PackageArtifactService');
  const lifecycleModule = await import('../../../server/services/package-runtime/packageLifecycle.service');
  lifecycleModule.resetDefaultPackageLifecycleCoordinator();
  const coordinator = lifecycleModule.getDefaultPackageLifecycleCoordinator();
  return { artifact, coordinator };
}

async function readUploadedManifest(version = '1.0.0') {
  const { parseManifestFile, resolveVersionForInstall } = await import(
    '../../../server/domain/package-domain/manifestRepository'
  );
  const selection = resolveVersionForInstall(PLUGIN_ID, version);
  if (!selection) return null;
  return parseManifestFile(selection.manifestPath);
}

async function installReferenceInventoryZip() {
  const { artifact, coordinator } = await loadLifecycleModules();
  const zip = buildVerticalAppZipBuffer(REFERENCE_INVENTORY_VERTICAL_APP_SPEC);
  const upload = await artifact.uploadPackageArtifact(zip, `${PLUGIN_ID}-1.0.0.zip`, 'admin');
  expect(upload.success, (upload as { error?: string }).error).toBe(true);
  const install = await coordinator.install(PLUGIN_ID, 'admin@example.com');
  expect(install.success, (install as { error?: string }).error).toBe(true);
  return { coordinator, install };
}

describe('p-14 reference inventory vertical-app exit criteria', () => {
  it('scenario 1 + 10: installs on empty node with propose pending until deployment apply', async () => {
    expect(fs.existsSync(deploymentAppliedPath(PLUGIN_ID))).toBe(false);

    const { coordinator, install } = await installReferenceInventoryZip();
    if (!install.success) return;

    expect(install.status).toBe('installed');
    expect(install.pluginKind).toBe('vertical-app');
    expect(install.deploymentStatus).toBe('pending');
    expect(fs.existsSync(deploymentAppliedPath(PLUGIN_ID))).toBe(false);
    expect(
      fs.existsSync(path.join('packages-storage', 'installed', `${PLUGIN_ID}.deployment-preview.json`)),
    ).toBe(true);

    const apply = await coordinator.applyDeployment(PLUGIN_ID, 'admin@example.com', null);
    expect(apply.success, (apply as { error?: string }).error).toBe(true);
    if (!apply.success) return;
    expect(apply.deploymentStatus).toBe('applied');
    expect(appliedRows(PLUGIN_ID).mounts).toHaveLength(1);
    expect(fs.existsSync(deploymentAppliedPath(PLUGIN_ID))).toBe(true);
    expect(
      fs.existsSync(path.join('packages-storage', 'installed', `${PLUGIN_ID}.deployment-preview.json`)),
    ).toBe(false);
  });

  it('scenarios 2–7: resolves shell, routes, APIs, DB, assets, and calendar after apply', async () => {
    const { coordinator } = await installReferenceInventoryZip();
    const apply = await coordinator.applyDeployment(PLUGIN_ID, 'admin@example.com', null);
    expect(apply.success, (apply as { error?: string }).error).toBe(true);
    if (!apply.success) return;

    const manifest = buildVerticalAppManifest(REFERENCE_INVENTORY_VERTICAL_APP_SPEC);
    const rows = appliedRows(PLUGIN_ID);
    const runtimeConfig = buildRuntimeConfigFromApplied(PLUGIN_ID);
    const mount = runtimeConfig.mounts.find((item) => item.id === PLUGIN_ID);
    expect(mount?.pathPrefix).toBe(PATH_PREFIX);

    const shellRule = resolveShellRuleForPath(runtimeConfig, PLUGIN_ID, PATH_PREFIX);
    expect(shellRule?.shellKey).toBe(manifest.capabilities.shell.key);
    const shell = runtimeConfig.shells.find((item) => item.shellKey === shellRule?.shellKey);
    expect(shell?.entry).toBe(buildPackageShellLoaderRef(PLUGIN_ID));

    const navBindings = runtimeConfig.bindings
      .filter((binding) => binding.mountId === PLUGIN_ID)
      .map((binding) => binding.nav?.label);
    expect(navBindings).toEqual(expect.arrayContaining(['Dashboard', 'Items']));

    for (const routePattern of ['dashboard', 'items']) {
      const binding = resolveRouteBindingForRelativePath(runtimeConfig, PLUGIN_ID, routePattern);
      expect(binding?.pageKey).toBe(routePattern);
      const pageModule = runtimeConfig.pageModules.find((item) => item.pageKey === binding?.pageKey);
      expect(pageModule).toMatchObject({
        loaderKind: 'package',
        loaderRef: buildPackagePageLoaderRef(PLUGIN_ID, routePattern),
      });
    }

    expect(rows.pageModules).toHaveLength(2);
    expect(
      fs.existsSync(path.join('packages-storage', 'runtimes', PLUGIN_ID, '1.0.0', 'ui/pages/Dashboard.js')),
    ).toBe(true);
    expect(
      fs.existsSync(path.join('packages-storage', 'runtimes', PLUGIN_ID, '1.0.0', 'ui/pages/Items.js')),
    ).toBe(true);
    expect(
      fs.existsSync(path.join('packages-storage', 'runtimes', PLUGIN_ID, '1.0.0', 'ui/shell/AppShell.js')),
    ).toBe(true);
    expect(fs.readFileSync(path.join('packages-storage', 'runtimes', PLUGIN_ID, '1.0.0', 'ui/pages/Dashboard.js'), 'utf8')).toContain(
      'data-page',
    );

    expect(dbScriptCalls.install).toContain('db/install/inventory_items.sql');

    const { resolvePackageStaticAsset } = await import(
      '../../../server/services/package-runtime/packageAssetsRuntime.service'
    );
    const asset = resolvePackageStaticAsset(PLUGIN_ID, 'logo');
    expect(asset.ok).toBe(true);
    if (asset.ok) {
      expect(fs.readFileSync(asset.absPath, 'utf8')).toContain('<svg');
    }

    const uploadedManifest = await readUploadedManifest();
    expect(uploadedManifest).toBeTruthy();
    if (!uploadedManifest) return;

    const {
      extractPackageApiRuntime,
      resolvePackageApiRoute,
      executePluginApiHandler,
    } = await import('../../../server/services/package-runtime/packageApiRuntime.service');
    extractPackageApiRuntime(PLUGIN_ID, '1.0.0', uploadedManifest);

    for (const apiPath of ['/api/packages/inventory/health', '/api/packages/inventory/items']) {
      const match = resolvePackageApiRoute('GET', apiPath);
      expect(match?.packageId).toBe(PLUGIN_ID);

      let body: unknown;
      const res = {
        headersSent: false,
        status: () => res,
        json: (payload: unknown) => {
          body = payload;
        },
        send: (payload: unknown) => {
          body = payload;
        },
      };
      if (!match) return;
      const executed = await executePluginApiHandler(match, { method: 'GET', query: {}, params: {} }, res);
      expect(executed.ok).toBe(true);
      expect(body).toMatchObject({ success: true });
    }

    expect(mount).toBeTruthy();
    if (!mount) return;
    expect(resolveMountCalendar(mount)).toBe('gregorian');
    expect(formatGridDateForCalendar(SAMPLE_UTC, resolveMountCalendar(mount))).toBe('2026-06-15');
  });

  it('scenario 8: uninstalls without orphan registry, deployment, or runtime artifacts', async () => {
    const { coordinator } = await installReferenceInventoryZip();
    expect((await coordinator.applyDeployment(PLUGIN_ID, 'admin@example.com', null)).success).toBe(true);
    expect(appliedRows(PLUGIN_ID).mounts).toHaveLength(1);

    const uninstall = await coordinator.uninstall(PLUGIN_ID, 'admin@example.com', {
      runDbUninstallScripts: true,
    });
    expect(uninstall.success, (uninstall as { error?: string }).error).toBe(true);
    if (!uninstall.success) return;

    expect(uninstall.status).toBe('not_installed');
    expect(fs.existsSync(deploymentAppliedPath(PLUGIN_ID))).toBe(false);
    expect(appliedRows(PLUGIN_ID).mounts).toHaveLength(0);
    expect(dbScriptCalls.uninstall).toContain('db/uninstall/inventory_items.sql');
    expect(fs.existsSync(path.join('packages-storage', 'runtimes', PLUGIN_ID, '1.0.0'))).toBe(false);
    expect(fs.existsSync(path.join('packages-storage', 'objects', `${PLUGIN_ID}.object-registry.json`))).toBe(
      false,
    );
  });

  it('scenario 9: installs on isolated empty node without studio registry coupling', async () => {
    expect(fs.existsSync(deploymentAppliedPath(PLUGIN_ID))).toBe(false);

    const { coordinator } = await installReferenceInventoryZip();
    const apply = await coordinator.applyDeployment(PLUGIN_ID, 'admin@example.com', null);
    expect(apply.success).toBe(true);
    if (!apply.success) return;

    expect(appliedRows(PLUGIN_ID).mounts.some((item) => item.id === 'studio')).toBe(false);
    expect(appliedRows(PLUGIN_ID).mounts[0]?.pathPrefix).toBe(PATH_PREFIX);
    expect(appliedRows(PLUGIN_ID).routeBindings).toHaveLength(2);
    expect(
      fs.existsSync(path.join('packages-storage', 'runtimes', PLUGIN_ID, '1.0.0', 'ui/shell/AppShell.js')),
    ).toBe(true);
  });

  it('quality gate: does not hardcode reference inventory packageId in production core', () => {
    const repoRoot = path.resolve(__dirname, '../../../..');
    const roots = ['src/server', 'src/app', 'src/features', 'src/pages', 'src/shared'];
    const offenders: string[] = [];

    for (const root of roots) {
      for (const filePath of listSourceFiles(path.join(repoRoot, root))) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (/\bpackageId:\s*['"]inventory['"]/.test(content) || /\bid:\s*['"]inventory['"]/.test(content)) {
          offenders.push(path.relative(repoRoot, filePath));
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
