/**
 * p-ecosystem-zip-test — ecosystem ZIP matrix (phase 1 P0+P1, phase 2 P2).
 * Spec: historical ecosystem ZIP phase-1 / phase-2 plans
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  buildDuplicateUploadZip,
  buildInvalidPluginZip,
  buildInvalidVerticalAppZip,
  buildPackageZipBuffer,
  buildSmokeFailMissingEntryZip,
  buildStudioFunctionExportSpec,
  buildVerticalAppZipBuffer,
  plApiAuthMatrixSpec,
  plDbConflictDenySpec,
  plDbConflictOwnerSpec,
  plDbSafeSpec,
  plDbUnsafeSpec,
  plApiConflictAllowSpec,
  plApiConflictDenySpec,
  plApiConflictOwnerSpec,
  plApiOnlySpec,
  plApiOnlyV11Spec,
  plDepBaseSpec,
  plDepChildSpec,
  plFullStackSpec,
  plInstallFailMissingDepSpec,
  plMcpConflictDenySpec,
  plMcpManifestSpec,
  plPropsSchemaRefSpec,
  plSmokeFailUnknownSlotSpec,
  plUiConflictAllowSpec,
  plUiConflictDenySpec,
  plUiConflictOwnerSpec,
  plUiDashSpec,
  plUiRoutesSpec,
  plUiSlotSpec,
  vaAutoMiniSpec,
  vaDesignerLayoutsOnlySpec,
  vaExtensionDependencySpec,
  vaProposeInventorySpec,
  vaReferenceInventorySpec,
  vaRtlJalaliSpec,
} from '../testkit/ecosystemFixtures';
import { deploymentAppliedPath } from '../testkit/deploymentAppliedAssertions';
import type { PackageManifest } from '../PackageManifestValidator';
import type { PackageLifecycleResult } from '../../../server/domain/package-domain/types';

const deploymentScanState = vi.hoisted(() => ({
  appliedPathPrefixes: new Map<string, { mountId: string; owner: string }>(),
}));

const aiSettingsState = vi.hoisted(() => ({
  stdioAllowlist: [] as string[],
}));

vi.mock('../../../core/ai/AiManager', () => ({
  aiManager: {
    getSettings: () => ({
      mcp: { stdioAllowlist: aiSettingsState.stdioAllowlist },
      mcpServers: [],
    }),
  },
}));

vi.mock('../../../server/services/package-runtime/deploymentConflictScan', () => ({
  findEffectiveShellOwner: async () => null,
  findEffectivePageModuleOwner: async () => null,
  findEffectiveMountIdByPathPrefix: async (pathPrefix: string, excludePluginId?: string) => {
    const entry = deploymentScanState.appliedPathPrefixes.get(pathPrefix);
    if (!entry || entry.owner === excludePluginId) return null;
    return entry.mountId;
  },
  findEffectiveMountOwnerById: async (mountId: string, excludePluginId?: string) => {
    for (const entry of deploymentScanState.appliedPathPrefixes.values()) {
      if (entry.mountId === mountId && entry.owner !== excludePluginId) return entry.owner;
    }
    return null;
  },
  findEffectiveRouteBindingOwner: async () => null,
  listEffectiveMountPathPrefixes: async () => [...deploymentScanState.appliedPathPrefixes.keys()],
  mountExistsInCoreOrDeployments: async (mountId: string, excludePluginId?: string) => {
    for (const entry of deploymentScanState.appliedPathPrefixes.values()) {
      if (entry.mountId === mountId && entry.owner !== excludePluginId) return true;
    }
    return false;
  },
  CORE_PLATFORM_OWNER: '__core__',
}));

vi.mock('../../../server/services/package-runtime/packageDbScripts.service', () => ({
  runPackageInstallDbScripts: vi.fn(async () => ({ ok: true as const, executedScripts: [] })),
  runPluginUninstallDbScripts: vi.fn(async () => ({ ok: true as const, executedScripts: [] })),
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

let tmpDir = '';
let settingsPath = '';
let origCwd = '';

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eco-zip-matrix-'));
  deploymentScanState.appliedPathPrefixes.clear();
  aiSettingsState.stdioAllowlist = [];
  settingsPath = path.join(tmpDir, 'settings.json');
  fs.writeFileSync(settingsPath, JSON.stringify({}, null, 2));
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

async function callPluginApi(packageId: string, version: string, apiPath: string) {
  const manifest = await readUploadedManifest(packageId, version);
  expect(manifest).toBeTruthy();
  if (!manifest) return null;

  const {
    extractPackageApiRuntime,
    resolvePackageApiRoute,
    executePluginApiHandler,
  } = await import('../../../server/services/package-runtime/packageApiRuntime.service');
  extractPackageApiRuntime(packageId, version, manifest as PackageManifest);

  const match = resolvePackageApiRoute('GET', apiPath);
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
  if (!match) return { match, body, executed: null };
  const executed = await executePluginApiHandler(match, { method: 'GET', query: {}, params: {} }, res);
  return { match, body, executed };
}

function expectLifecycleFailure(result: PackageLifecycleResult, code: string) {
  expect(result.success).toBe(false);
  if (result.success) return;
  const failure = result as Extract<PackageLifecycleResult, { success: false }>;
  expect(failure.code).toBe(code);
}

describe('pEcosystemZipMatrix.exit — phase 1 (P0+P1)', () => {
  it('SC-B1: uploads and installs API-only extension (PL-01)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const spec = plApiOnlySpec();
    const zip = buildPackageZipBuffer(spec);

    expect((await artifact.uploadPackageArtifact(zip, `${spec.packageId}.zip`, 'admin')).success).toBe(true);
    expect((await coordinator.install(spec.packageId, 'admin@example.com')).success).toBe(true);

    const api = await callPluginApi(spec.packageId, '1.0.0', `/api${spec.apis![0]!.path}`);
    expect(api?.match?.packageId).toBe(spec.packageId);
    expect(api?.executed).toMatchObject({ ok: true });
    expect(api?.body).toMatchObject({ success: true });
  });

  it('SC-B2: installs dashboard widget slot (PL-02)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const spec = plUiDashSpec();
    const zip = buildPackageZipBuffer(spec);

    expect((await artifact.uploadPackageArtifact(zip, `${spec.packageId}.zip`, 'admin')).success).toBe(true);
    expect((await coordinator.install(spec.packageId, 'admin@example.com')).success).toBe(true);

    const { listActiveSlotComponents } = await import('../../../server/services/package-runtime/packageUiRuntime.service');
    const active = listActiveSlotComponents().filter((item) => item.packageId === spec.packageId);
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({
      slotId: 'core.dashboard.widgets',
      componentKey: `${spec.packageId}-widget`,
    });
  });

  it('SC-D1: vertical-app propose then apply writes deployment-applied (VA-04)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const spec = vaProposeInventorySpec();
    const zip = buildVerticalAppZipBuffer(spec);

    expect((await artifact.uploadPackageArtifact(zip, `${spec.packageId}.zip`, 'admin')).success).toBe(true);
    const install = await coordinator.install(spec.packageId, 'admin@example.com');
    expect(install.success, (install as { error?: string }).error).toBe(true);
    if (!install.success) return;
    expect(install.deploymentStatus).toBe('pending');
    expect(fs.existsSync(deploymentAppliedPath(spec.packageId))).toBe(false);

    const apply = await coordinator.applyDeployment(spec.packageId, 'admin@example.com', null);
    expect(apply.success, (apply as { error?: string }).error).toBe(true);
    if (!apply.success) return;
    expect(apply.deploymentStatus).toBe('applied');
    expect(fs.existsSync(deploymentAppliedPath(spec.packageId))).toBe(true);
  });

  it('SC-C5: API conflict with deny policy blocks second install (PL-11 + PL-12)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const sharedPath = '/packages/eco-shared-zone/ping';
    const owner = plApiConflictOwnerSpec(sharedPath);
    const deny = plApiConflictDenySpec(sharedPath);

    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(owner), 'owner.zip', 'admin')).success).toBe(true);
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(deny), 'deny.zip', 'admin')).success).toBe(true);
    expect((await coordinator.install(owner.packageId, 'admin@example.com')).success).toBe(true);

    const blocked = await coordinator.install(deny.packageId, 'admin@example.com');
    expectLifecycleFailure(blocked, 'conflict_denied');
  });

  it('SC-C7: UI conflict with deny policy blocks second install (PL-16 + PL-17)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const owner = plUiConflictOwnerSpec();
    const deny = plUiConflictDenySpec();

    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(owner), 'ui-owner.zip', 'admin')).success).toBe(true);
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(deny), 'ui-deny.zip', 'admin')).success).toBe(true);
    expect((await coordinator.install(owner.packageId, 'admin@example.com')).success).toBe(true);

    const blocked = await coordinator.install(deny.packageId, 'admin@example.com');
    expectLifecycleFailure(blocked, 'conflict_denied');
  });

  it('SC-F2: rejects invalid extension uploads (NEG-PL-01..07)', async () => {
    const { artifact } = await loadLifecycleModules();
    const scenarios = [
      'unknown-key',
      'empty-caps',
      'bad-id',
      'bad-integrity',
      'missing-json',
      'zip-slip',
      'non-zip',
    ] as const;

    for (const scenario of scenarios) {
      const { buffer, originalName } = buildInvalidPluginZip(scenario);
      const result = await artifact.uploadPackageArtifact(buffer, originalName, 'admin');
      expect(result.success, scenario).toBe(false);
    }
  });

  it('SC-C1: child install fails when dependency base is missing (PL-10 before PL-09)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const child = plDepChildSpec();
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(child), 'child.zip', 'admin')).success).toBe(true);

    const blocked = await coordinator.install(child.packageId, 'admin@example.com');
    expectLifecycleFailure(blocked, 'dependency_missing');
  });

  it('SC-C2: installs dependency base then child (PL-09 + PL-10)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const base = plDepBaseSpec();
    const child = plDepChildSpec();

    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(base), 'base.zip', 'admin')).success).toBe(true);
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(child), 'child.zip', 'admin')).success).toBe(true);
    expect((await coordinator.install(base.packageId, 'admin@example.com')).success).toBe(true);
    expect((await coordinator.install(child.packageId, 'admin@example.com')).success).toBe(true);
  });

  it('SC-C4: uninstalls child then base cleanly', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const base = plDepBaseSpec();
    const child = plDepChildSpec();

    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(base), 'base.zip', 'admin')).success).toBe(true);
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(child), 'child.zip', 'admin')).success).toBe(true);
    expect((await coordinator.install(base.packageId, 'admin@example.com')).success).toBe(true);
    expect((await coordinator.install(child.packageId, 'admin@example.com')).success).toBe(true);

    expect((await coordinator.uninstall(child.packageId, 'admin@example.com')).success).toBe(true);
    expect((await coordinator.uninstall(base.packageId, 'admin@example.com')).success).toBe(true);

    const baseStatePath = path.join('packages-storage', 'installed', `${base.packageId}.install-state.json`);
    const childStatePath = path.join('packages-storage', 'installed', `${child.packageId}.install-state.json`);
    expect(JSON.parse(fs.readFileSync(baseStatePath, 'utf8')).status).toBe('not_installed');
    expect(JSON.parse(fs.readFileSync(childStatePath, 'utf8')).status).toBe('not_installed');
  });

  it('SC-B9: disable then enable keeps extension installed', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const spec = plApiOnlySpec('toggle');
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(spec), 'toggle.zip', 'admin')).success).toBe(true);
    expect((await coordinator.install(spec.packageId, 'admin@example.com')).success).toBe(true);

    expect(coordinator.disable(spec.packageId, 'admin@example.com').success).toBe(true);
    const statePath = path.join('packages-storage', 'installed', `${spec.packageId}.install-state.json`);
    expect(JSON.parse(fs.readFileSync(statePath, 'utf8')).enabled).toBe(false);

    const { resolvePackageApiRoute } = await import('../../../server/services/package-runtime/packageApiRuntime.service');
    expect(resolvePackageApiRoute('GET', `/api${spec.apis![0]!.path}`)).toBeNull();

    expect(coordinator.enable(spec.packageId, 'admin@example.com').success).toBe(true);
    expect(JSON.parse(fs.readFileSync(statePath, 'utf8')).enabled).toBe(true);
  });

  it('SC-G1: reinstall upgrades API-only extension to 1.1.0 (PL-21)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const v1 = plApiOnlySpec('upgrade');
    const v11 = plApiOnlyV11Spec('upgrade');

    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(v1), `${v1.packageId}-1.0.0.zip`, 'admin')).success).toBe(true);
    expect((await coordinator.install(v1.packageId, 'admin@example.com')).success).toBe(true);

    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(v11), `${v11.packageId}-1.1.0.zip`, 'admin')).success).toBe(true);
    const reinstall = await coordinator.reinstall(v11.packageId, 'admin@example.com');
    expect(reinstall.success, (reinstall as { error?: string }).error).toBe(true);
    if (!reinstall.success) return;
    expect(reinstall.version).toBe('1.1.0');

    const api = await callPluginApi(v11.packageId, '1.1.0', `/api${v11.apis![1]!.path}`);
    expect(api?.executed).toMatchObject({ ok: true });
  });

  it('SC-D7: uninstall removes deployment-applied overlay (VA-01)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const spec = vaProposeInventorySpec();
    expect((await artifact.uploadPackageArtifact(buildVerticalAppZipBuffer(spec), 'va.zip', 'admin')).success).toBe(true);
    expect((await coordinator.install(spec.packageId, 'admin@example.com')).success).toBe(true);
    expect((await coordinator.applyDeployment(spec.packageId, 'admin@example.com', null)).success).toBe(true);
    expect(fs.existsSync(deploymentAppliedPath(spec.packageId))).toBe(true);

    expect((await coordinator.uninstall(spec.packageId, 'admin@example.com')).success).toBe(true);
    expect(fs.existsSync(deploymentAppliedPath(spec.packageId))).toBe(false);
  });

  it('SC-E1: installs extensions in cross-artifact happy path', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const api = plApiOnlySpec('cross-api');
    const ui = plUiDashSpec('cross-ui');
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(api), 'api.zip', 'admin')).success).toBe(true);
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(ui), 'ui.zip', 'admin')).success).toBe(true);
    expect((await coordinator.install(api.packageId, 'admin@example.com')).success).toBe(true);
    expect((await coordinator.install(ui.packageId, 'admin@example.com')).success).toBe(true);

    const { listActiveSlotComponents } = await import('../../../server/services/package-runtime/packageUiRuntime.service');
    expect(listActiveSlotComponents().some((item) => item.packageId === ui.packageId)).toBe(true);
  });
});

describe('pEcosystemZipMatrix.exit — phase 2 (P2)', () => {
  it('SC-B3: installs sidebar, settings, and toolbar slot extensions (PL-03..05)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const slotIds = [
      'core.sidebar.navigation',
      'core.settings.sections',
      'core.toolbar.actions',
    ] as const;
    const specs = slotIds.map((slotId) => plUiSlotSpec(slotId));

    for (const spec of specs) {
      expect(
        (await artifact.uploadPackageArtifact(buildPackageZipBuffer(spec), `${spec.packageId}.zip`, 'admin')).success,
      ).toBe(true);
      expect((await coordinator.install(spec.packageId, 'admin@example.com')).success).toBe(true);
    }

    const { listActiveSlotComponents } = await import('../../../server/services/package-runtime/packageUiRuntime.service');
    const active = listActiveSlotComponents();
    for (const spec of specs) {
      expect(active).toContainEqual(
        expect.objectContaining({
          packageId: spec.packageId,
          slotId: spec.uiComponents![0]!.slotId,
          componentKey: spec.uiComponents![0]!.componentKey,
        }),
      );
    }
  });

  it('SC-C6: API conflict with allow policy installs second extension (PL-11 + PL-13)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const sharedPath = '/packages/eco-allow-zone/ping';
    const owner = plApiConflictOwnerSpec(sharedPath);
    const allow = plApiConflictAllowSpec(sharedPath);

    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(owner), 'owner.zip', 'admin')).success).toBe(true);
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(allow), 'allow.zip', 'admin')).success).toBe(true);
    expect((await coordinator.install(owner.packageId, 'admin@example.com')).success).toBe(true);
    expect((await coordinator.install(allow.packageId, 'admin@example.com')).success).toBe(true);

    const { resolvePackageApiRoute } = await import('../../../server/services/package-runtime/packageApiRuntime.service');
    const match = resolvePackageApiRoute('GET', `/api${sharedPath}`);
    expect(match?.packageId).toBe(allow.packageId);
  });

  it('SC-D2: mini vertical-app with applyPolicy auto applies deployment (VA-02)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const spec = vaAutoMiniSpec();
    const zip = buildVerticalAppZipBuffer(spec);

    expect((await artifact.uploadPackageArtifact(zip, `${spec.packageId}.zip`, 'admin')).success).toBe(true);
    const install = await coordinator.install(spec.packageId, 'admin@example.com');
    expect(install.success, (install as { error?: string }).error).toBe(true);
    if (!install.success) return;
    expect(install.deploymentStatus).toBe('applied');
    expect(fs.existsSync(deploymentAppliedPath(spec.packageId))).toBe(true);
  });

  it('SC-F3: rejects invalid vertical-app uploads (NEG-VA-01..04)', async () => {
    const { artifact } = await loadLifecycleModules();
    const scenarios = ['unknown-key', 'bad-kind', 'zip-slip', 'bad-integrity'] as const;

    for (const scenario of scenarios) {
      const { buffer, originalName } = buildInvalidVerticalAppZip(scenario);
      const result = await artifact.uploadPackageArtifact(buffer, originalName, 'admin');
      expect(result.success, scenario).toBe(false);
    }
  });

  it('SC-B4: installs extension UI routes with applied deployment (PL-06)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const spec = plUiRoutesSpec();
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(spec), `${spec.packageId}.zip`, 'admin')).success).toBe(true);

    const install = await coordinator.install(spec.packageId, 'admin@example.com');
    expect(install.success, (install as { error?: string }).error).toBe(true);
    if (!install.success) return;

    if (install.deploymentStatus === 'pending') {
      const apply = await coordinator.applyDeployment(spec.packageId, 'admin@example.com', null);
      expect(apply.success, (apply as { error?: string }).error).toBe(true);
      if (!apply.success) return;
      expect(apply.deploymentStatus).toBe('applied');
    } else {
      expect(install.deploymentStatus).toBe('applied');
    }
    expect(fs.existsSync(deploymentAppliedPath(spec.packageId))).toBe(true);
  });

  it('SC-B5: installs DB-safe extension (PL-07)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const spec = plDbSafeSpec();
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(spec), `${spec.packageId}.zip`, 'admin')).success).toBe(true);
    expect((await coordinator.install(spec.packageId, 'admin@example.com')).success).toBe(true);
  });

  it('SC-C8: UI conflict with allow policy installs second extension (PL-16 + PL-18)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const owner = plUiConflictOwnerSpec();
    const allow = plUiConflictAllowSpec();

    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(owner), 'ui-owner.zip', 'admin')).success).toBe(true);
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(allow), 'ui-allow.zip', 'admin')).success).toBe(true);
    expect((await coordinator.install(owner.packageId, 'admin@example.com')).success).toBe(true);
    expect((await coordinator.install(allow.packageId, 'admin@example.com')).success).toBe(true);

    const { listActiveSlotComponents } = await import('../../../server/services/package-runtime/packageUiRuntime.service');
    const active = listActiveSlotComponents().filter((item) => item.componentKey === 'shared-widget');
    expect(active).toHaveLength(1);
    expect(active[0]?.packageId).toBe(allow.packageId);
  });

  it('SC-C9: DB conflict with deny policy blocks second install (PL-23 + PL-24)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const objectName = 'eco_shared_table';
    const owner = plDbConflictOwnerSpec(objectName);
    const deny = plDbConflictDenySpec(objectName);

    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(owner), 'db-owner.zip', 'admin')).success).toBe(true);
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(deny), 'db-deny.zip', 'admin')).success).toBe(true);
    expect((await coordinator.install(owner.packageId, 'admin@example.com')).success).toBe(true);

    const blocked = await coordinator.install(deny.packageId, 'admin@example.com');
    expectLifecycleFailure(blocked, 'conflict_denied');
  });

  it('SC-B6: blocks DB-unsafe extension install path (PL-08)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const spec = plDbUnsafeSpec();
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(spec), `${spec.packageId}.zip`, 'admin')).success).toBe(true);

    const blocked = await coordinator.install(spec.packageId, 'admin@example.com');
    expectLifecycleFailure(blocked, 'script_execution_unsafe');
  });

  it('SC-B7: install is idempotent when the same version is already active (PL-01)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const spec = plApiOnlySpec('b7-idempotent');
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(spec), `${spec.packageId}.zip`, 'admin')).success).toBe(true);
    expect((await coordinator.install(spec.packageId, 'admin@example.com')).success).toBe(true);

    const again = await coordinator.install(spec.packageId, 'admin@example.com');
    expect(again.success).toBe(true);
    if (!again.success) return;
    expect(again.idempotent).toBe(true);
    expect(again.version).toBe('1.0.0');
  });

  it('SC-B8: uninstalls API-only extension cleanly (PL-01)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const spec = plApiOnlySpec('b8-uninstall');
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(spec), `${spec.packageId}.zip`, 'admin')).success).toBe(true);
    expect((await coordinator.install(spec.packageId, 'admin@example.com')).success).toBe(true);

    const uninstall = await coordinator.uninstall(spec.packageId, 'admin@example.com');
    expect(uninstall.success, (uninstall as { error?: string }).error).toBe(true);
    if (!uninstall.success) return;
    expect(uninstall.status).toBe('not_installed');

    const registryPath = path.join('packages-storage', 'objects', `${spec.packageId}.object-registry.json`);
    expect(fs.existsSync(registryPath)).toBe(false);
  });

  it('SC-B10: smoke test blocks install for unknown slot extension (NEG-PL-09)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const spec = plSmokeFailUnknownSlotSpec();
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(spec), `${spec.packageId}.zip`, 'admin')).success).toBe(true);

    const blocked = await coordinator.install(spec.packageId, 'admin@example.com');
    expectLifecycleFailure(blocked, 'invalid_manifest');
  });

  it('SC-C3: blocks uninstall of dependency base while child remains installed (PL-09 + PL-10)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const base = plDepBaseSpec();
    const child = plDepChildSpec();

    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(base), 'base.zip', 'admin')).success).toBe(true);
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(child), 'child.zip', 'admin')).success).toBe(true);
    expect((await coordinator.install(base.packageId, 'admin@example.com')).success).toBe(true);
    expect((await coordinator.install(child.packageId, 'admin@example.com')).success).toBe(true);

    const blocked = await coordinator.uninstall(base.packageId, 'admin@example.com');
    expectLifecycleFailure(blocked, 'reverse_dependency_blocked');
  });

  it('SC-C10: installs MCP owner then registers second MCP manifest (PL-15 + PL-25)', async () => {
    aiSettingsState.stdioAllowlist = ['npx'];
    const { artifact, coordinator } = await loadLifecycleModules();
    const owner = plMcpManifestSpec();
    const followUp = plMcpConflictDenySpec();

    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(owner), 'mcp-owner.zip', 'admin')).success).toBe(true);
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(followUp), 'mcp-deny.zip', 'admin')).success).toBe(true);
    expect((await coordinator.install(owner.packageId, 'admin@example.com')).success).toBe(true);
    expect((await coordinator.install(followUp.packageId, 'admin@example.com')).success).toBe(true);

    const registryPath = path.join('packages-storage', 'objects', `${followUp.packageId}.object-registry.json`);
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    expect(registry.records.mcpServers).toHaveLength(1);
  });

  it('SC-C11: blocks install when declared dependency is missing (NEG-PL-11)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const spec = plInstallFailMissingDepSpec();
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(spec), `${spec.packageId}.zip`, 'admin')).success).toBe(true);

    const blocked = await coordinator.install(spec.packageId, 'admin@example.com');
    expectLifecycleFailure(blocked, 'dependency_missing');
  });

  it('SC-C12: blocks MCP install when stdio allowlist is not configured (PL-09 + NEG-PL-12)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const base = plDepBaseSpec();
    const mcpDeny = plMcpConflictDenySpec();

    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(base), 'base.zip', 'admin')).success).toBe(true);
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(mcpDeny), 'mcp-deny.zip', 'admin')).success).toBe(true);
    expect((await coordinator.install(base.packageId, 'admin@example.com')).success).toBe(true);

    const blocked = await coordinator.install(mcpDeny.packageId, 'admin@example.com');
    expectLifecycleFailure(blocked, 'invalid_manifest');
  });

  it('SC-C13: keeps dashboard widget and dependency child active together (PL-02 + PL-10)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const dash = plUiDashSpec('c13-dash');
    const base = plDepBaseSpec();
    const child = plDepChildSpec();

    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(base), 'base.zip', 'admin')).success).toBe(true);
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(dash), 'dash.zip', 'admin')).success).toBe(true);
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(child), 'child.zip', 'admin')).success).toBe(true);
    expect((await coordinator.install(base.packageId, 'admin@example.com')).success).toBe(true);
    expect((await coordinator.install(dash.packageId, 'admin@example.com')).success).toBe(true);
    expect((await coordinator.install(child.packageId, 'admin@example.com')).success).toBe(true);

    const { listActiveSlotComponents } = await import('../../../server/services/package-runtime/packageUiRuntime.service');
    const active = listActiveSlotComponents();
    expect(active.some((item) => item.packageId === dash.packageId)).toBe(true);
    expect(active.some((item) => item.packageId === child.packageId)).toBe(true);
  });

  it('SC-C14: rejects duplicate package version upload (NEG-PL-08)', async () => {
    const { artifact } = await loadLifecycleModules();
    const spec = plApiOnlySpec();
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(spec), `${spec.packageId}.zip`, 'admin')).success).toBe(true);

    const duplicate = buildDuplicateUploadZip();
    const blocked = await artifact.uploadPackageArtifact(duplicate.buffer, duplicate.originalName, 'admin');
    expect(blocked.success).toBe(false);
  });

  it('SC-D3: auto-applies vertical-app with designer layouts only (VA-03)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const spec = vaDesignerLayoutsOnlySpec();
    expect((await artifact.uploadPackageArtifact(buildVerticalAppZipBuffer(spec), `${spec.packageId}.zip`, 'admin')).success).toBe(true);

    const install = await coordinator.install(spec.packageId, 'admin@example.com');
    expect(install.success, (install as { error?: string }).error).toBe(true);
    if (!install.success) return;
    expect(install.deploymentStatus).toBe('applied');
    expect(fs.existsSync(deploymentAppliedPath(spec.packageId))).toBe(true);
  });

  it('SC-D5: installs reference and mini vertical-apps on the same node (VA-01 + VA-02)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const reference = vaReferenceInventorySpec();
    const mini = vaAutoMiniSpec();

    expect((await artifact.uploadPackageArtifact(buildVerticalAppZipBuffer(reference), 'va-ref.zip', 'admin')).success).toBe(true);
    expect((await artifact.uploadPackageArtifact(buildVerticalAppZipBuffer(mini), 'va-mini.zip', 'admin')).success).toBe(true);
    expect((await coordinator.install(reference.packageId, 'admin@example.com')).success).toBe(true);
    expect((await coordinator.install(mini.packageId, 'admin@example.com')).success).toBe(true);

    const refStatePath = path.join('packages-storage', 'installed', `${reference.packageId}.install-state.json`);
    const miniStatePath = path.join('packages-storage', 'installed', `${mini.packageId}.install-state.json`);
    expect(JSON.parse(fs.readFileSync(refStatePath, 'utf8')).status).toBe('installed');
    expect(JSON.parse(fs.readFileSync(miniStatePath, 'utf8')).status).toBe('installed');
  });

  it('SC-D9: uploads and installs studio function export extension (ST-03)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const spec = buildStudioFunctionExportSpec();
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(spec), `${spec.packageId}.zip`, 'admin')).success).toBe(true);
    expect((await coordinator.install(spec.packageId, 'admin@example.com')).success).toBe(true);

    const manifest = await readUploadedManifest(spec.packageId, '1.0.0');
    expect(manifest?.capabilities.apis).toHaveLength(1);
    expect(manifest?.capabilities.apis?.[0]?.entry).toBe('api/echo.ts');
  });

  it('SC-F4: accepts upload for extension missing smoke-test UI entry (NEG-PL-10)', async () => {
    const { artifact } = await loadLifecycleModules();
    const { buffer, originalName } = buildSmokeFailMissingEntryZip();
    const upload = await artifact.uploadPackageArtifact(buffer, originalName, 'admin');
    expect(upload.success).toBe(true);
  });

  it('SC-G2: serves installed API-only extension at runtime (PL-01)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const spec = plApiOnlySpec('g2-runtime');
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(spec), `${spec.packageId}.zip`, 'admin')).success).toBe(true);
    expect((await coordinator.install(spec.packageId, 'admin@example.com')).success).toBe(true);

    const api = await callPluginApi(spec.packageId, '1.0.0', `/api${spec.apis![0]!.path}`);
    expect(api?.executed).toMatchObject({ ok: true });
  });

  it('SC-G3: reinstalls API-only extension after uninstall (PL-01)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const spec = plApiOnlySpec('g3-reinstall');
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(spec), `${spec.packageId}.zip`, 'admin')).success).toBe(true);
    expect((await coordinator.install(spec.packageId, 'admin@example.com')).success).toBe(true);
    expect((await coordinator.uninstall(spec.packageId, 'admin@example.com')).success).toBe(true);

    const reinstall = await coordinator.reinstall(spec.packageId, 'admin@example.com');
    expect(reinstall.success, (reinstall as { error?: string }).error).toBe(true);
    if (!reinstall.success) return;
    expect(reinstall.status).toBe('installed');
  });

  it('SC-G4: installs vertical-app when extension dependency is present (VA-07 + PL-02)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const dash = plUiDashSpec();
    const va = vaExtensionDependencySpec();

    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(dash), 'dash.zip', 'admin')).success).toBe(true);
    expect((await artifact.uploadPackageArtifact(buildVerticalAppZipBuffer(va), 'va.zip', 'admin')).success).toBe(true);
    expect((await coordinator.install(dash.packageId, 'admin@example.com')).success).toBe(true);
    expect((await coordinator.install(va.packageId, 'admin@example.com')).success).toBe(true);
  });

  it('SC-G5: blocks vertical-app install when extension dependency is missing (VA-07)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const va = vaExtensionDependencySpec();
    expect((await artifact.uploadPackageArtifact(buildVerticalAppZipBuffer(va), 'va.zip', 'admin')).success).toBe(true);

    const blocked = await coordinator.install(va.packageId, 'admin@example.com');
    expectLifecycleFailure(blocked, 'dependency_missing');
  });

  it('SC-G6: registers API auth levels from auth matrix extension (PL-19)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const spec = plApiAuthMatrixSpec();
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(spec), `${spec.packageId}.zip`, 'admin')).success).toBe(true);
    expect((await coordinator.install(spec.packageId, 'admin@example.com')).success).toBe(true);

    const registryPath = path.join('packages-storage', 'objects', `${spec.packageId}.object-registry.json`);
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    const authByPath = new Map<string, string>(
      registry.records.apis.map((api: { path: string; auth: string }) => [api.path, api.auth]),
    );
    expect(authByPath.get(`/packages/${spec.packageId}/public`)).toBe('public');
    expect(authByPath.get(`/packages/${spec.packageId}/authenticated`)).toBe('authenticated');
    expect(authByPath.get(`/packages/${spec.packageId}/admin`)).toBe('admin');
  });

  it('SC-G7: installs extension with propsSchemaRef UI component (PL-26)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const spec = plPropsSchemaRefSpec();
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(spec), `${spec.packageId}.zip`, 'admin')).success).toBe(true);
    expect((await coordinator.install(spec.packageId, 'admin@example.com')).success).toBe(true);

    const manifest = await readUploadedManifest(spec.packageId, '1.0.0');
    expect(manifest?.capabilities.ui_components[0]?.propsSchemaRef).toBe('schemas/widget-props.json');

    const { listActiveSlotComponents } = await import('../../../server/services/package-runtime/packageUiRuntime.service');
    expect(listActiveSlotComponents().some((item) => item.packageId === spec.packageId)).toBe(true);
  });

  it('SC-E3: coexists reference VA and sidebar slot (VA-01 + PL-03)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const sidebar = plUiSlotSpec('core.sidebar.navigation');
    const va = vaReferenceInventorySpec();
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(sidebar), 'sidebar.zip', 'admin')).success).toBe(true);
    expect((await artifact.uploadPackageArtifact(buildVerticalAppZipBuffer(va), 'va.zip', 'admin')).success).toBe(true);
    expect((await coordinator.install(sidebar.packageId, 'admin@example.com')).success).toBe(true);
    expect((await coordinator.install(va.packageId, 'admin@example.com')).success).toBe(true);

    const { listActiveSlotComponents } = await import('../../../server/services/package-runtime/packageUiRuntime.service');
    expect(listActiveSlotComponents().some((item) => item.packageId === sidebar.packageId)).toBe(true);
    const vaStatePath = path.join('packages-storage', 'installed', `${va.packageId}.install-state.json`);
    expect(JSON.parse(fs.readFileSync(vaStatePath, 'utf8')).status).toBe('installed');
  });

  it('SC-E4: installs full-stack extension alongside reference VA (PL-14 + VA-01)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const fullStack = plFullStackSpec();
    const va = vaReferenceInventorySpec();

    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(fullStack), 'fullstack.zip', 'admin')).success).toBe(true);
    expect((await artifact.uploadPackageArtifact(buildVerticalAppZipBuffer(va), 'va.zip', 'admin')).success).toBe(true);
    expect((await coordinator.install(fullStack.packageId, 'admin@example.com')).success).toBe(true);
    expect((await coordinator.install(va.packageId, 'admin@example.com')).success).toBe(true);

    const api = await callPluginApi(fullStack.packageId, '1.0.0', `/api${fullStack.apis![0]!.path}`);
    expect(api?.executed).toMatchObject({ ok: true });
    const { listActiveSlotComponents } = await import('../../../server/services/package-runtime/packageUiRuntime.service');
    expect(listActiveSlotComponents().some((item) => item.packageId === fullStack.packageId)).toBe(true);
    const vaStatePath = path.join('packages-storage', 'installed', `${va.packageId}.install-state.json`);
    expect(JSON.parse(fs.readFileSync(vaStatePath, 'utf8')).status).toBe('installed');
  });

  it('SC-E5: installs dashboard extension alongside reference VA (PL-02 + VA-01)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const dash = plUiDashSpec('e5-dash');
    const va = vaReferenceInventorySpec();

    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(dash), 'dash.zip', 'admin')).success).toBe(true);
    expect((await artifact.uploadPackageArtifact(buildVerticalAppZipBuffer(va), 'va.zip', 'admin')).success).toBe(true);
    expect((await coordinator.install(dash.packageId, 'admin@example.com')).success).toBe(true);
    expect((await coordinator.install(va.packageId, 'admin@example.com')).success).toBe(true);

    const { listActiveSlotComponents } = await import('../../../server/services/package-runtime/packageUiRuntime.service');
    expect(listActiveSlotComponents().some((item) => item.packageId === dash.packageId)).toBe(true);
    const vaStatePath = path.join('packages-storage', 'installed', `${va.packageId}.install-state.json`);
    expect(JSON.parse(fs.readFileSync(vaStatePath, 'utf8')).status).toBe('installed');
  });

  it('SC-E7: installs slot extensions (PL-02..05)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const dash = plUiDashSpec('e7-dash');
    const slots = [
      plUiSlotSpec('core.sidebar.navigation'),
      plUiSlotSpec('core.settings.sections'),
      plUiSlotSpec('core.toolbar.actions'),
    ];
    expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(dash), 'dash.zip', 'admin')).success).toBe(true);
    for (const spec of slots) {
      expect((await artifact.uploadPackageArtifact(buildPackageZipBuffer(spec), `${spec.packageId}.zip`, 'admin')).success).toBe(true);
    }
    expect((await coordinator.install(dash.packageId, 'admin@example.com')).success).toBe(true);
    for (const spec of slots) {
      expect((await coordinator.install(spec.packageId, 'admin@example.com')).success).toBe(true);
    }

    const { listActiveSlotComponents } = await import('../../../server/services/package-runtime/packageUiRuntime.service');
    const active = listActiveSlotComponents();
    expect(active.some((item) => item.packageId === dash.packageId)).toBe(true);
    for (const spec of slots) {
      expect(active.some((item) => item.packageId === spec.packageId)).toBe(true);
    }
  });

  it('SC-E8: installs RTL jalali VA (VA-05)', async () => {
    const { artifact, coordinator } = await loadLifecycleModules();
    const va = vaRtlJalaliSpec();
    expect((await artifact.uploadPackageArtifact(buildVerticalAppZipBuffer(va), 'va-rtl.zip', 'admin')).success).toBe(true);
    const install = await coordinator.install(va.packageId, 'admin@example.com');
    expect(install.success, (install as { error?: string }).error).toBe(true);
    if (!install.success) return;
    expect(install.deploymentStatus).toBe('applied');

    const manifest = await readUploadedManifest(va.packageId, '1.0.0');
    expect(manifest?.deployment?.mount?.experienceConfig).toMatchObject({
      locale: 'fa-IR',
      calendar: 'jalali',
      direction: 'rtl',
    });
  });
});
