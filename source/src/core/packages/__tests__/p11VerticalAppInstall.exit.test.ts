/**
 * p-11 exit criteria — vertical-app install (VA-1).
 * Consolidates scenarios 1–8 and uninstall reverse from the historical p-11 vertical-app install plan.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  buildVerticalAppZipBuffer,
  buildVerticalAppManifest,
} from '../testkit/verticalAppPackageBuilder';
import {
  buildPackagePageLoaderRef,
  buildPackageShellLoaderRef,
} from '../../../shared/api/contracts/package-manifest/verticalApp';
import {
  deploymentAppliedPath,
  readAppliedDeploymentRows,
} from '../testkit/deploymentAppliedAssertions';

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

const FULL_VA_SPEC = {
  packageId: 'p11-exit-demo',
  name: 'p-11 Exit Demo',
  version: '1.0.0',
  pathPrefix: '/p11-exit-demo',
  applyPolicy: 'auto' as const,
  apis: [
    {
      id: 'p11-exit-demo.health',
      method: 'GET' as const,
      path: '/packages/p11-exit-demo/health',
      entry: 'api/health.js',
      auth: 'public' as const,
    },
  ],
  staticAssets: [
    {
      assetKey: 'logo',
      path: 'assets/logo.svg',
      mime: 'image/svg+xml',
      public: true,
    },
  ],
  dbObjects: [
    {
      objectType: 'table' as const,
      objectName: 'p11_exit_items',
      installScript: 'db/install/p11_exit_items.sql',
      uninstallScript: 'db/uninstall/p11_exit_items.sql',
    },
  ],
};

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

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p11-exit-test-'));
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

async function readUploadedManifest(packageId: string, version = '1.0.0') {
  const { parseManifestFile, resolveVersionForInstall } = await import(
    '../../../server/domain/package-domain/manifestRepository'
  );
  const selection = resolveVersionForInstall(packageId, version);
  if (!selection) return null;
  return parseManifestFile(selection.manifestPath);
}

describe('p-11 vertical-app install exit criteria', () => {
  it('installs vertical-app ZIP with applied deployment, runtime, API, DB scripts, and static assets', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const zip = buildVerticalAppZipBuffer(FULL_VA_SPEC);

    const upload = await artifact.uploadPackageArtifact(zip, 'p11-exit-demo.zip', 'admin');
    expect(upload.success, (upload as { error?: string }).error).toBe(true);

    const install = await coordinator.install('p11-exit-demo', 'admin@example.com');
    expect(install.success, (install as { error?: string }).error).toBe(true);
    if (!install.success) return;

    expect(install.status).toBe('installed');
    expect(install.pluginKind).toBe('vertical-app');
    expect(install.deploymentStatus).toBe('applied');
    expect(fs.existsSync(deploymentAppliedPath('p11-exit-demo'))).toBe(true);

    const manifest = buildVerticalAppManifest(FULL_VA_SPEC);
    const rows = appliedRows('p11-exit-demo');

    expect(rows.mounts).toHaveLength(1);
    expect(rows.mounts[0]?.pathPrefix).toBe('/p11-exit-demo');
    expect(rows.shells).toHaveLength(1);
    expect(rows.shells[0]?.entry).toBe(buildPackageShellLoaderRef('p11-exit-demo'));
    expect(rows.shellRules).toHaveLength(1);
    expect(rows.shellRules[0]?.shellKey).toBe(manifest.capabilities.shell.key);
    expect(rows.pageModules).toHaveLength(1);
    expect(rows.pageModules[0]).toMatchObject({
      pageKey: 'home',
      loaderKind: 'package',
      loaderRef: buildPackagePageLoaderRef('p11-exit-demo', 'home'),
    });
    expect(rows.routeBindings).toHaveLength(1);
    expect(rows.routeBindings[0]).toMatchObject({
      routePattern: 'home',
      pageKey: 'home',
    });
    expect(rows.routeBindings[0]?.nav).toMatchObject({ label: 'Home' });

    expect(
      fs.existsSync(path.join('packages-storage', 'runtimes', 'p11-exit-demo', '1.0.0', 'ui/shell/AppShell.js')),
    ).toBe(true);
    expect(
      fs.existsSync(path.join('packages-storage', 'runtimes', 'p11-exit-demo', '1.0.0', 'ui/pages/Home.js')),
    ).toBe(true);

    expect(dbScriptCalls.install).toContain('db/install/p11_exit_items.sql');

    const { resolvePackageStaticAsset } = await import('../../../server/services/package-runtime/packageAssetsRuntime.service');
    const asset = resolvePackageStaticAsset('p11-exit-demo', 'logo');
    expect(asset.ok).toBe(true);
    if (asset.ok) {
      expect(fs.readFileSync(asset.absPath, 'utf8')).toBe('asset:logo');
    }

    const {
      extractPackageApiRuntime,
      resolvePackageApiRoute,
      executePluginApiHandler,
    } = await import('../../../server/services/package-runtime/packageApiRuntime.service');
    const uploadedManifest = await readUploadedManifest('p11-exit-demo');
    expect(uploadedManifest).toBeTruthy();
    if (!uploadedManifest) return;

    extractPackageApiRuntime('p11-exit-demo', '1.0.0', uploadedManifest);
    const match = resolvePackageApiRoute('GET', '/api/packages/p11-exit-demo/health');
    expect(match?.packageId).toBe('p11-exit-demo');

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
    expect(body).toMatchObject({ success: true, packageId: 'p11-exit-demo' });
  });

  it('keeps applyPolicy propose pending until deployment is explicitly applied', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const zip = buildVerticalAppZipBuffer({
      ...FULL_VA_SPEC,
      packageId: 'p11-exit-propose',
      pathPrefix: '/p11-exit-propose',
      applyPolicy: 'propose',
    });

    await artifact.uploadPackageArtifact(zip, 'p11-exit-propose.zip', 'admin');
    const install = await coordinator.install('p11-exit-propose', 'admin@example.com');
    expect(install.success, (install as { error?: string }).error).toBe(true);
    if (!install.success) return;

    expect(install.deploymentStatus).toBe('pending');
    expect(fs.existsSync(deploymentAppliedPath('p11-exit-propose'))).toBe(false);
    expect(
      fs.existsSync(
        path.join('packages-storage', 'installed', 'p11-exit-propose.deployment-preview.json'),
      ),
    ).toBe(true);

    const blockedApply = await coordinator.applyDeployment('p11-exit-propose', 'admin@example.com', null);
    expect(blockedApply.success, (blockedApply as { error?: string }).error).toBe(true);
    if (!blockedApply.success) return;

    expect(blockedApply.deploymentStatus).toBe('applied');
    expect(appliedRows('p11-exit-propose').mounts).toHaveLength(1);
    expect(fs.existsSync(deploymentAppliedPath('p11-exit-propose'))).toBe(true);
    expect(
      fs.existsSync(
        path.join('packages-storage', 'installed', 'p11-exit-propose.deployment-preview.json'),
      ),
    ).toBe(false);
  });

  it('uninstalls vertical-app in reverse order without orphan registry, deployment, or runtime artifacts', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    await artifact.uploadPackageArtifact(buildVerticalAppZipBuffer(FULL_VA_SPEC), 'p11-exit-demo.zip', 'admin');
    expect((await coordinator.install('p11-exit-demo', 'admin@example.com')).success).toBe(true);
    expect(appliedRows('p11-exit-demo').mounts).toHaveLength(1);

    const uninstall = await coordinator.uninstall('p11-exit-demo', 'admin@example.com', {
      runDbUninstallScripts: true,
    });
    expect(uninstall.success, (uninstall as { error?: string }).error).toBe(true);
    if (!uninstall.success) return;

    expect(uninstall.status).toBe('not_installed');
    expect(fs.existsSync(deploymentAppliedPath('p11-exit-demo'))).toBe(false);
    expect(appliedRows('p11-exit-demo').mounts).toHaveLength(0);
    expect(dbScriptCalls.uninstall).toContain('db/uninstall/p11_exit_items.sql');
    expect(fs.existsSync(path.join('packages-storage', 'runtimes', 'p11-exit-demo', '1.0.0'))).toBe(false);
    expect(fs.existsSync(path.join('packages-storage', 'objects', 'p11-exit-demo.object-registry.json'))).toBe(
      false,
    );

    const state = JSON.parse(
      fs.readFileSync(path.join('packages-storage', 'installed', 'p11-exit-demo.install-state.json'), 'utf8'),
    );
    expect(state.status).toBe('not_installed');
    expect(state.activeVersion).toBeNull();
  });

  it('uninstalls propose-pending vertical-app without leaving deployment preview or platform rows', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    await artifact.uploadPackageArtifact(
      buildVerticalAppZipBuffer({
        ...FULL_VA_SPEC,
        packageId: 'p11-exit-propose-uninstall',
        pathPrefix: '/p11-exit-propose-uninstall',
        applyPolicy: 'propose',
      }),
      'p11-exit-propose-uninstall.zip',
      'admin',
    );
    expect((await coordinator.install('p11-exit-propose-uninstall', 'admin@example.com')).success).toBe(true);

    const uninstall = await coordinator.uninstall('p11-exit-propose-uninstall', 'admin@example.com');
    expect(uninstall.success).toBe(true);
    expect(fs.existsSync(deploymentAppliedPath('p11-exit-propose-uninstall'))).toBe(false);
    expect(
      fs.existsSync(
        path.join('packages-storage', 'installed', 'p11-exit-propose-uninstall.deployment-preview.json'),
      ),
    ).toBe(false);
    expect(
      fs.existsSync(path.join('packages-storage', 'runtimes', 'p11-exit-propose-uninstall', '1.0.0')),
    ).toBe(false);
  });
});
