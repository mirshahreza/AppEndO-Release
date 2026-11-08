/**
 * p-08 exit criteria — extension package runtime (MR post-CD).
 * Consolidates the checklist from the historical p-08 extension package runtime plan.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  buildPackageZipBuffer,
  buildScaffoldPackageZip,
  REFERENCE_PACKAGE_SPECS,
} from '../testkit/packageZipBuilder';

let tmpDir = '';
let origCwd = '';

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p08-exit-test-'));
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

async function readUploadedManifest(packageId: string, version = '1.0.0') {
  const { parseManifestFile, resolveVersionForInstall } = await import(
    '../../../server/domain/package-domain/manifestRepository'
  );
  const selection = resolveVersionForInstall(packageId, version);
  if (!selection) return null;
  return parseManifestFile(selection.manifestPath);
}

const FULL_EXTENSION_SPEC = {
  packageId: 'p08-exit-demo',
  name: 'p-08 Exit Demo',
  version: '1.0.0',
  apis: [
    {
      id: 'p08-exit-demo.health',
      method: 'GET' as const,
      path: '/packages/p08-exit-demo/health',
      entry: 'edge/health.js',
      auth: 'public' as const,
    },
  ],
  uiComponents: [
    {
      componentKey: 'exit-widget',
      slotId: 'core.dashboard.widgets',
      entry: 'ui/ExitWidget.js',
      order: 1,
    },
  ],
};

describe('p-08 extension package runtime exit criteria', () => {
  it('installs from ZIP with UI slot binding and callable API', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const zip = buildPackageZipBuffer(FULL_EXTENSION_SPEC);

    const upload = await artifact.uploadPackageArtifact(zip, 'p08-exit-demo.zip', 'admin');
    expect(upload.success, (upload as { error?: string }).error).toBe(true);

    const install = await coordinator.install('p08-exit-demo', 'admin@example.com');
    expect(install.success, (install as { error?: string }).error).toBe(true);
    if (!install.success) return;

    const { listActiveSlotComponents } = await import('../../../server/services/package-runtime/packageUiRuntime.service');
    const {
      extractPackageApiRuntime,
      resolvePackageApiRoute,
      executePluginApiHandler,
    } = await import('../../../server/services/package-runtime/packageApiRuntime.service');
    const manifest = await readUploadedManifest('p08-exit-demo', '1.0.0');
    expect(manifest).toBeTruthy();
    if (!manifest) return;

    extractPackageApiRuntime('p08-exit-demo', '1.0.0', manifest);

    const active = listActiveSlotComponents();
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({
      packageId: 'p08-exit-demo',
      componentKey: 'exit-widget',
      slotId: 'core.dashboard.widgets',
    });

    const match = resolvePackageApiRoute('GET', '/api/packages/p08-exit-demo/health');
    expect(match?.packageId).toBe('p08-exit-demo');

    let statusCode = 200;
    let body: unknown;
    const res = {
      headersSent: false,
      status: (code: number) => {
        statusCode = code;
        return res;
      },
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
    expect(statusCode).toBe(200);
    expect(body).toMatchObject({ success: true, packageId: 'p08-exit-demo' });
  });

  it('toggles enable/disable without uninstall or restart', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    await artifact.uploadPackageArtifact(buildPackageZipBuffer(FULL_EXTENSION_SPEC), 'p08-exit-demo.zip', 'admin');
    expect((await coordinator.install('p08-exit-demo', 'admin@example.com')).success).toBe(true);

    const { listActiveSlotComponents } = await import('../../../server/services/package-runtime/packageUiRuntime.service');
    const { extractPackageApiRuntime, resolvePackageApiRoute } = await import(
      '../../../server/services/package-runtime/packageApiRuntime.service'
    );
    const manifest = await readUploadedManifest('p08-exit-demo');
    if (!manifest) return;
    extractPackageApiRuntime('p08-exit-demo', '1.0.0', manifest);

    expect(listActiveSlotComponents()).toHaveLength(1);
    expect(resolvePackageApiRoute('GET', '/api/packages/p08-exit-demo/health')).toBeTruthy();

    const disable = coordinator.disable('p08-exit-demo', 'admin@example.com');
    expect(disable.success).toBe(true);
    expect(listActiveSlotComponents()).toHaveLength(0);
    expect(resolvePackageApiRoute('GET', '/api/packages/p08-exit-demo/health')).toBeNull();

    const stateAfterDisable = JSON.parse(
      fs.readFileSync(path.join('packages-storage', 'installed', 'p08-exit-demo.install-state.json'), 'utf8'),
    );
    expect(stateAfterDisable.status).toBe('installed');
    expect(stateAfterDisable.enabled).toBe(false);

    const enable = coordinator.enable('p08-exit-demo', 'admin@example.com');
    expect(enable.success).toBe(true);
    expect(listActiveSlotComponents()).toHaveLength(1);
    expect(resolvePackageApiRoute('GET', '/api/packages/p08-exit-demo/health')).toBeTruthy();
  });

  it('uninstalls without orphan registry, runtime, or slot bindings', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    await artifact.uploadPackageArtifact(buildPackageZipBuffer(FULL_EXTENSION_SPEC), 'p08-exit-demo.zip', 'admin');
    expect((await coordinator.install('p08-exit-demo', 'admin@example.com')).success).toBe(true);

    const { listActiveSlotComponents } = await import('../../../server/services/package-runtime/packageUiRuntime.service');
    const { resolvePackageApiRoute } = await import('../../../server/services/package-runtime/packageApiRuntime.service');

    const uninstall = await coordinator.uninstall('p08-exit-demo', 'admin@example.com');
    expect(uninstall.success, (uninstall as { error?: string }).error).toBe(true);
    if (!uninstall.success) return;

    expect(fs.existsSync(path.join('packages-storage', 'runtimes', 'p08-exit-demo', '1.0.0'))).toBe(false);
    expect(fs.existsSync(path.join('packages-storage', 'objects', 'p08-exit-demo.object-registry.json'))).toBe(false);
    expect(listActiveSlotComponents()).toHaveLength(0);
    expect(resolvePackageApiRoute('GET', '/api/packages/p08-exit-demo/health')).toBeNull();

    const state = JSON.parse(
      fs.readFileSync(path.join('packages-storage', 'installed', 'p08-exit-demo.install-state.json'), 'utf8'),
    );
    expect(state.status).toBe('not_installed');
    expect(state.activeVersion).toBeNull();
  });

  it('ships a scaffold ZIP through Developer Kit tooling without core changes', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const zip = buildScaffoldPackageZip('scaffold-ship-demo');

    const upload = await artifact.uploadPackageArtifact(zip, 'scaffold-ship-demo.zip', 'admin');
    expect(upload.success, (upload as { error?: string }).error).toBe(true);

    const install = await coordinator.install('scaffold-ship-demo', 'admin@example.com');
    expect(install.success, (install as { error?: string }).error).toBe(true);
    if (!install.success) return;

    const { listActiveSlotComponents } = await import('../../../server/services/package-runtime/packageUiRuntime.service');
    const active = listActiveSlotComponents();
    expect(active.some((item) => item.packageId === 'scaffold-ship-demo')).toBe(true);

    const uninstall = await coordinator.uninstall('scaffold-ship-demo', 'admin@example.com');
    expect(uninstall.success).toBe(true);
  });

  it('installs both official reference plugins built from shared package builder', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const { listActiveSlotComponents } = await import('../../../server/services/package-runtime/packageUiRuntime.service');
    const {
      extractPackageApiRuntime,
      resolvePackageApiRoute,
      executePluginApiHandler,
    } = await import('../../../server/services/package-runtime/packageApiRuntime.service');

    for (const spec of REFERENCE_PACKAGE_SPECS) {
      const zip = buildPackageZipBuffer(spec);
      const upload = await artifact.uploadPackageArtifact(zip, `${spec.packageId}.zip`, 'admin');
      expect(upload.success, (upload as { error?: string }).error).toBe(true);

      const install = await coordinator.install(spec.packageId, 'admin@example.com');
      expect(install.success, (install as { error?: string }).error).toBe(true);
    }

    const widgetActive = listActiveSlotComponents().find((item) => item.packageId === 'ref-hello-widget');
    expect(widgetActive?.componentKey).toBe('hello-widget');

    const apiManifest = await readUploadedManifest('ref-hello-api', '1.0.0');
    expect(apiManifest).toBeTruthy();
    if (!apiManifest) return;
    extractPackageApiRuntime('ref-hello-api', '1.0.0', apiManifest);

    const match = resolvePackageApiRoute('GET', '/api/packages/ref-hello-api/health');
    expect(match?.packageId).toBe('ref-hello-api');

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
    expect(body).toMatchObject({ success: true, packageId: 'ref-hello-api' });

    for (const spec of REFERENCE_PACKAGE_SPECS) {
      const uninstall = await coordinator.uninstall(spec.packageId, 'admin@example.com');
      expect(uninstall.success, (uninstall as { error?: string }).error).toBe(true);
    }
  });
});
