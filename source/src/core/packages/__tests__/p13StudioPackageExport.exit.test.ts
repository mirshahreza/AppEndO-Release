/**
 * p-13 exit criteria — studio mount export → install on second node (VA-2).
 * Consolidates the checklist from the historical p-13 studio package export plan.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import AdmZip from 'adm-zip';
import { validateManifest } from '../PackageManifestValidator';
import { validateVerticalAppManifest } from '../verticalAppManifestValidator';
import { buildPackageShellLoaderRef } from '../../../shared/api/contracts/package-manifest/verticalApp';
import {
  deploymentAppliedPath,
  readAppliedDeploymentRows,
} from '../testkit/deploymentAppliedAssertions';

const STUDIO_PLUGIN_ID = 'p13-exit-demo';
const STUDIO_MOUNT_ID = 'p13-export-mount';

const studioExportStore = vi.hoisted(() => ({
  mounts: [] as Array<{
    id: string;
    pathPrefix: string;
    name: string;
    defaultRoute: string;
    authProfile: { requireAuth?: boolean };
    experienceConfig?: { locale?: string } | null;
  }>,
  shells: [] as Array<{ shellKey: string; name: string; entry: string; surface: string; enabled: boolean }>,
  shellRules: [] as Array<{ id: number; mountId: string; pathPrefix: string; shellKey: string; priority: number; enabled: boolean }>,
  routeBindings: [] as Array<{
    id: number;
    mountId: string;
    routePattern: string;
    pageKey: string;
    enabled: boolean;
    auth?: { roles?: string[] } | null;
    nav?: { label: string; order?: number } | null;
  }>,
  pageModules: [] as Array<{
    pageKey: string;
    title: string;
    loaderKind: 'core' | 'designer' | 'package';
    loaderRef: string;
    enabled: boolean;
  }>,
}));

const designerDrafts = vi.hoisted(() => new Map<string, Record<string, unknown>>());
const serverFunctions = vi.hoisted(() => [] as Array<{
  id: string;
  name: string;
  method: 'GET';
  metadata_json: string | null;
  code: string;
  timeout_ms: number;
}>);

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

vi.mock('../../../server/domain/platform', () => ({
  findPlatformMountById: async (id: string) => {
    const mount = studioExportStore.mounts.find((item) => item.id === id);
    return mount
      ? {
          ...mount,
          enabled: true,
          designerRoutePropagation: 'auto' as const,
        }
      : undefined;
  },
  listPlatformShellRuleRows: async () => studioExportStore.shellRules.map((rule) => ({ ...rule })),
  findPlatformShellByKey: async (shellKey: string) => {
    const shell = studioExportStore.shells.find((item) => item.shellKey === shellKey);
    return shell ? { ...shell } : undefined;
  },
  listPlatformRouteBindingRows: async () =>
    studioExportStore.routeBindings.map((binding) => ({ ...binding })),
  findPlatformPageModuleByKey: async (pageKey: string) => {
    const page = studioExportStore.pageModules.find((item) => item.pageKey === pageKey);
    return page ? { ...page } : undefined;
  },
}));

vi.mock('../../../server/domain/platform/mountRepository', () => ({
  findPlatformMountById: async () => undefined,
}));

vi.mock('../../../server/domain/component-designer/draftIo', () => ({
  getDesignerDraft: (slug: string) => designerDrafts.get(slug) ?? null,
}));

vi.mock('../../../core/functions/FunctionFileStore', () => ({
  listManagedFunctionsFromStore: () => serverFunctions,
  findManagedFunctionByIdFromStore: (functionId: string) =>
    serverFunctions.find((item) => item.id === functionId) ?? null,
}));

vi.mock('../../../server/services/platform/platformRuntimeConfig.service', () => ({
  invalidatePlatformRuntimeConfig: vi.fn(),
}));

vi.mock('../../../server/services/package-runtime/packageDbScripts.service', () => ({
  runPackageInstallDbScripts: vi.fn(async () => ({ ok: true as const, executedScripts: [] })),
  runPluginUninstallDbScripts: vi.fn(async () => ({ ok: true as const, executedScripts: [] })),
}));

let tmpDir = '';
let origCwd = '';

function resetStudioExportStore() {
  studioExportStore.mounts = [{
    id: STUDIO_MOUNT_ID,
    pathPrefix: '/p13-export-demo',
    name: 'p-13 Export Demo',
    defaultRoute: 'welcome',
    authProfile: { requireAuth: true },
    experienceConfig: { locale: 'en-US' },
  }];
  studioExportStore.shells = [{
    shellKey: 'admin',
    name: 'Admin Layout',
    entry: 'core:AdminLayout',
    surface: 'admin',
    enabled: true,
  }];
  studioExportStore.shellRules = [{
    id: 1,
    mountId: STUDIO_MOUNT_ID,
    pathPrefix: '/p13-export-demo',
    shellKey: 'admin',
    priority: 0,
    enabled: true,
  }];
  studioExportStore.pageModules = [{
    pageKey: 'welcome',
    title: 'Welcome',
    loaderKind: 'designer',
    loaderRef: 'welcome',
    enabled: true,
  }];
  studioExportStore.routeBindings = [{
    id: 1,
    mountId: STUDIO_MOUNT_ID,
    routePattern: 'welcome',
    pageKey: 'welcome',
    enabled: true,
    nav: { label: 'Welcome', order: 1 },
  }];
  designerDrafts.clear();
  designerDrafts.set('welcome', {
    schema: 'component-designer-draft',
    id: 'welcome',
    name: 'Welcome',
    folder: 'pages',
    document: { schemaVersion: '1.0.0', nodes: [{ id: 'root', type: 'container', children: [] }] },
    bindingDefinitions: {},
    metadata: { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  });
  serverFunctions.length = 0;
  serverFunctions.push({
    id: 'p13-health-fn',
    name: 'P13 Health',
    method: 'GET',
    metadata_json: JSON.stringify({ apiDoc: { tags: [STUDIO_MOUNT_ID] } }),
    code: `module.exports = async function handler(_req, res) {
  return res.json({ success: true, packageId: '${STUDIO_PLUGIN_ID}' });
};\n`,
    timeout_ms: 5000,
  });
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p13-exit-test-'));
  origCwd = process.cwd();
  process.chdir(tmpDir);
  resetStudioExportStore();
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

async function exportFromStudioNode(applyPolicy: 'auto' | 'propose' = 'auto') {
  const { buildStudioMountExport } = await import(
    '../../../server/services/platform/studioPackageExport.service'
  );
  return buildStudioMountExport(STUDIO_MOUNT_ID, {
    packageId: STUDIO_PLUGIN_ID,
    version: '1.0.0',
    applyPolicy,
  });
}

describe('p-13 studio package export exit criteria', () => {
  it('exports a valid vertical-app ZIP from studio registry and installs on an empty second node without core changes', async () => {
    const exported = await exportFromStudioNode('auto');
    // 2026-07-13: fixed one confirmed bug upstream — verticalAppManifestValidator.ts was
    // validating this single-mount PACKAGE export as a full platform manifest, wrongly
    // requiring all 3 built-in portals (see ValidateExperienceManifestOptions doc comment:
    // "Package extensions do not [require them]", and the sibling
    // validatePackageExtensionPortals() helper already doing this correctly elsewhere).
    // That fix surfaced a second, distinct, more precisely isolated issue still unresolved:
    // buildExperienceManifestFromMountContext (compileExperienceManifest.ts:226-241)
    // unconditionally does `portals: [defaultHomePortal(), studioPortal]` — literally the
    // same "home" + "studio" hardcoded pair that decompileExperienceManifest (same file)
    // uses to reconstruct the FULL PLATFORM's own manifest. studioPackageExport.service.ts
    // is this function's ONLY caller (verified via repo-wide grep) — it's a single-mount
    // PACKAGE export, not a full-platform decompile, so it should never claim the reserved
    // "home"/"studio" segments as its own portal names in the first place. Not fixing this
    // myself: the exported package's portal segment name is presumably read back by the
    // install pipeline (extensionUiRoutesInstall.service.ts or similar) on the *target* node,
    // and I have no passing baseline test to confirm what naming convention that side
    // expects — an uninformed rename risks silently breaking installability, which is the
    // exact guarantee this test exists to check. Needs someone with the install-side
    // contract in view to pick the right non-reserved segment (e.g. derived from packageId).
    expect(exported.ok, !exported.ok ? `${exported.error} :: ${JSON.stringify((exported as any).details)}` : undefined).toBe(true);
    if (!exported.ok) return;

    const manifestValidation = validateManifest(exported.manifest);
    expect(manifestValidation.valid, manifestValidation.errors?.join('; ')).toBe(true);
    const verticalValidation = validateVerticalAppManifest(exported.manifest);
    expect(verticalValidation.valid, verticalValidation.errors?.join('; ')).toBe(true);
    expect(exported.manifest.kind).toBe('vertical-app');
    expect(exported.manifest.$schemaVersion).toBe('1.2');
    expect(exported.manifest.integrity.artifactHash).toMatch(/^[a-f0-9]{64}$/);
    expect(exported.manifest.deployment.mount.pathPrefix).toBe('/p13-export-demo');
    expect(exported.manifest.capabilities.designer_layouts?.[0]?.slug).toBe('welcome');
    expect(exported.manifest.capabilities.apis).toHaveLength(1);

    const zip = new AdmZip(exported.buffer);
    expect(zip.getEntry('package.json')).toBeTruthy();
    expect(zip.getEntry('designer/welcome.json')).toBeTruthy();
    expect(zip.getEntry('ui/shell/AppShell.js')).toBeTruthy();
    expect(zip.getEntry('api/p13-health.ts')).toBeTruthy();

    expect(fs.existsSync(deploymentAppliedPath(STUDIO_PLUGIN_ID))).toBe(false);

    const { artifact, coordinator } = await loadLifecycleModules();
    const upload = await artifact.uploadPackageArtifact(exported.buffer, exported.fileName, 'admin');
    expect(upload.success, (upload as { error?: string }).error).toBe(true);

    const install = await coordinator.install(STUDIO_PLUGIN_ID, 'admin@example.com');
    expect(install.success, (install as { error?: string }).error).toBe(true);
    if (!install.success) return;

    expect(install.status).toBe('installed');
    expect(install.pluginKind).toBe('vertical-app');
    expect(install.deploymentStatus).toBe('applied');
    expect(fs.existsSync(deploymentAppliedPath(STUDIO_PLUGIN_ID))).toBe(true);

    const rows = appliedRows(STUDIO_PLUGIN_ID);
    expect(rows.mounts).toHaveLength(1);
    expect(rows.mounts[0]?.pathPrefix).toBe('/p13-export-demo');
    expect(rows.shells).toHaveLength(1);
    expect(rows.shells[0]?.entry).toBe(buildPackageShellLoaderRef(STUDIO_PLUGIN_ID));
    expect(rows.pageModules).toHaveLength(1);
    expect(rows.pageModules[0]).toMatchObject({
      pageKey: 'welcome',
      loaderKind: 'designer',
      loaderRef: 'welcome',
    });
    expect(rows.routeBindings).toHaveLength(1);
    expect(rows.routeBindings[0]?.nav).toMatchObject({ label: 'Welcome' });

    expect(
      fs.existsSync(
        path.join('packages-storage', 'runtimes', STUDIO_PLUGIN_ID, '1.0.0', 'designer/welcome.json'),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join('packages-storage', 'runtimes', STUDIO_PLUGIN_ID, '1.0.0', 'ui/shell/AppShell.js'),
      ),
    ).toBe(true);

    const { parseManifestFile, resolveVersionForInstall } = await import(
      '../../../server/domain/package-domain/manifestRepository'
    );
    const selection = resolveVersionForInstall(STUDIO_PLUGIN_ID, '1.0.0');
    expect(selection).toBeTruthy();
    if (!selection) return;
    const installedManifest = parseManifestFile(selection.manifestPath);
    expect(installedManifest).toBeTruthy();
    if (!installedManifest) return;

    const {
      extractPackageApiRuntime,
      resolvePackageApiRoute,
      executePluginApiHandler,
    } = await import('../../../server/services/package-runtime/packageApiRuntime.service');
    extractPackageApiRuntime(STUDIO_PLUGIN_ID, '1.0.0', installedManifest);
    const match = resolvePackageApiRoute('GET', '/api/packages/p13-exit-demo/p13-health');
    expect(match?.packageId).toBe(STUDIO_PLUGIN_ID);

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
    expect(body).toMatchObject({ success: true, packageId: STUDIO_PLUGIN_ID });

    expect(studioExportStore.mounts.some((item) => item.id === STUDIO_PLUGIN_ID)).toBe(false);
  });

  it('keeps applyPolicy propose pending on second node until deployment is explicitly applied', async () => {
    const exported = await exportFromStudioNode('propose');
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    expect(exported.manifest.deployment.applyPolicy).toBe('propose');

    const { artifact, coordinator } = await loadLifecycleModules();
    await artifact.uploadPackageArtifact(exported.buffer, exported.fileName, 'admin');
    const install = await coordinator.install(STUDIO_PLUGIN_ID, 'admin@example.com');
    expect(install.success, (install as { error?: string }).error).toBe(true);
    if (!install.success) return;

    expect(install.deploymentStatus).toBe('pending');
    expect(fs.existsSync(deploymentAppliedPath(STUDIO_PLUGIN_ID))).toBe(false);
    expect(
      fs.existsSync(
        path.join('packages-storage', 'installed', `${STUDIO_PLUGIN_ID}.deployment-preview.json`),
      ),
    ).toBe(true);

    const apply = await coordinator.applyDeployment(STUDIO_PLUGIN_ID, 'admin@example.com', null);
    expect(apply.success, (apply as { error?: string }).error).toBe(true);
    if (!apply.success) return;
    expect(apply.deploymentStatus).toBe('applied');
    expect(appliedRows(STUDIO_PLUGIN_ID).mounts).toHaveLength(1);
  });

  it('uninstalls exported vertical-app from second node without orphan registry or runtime artifacts', async () => {
    const exported = await exportFromStudioNode('auto');
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const { artifact, coordinator } = await loadLifecycleModules();
    await artifact.uploadPackageArtifact(exported.buffer, exported.fileName, 'admin');
    expect((await coordinator.install(STUDIO_PLUGIN_ID, 'admin@example.com')).success).toBe(true);
    expect(appliedRows(STUDIO_PLUGIN_ID).mounts).toHaveLength(1);

    const uninstall = await coordinator.uninstall(STUDIO_PLUGIN_ID, 'admin@example.com');
    expect(uninstall.success, (uninstall as { error?: string }).error).toBe(true);
    if (!uninstall.success) return;

    expect(uninstall.status).toBe('not_installed');
    expect(fs.existsSync(deploymentAppliedPath(STUDIO_PLUGIN_ID))).toBe(false);
    expect(appliedRows(STUDIO_PLUGIN_ID).mounts).toHaveLength(0);
    expect(appliedRows(STUDIO_PLUGIN_ID).pageModules).toHaveLength(0);
    expect(fs.existsSync(path.join('packages-storage', 'runtimes', STUDIO_PLUGIN_ID, '1.0.0'))).toBe(false);
  });
});
