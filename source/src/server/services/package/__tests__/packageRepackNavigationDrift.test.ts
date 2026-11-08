import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdmZip from 'adm-zip';
import { computePackageArtifactHashFromZip } from '../../../../core/packages/packageArtifactHash';
import { resolveApiMetaEntryPath } from '../../../../core/packages/packageApiMetaSidecar';

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

let tmpDir = '';
let origCwd = '';

beforeEach(() => {
  navigationStore.clear();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-repack-nav-'));
  origCwd = process.cwd();
  process.chdir(tmpDir);
  vi.resetModules();
});

afterEach(() => {
  process.chdir(origCwd);
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {
    // Windows may briefly lock package-storage handles
  }
  vi.resetModules();
});

describe('package repack navigation drift', () => {
  it('detects navigation edits stored in platform registry', async () => {
    const {
      packageDirs,
      writePackageIndex,
      writePlatformCapabilitiesApplied,
    } = await import('../../../../core/packages/PackageFileStore');
    const { writeInstallState } = await import('../../../domain/package-domain/installStateRepository');
    const { previewPackageRepackDrift } = await import('../packageRepack.service');

    const packageId = 'repack-nav-pack';
    const version = '1.0.0';
    const navigationId = 'crm-menu';
    const navigationEntry = `platform/navigations/${navigationId}.json`;
    const navigationManifest = {
      id: navigationId,
      version: '1',
      portalSegment: 'crm',
      groups: [{ heading: 'Main', order: 0, items: [] }],
    };

    const apiEntry = 'edge/health.js';
    const zip = new AdmZip();
    zip.addFile(
      navigationEntry,
      Buffer.from(`${JSON.stringify(navigationManifest, null, 2)}\n`, 'utf8'),
    );
    zip.addFile(apiEntry, Buffer.from('export default async function handler() {}\n', 'utf8'));
    zip.addFile(
      resolveApiMetaEntryPath(apiEntry),
      Buffer.from(`${JSON.stringify({
        schema: 'package-api-meta',
        schemaVersion: '1.0.0',
        auth: 'public',
        timeoutMs: 10_000,
        engineType: 'SANDBOX_JS',
      }, null, 2)}\n`, 'utf8'),
    );

    const manifest = {
      $schemaVersion: '1.0',
      id: packageId,
      name: 'Repack Nav Pack',
      version,
      requiredAppVersion: '>=1.0.0',
      capabilities: {
        apis: [{
          id: 'health',
          method: 'GET',
          path: `/packages/${packageId}/health`,
          entry: apiEntry,
          auth: 'public',
        }],
        ui_components: [],
        db_objects: [],
        mcp_servers: [],
        navigations: [{ id: navigationId, entry: navigationEntry }],
      },
      overridePolicy: {
        apis: 'deny',
        ui_components: 'deny',
        db_objects: 'deny',
        mcp_servers: 'deny',
      },
      integrity: {
        algorithm: 'sha256',
        artifactHash: computePackageArtifactHashFromZip(zip),
      },
    };

    zip.addFile('package.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'));

    const artifactRelPath = `artifacts/${packageId}/${version}.zip`;
    const manifestRelPath = `manifests/${packageId}/${version}.manifest.json`;
    fs.mkdirSync(path.join(packageDirs.artifacts, packageId), { recursive: true });
    fs.mkdirSync(path.join(packageDirs.manifests, packageId), { recursive: true });
    zip.writeZip(path.join(packageDirs.root, artifactRelPath));
    fs.writeFileSync(
      path.join(packageDirs.root, manifestRelPath),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8',
    );

    writePackageIndex({
      schema: 'package-index',
      schemaVersion: '1.0.0',
      packages: [{
        packageId,
        displayName: 'Repack Nav Pack',
        versions: [{
          version,
          artifactPath: artifactRelPath,
          manifestPath: manifestRelPath,
          artifactSha256: 'a'.repeat(64),
          requiredAppVersion: '1.0.0',
          createdAt: new Date().toISOString(),
        }],
      }],
    });

    writeInstallState({
      schema: 'package-install-state',
      schemaVersion: '1.0.0',
      packageId,
      status: 'installed',
      activeVersion: version,
      pluginKind: 'extension',
      updatedAt: new Date().toISOString(),
    });

    writePlatformCapabilitiesApplied({
      schema: 'package-platform-capabilities-applied',
      schemaVersion: '1.0.0',
      packageId,
      version,
      appliedAt: new Date().toISOString(),
      navigations: [navigationId],
      portals: [],
    });

    navigationStore.set(navigationId, {
      ...navigationManifest,
      groups: [{
        heading: 'Main',
        order: 0,
        items: [{ label: 'Updated item', pageKey: 'crm-home', order: 1 }],
      }],
    });

    const drift = previewPackageRepackDrift(packageId);
    expect('ok' in drift && drift.ok === false).toBe(false);
    if ('ok' in drift && drift.ok === false) {
      throw new Error('unexpected drift preview failure');
    }

    expect(drift.hasChanges).toBe(true);
    expect(drift.changedByCategory.navigations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemId: `navigation:${navigationId}`,
          label: navigationId,
          entryPath: navigationEntry,
        }),
      ]),
    );
  });
});

