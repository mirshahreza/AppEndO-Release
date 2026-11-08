/**
 * p-12 exit criteria — extension UI routes (VA-P6).
 * Consolidates the checklist from the historical p-12 extension UI routes plan.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  buildPackageZipBuffer,
  REFERENCE_UI_ROUTE_PACKAGE_SPEC,
} from '../testkit/packageZipBuilder';
import { validateManifest } from '../PackageManifestValidator';
import {
  buildPackagePageLoaderRef,
} from '../../../shared/api/contracts/package-manifest/verticalApp';
import { titleFromUiRoutePageKey } from '../../../shared/api/contracts/package-manifest/extensionUiRoutes';
import type { PlatformRuntimeConfig } from '../../../shared/api/contracts/platform/types';
import { resolveRouteBindingForRelativePath } from '../../../app/platform/platformConfigHelpers';
import {
  deploymentAppliedPath,
  readAppliedDeploymentRows,
} from '../testkit/deploymentAppliedAssertions';

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
  findPlatformMountById: async (mountId: string) => {
    if (mountId !== 'studio') return undefined;
    return { id: 'studio', pathPrefix: '/studio' };
  },
}));

vi.mock('../../../server/services/platform/platformRuntimeConfig.service', () => ({
  invalidatePlatformRuntimeConfig: vi.fn(),
}));

const FULL_UI_ROUTES_SPEC = {
  packageId: 'p12-exit-demo',
  name: 'p-12 Exit Demo',
  version: '1.0.0',
  uiRoutes: [
    {
      pageKey: 'hello-page',
      entry: 'ui/HelloPage.js',
      suggestedRoutePattern: 'packages/p12-exit-demo/hello-page',
    },
  ],
};

let tmpDir = '';
let origCwd = '';

function appliedRows(packageId: string) {
  const rows = readAppliedDeploymentRows(packageId);
  return {
    routeBindings: rows?.bindings ?? [],
    pageModules: rows?.pageModules ?? [],
  };
}

function buildRuntimeConfigFromApplied(packageId: string): PlatformRuntimeConfig {
  const rows = readAppliedDeploymentRows(packageId);
  return {
    mounts: [
      {
        id: 'studio',
        pathPrefix: '/studio',
        name: 'Studio',
        enabled: true,
        defaultRoute: '/studio',
        designerRoutePropagation: 'none',
        authProfile: { requireAuth: true },
      },
    ],
    shells: [],
    shellRules: [],
    pageModules: rows?.pageModules ?? [],
    bindings: rows?.bindings ?? [],
    navigations: [],
    version: 'v-test',
  };
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p12-exit-test-'));
  origCwd = process.cwd();
  process.chdir(tmpDir);
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

describe('p-12 extension UI routes exit criteria', () => {
  it('applies ui_routes during install without an admin Apply step', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const zip = buildPackageZipBuffer(FULL_UI_ROUTES_SPEC);

    const upload = await artifact.uploadPackageArtifact(zip, 'p12-exit-demo.zip', 'admin');
    expect(upload.success, (upload as { error?: string }).error).toBe(true);

    const install = await coordinator.install('p12-exit-demo', 'admin@example.com');
    expect(install.success, (install as { error?: string }).error).toBe(true);
    if (!install.success) return;

    expect(install.deploymentStatus).toBe('applied');
    expect(fs.existsSync(deploymentAppliedPath('p12-exit-demo'))).toBe(true);
    expect(appliedRows('p12-exit-demo').pageModules).toHaveLength(1);
    expect(appliedRows('p12-exit-demo').routeBindings).toHaveLength(1);
    expect(appliedRows('p12-exit-demo').routeBindings[0]).toMatchObject({
      mountId: 'studio',
      routePattern: 'packages/p12-exit-demo/hello-page',
      pageKey: 'hello-page',
    });
    expect(
      fs.existsSync(path.join('packages-storage', 'installed', 'p12-exit-demo.deployment-preview.json')),
    ).toBe(false);
  });

  it('keeps studio routes after an idempotent applyDeployment on an already-applied install', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    await artifact.uploadPackageArtifact(buildPackageZipBuffer(FULL_UI_ROUTES_SPEC), 'p12-exit-demo.zip', 'admin');
    expect((await coordinator.install('p12-exit-demo', 'admin@example.com')).success).toBe(true);

    const apply = await coordinator.applyDeployment('p12-exit-demo', 'admin@example.com', null);
    expect(apply.success, (apply as { error?: string }).error).toBe(true);
    if (!apply.success) return;

    expect(apply.deploymentStatus).toBe('applied');
    expect(fs.existsSync(deploymentAppliedPath('p12-exit-demo'))).toBe(true);
    expect(appliedRows('p12-exit-demo').pageModules).toHaveLength(1);
    expect(appliedRows('p12-exit-demo').pageModules[0]).toMatchObject({
      pageKey: 'hello-page',
      loaderKind: 'package',
      loaderRef: buildPackagePageLoaderRef('p12-exit-demo', 'hello-page'),
      title: titleFromUiRoutePageKey('hello-page'),
    });
    expect(appliedRows('p12-exit-demo').routeBindings).toHaveLength(1);
    expect(appliedRows('p12-exit-demo').routeBindings[0]).toMatchObject({
      mountId: 'studio',
      routePattern: 'packages/p12-exit-demo/hello-page',
      pageKey: 'hello-page',
    });

    const runtimeConfig = buildRuntimeConfigFromApplied('p12-exit-demo');
    const binding = resolveRouteBindingForRelativePath(
      runtimeConfig,
      'studio',
      'packages/p12-exit-demo/hello-page',
    );
    expect(binding?.pageKey).toBe('hello-page');

    const pageModule = runtimeConfig.pageModules.find((item) => item.pageKey === binding?.pageKey);
    expect(pageModule).toMatchObject({
      loaderKind: 'package',
      loaderRef: buildPackagePageLoaderRef('p12-exit-demo', 'hello-page'),
    });

    const { resolveUiComponentModule } = await import(
      '../../../server/services/package-runtime/packageUiRuntime.service'
    );
    const module = resolveUiComponentModule('p12-exit-demo', 'hello-page');
    expect(module.ok).toBe(true);
    if (module.ok) {
      expect(fs.existsSync(module.absPath)).toBe(true);
    }

    expect(
      fs.existsSync(
        path.join('packages-storage', 'installed', 'p12-exit-demo.deployment-preview.json'),
      ),
    ).toBe(false);
  });

  it('uninstalls applied extension without orphan registry bindings or runtime artifacts', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    await artifact.uploadPackageArtifact(buildPackageZipBuffer(FULL_UI_ROUTES_SPEC), 'p12-exit-demo.zip', 'admin');
    expect((await coordinator.install('p12-exit-demo', 'admin@example.com')).success).toBe(true);
    expect((await coordinator.applyDeployment('p12-exit-demo', 'admin@example.com', null)).success).toBe(true);
    expect(appliedRows('p12-exit-demo').routeBindings).toHaveLength(1);

    const uninstall = await coordinator.uninstall('p12-exit-demo', 'admin@example.com');
    expect(uninstall.success, (uninstall as { error?: string }).error).toBe(true);
    if (!uninstall.success) return;

    expect(uninstall.status).toBe('not_installed');
    expect(fs.existsSync(deploymentAppliedPath('p12-exit-demo'))).toBe(false);
    expect(appliedRows('p12-exit-demo').routeBindings).toHaveLength(0);
    expect(appliedRows('p12-exit-demo').pageModules).toHaveLength(0);
    expect(fs.existsSync(path.join('packages-storage', 'runtimes', 'p12-exit-demo', '1.0.0'))).toBe(false);
    expect(fs.existsSync(path.join('packages-storage', 'objects', 'p12-exit-demo.object-registry.json'))).toBe(
      false,
    );

    const state = JSON.parse(
      fs.readFileSync(path.join('packages-storage', 'installed', 'p12-exit-demo.install-state.json'), 'utf8'),
    );
    expect(state.status).toBe('not_installed');
    expect(state.activeVersion).toBeNull();
  });

  it('uninstalls an installed extension without leaving deployment preview or platform rows', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    await artifact.uploadPackageArtifact(buildPackageZipBuffer(FULL_UI_ROUTES_SPEC), 'p12-exit-demo.zip', 'admin');
    expect((await coordinator.install('p12-exit-demo', 'admin@example.com')).success).toBe(true);

    const uninstall = await coordinator.uninstall('p12-exit-demo', 'admin@example.com');
    expect(uninstall.success).toBe(true);
    expect(fs.existsSync(deploymentAppliedPath('p12-exit-demo'))).toBe(false);
    expect(appliedRows('p12-exit-demo').routeBindings).toHaveLength(0);
    expect(appliedRows('p12-exit-demo').pageModules).toHaveLength(0);
    expect(
      fs.existsSync(path.join('packages-storage', 'installed', 'p12-exit-demo.deployment-preview.json')),
    ).toBe(false);
    expect(fs.existsSync(path.join('packages-storage', 'runtimes', 'p12-exit-demo', '1.0.0'))).toBe(false);
  });

  it('rejects unknown ui_routes manifest fields at validation boundary', () => {
    const result = validateManifest({
      $schemaVersion: '1.0',
      id: 'invalid-ui-routes',
      name: 'Invalid UI Routes',
      version: '1.0.0',
      requiredAppVersion: '>=1.0.0',
      capabilities: {
        apis: [],
        ui_components: [],
        ui_routes: [{
          pageKey: 'hello-page',
          entry: 'ui/HelloPage.js',
          unknownField: true,
        }],
        db_objects: [],
        mcp_servers: [],
      },
      overridePolicy: {
        apis: 'deny',
        ui_components: 'deny',
        db_objects: 'deny',
        mcp_servers: 'deny',
      },
      integrity: {
        algorithm: 'sha256',
        artifactHash: 'a'.repeat(64),
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('unknown field'))).toBe(true);
  });

  it('installs official ref-hello-page reference package with ui_routes applied', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const spec = REFERENCE_UI_ROUTE_PACKAGE_SPEC;
    const zip = buildPackageZipBuffer(spec);

    const upload = await artifact.uploadPackageArtifact(zip, `${spec.packageId}.zip`, 'admin');
    expect(upload.success, (upload as { error?: string }).error).toBe(true);

    const install = await coordinator.install(spec.packageId, 'admin@example.com');
    expect(install.success, (install as { error?: string }).error).toBe(true);
    if (!install.success) return;

    expect(install.deploymentStatus).toBe('applied');

    const apply = await coordinator.applyDeployment(spec.packageId, 'admin@example.com', null);
    expect(apply.success).toBe(true);
    expect(appliedRows(spec.packageId).routeBindings[0]?.routePattern).toBe('packages/ref-hello-page/hello');

    const { resolveUiComponentModule } = await import(
      '../../../server/services/package-runtime/packageUiRuntime.service'
    );
    const module = resolveUiComponentModule(spec.packageId, 'hello-page');
    expect(module.ok).toBe(true);

    const uninstall = await coordinator.uninstall(spec.packageId, 'admin@example.com');
    expect(uninstall.success).toBe(true);
    expect(fs.existsSync(deploymentAppliedPath(spec.packageId))).toBe(false);
  });
});
