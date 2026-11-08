import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import { computePackageArtifactHashFromZip } from '../packageArtifactHash';

interface ZipBuildOptions {
  dependencies?: Array<{ packageId: string; versionRange: string }>;
  libraries?: Array<{ name: string; versionRange?: string }>;
  apis?: Array<{
    id: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    entry: string;
  }>;
  uiComponents?: Array<{
    componentKey: string;
    slotId: string;
    entry: string;
    order?: number;
  }>;
  dbObjects?: Array<{
    objectType: 'table' | 'view' | 'index' | 'function' | 'trigger' | 'seed';
    objectName: string;
    installScript: string;
    uninstallScript?: string;
    seedScript?: string;
  }>;
}

function buildZip(packageId: string, version: string, options: ZipBuildOptions = {}): Buffer {
  const draftManifest = {
    $schemaVersion: '1.0',
    id: packageId,
    name: `Package ${packageId}`,
    version,
    requiredAppVersion: '>=1.0.0',
    dependencies: options.dependencies ?? [],
    ...(options.libraries?.length ? { libraries: options.libraries } : {}),
    capabilities: {
      apis: options.apis ?? [
        {
          id: `${packageId}.health`,
          method: 'GET',
          path: `/packages/${packageId}/health`,
          entry: 'edge/health.ts',
        },
      ],
      ui_components: options.uiComponents ?? [],
      db_objects: options.dbObjects ?? [],
      mcp_servers: [],
    },
    overridePolicy: { apis: 'deny', ui_components: 'deny', db_objects: 'deny' },
    integrity: {
      algorithm: 'sha256',
      artifactHash: '0'.repeat(64),
    },
  };

  const zip = new AdmZip();
  zip.addFile('package.json', Buffer.from(JSON.stringify(draftManifest)));
  for (const api of draftManifest.capabilities.apis) {
    zip.addFile(api.entry, Buffer.from('export default async function handler() { return { ok: true }; }'));
  }
  for (const ui of draftManifest.capabilities.ui_components) {
    zip.addFile(ui.entry, Buffer.from('export default function Component() { return null; }'));
  }
  const dbScriptPaths = new Set<string>();
  for (const dbObject of draftManifest.capabilities.db_objects) {
    for (const scriptPath of [dbObject.installScript, dbObject.uninstallScript, dbObject.seedScript]) {
      if (scriptPath) dbScriptPaths.add(scriptPath);
    }
  }
  for (const scriptPath of dbScriptPaths) {
    zip.addFile(scriptPath, Buffer.from(`-- ${scriptPath}\nSELECT 1;\n`));
  }

  const artifactHash = computePackageArtifactHashFromZip(zip);
  const manifest = {
    ...draftManifest,
    integrity: { algorithm: 'sha256', artifactHash },
  };
  zip.updateFile('package.json', Buffer.from(JSON.stringify(manifest)));
  return zip.toBuffer();
}

let tmpDir = '';
let origCwd = '';

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'package-lifecycle-test-'));
  origCwd = process.cwd();
  process.chdir(tmpDir);
  vi.resetModules();
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.resetModules();
});

const writeRuntimeSettings = (runtime: Record<string, unknown>) => {
  fs.writeFileSync(
    path.join(tmpDir, 'settings.json'),
    JSON.stringify({ runtime }, null, 2),
    'utf8',
  );
};

async function loadModules() {
  const artifact = await import('../PackageArtifactService');
  const lifecycleModule = await import('../../../server/services/package-runtime/packageLifecycle.service');
  lifecycleModule.resetDefaultPackageLifecycleCoordinator();
  const coordinator = lifecycleModule.getDefaultPackageLifecycleCoordinator();
  return { artifact, coordinator, lifecycleModule };
}

