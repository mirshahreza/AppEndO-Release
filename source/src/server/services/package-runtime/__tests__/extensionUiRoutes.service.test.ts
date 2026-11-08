import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { PackageManifest } from '../../../../core/packages/PackageManifestValidator';
import {
  applyExtensionUiRoutes,
  buildExtensionUiRoutesPreview,
  collectExtensionUiRoutesConflicts,
  confirmExtensionUiRoutes,
} from '../extensionUiRoutes.service';
import { deploymentAppliedPath } from '../../../../core/packages/testkit/deploymentAppliedAssertions';

const platformStore = vi.hoisted(() => ({
  mounts: new Map<string, { id: string }>(),
  pageModules: new Map<string, string>(),
  routeBindings: new Map<string, string>(),
}));

vi.mock('../../../domain/platform/mountRepository', () => ({
  findPlatformMountById: async (mountId: string) => {
    const mount = platformStore.mounts.get(mountId);
    return mount ? { id: mount.id } : undefined;
  },
}));

vi.mock('../deploymentConflictScan', () => ({
  CORE_PLATFORM_OWNER: '__core__',
  findEffectivePageModuleOwner: async (pageKey: string) => platformStore.pageModules.get(pageKey) ?? null,
  findEffectiveRouteBindingOwner: async (mountId: string, routePattern: string) =>
    platformStore.routeBindings.get(`${mountId}::${routePattern}`) ?? null,
}));

vi.mock('../../platform/platformRuntimeConfig.service', () => ({
  invalidatePlatformRuntimeConfig: vi.fn(),
}));

function buildManifest(packageId: string): PackageManifest {
  return {
    $schemaVersion: '1.0',
    id: packageId,
    name: 'Demo Routes',
    version: '1.0.0',
    requiredAppVersion: '>=1.0.0',
    capabilities: {
      apis: [],
      ui_components: [],
      ui_routes: [{
        pageKey: 'hello-page',
        entry: 'ui/HelloPage.js',
        suggestedRoutePattern: 'packages/demo/hello-page',
      }],
      db_objects: [],
      mcp_servers: [],
      edge_models: [],
      edge_apis: [],
      edge_model_studio_meta: [],
      install_hooks: [],
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
  };
}

let tmpDir = '';
let origCwd = '';

describe('extensionUiRoutes.service', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'extension-ui-routes-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);
    fs.mkdirSync('packages-storage/installed', { recursive: true });
    fs.mkdirSync('packages-storage/deployments', { recursive: true });
    fs.mkdirSync('packages-storage/tmp', { recursive: true });
    platformStore.mounts.clear();
    platformStore.pageModules.clear();
    platformStore.routeBindings.clear();
    platformStore.mounts.set('studio', { id: 'studio' });
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('builds extension ui routes preview with studio mount default', () => {
    const preview = buildExtensionUiRoutesPreview('demo-routes', '1.0.0', buildManifest('demo-routes'));
    expect(preview.schema).toBe('package-ui-routes-preview');
    expect(preview.routes[0]).toMatchObject({
      pageKey: 'hello-page',
      mountId: 'studio',
      routePattern: 'packages/demo/hello-page',
      loaderRef: 'demo-routes:hello-page',
    });
  });

  it('detects route binding conflicts', async () => {
    platformStore.routeBindings.set('studio::packages/demo/hello-page', 'other-package');
    const conflicts = await collectExtensionUiRoutesConflicts('demo-routes', buildManifest('demo-routes'));
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.message).toContain('owned by');
  });

  it('writes pending preview on apply', async () => {
    const result = await applyExtensionUiRoutes('demo-routes', '1.0.0', buildManifest('demo-routes'), null);
    expect(result).toEqual({ ok: true, status: 'pending' });
    const previewPath = path.join('packages-storage', 'installed', 'demo-routes.deployment-preview.json');
    expect(fs.existsSync(previewPath)).toBe(true);
  });

  it('writes deployment-applied file on confirm', async () => {
    await applyExtensionUiRoutes('demo-routes', '1.0.0', buildManifest('demo-routes'), null);
    const result = await confirmExtensionUiRoutes('demo-routes', '1.0.0', buildManifest('demo-routes'), null);
    expect(result).toEqual({ ok: true, status: 'applied' });
    expect(fs.existsSync(deploymentAppliedPath('demo-routes'))).toBe(true);
    const applied = JSON.parse(fs.readFileSync(deploymentAppliedPath('demo-routes'), 'utf8'));
    expect(applied.kind).toBe('extension-ui-routes');
    expect(applied.routes[0]?.pageKey).toBe('hello-page');
  });

  it('adopts existing designer pages instead of conflicting or overlaying package routes', async () => {
    platformStore.pageModules.set('hello-page', '__core__');
    const conflicts = await collectExtensionUiRoutesConflicts('demo-routes', buildManifest('demo-routes'));
    expect(conflicts).toHaveLength(0);
    const result = await applyExtensionUiRoutes('demo-routes', '1.0.0', buildManifest('demo-routes'), null);
    expect(result).toEqual({ ok: true, status: 'applied' });
    expect(fs.existsSync(path.join('packages-storage', 'installed', 'demo-routes.deployment-preview.json'))).toBe(false);
    expect(fs.existsSync(deploymentAppliedPath('demo-routes'))).toBe(false);
  });

  it('adopts a packed designer path that collapses to an existing page', async () => {
    platformStore.pageModules.set('cms-contents-list', '__core__');
    const manifest = buildManifest('cms');
    manifest.capabilities.ui_routes = [{
      pageKey: 'general-cms-contents-list',
      entry: 'ui/general/cms-contents-list.tsx',
      suggestedRoutePattern: 'general/cms-contents-list',
    }];
    const conflicts = await collectExtensionUiRoutesConflicts('cms', manifest);
    expect(conflicts).toHaveLength(0);
    const result = await applyExtensionUiRoutes('cms', '1.2.1', manifest, null);
    expect(result).toEqual({ ok: true, status: 'applied' });
  });
});
