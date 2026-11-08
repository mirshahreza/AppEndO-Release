/**
 * p-15 exit criteria — Hawiety vertical-app extraction (stub manifest lifecycle).
 * Lifecycle scenarios pass on the testkit zip; platform leak quality gates enforce package-gated boot.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  HAWIETY_VERTICAL_APP_SPEC,
  buildHawietyVerticalAppManifest,
  buildHawietyVerticalAppZipBuffer,
} from '../testkit/hawietyVerticalAppPackageBuilder';
import {
  buildPackagePageLoaderRef,
  buildPackageShellLoaderRef,
} from '../../../shared/api/contracts/package-manifest/verticalApp';
import type { PlatformRuntimeConfig } from '../../../shared/api/contracts/platform/types';
import {
  resolveRouteBindingForRelativePath,
  resolveShellRuleForPath,
} from '../../../app/platform/platformConfigHelpers';
import {
  deploymentAppliedPath,
  readAppliedDeploymentRows,
} from '../testkit/deploymentAppliedAssertions';
import platformLeakInventory from '../testkit/hwy-platform-leak-inventory.json';

const PLUGIN_ID = HAWIETY_VERTICAL_APP_SPEC.packageId;
const PATH_PREFIX = HAWIETY_VERTICAL_APP_SPEC.pathPrefix;

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
      version: 'v-p15-test',
    };
  }

  return {
    mounts: rows.mounts,
    shells: rows.shells,
    shellRules: rows.shellRules,
    pageModules: rows.pageModules,
    bindings: rows.bindings,
    navigations: [],
    version: 'v-p15-test',
  };
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p15-exit-test-'));
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

async function readUploadedManifest(version = '0.1.0') {
  const { parseManifestFile, resolveVersionForInstall } = await import(
    '../../../server/domain/package-domain/manifestRepository'
  );
  const selection = resolveVersionForInstall(PLUGIN_ID, version);
  if (!selection) return null;
  return parseManifestFile(selection.manifestPath);
}

async function installHawietyZip() {
  const { artifact, coordinator } = await loadLifecycleModules();
  const zip = buildHawietyVerticalAppZipBuffer();
  const upload = await artifact.uploadPackageArtifact(zip, `${PLUGIN_ID}-0.1.0.zip`, 'admin');
  expect(upload.success, (upload as { error?: string }).error).toBe(true);
  const install = await coordinator.install(PLUGIN_ID, 'admin@example.com');
  expect(install.success, (install as { error?: string }).error).toBe(true);
  return { coordinator, install };
}

describe('p-15 Hawiety vertical-app exit criteria (stub lifecycle)', () => {
  it('scenario 1: installs with propose pending until deployment apply', async () => {
    expect(fs.existsSync(deploymentAppliedPath(PLUGIN_ID))).toBe(false);

    const { coordinator, install } = await installHawietyZip();
    if (!install.success) return;

    expect(install.status).toBe('installed');
    expect(install.pluginKind).toBe('vertical-app');
    expect(install.deploymentStatus).toBe('pending');
    expect(fs.existsSync(deploymentAppliedPath(PLUGIN_ID))).toBe(false);

    const apply = await coordinator.applyDeployment(PLUGIN_ID, 'admin@example.com', null);
    expect(apply.success, (apply as { error?: string }).error).toBe(true);
    if (!apply.success) return;
    expect(apply.deploymentStatus).toBe('applied');
    expect(appliedRows(PLUGIN_ID).mounts).toHaveLength(1);
    expect(fs.existsSync(deploymentAppliedPath(PLUGIN_ID))).toBe(true);
  });

  it('scenarios 2–6: resolves shell, routes, ETL API, DB scripts, and assets after apply', async () => {
    const { coordinator } = await installHawietyZip();
    const apply = await coordinator.applyDeployment(PLUGIN_ID, 'admin@example.com', null);
    expect(apply.success, (apply as { error?: string }).error).toBe(true);
    if (!apply.success) return;

    const manifest = buildHawietyVerticalAppManifest();
    const runtimeConfig = buildRuntimeConfigFromApplied(PLUGIN_ID);
    const mount = runtimeConfig.mounts.find((item) => item.id === PLUGIN_ID);
    expect(mount?.pathPrefix).toBe(PATH_PREFIX);

    const shellRule = resolveShellRuleForPath(runtimeConfig, PLUGIN_ID, PATH_PREFIX);
    expect(shellRule?.shellKey).toBe(manifest.capabilities.shell.key);
    const shell = runtimeConfig.shells.find((item) => item.shellKey === shellRule?.shellKey);
    expect(shell?.entry).toBe(buildPackageShellLoaderRef(PLUGIN_ID));

    const membersBinding = resolveRouteBindingForRelativePath(runtimeConfig, PLUGIN_ID, 'members-all');
    expect(membersBinding?.pageKey).toBe('hwy-members-all');
    const etlBinding = resolveRouteBindingForRelativePath(runtimeConfig, PLUGIN_ID, 'etl-console');
    expect(etlBinding?.pageKey).toBe('hwy-etl-console');

    const etlPage = runtimeConfig.pageModules.find((item) => item.pageKey === 'hwy-etl-console');
    expect(etlPage).toMatchObject({
      loaderKind: 'package',
      loaderRef: buildPackagePageLoaderRef(PLUGIN_ID, 'hwy-etl-console'),
    });

    expect(
      fs.existsSync(path.join('packages-storage', 'runtimes', PLUGIN_ID, '0.1.0', 'ui/layouts/hwy_members_all.js')),
    ).toBe(true);
    expect(
      fs.existsSync(path.join('packages-storage', 'runtimes', PLUGIN_ID, '0.1.0', 'ui/pages/hwy_etl_console.js')),
    ).toBe(true);

    expect(dbScriptCalls.install).toContain('db/install/hwy_etl_geo_map.sql');
    expect(dbScriptCalls.install.some((script) => script.includes('member'))).toBe(false);

    const { resolvePackageStaticAsset } = await import(
      '../../../server/services/package-runtime/packageAssetsRuntime.service'
    );
    const asset = resolvePackageStaticAsset(PLUGIN_ID, 'logo');
    expect(asset.ok).toBe(true);

    const uploadedManifest = await readUploadedManifest();
    expect(uploadedManifest).toBeTruthy();
    if (!uploadedManifest) return;

    const {
      extractPackageApiRuntime,
      resolvePackageApiRoute,
      executePluginApiHandler,
    } = await import('../../../server/services/package-runtime/packageApiRuntime.service');
    extractPackageApiRuntime(PLUGIN_ID, '0.1.0', uploadedManifest);

    for (const apiPath of ['/api/packages/hawiety/health', '/api/packages/hawiety/etl/status']) {
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
      expect(body).toMatchObject({ success: true, packageId: 'hawiety' });
    }

    const healthMatch = resolvePackageApiRoute('GET', '/api/packages/hawiety/health');
    if (healthMatch) {
      let healthBody: unknown;
      const healthRes = {
        headersSent: false,
        status: () => healthRes,
        json: (payload: unknown) => {
          healthBody = payload;
        },
        send: (payload: unknown) => {
          healthBody = payload;
        },
      };
      await executePluginApiHandler(healthMatch, { method: 'GET', query: {}, params: {} }, healthRes);
      expect(healthBody).toMatchObject({ dataPolicy: 'etl-not-seed' });
    }
  });

  it('scenario 7: uninstalls without orphan deployment or runtime artifacts', async () => {
    const { coordinator } = await installHawietyZip();
    expect((await coordinator.applyDeployment(PLUGIN_ID, 'admin@example.com', null)).success).toBe(true);

    const uninstall = await coordinator.uninstall(PLUGIN_ID, 'admin@example.com', {
      runDbUninstallScripts: true,
    });
    expect(uninstall.success, (uninstall as { error?: string }).error).toBe(true);
    if (!uninstall.success) return;

    expect(uninstall.status).toBe('not_installed');
    expect(fs.existsSync(deploymentAppliedPath(PLUGIN_ID))).toBe(false);
    expect(appliedRows(PLUGIN_ID).mounts).toHaveLength(0);
    expect(dbScriptCalls.uninstall).toContain('db/uninstall/hwy_etl_geo_map.sql');
    expect(fs.existsSync(path.join('packages-storage', 'runtimes', PLUGIN_ID, '0.1.0'))).toBe(false);
  });

  it('manifest encodes designer list + ETL page without seed db_objects', () => {
    const manifest = buildHawietyVerticalAppManifest();
    expect(manifest.kind).toBe('vertical-app');
    expect(manifest.id).toBe('hawiety');
    expect(manifest.capabilities.designer_layouts?.some((l) => l.slug === 'hwy-members-all')).toBe(true);
    expect(manifest.capabilities.pages?.some((p) => p.pageKey === 'hwy-etl-console')).toBe(true);
    expect(manifest.capabilities.db_objects.every((db) => !/members|nakhebin/i.test(db.objectName))).toBe(true);
  });
});

describe('p-15 Hawiety platform leak quality gates', () => {
  it('tracks leak inventory categories for extraction waves', () => {
    expect(platformLeakInventory.categories.length).toBeGreaterThanOrEqual(8);
    expect(platformLeakInventory.qualityGate.id).toBe('p15-no-core-hawiety-boot');
  });

  it('quality gate: Hawiety routes mount only when package runtime is enabled', () => {
    const repoRoot = path.resolve(__dirname, '../../../..');
    const bootstrapPath = path.join(repoRoot, 'src/server/bootstrapFullRuntime.ts');
    const content = fs.readFileSync(bootstrapPath, 'utf8');

    expect(content).not.toMatch(/import\s+\{\s*mountHwyRoutes\s*\}/);
    expect(content).toMatch(/isHawietyRuntimeEnabled\(\)/);
    expect(content).toMatch(/mountHwyRoutes\(routeHost\)/);
  });

  it('quality gate: no core:Hwy page resolvers in platform resolvers', () => {
    const repoRoot = path.resolve(__dirname, '../../../..');
    const resolversPath = path.join(repoRoot, 'src/app/platform/resolvers.ts');
    const content = fs.readFileSync(resolversPath, 'utf8');
    expect(content).not.toMatch(/core:Hwy/);
  });
});
