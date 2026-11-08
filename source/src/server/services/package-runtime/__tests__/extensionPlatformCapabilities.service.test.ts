import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdmZip from 'adm-zip';

const tempRoots: string[] = [];

const navigationStore = vi.hoisted(() => new Map<string, unknown>());

vi.mock('../../../../core/platform-registry/PlatformRegistryFileStore', () => ({
  deleteNavigationFile: vi.fn((id: string) => {
    navigationStore.delete(id);
  }),
  readNavigationFile: vi.fn((id: string) => navigationStore.get(id) ?? null),
  readShellFile: vi.fn(() => null),
  writeShellFile: vi.fn(),
  withPlatformRegistryLock: vi.fn((fn: () => void) => fn()),
  writeNavigationFile: vi.fn((manifest: { id: string }) => {
    navigationStore.set(manifest.id, manifest);
  }),
}));

vi.mock('../../../../core/platform-registry/loadPlatformRegistryDefaults', () => ({
  loadPlatformRegistryDefaultShells: vi.fn(() => []),
}));

vi.mock('../../../../core/platform-registry/platformRegistryDefaults', () => ({
  restoreCoreNavigationManifests: vi.fn(),
}));

vi.mock('../../platform/platformRuntimeConfig.service', () => ({
  invalidatePlatformRuntimeConfig: vi.fn(),
}));

vi.mock('../../platform/compileExperienceManifest', () => ({
  compileExperienceManifest: vi.fn(async () => ({
    navigationIds: ['my-portal'],
    shellKeys: ['my-portal'],
    routeBindingIds: [101],
    pageModulesCreated: 0,
    pageModulesUpdated: 0,
    bindingsRemoved: 0,
  })),
}));

vi.mock('../../../domain/platform/routeBindingRepository', () => ({
  deletePlatformRouteBinding: vi.fn(async () => undefined),
}));

vi.mock('../../../domain/platform/shellRepository', () => ({
  deletePlatformShell: vi.fn(async () => undefined),
  updatePlatformShell: vi.fn(async () => undefined),
}));

function createTempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-platform-caps-'));
  tempRoots.push(root);
  return root;
}