describe('package repack vertical-app drift', () => {
  it('previews drift when capabilities omit ui_components (vertical-app)', async () => {
    const {
      packageDirs,
      writePackageIndex,
      writePlatformCapabilitiesApplied,
    } = await import('../../../../core/packages/PackageFileStore');
    const { writeInstallState } = await import('../../../domain/package-domain/installStateRepository');
    const { previewPackageRepackDrift } = await import('../packageRepack.service');
    const { buildVerticalAppManifest, buildVerticalAppZipBuffer } = await import(
      '../../../../core/packages/testkit/verticalAppPackageBuilder'
    );

    const packageId = 'repack-vertical-app';
    const version = '1.0.0';
    const spec = {
      packageId,
      name: 'Repack Vertical App',
      version,
      pathPrefix: '/repack-vertical',
      pages: [{ pageKey: 'home', title: 'Home' }],
    };
    const manifest = buildVerticalAppManifest(spec);
    const zipBuffer = buildVerticalAppZipBuffer(spec);
    const zip = new AdmZip(zipBuffer);

    const manifestPath = `manifests/${packageId}/${version}.manifest.json`;
    const artifactPath = `artifacts/${packageId}/${version}.zip`;
    fs.mkdirSync(path.join(packageDirs.manifests, packageId), { recursive: true });
    fs.mkdirSync(path.join(packageDirs.artifacts, packageId), { recursive: true });
    fs.writeFileSync(
      path.join(packageDirs.root, manifestPath),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8',
    );
    fs.writeFileSync(path.join(packageDirs.root, artifactPath), zipBuffer);

    writePackageIndex({
      schema: 'package-index',
      schemaVersion: '1.0.0',
      packages: [{
        packageId,
        displayName: manifest.name,
        versions: [{
          version,
          manifestPath,
          artifactPath,
          artifactSha256: computePackageArtifactHashFromZip(zip),
          requiredAppVersion: '1.0.0',
          createdAt: new Date().toISOString(),
        }],
      }],
    });
    writeInstallState({
      schema: 'package-install-state',
      schemaVersion: '1.0.0',
      packageId,
      status: 'installed',
      activeVersion: version,
      pluginKind: 'vertical-app',
      updatedAt: new Date().toISOString(),
    });
    writePlatformCapabilitiesApplied({
      schema: 'package-platform-capabilities-applied',
      schemaVersion: '1.0.0',
      packageId,
      version,
      appliedAt: new Date().toISOString(),
      navigations: [],
      portals: [],
    });

    const drift = previewPackageRepackDrift(packageId);
    expect('ok' in drift && drift.ok === false).toBe(false);
    if ('ok' in drift && drift.ok === false) {
      throw new Error('unexpected drift preview failure');
    }

    expect(drift.baseVersion).toBe(version);
    expect(drift.pluginKind).toBe('vertical-app');
  });
});