describe('PluginLifecycleService', () => {
  it('installs package and writes install-state/object-registry/dependency-graph', async () => {
    const { artifact, coordinator } = await loadModules();

    const up = await artifact.uploadPackageArtifact(buildZip('ecommerce-core', '1.0.0'), 'ec.zip', 'admin');
    expect(up.success, (up as any).error).toBe(true);

    const result = await coordinator.install('ecommerce-core', 'admin@example.com');
    expect(result.success, (result as any).error).toBe(true);
    if (!result.success) return;
    expect(result.status).toBe('installed');
    expect(result.version).toBe('1.0.0');
    expect(result.idempotent).toBe(false);

    const statePath = path.join(tmpDir, 'packages-storage', 'installed', 'ecommerce-core.install-state.json');
    const objectPath = path.join(tmpDir, 'packages-storage', 'objects', 'ecommerce-core.object-registry.json');
    const graphPath = path.join(tmpDir, 'packages-storage', 'dependencies', 'graph.json');

    expect(fs.existsSync(statePath)).toBe(true);
    expect(fs.existsSync(objectPath)).toBe(true);
    expect(fs.existsSync(graphPath)).toBe(true);

    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    expect(state.status).toBe('installed');
    expect(state.activeVersion).toBe('1.0.0');
    expect(state.enabled).toBe(true);

    const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
    expect(graph.nodes.some((n: any) => n.packageId === 'ecommerce-core')).toBe(true);
  });

  it('recovers missing manifest from zip artifact during install', async () => {
    const { artifact, coordinator } = await loadModules();

    const up = await artifact.uploadPackageArtifact(buildZip('ecommerce-core', '1.0.0'), 'ec.zip', 'admin');
    expect(up.success, (up as any).error).toBe(true);

    const manifestPath = path.join(tmpDir, 'packages-storage', 'manifests', 'ecommerce-core', '1.0.0.manifest.json');
    fs.rmSync(manifestPath, { force: true });
    expect(fs.existsSync(manifestPath)).toBe(false);

    const result = await coordinator.install('ecommerce-core', 'admin@example.com');
    expect(result.success, (result as any).error).toBe(true);
    expect(fs.existsSync(manifestPath)).toBe(true);
  });

  it('keeps install idempotent for same active version', async () => {
    const { artifact, coordinator } = await loadModules();

    await artifact.uploadPackageArtifact(buildZip('ecommerce-core', '1.0.0'), 'ec.zip', 'admin');

    const first = await coordinator.install('ecommerce-core', 'admin@example.com');
    expect(first.success).toBe(true);

    const second = await coordinator.install('ecommerce-core', 'admin@example.com');
    expect(second.success).toBe(true);
    if (!second.success) return;
    expect(second.idempotent).toBe(true);
    expect(second.status).toBe('installed');
  });

  it('enables and disables an installed package without uninstalling', async () => {
    const { artifact, coordinator } = await loadModules();

    await artifact.uploadPackageArtifact(buildZip('ecommerce-core', '1.0.0'), 'ec.zip', 'admin');
    const install = await coordinator.install('ecommerce-core', 'admin@example.com');
    expect(install.success).toBe(true);

    const disable = coordinator.disable('ecommerce-core', 'admin@example.com');
    expect(disable.success).toBe(true);
    if (disable.success) {
      expect(disable.enabled).toBe(false);
    }

    const statePath = path.join(tmpDir, 'packages-storage', 'installed', 'ecommerce-core.install-state.json');
    let state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    expect(state.status).toBe('installed');
    expect(state.enabled).toBe(false);

    const enable = coordinator.enable('ecommerce-core', 'admin@example.com');
    expect(enable.success).toBe(true);
    if (enable.success) {
      expect(enable.enabled).toBe(true);
    }

    state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    expect(state.enabled).toBe(true);
  });

  it('blocks install when dependency is missing', async () => {
    const { artifact, coordinator } = await loadModules();

    await artifact.uploadPackageArtifact(
      buildZip('ecommerce-addon', '1.0.0', {
        dependencies: [{ packageId: 'base-catalog', versionRange: '>=1.0.0' }],
      }),
      'addon.zip',
      'admin',
    );

    const result = await coordinator.install('ecommerce-addon', 'admin@example.com');
    expect(result.success).toBe(false);
    if (result.success) return;
    const failure = result as Extract<typeof result, { success: false }>;
    expect(failure.code).toBe('dependency_missing');
    expect((failure.details || []).some((x) => x.includes('base-catalog'))).toBe(true);
  });

  it('does not start package install when required libraries cannot be deployed', async () => {
    const { artifact, lifecycleModule } = await loadModules();
    const coordinator = lifecycleModule.createPackageLifecycleCoordinator({
      satisfyLibraries: async () => ({
        ok: false,
        error: 'Failed to deploy required libraries before package install.',
        details: ['"xlsx": network down'],
      }),
    });

    await artifact.uploadPackageArtifact(
      buildZip('sheet-kit', '1.0.0', {
        libraries: [{ name: 'xlsx', versionRange: '^0.18.5' }],
      }),
      'sheet.zip',
      'admin',
    );

    const result = await coordinator.install('sheet-kit', 'admin@example.com');
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('libraries_unsatisfied');
    expect((result.details || []).some((line) => line.includes('xlsx'))).toBe(true);

    const statePath = path.join(tmpDir, 'packages-storage', 'installed', 'sheet-kit.install-state.json');
    expect(fs.existsSync(statePath)).toBe(true);
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8')) as { status: string };
    expect(state.status).not.toBe('installed');
  });

  it('prunes declared libraries after uninstall', async () => {
    const { artifact, lifecycleModule } = await loadModules();
    const pruned: string[] = [];
    const coordinator = lifecycleModule.createPackageLifecycleCoordinator({
      satisfyLibraries: async () => ({ ok: true }),
      pruneLibraries: async (names) => {
        pruned.push(...names);
      },
    });

    await artifact.uploadPackageArtifact(
      buildZip('sheet-kit', '1.0.0', {
        libraries: [{ name: 'xlsx', versionRange: '^0.18.5' }],
      }),
      'sheet.zip',
      'admin',
    );

    const installed = await coordinator.install('sheet-kit', 'admin@example.com');
    expect(installed.success, (installed as { error?: string }).error).toBe(true);

    const uninstalled = await coordinator.uninstall('sheet-kit', 'admin@example.com');
    expect(uninstalled.success, (uninstalled as { error?: string }).error).toBe(true);
    expect(pruned).toEqual(['xlsx']);
  });

  it('installs a package that only declares a core library without npm', async () => {
    const { artifact, coordinator } = await loadModules();

    await artifact.uploadPackageArtifact(
      buildZip('react-kit', '1.0.0', {
        libraries: [{ name: 'react' }],
      }),
      'react-kit.zip',
      'admin',
    );

    const result = await coordinator.install('react-kit', 'admin@example.com');
    expect(result.success, (result as { error?: string }).error).toBe(true);
    if (!result.success) return;
    expect(result.status).toBe('installed');
  });

  it('blocks install when dependency version is incompatible', async () => {
    const { artifact, coordinator } = await loadModules();

    await artifact.uploadPackageArtifact(buildZip('base-catalog', '1.0.0'), 'base.zip', 'admin');
    await artifact.uploadPackageArtifact(
      buildZip('ecommerce-addon', '1.0.0', {
        dependencies: [{ packageId: 'base-catalog', versionRange: '>=2.0.0 <3.0.0' }],
      }),
      'addon.zip',
      'admin',
    );

    const baseInstall = await coordinator.install('base-catalog', 'admin@example.com');
    expect(baseInstall.success).toBe(true);

    const result = await coordinator.install('ecommerce-addon', 'admin@example.com');
    expect(result.success).toBe(false);
    if (result.success) return;
    const failure = result as Extract<typeof result, { success: false }>;
    expect(failure.code).toBe('dependency_conflict');
    expect((failure.details || []).some((x) => x.includes('base-catalog'))).toBe(true);
  });

  it('blocks install when dependency cycle is detected', async () => {
    const { artifact, coordinator } = await loadModules();

    await artifact.uploadPackageArtifact(
      buildZip('pack-a', '1.0.0', {
        dependencies: [{ packageId: 'pack-b', versionRange: '>=1.0.0 <2.0.0' }],
      }),
      'a.zip',
      'admin',
    );
    await artifact.uploadPackageArtifact(
      buildZip('pack-b', '1.0.0', {
        dependencies: [{ packageId: 'pack-a', versionRange: '>=1.0.0 <2.0.0' }],
      }),
      'b.zip',
      'admin',
    );

    // Simulate an existing installed package to validate cycle detection logic.
    const stateDir = path.join(tmpDir, 'packages-storage', 'installed');
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(
      path.join(stateDir, 'pack-a.install-state.json'),
      JSON.stringify({
        schema: 'package-install-state',
        schemaVersion: '1.0.0',
        packageId: 'pack-a',
        status: 'installed',
        activeVersion: '1.0.0',
        updatedAt: new Date().toISOString(),
      }),
    );

    const result = await coordinator.install('pack-b', 'admin@example.com');
    expect(result.success).toBe(false);
    if (result.success) return;
    const failure = result as Extract<typeof result, { success: false }>;
    expect(failure.code).toBe('dependency_cycle');
    expect((failure.details || []).some((x) => x.includes('pack-a') && x.includes('pack-b'))).toBe(true);
  });

  it('blocks install when object conflicts exist and override is denied', async () => {
    const { artifact, coordinator } = await loadModules();

    await artifact.uploadPackageArtifact(
      buildZip('base-catalog', '1.0.0', {
        apis: [
          {
            id: 'shared.orders',
            method: 'GET',
            path: '/packages/shared/orders',
            entry: 'edge/orders.ts',
          },
        ],
      }),
      'base.zip',
      'admin',
    );
    await artifact.uploadPackageArtifact(
      buildZip('ecommerce-addon', '1.0.0', {
        apis: [
          {
            id: 'shared.orders.override',
            method: 'GET',
            path: '/packages/shared/orders',
            entry: 'edge/orders.ts',
          },
        ],
      }),
      'addon.zip',
      'admin',
    );

    expect((await coordinator.install('base-catalog', 'admin@example.com')).success).toBe(true);

    const blocked = await coordinator.install('ecommerce-addon', 'admin@example.com');
    expect(blocked.success).toBe(false);
    if (blocked.success) return;

    const failure = blocked as Extract<typeof blocked, { success: false }>;
    expect(failure.code).toBe('conflict_denied');
    expect((failure.details || []).some((detail) => detail.includes('apis: GET /packages/shared/orders'))).toBe(true);
  });

  it('applies per-object override and preserves unrelated owner registrations', async () => {
    const { artifact, coordinator } = await loadModules();

    await artifact.uploadPackageArtifact(
      buildZip('base-catalog', '1.0.0', {
        apis: [
          {
            id: 'shared.orders',
            method: 'GET',
            path: '/packages/shared/orders',
            entry: 'edge/orders.ts',
          },
        ],
        uiComponents: [
          {
            componentKey: 'catalog.summary',
            slotId: 'core.dashboard.widgets',
            entry: 'ui/catalog-summary.tsx',
            order: 100,
          },
        ],
      }),
      'base.zip',
      'admin',
    );
    await artifact.uploadPackageArtifact(
      buildZip('ecommerce-addon', '1.0.0', {
        apis: [
          {
            id: 'shared.orders.override',
            method: 'GET',
            path: '/packages/shared/orders',
            entry: 'edge/orders.ts',
          },
        ],
      }),
      'addon.zip',
      'admin',
    );

    expect((await coordinator.install('base-catalog', 'admin@example.com')).success).toBe(true);

    const installed = await coordinator.install('ecommerce-addon', 'admin@example.com', {
      overridePolicy: {
        apis: 'allow',
      },
    });
    expect(installed.success, (installed as any).error).toBe(true);

    const baseRegistry = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'packages-storage', 'objects', 'base-catalog.object-registry.json'), 'utf8'),
    );
    expect(baseRegistry.records.apis).toHaveLength(0);
    expect(baseRegistry.records.uiComponents).toHaveLength(1);
    expect(baseRegistry.records.uiComponents[0].componentKey).toBe('catalog.summary');

    const addonRegistry = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'packages-storage', 'objects', 'ecommerce-addon.object-registry.json'), 'utf8'),
    );
    expect(addonRegistry.records.apis).toHaveLength(1);
    expect(addonRegistry.records.apis[0].conflictKey).toBe('GET /packages/shared/orders');
  });

  it('blocks uninstall when reverse dependency exists', async () => {
    const { artifact, coordinator } = await loadModules();

    await artifact.uploadPackageArtifact(buildZip('base-catalog', '1.0.0'), 'base.zip', 'admin');
    await artifact.uploadPackageArtifact(
      buildZip('ecommerce-addon', '1.0.0', {
        dependencies: [{ packageId: 'base-catalog', versionRange: '>=1.0.0 <2.0.0' }],
      }),
      'addon.zip',
      'admin',
    );

    const baseInstall = await coordinator.install('base-catalog', 'admin@example.com');
    expect(baseInstall.success).toBe(true);
    const addonInstall = await coordinator.install('ecommerce-addon', 'admin@example.com');
    expect(addonInstall.success).toBe(true);

    const blocked = await coordinator.uninstall('base-catalog', 'admin@example.com');
    expect(blocked.success).toBe(false);
    if (blocked.success) return;
    const blockedFailure = blocked as Extract<typeof blocked, { success: false }>;
    expect(blockedFailure.code).toBe('reverse_dependency_blocked');
    expect((blockedFailure.details || []).includes('ecommerce-addon')).toBe(true);

    const addonUninstall = await coordinator.uninstall('ecommerce-addon', 'admin@example.com');
    expect(addonUninstall.success).toBe(true);

    const baseUninstall = await coordinator.uninstall('base-catalog', 'admin@example.com');
    expect(baseUninstall.success).toBe(true);
    if (!baseUninstall.success) return;
    expect(baseUninstall.status).toBe('not_installed');
  });

  it('uninstalls package with full cleanup when no reverse dependency exists', async () => {
    const { artifact, coordinator } = await loadModules();

    await artifact.uploadPackageArtifact(buildZip('ecommerce-core', '1.0.0'), 'ec.zip', 'admin');

    const installResult = await coordinator.install('ecommerce-core', 'admin@example.com');
    expect(installResult.success).toBe(true);

    const objectRegistryPath = path.join(tmpDir, 'packages-storage', 'objects', 'ecommerce-core.object-registry.json');
    expect(fs.existsSync(objectRegistryPath)).toBe(true);

    const uninstallResult = await coordinator.uninstall('ecommerce-core', 'admin@example.com');
    expect(uninstallResult.success, (uninstallResult as any).error).toBe(true);
    if (!uninstallResult.success) return;
    expect(uninstallResult.status).toBe('not_installed');

    const state = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'packages-storage', 'installed', 'ecommerce-core.install-state.json'), 'utf8'),
    );
    expect(state.status).toBe('not_installed');
    expect(state.activeVersion).toBeNull();
    expect(fs.existsSync(objectRegistryPath)).toBe(false);

    const graph = coordinator.getDependencyGraph();
    expect(graph.nodes.some((node) => node.packageId === 'ecommerce-core')).toBe(false);
    expect(graph.edges.some((edge) => edge.fromPluginId === 'ecommerce-core' || edge.toPluginId === 'ecommerce-core')).toBe(false);
  });

  it('installs UI+API package E2E and uninstall leaves no runtime or slot orphans', async () => {
    const { artifact, coordinator } = await loadModules();

    await artifact.uploadPackageArtifact(
      buildZip('lifecycle-demo', '1.0.0', {
        apis: [
          {
            id: 'lifecycle-demo.health',
            method: 'GET',
            path: '/packages/lifecycle-demo/health',
            entry: 'edge/health.js',
          },
        ],
        uiComponents: [
          {
            componentKey: 'summary-widget',
            slotId: 'core.dashboard.widgets',
            entry: 'ui/SummaryWidget.js',
            order: 10,
          },
        ],
      }),
      'lifecycle-demo.zip',
      'admin',
    );

    const installResult = await coordinator.install('lifecycle-demo', 'admin@example.com');
    expect(installResult.success, (installResult as any).error).toBe(true);
    if (!installResult.success) return;

    const runtimeRoot = path.join(tmpDir, 'packages-storage', 'runtimes', 'lifecycle-demo', '1.0.0');
    expect(fs.existsSync(path.join(runtimeRoot, 'ui', 'SummaryWidget.js'))).toBe(true);
    expect(fs.existsSync(path.join(runtimeRoot, 'edge', 'health.js'))).toBe(true);

    const objectRegistryPath = path.join(tmpDir, 'packages-storage', 'objects', 'lifecycle-demo.object-registry.json');
    expect(fs.existsSync(objectRegistryPath)).toBe(true);

    const { listActiveSlotComponents } = await import('../../../server/services/package-runtime/packageUiRuntime.service');
    const { resolvePackageApiRoute } = await import('../../../server/services/package-runtime/packageApiRuntime.service');

    const active = listActiveSlotComponents();
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({
      packageId: 'lifecycle-demo',
      componentKey: 'summary-widget',
      slotId: 'core.dashboard.widgets',
    });

    expect(resolvePackageApiRoute('GET', '/api/packages/lifecycle-demo/health')).toMatchObject({
      packageId: 'lifecycle-demo',
    });

    const uninstallResult = await coordinator.uninstall('lifecycle-demo', 'admin@example.com');
    expect(uninstallResult.success, (uninstallResult as any).error).toBe(true);
    if (!uninstallResult.success) return;

    expect(fs.existsSync(runtimeRoot)).toBe(false);
    expect(fs.existsSync(objectRegistryPath)).toBe(false);
    expect(listActiveSlotComponents()).toHaveLength(0);
    expect(resolvePackageApiRoute('GET', '/api/packages/lifecycle-demo/health')).toBeNull();

    const state = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'packages-storage', 'installed', 'lifecycle-demo.install-state.json'), 'utf8'),
    );
    expect(state.status).toBe('not_installed');
    expect(state.activeVersion).toBeNull();
  });

  it('rolls back runtime artifacts when install fails after partial extraction', async () => {
    const { artifact, coordinator } = await loadModules();

    const manifest = {
      $schemaVersion: '1.0' as const,
      id: 'broken-runtime',
      name: 'Broken Runtime',
      version: '1.0.0',
      requiredAppVersion: '>=1.0.0',
      dependencies: [],
      capabilities: {
        apis: [
          {
            id: 'broken-runtime.health',
            method: 'GET' as const,
            path: '/packages/broken-runtime/health',
            entry: 'edge/missing-health.js',
          },
        ],
        ui_components: [
          {
            componentKey: 'summary-widget',
            slotId: 'core.dashboard.widgets',
            entry: 'ui/SummaryWidget.js',
            order: 10,
          },
        ],
        db_objects: [],
        mcp_servers: [],
      },
      overridePolicy: { apis: 'deny', ui_components: 'deny', db_objects: 'deny' },
      integrity: {
        algorithm: 'sha256' as const,
        artifactHash: '0'.repeat(64),
      },
    };

    const zip = new AdmZip();
    zip.addFile('package.json', Buffer.from(JSON.stringify(manifest)));
    zip.addFile(
      'ui/SummaryWidget.js',
      Buffer.from('export default function SummaryWidget() { return null; }'),
    );
    // A random placeholder hash (the previous version of this fixture) fails artifact
    // integrity validation before upload even completes — coordinator.install then reports
    // "not found" instead of exercising the partial-extraction rollback this test is for.
    // Compute the real hash the same way buildZip() does, after all files are added.
    const finalManifest = {
      ...manifest,
      integrity: { algorithm: 'sha256' as const, artifactHash: computePackageArtifactHashFromZip(zip) },
    };
    zip.updateFile('package.json', Buffer.from(JSON.stringify(finalManifest)));

    const upload = await artifact.uploadPackageArtifact(zip.toBuffer(), 'broken-runtime.zip', 'admin');
    expect(upload.success, (upload as { error?: string }).error).toBe(true);

    const installResult = await coordinator.install('broken-runtime', 'admin@example.com');
    expect(installResult.success).toBe(false);

    const runtimeRoot = path.join(tmpDir, 'packages-storage', 'runtimes', 'broken-runtime', '1.0.0');
    expect(fs.existsSync(runtimeRoot)).toBe(false);

    const objectRegistryPath = path.join(tmpDir, 'packages-storage', 'objects', 'broken-runtime.object-registry.json');
    expect(fs.existsSync(objectRegistryPath)).toBe(false);

    const state = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'packages-storage', 'installed', 'broken-runtime.install-state.json'), 'utf8'),
    );
    expect(state.status).toBe('failed');
    expect(state.activeVersion).toBeNull();
  });

  it('supports reinstall to switch versions deterministically', async () => {
    const { artifact, coordinator } = await loadModules();

    await artifact.uploadPackageArtifact(buildZip('ecommerce-core', '1.0.0'), 'ec-1.0.0.zip', 'admin');
    await artifact.uploadPackageArtifact(buildZip('ecommerce-core', '1.1.0'), 'ec-1.1.0.zip', 'admin');

    const installV1 = await coordinator.install('ecommerce-core', 'admin@example.com', { version: '1.0.0' });
    expect(installV1.success).toBe(true);

    const reinstall = await coordinator.reinstall('ecommerce-core', 'admin@example.com', { version: '1.1.0' });
    expect(reinstall.success, (reinstall as any).error).toBe(true);
    if (!reinstall.success) return;
    expect(reinstall.operation).toBe('reinstall');
    expect(reinstall.version).toBe('1.1.0');

    const statePath = path.join(tmpDir, 'packages-storage', 'installed', 'ecommerce-core.install-state.json');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    expect(state.status).toBe('installed');
    expect(state.activeVersion).toBe('1.1.0');
  });

  it('returns dependency graph for installed packages', async () => {
    const { artifact, coordinator } = await loadModules();

    await artifact.uploadPackageArtifact(buildZip('base-catalog', '1.0.0'), 'base.zip', 'admin');
    await artifact.uploadPackageArtifact(
      buildZip('ecommerce-addon', '1.0.0', {
        dependencies: [{ packageId: 'base-catalog', versionRange: '>=1.0.0 <2.0.0' }],
      }),
      'addon.zip',
      'admin',
    );

    expect((await coordinator.install('base-catalog', 'admin@example.com')).success).toBe(true);
    expect((await coordinator.install('ecommerce-addon', 'admin@example.com')).success).toBe(true);

    const graph = coordinator.getDependencyGraph();
    expect(graph.nodes.some((x) => x.packageId === 'base-catalog')).toBe(true);
    expect(graph.nodes.some((x) => x.packageId === 'ecommerce-addon')).toBe(true);
    expect(
      graph.edges.some(
        (edge) =>
          edge.fromPackageId === 'ecommerce-addon' &&
          edge.toPackageId === 'base-catalog' &&
          edge.satisfied,
      ),
    ).toBe(true);
    expect(graph.hasCycle).toBe(false);
  });

  it('blocks install when db script paths violate allowlist policy', async () => {
    const { artifact, coordinator } = await loadModules();

    writeRuntimeSettings({
      packageScriptAllowedPathPrefixes: 'db/install/,db/uninstall/,db/seed/',
    });
    try {
      await artifact.uploadPackageArtifact(
        buildZip('unsafe-db-pack', '1.0.0', {
          dbObjects: [
            {
              objectType: 'table',
              objectName: 'unsafe_table',
              installScript: 'scripts/install.sql',
              uninstallScript: 'db/uninstall/unsafe_table.sql',
            },
          ],
        }),
        'unsafe-db.zip',
        'admin',
      );

      const result = await coordinator.install('unsafe-db-pack', 'admin@example.com');
      expect(result.success).toBe(false);
      if (result.success) return;

      const failure = result as Extract<typeof result, { success: false }>;
      expect(failure.code).toBe('script_execution_unsafe');
      expect((failure.details || []).some((line) => line.includes('scripts/install.sql'))).toBe(true);
    } finally {
      // no-op
    }
  });

  it('supports uninstall without DB uninstall script validation when operator skips DB scripts', async () => {
    const { artifact, coordinator } = await loadModules();

    writeRuntimeSettings({
      packageScriptAllowedPathPrefixes: 'db/install/,db/uninstall/,db/seed/',
    });
    try {
      await artifact.uploadPackageArtifact(
        buildZip('retail-invoice-kit', '1.0.0', {
          dbObjects: [
            {
              objectType: 'table',
              objectName: 'invoice_headers',
              installScript: 'db/install/invoice_headers.sql',
              uninstallScript: 'legacy/remove_invoice_headers.sql',
            },
          ],
        }),
        'retail-invoice-kit.zip',
        'admin',
      );

      const installResult = await coordinator.install('retail-invoice-kit', 'admin@example.com');
      // 2026-07-13: currently fails in this environment — packageDbScripts.service.ts
      // genuinely executes install SQL against a real configured data source
      // (executeSqlScript), not a mock/stub. In this test's isolated tmpDir (process.chdir),
      // that resolves to "SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a
      // string" — a real Postgres auth failure, not a code bug in this test. This needs
      // either a working local DB connection reachable from an isolated tmpDir, or the
      // service/test should stub executeSqlScript for unit-level coverage — left failing
      // rather than guessing which is intended.
      expect(installResult.success, `${(installResult as any).error} :: ${JSON.stringify((installResult as any).details)}`).toBe(true);

      const strictUninstall = await coordinator.uninstall('retail-invoice-kit', 'admin@example.com', {
        runDbUninstallScripts: true,
      });
      expect(strictUninstall.success).toBe(false);
      if (strictUninstall.success) return;
      const strictFailure = strictUninstall as Extract<typeof strictUninstall, { success: false }>;
      expect(strictFailure.code).toBe('script_execution_unsafe');

      const softUninstall = await coordinator.uninstall('retail-invoice-kit', 'admin@example.com', {
        runDbUninstallScripts: false,
      });
      expect(softUninstall.success, (softUninstall as any).error).toBe(true);
      if (!softUninstall.success) return;
      expect(softUninstall.status).toBe('not_installed');
    } finally {
      // no-op
    }
  });
});