describe('extensionPlatformCapabilities.service', () => {
  beforeEach(() => {
    navigationStore.clear();
    vi.resetModules();
  });

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
    delete process.env.PACKAGE_STORAGE_ROOT;
  });

  it('publishes navigation manifests on apply and removes them on rollback', async () => {
    const storageRoot = createTempRoot();
    process.env.PACKAGE_STORAGE_ROOT = storageRoot;

    const {
      packageDirs,
      writePackageIndex,
      readPlatformCapabilitiesApplied,
    } = await import('../../../../core/packages/PackageFileStore');
    const {
      applyExtensionPlatformCapabilities,
      rollbackExtensionPlatformCapabilities,
    } = await import('../extensionPlatformCapabilities.service');

    const packageId = 'pkg-nav-test';
    const version = '1.0.0';
    const navigationEntry = 'platform/navigations/my-test.json';
    const navigationManifest = {
      id: 'my-test',
      version: '1',
      groups: [{ heading: 'Group', order: 0, items: [] }],
    };

    fs.mkdirSync(path.join(packageDirs.artifacts, packageId), { recursive: true });
    const zip = new AdmZip();
    zip.addFile(
      navigationEntry,
      Buffer.from(`${JSON.stringify(navigationManifest, null, 2)}\n`, 'utf8'),
    );
    zip.writeZip(path.join(packageDirs.artifacts, packageId, `${version}.zip`));

    writePackageIndex({
      schema: 'package-index',
      schemaVersion: '1.0.0',
      packages: [{
        packageId,
        displayName: 'Nav Test',
        latestVersion: version,
        versions: [{
          version,
          artifactPath: `artifacts/${packageId}/${version}.zip`,
          manifestPath: `manifests/${packageId}/${version}.manifest.json`,
          artifactSha256: 'a'.repeat(64),
          requiredAppVersion: '1.0.0',
        }],
      }],
    });

    const manifest = {
      $schemaVersion: '1.0',
      id: packageId,
      name: 'Nav Test',
      version,
      requiredAppVersion: '1.0.0',
      capabilities: {
        apis: [{ id: 'get-x', method: 'GET', path: '/packages/pkg-nav-test/x', entry: 'api/x.ts' }],
        ui_components: [],
        db_objects: [],
        mcp_servers: [],
        edge_models: [],
        edge_apis: [],
        edge_model_studio_meta: [],
        install_hooks: [],
        navigations: [{ id: 'my-test', entry: navigationEntry }],
      },
      overridePolicy: { apis: 'deny', ui_components: 'deny', db_objects: 'deny' },
      integrity: { algorithm: 'sha256', artifactHash: 'b'.repeat(64) },
    } as const;

    const applyResult = await applyExtensionPlatformCapabilities(packageId, version, manifest);
    expect(applyResult).toEqual({ ok: true });
    expect(navigationStore.has('my-test')).toBe(true);
    expect(readPlatformCapabilitiesApplied(packageId)?.navigations).toEqual(['my-test']);

    await rollbackExtensionPlatformCapabilities(packageId, manifest);
    expect(navigationStore.has('my-test')).toBe(false);
    expect(readPlatformCapabilitiesApplied(packageId)).toBeNull();
  });

  it('applies extension portals without requiring built-in home/studio/component-alone', async () => {
    const storageRoot = createTempRoot();
    process.env.PACKAGE_STORAGE_ROOT = storageRoot;

    const {
      packageDirs,
      writePackageIndex,
      readPlatformCapabilitiesApplied,
    } = await import('../../../../core/packages/PackageFileStore');
    const { compileExperienceManifest } = await import('../../platform/compileExperienceManifest');
    const {
      applyExtensionPlatformCapabilities,
    } = await import('../extensionPlatformCapabilities.service');

    const packageId = 'pkg-portal-test';
    const version = '1.0.0';
    const portalEntry = 'platform/portals/my-test.json';
    const portalManifest = {
      segment: 'my-test',
      name: 'My Test',
      shellKey: 'my-test',
      entryMode: 'shell',
      enabled: true,
      auth: { accessMode: 'authenticated', allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
      pages: [{ path: 'my-test/home', pageKey: 'home' }],
    };

    fs.mkdirSync(path.join(packageDirs.artifacts, packageId), { recursive: true });
    const zip = new AdmZip();
    zip.addFile(
      portalEntry,
      Buffer.from(`${JSON.stringify(portalManifest, null, 2)}\n`, 'utf8'),
    );
    zip.writeZip(path.join(packageDirs.artifacts, packageId, `${version}.zip`));

    writePackageIndex({
      schema: 'package-index',
      schemaVersion: '1.0.0',
      packages: [{
        packageId,
        displayName: 'Portal Test',
        latestVersion: version,
        versions: [{
          version,
          artifactPath: `artifacts/${packageId}/${version}.zip`,
          manifestPath: `manifests/${packageId}/${version}.manifest.json`,
          artifactSha256: 'a'.repeat(64),
          requiredAppVersion: '1.0.0',
        }],
      }],
    });

    const manifest = {
      $schemaVersion: '1.0',
      id: packageId,
      name: 'Portal Test',
      version,
      requiredAppVersion: '1.0.0',
      capabilities: {
        apis: [{ id: 'get-x', method: 'GET', path: '/packages/pkg-portal-test/x', entry: 'api/x.ts' }],
        ui_components: [],
        db_objects: [],
        mcp_servers: [],
        edge_models: [],
        edge_apis: [],
        edge_model_studio_meta: [],
        install_hooks: [],
        portals: [{ segment: 'my-test', entry: portalEntry }],
      },
      overridePolicy: { apis: 'deny', ui_components: 'deny', db_objects: 'deny' },
      integrity: { algorithm: 'sha256', artifactHash: 'b'.repeat(64) },
    } as const;

    const applyResult = await applyExtensionPlatformCapabilities(packageId, version, manifest);
    expect(applyResult).toEqual({ ok: true });
    expect(readPlatformCapabilitiesApplied(packageId)?.portals).toEqual(['my-test']);
    expect(compileExperienceManifest).toHaveBeenCalledWith(
      expect.objectContaining({
        id: packageId,
        portals: [expect.objectContaining({ segment: 'my-test' })],
      }),
      expect.objectContaining({ username: `package:${packageId}` }),
    );
  });
});
