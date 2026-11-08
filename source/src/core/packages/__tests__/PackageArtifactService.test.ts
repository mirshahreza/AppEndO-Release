/**
 * PackageArtifactService integration tests
 *
 * Uses a real temporary directory on disk to exercise the full upload →
 * list → detail → delete flow without any mocking.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PACKAGE_ARTIFACT_MAX_BYTES, packageArtifactSizeLimitError } from '../packageArtifactLimits';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import AdmZip from 'adm-zip';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a valid ZIP buffer with a well-formed package.json inside.
 * integrity.artifactHash is retained as manifest metadata; artifact integrity
 * is verified against persisted bytes during upload.
 */
import { computePackageArtifactHashFromZip } from '../packageArtifactHash';

function buildValidZip(packageId: string, version: string): Buffer {
  const manifestBase = {
    $schemaVersion: '1.0',
    id: packageId,
    name: `Package ${packageId}`,
    version,
    requiredAppVersion: '>=1.0.0',
    capabilities: {
      apis: [
        {
          id: 'orders.list',
          method: 'GET',
          path: `/packages/${packageId}/orders`,
          entry: 'edge/orders.ts',
        },
      ],
      ui_components: [],
      db_objects: [],
      mcp_servers: [],
    },
    overridePolicy: { apis: 'deny', ui_components: 'deny', db_objects: 'deny' },
    integrity: {
      algorithm: 'sha256',
      artifactHash: '0'.repeat(64),
    },
  };

  const draftZip = new AdmZip();
  draftZip.addFile('package.json', Buffer.from(JSON.stringify(manifestBase)));
  const artifactHash = computePackageArtifactHashFromZip(draftZip);

  const manifest = {
    ...manifestBase,
    integrity: {
      algorithm: 'sha256',
      artifactHash,
    },
  };

  const zip = new AdmZip();
  zip.addFile('package.json', Buffer.from(JSON.stringify(manifest)));
  return zip.toBuffer();
}

// ---------------------------------------------------------------------------
// Test setup / teardown
// ---------------------------------------------------------------------------

let tmpDir = '';
let origCwd = '';

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'package-artifact-test-'));
  origCwd = process.cwd();
  process.chdir(tmpDir);
  // Reset module registry so each test gets a fresh import with the new CWD.
  // This is necessary because PACKAGE_STORAGE_ROOT resolves relative to CWD.
  vi.resetModules();
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.resetModules();
});

// Dynamic import AFTER chdir + resetModules so relative paths resolve to tmpDir.
async function loadService() {
  return import('../PackageArtifactService');
}

// ---------------------------------------------------------------------------
// Upload tests
// ---------------------------------------------------------------------------

describe('PackageArtifactService – uploadPackageArtifact', () => {
  it('rejects oversized file', async () => {
    const { uploadPackageArtifact } = await loadService();
    const bigBuf = Buffer.alloc(1);
    Object.defineProperty(bigBuf, 'length', { value: PACKAGE_ARTIFACT_MAX_BYTES + 1 });
    const result = await uploadPackageArtifact(bigBuf, 'big.zip', 'admin');
    expect(result.success).toBe(false);
    expect((result as any).error).toMatch(/512 MB/);
    expect(packageArtifactSizeLimitError(PACKAGE_ARTIFACT_MAX_BYTES + 1)).toMatch(/512 MB/);
  });

  it('rejects non-zip extension', async () => {
    const { uploadPackageArtifact } = await loadService();
    const result = await uploadPackageArtifact(Buffer.from('data'), 'package.tar.gz', 'admin');
    expect(result.success).toBe(false);
    expect((result as any).error).toMatch(/\.zip/);
  });

  it('rejects corrupt ZIP', async () => {
    const { uploadPackageArtifact } = await loadService();
    const result = await uploadPackageArtifact(Buffer.from('not-a-zip'), 'bad.zip', 'admin');
    expect(result.success).toBe(false);
    expect((result as any).error).toMatch(/parse ZIP/);
  });

  it('rejects ZIP without package.json', async () => {
    const { uploadPackageArtifact } = await loadService();
    const zip = new AdmZip();
    zip.addFile('readme.txt', Buffer.from('hello'));
    const result = await uploadPackageArtifact(zip.toBuffer(), 'nomanifest.zip', 'admin');
    expect(result.success).toBe(false);
    expect((result as any).error).toMatch(/package\.json/);
  });

  it('rejects manifest with validation errors', async () => {
    const { uploadPackageArtifact } = await loadService();
    const zip = new AdmZip();
    zip.addFile('package.json', Buffer.from(JSON.stringify({ $schemaVersion: '2.0' })));
    const result = await uploadPackageArtifact(zip.toBuffer(), 'bad-manifest.zip', 'admin');
    expect(result.success).toBe(false);
    expect((result as any).error).toMatch(/validation failed/);
  });

  it('rejects absolute-like unsafe zip entry paths', async () => {
    const { uploadPackageArtifact } = await loadService();
    const manifest = {
      $schemaVersion: '1.0',
      id: 'ecommerce-core',
      name: 'Plugin ecommerce-core',
      version: '1.0.1',
      requiredAppVersion: '>=1.0.0',
      capabilities: {
        apis: [{ id: 'orders.list', method: 'GET', path: '/packages/ecommerce-core/orders', entry: 'edge/orders.ts' }],
        ui_components: [],
        db_objects: [],
        mcp_servers: [],
      },
      overridePolicy: { apis: 'deny', ui_components: 'deny', db_objects: 'deny' },
      integrity: { algorithm: 'sha256', artifactHash: crypto.randomBytes(32).toString('hex') },
    };

    const zip = new AdmZip();
    zip.addFile('package.json', Buffer.from(JSON.stringify(manifest)));
    zip.addFile('C:/windows/path.txt', Buffer.from('x'));

    const result = await uploadPackageArtifact(zip.toBuffer(), 'unsafe-path.zip', 'admin');
    expect(result.success).toBe(false);
    expect((result as any).error).toMatch(/unsafe entry path/i);
  });

  it('uploads a valid package artifact and persists files', async () => {
    const { uploadPackageArtifact, listPackages, getPackageDetail } = await loadService();
    const buf = buildValidZip('ecommerce-core', '1.0.0');
    const result = await uploadPackageArtifact(buf, 'ecommerce-core-1.0.0.zip', 'admin');

    expect(result.success, (result as any).error).toBe(true);
    if (!result.success) return;
    expect(result.packageId).toBe('ecommerce-core');
    expect(result.version).toBe('1.0.0');
    expect(result.artifactSha256).toHaveLength(64);

    // Artifact file on disk
    const artifactPath = path.join(tmpDir, 'packages-storage', 'artifacts', 'ecommerce-core', '1.0.0.zip');
    expect(fs.existsSync(artifactPath)).toBe(true);

    // Manifest file on disk
    const manifestPath = path.join(tmpDir, 'packages-storage', 'manifests', 'ecommerce-core', '1.0.0.manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    // Index updated
    const items = listPackages();
    expect(items.some(p => p.packageId === 'ecommerce-core')).toBe(true);

    // Detail
    const detail = getPackageDetail('ecommerce-core');
    expect(detail).not.toBeNull();
    expect(detail!.version).toBe('1.0.0');
    expect(detail!.catalogVersions).toEqual(['1.0.0']);
    expect(detail!.installStatus).toBe('not_installed');
  });

  it('rejects duplicate packageId+version', async () => {
    const { uploadPackageArtifact } = await loadService();
    const buf = buildValidZip('ecommerce-core', '1.0.0');
    await uploadPackageArtifact(buf, 'ec.zip', 'admin');
    const result = await uploadPackageArtifact(buf, 'ec.zip', 'admin');
    expect(result.success).toBe(false);
    expect((result as any).error).toMatch(/already exists/);
  });

  it('allows multiple versions of same package', async () => {
    const { uploadPackageArtifact, getPackageDetail, listPackages } = await loadService();
    const buf1 = buildValidZip('ecommerce-core', '1.0.0');
    const buf2 = buildValidZip('ecommerce-core', '1.1.0');
    await uploadPackageArtifact(buf1, 'ec-1.0.0.zip', 'admin');
    await uploadPackageArtifact(buf2, 'ec-1.1.0.zip', 'admin');

    const items = listPackages();
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.version).sort()).toEqual(['1.0.0', '1.1.0']);

    const detail = getPackageDetail('ecommerce-core', '1.1.0');
    expect(detail?.catalogVersions).toEqual(expect.arrayContaining(['1.0.0', '1.1.0']));
  });
});

// ---------------------------------------------------------------------------
// List tests
// ---------------------------------------------------------------------------

describe('PackageArtifactService – listPackages', () => {
  it('returns empty list when no plugins uploaded', async () => {
    const { listPackages } = await loadService();
    expect(listPackages()).toEqual([]);
  });

  it('returns installStatus=not_installed for fresh uploads', async () => {
    const { uploadPackageArtifact, listPackages } = await loadService();
    const buf = buildValidZip('ecommerce-core', '1.0.0');
    await uploadPackageArtifact(buf, 'ec.zip', 'admin');
    const items = listPackages();
    expect(items[0].installStatus).toBe('not_installed');
    expect(items[0].activeInstalledVersion).toBeNull();
  });

  it('resolves technical createdBy labels for display using upload actor', async () => {
    const { uploadPackageArtifact, listPackages } = await loadService();
    const buf = buildValidZip('ecommerce-core', '2.0.0');
    await uploadPackageArtifact(buf, 'ec-2.0.0.zip', 'admin', {
      createdBy: 'install-remote-hubs',
    });

    const items = listPackages();
    const row = items.find((item) => item.version === '2.0.0');
    expect(row?.createdBy).toBe('admin');
  });

  it('returns createdAt and createdBy per catalog version row', async () => {
    const { uploadPackageArtifact, listPackages } = await loadService();
    const buf1 = buildValidZip('ecommerce-core', '1.0.0');
    const buf2 = buildValidZip('ecommerce-core', '1.1.0');
    await uploadPackageArtifact(buf1, 'ec-1.0.0.zip', 'admin');
    await uploadPackageArtifact(buf2, 'ec-1.1.0.zip', 'other-user');

    const items = listPackages();
    expect(items).toHaveLength(2);

    const v100 = items.find((item) => item.version === '1.0.0');
    const v110 = items.find((item) => item.version === '1.1.0');
    expect(v100?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(v100?.createdBy).toBe('admin');
    expect(v110?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(v110?.createdBy).toBe('other-user');
  });

  it('recovers missing manifest from zip artifact during list', async () => {
    const { uploadPackageArtifact, listPackages } = await loadService();
    const buf = buildValidZip('ecommerce-core', '1.0.0');
    await uploadPackageArtifact(buf, 'ec.zip', 'admin');

    const manifestPath = path.join(tmpDir, 'packages-storage', 'manifests', 'ecommerce-core', '1.0.0.manifest.json');
    fs.rmSync(manifestPath, { force: true });
    expect(fs.existsSync(manifestPath)).toBe(false);

    const items = listPackages();
    expect(items).toHaveLength(1);
    expect(fs.existsSync(manifestPath)).toBe(true);
    expect(items[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('backfills missing createdBy from cached manifest during list', async () => {
    const { listPackages } = await loadService();
    const packageId = 'ecommerce-core';
    const version = '1.0.0';
    const buf = buildValidZip(packageId, version);

    const artifactDir = path.join(tmpDir, 'packages-storage', 'artifacts', packageId);
    fs.mkdirSync(artifactDir, { recursive: true });
    const artifactPath = path.join(artifactDir, `${version}.zip`);
    fs.writeFileSync(artifactPath, buf);

    const manifestDir = path.join(tmpDir, 'packages-storage', 'manifests', packageId);
    fs.mkdirSync(manifestDir, { recursive: true });
    const manifestPath = path.join(manifestDir, `${version}.manifest.json`);
    const zipManifest = JSON.parse(new AdmZip(buf).readAsText('package.json')) as Record<string, unknown>;
    fs.writeFileSync(manifestPath, JSON.stringify({
      ...zipManifest,
      createdAt: '2026-01-15T10:00:00.000Z',
      createdBy: 'manifest-author',
    }, null, 2));

    const indexPath = path.join(tmpDir, 'packages-storage', 'index.json');
    fs.mkdirSync(path.dirname(indexPath), { recursive: true });
    fs.writeFileSync(indexPath, JSON.stringify({
      schema: 'package-index',
      schemaVersion: '1.0.0',
      updatedAt: new Date().toISOString(),
      packages: [{
        packageId,
        displayName: 'Package ecommerce-core',
        latestVersion: version,
        versions: [{
          version,
          artifactPath: `artifacts/${packageId}/${version}.zip`,
          manifestPath: `manifests/${packageId}/${version}.manifest.json`,
          artifactSha256: crypto.createHash('sha256').update(buf).digest('hex'),
          requiredAppVersion: '>=1.0.0',
        }],
      }],
    }, null, 2));

    const items = listPackages();
    expect(items).toHaveLength(1);
    expect(items[0].createdAt).toBe('2026-01-15T10:00:00.000Z');
    expect(items[0].createdBy).toBe('manifest-author');
  });

  it('backfills missing createdBy from upload event actor during list', async () => {
    const { listPackages } = await loadService();
    const packageId = 'ecommerce-core';
    const version = '1.0.0';
    const buf = buildValidZip(packageId, version);

    const artifactDir = path.join(tmpDir, 'packages-storage', 'artifacts', packageId);
    fs.mkdirSync(artifactDir, { recursive: true });
    const artifactPath = path.join(artifactDir, `${version}.zip`);
    fs.writeFileSync(artifactPath, buf);

    const manifestDir = path.join(tmpDir, 'packages-storage', 'manifests', packageId);
    fs.mkdirSync(manifestDir, { recursive: true });
    fs.writeFileSync(path.join(manifestDir, `${version}.manifest.json`), JSON.stringify({
      id: packageId,
      name: `Package ${packageId}`,
      version,
      requiredAppVersion: '>=1.0.0',
      createdAt: '2026-01-15T10:00:00.000Z',
      capabilities: { apis: [], ui_components: [], db_objects: [] },
    }, null, 2));

    const eventsDir = path.join(tmpDir, 'packages-storage', 'events');
    fs.mkdirSync(eventsDir, { recursive: true });
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    fs.writeFileSync(path.join(eventsDir, `events-${month}.jsonl`), `${JSON.stringify({
      schema: 'package-event',
      schemaVersion: '1.1.0',
      type: 'package.artifact.uploaded',
      packageId,
      version,
      actor: 'uploader@example.com',
    })}\n`);

    const indexPath = path.join(tmpDir, 'packages-storage', 'index.json');
    fs.mkdirSync(path.dirname(indexPath), { recursive: true });
    fs.writeFileSync(indexPath, JSON.stringify({
      schema: 'package-index',
      schemaVersion: '1.0.0',
      updatedAt: new Date().toISOString(),
      packages: [{
        packageId,
        displayName: 'Package ecommerce-core',
        latestVersion: version,
        versions: [{
          version,
          artifactPath: `artifacts/${packageId}/${version}.zip`,
          manifestPath: `manifests/${packageId}/${version}.manifest.json`,
          artifactSha256: crypto.createHash('sha256').update(buf).digest('hex'),
          requiredAppVersion: '>=1.0.0',
          createdAt: '2026-01-15T10:00:00.000Z',
        }],
      }],
    }, null, 2));

    const items = listPackages();
    expect(items).toHaveLength(1);
    expect(items[0].createdBy).toBe('uploader@example.com');
  });

  it('backfills missing createdAt from artifact mtime during list', async () => {
    const { listPackages } = await loadService();
    const packageId = 'ecommerce-core';
    const version = '1.0.0';
    const buf = buildValidZip(packageId, version);

    const artifactDir = path.join(tmpDir, 'packages-storage', 'artifacts', packageId);
    fs.mkdirSync(artifactDir, { recursive: true });
    const artifactPath = path.join(artifactDir, `${version}.zip`);
    fs.writeFileSync(artifactPath, buf);

    const indexPath = path.join(tmpDir, 'packages-storage', 'index.json');
    fs.mkdirSync(path.dirname(indexPath), { recursive: true });
    fs.writeFileSync(indexPath, JSON.stringify({
      schema: 'package-index',
      schemaVersion: '1.0.0',
      updatedAt: new Date().toISOString(),
      packages: [{
        packageId,
        displayName: 'Package ecommerce-core',
        latestVersion: version,
        versions: [{
          version,
          artifactPath: `artifacts/${packageId}/${version}.zip`,
          manifestPath: `manifests/${packageId}/${version}.manifest.json`,
          artifactSha256: crypto.createHash('sha256').update(buf).digest('hex'),
          requiredAppVersion: '>=1.0.0',
          createdAt: '',
        }],
      }],
    }, null, 2));

    const items = listPackages();
    expect(items).toHaveLength(1);
    expect(items[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('lists an installed version even when it is missing from the catalog index', async () => {
    const { uploadPackageArtifact, listPackages, getPackageDetail } = await loadService();
    const buf = buildValidZip('ecommerce-core', '1.2.0');
    await uploadPackageArtifact(buf, 'ec-1.2.0.zip', 'admin');

    const leftover = buildValidZip('ecommerce-core', '1.1.0');
    const leftoverDir = path.join(tmpDir, 'packages-storage', 'artifacts', 'ecommerce-core');
    fs.mkdirSync(leftoverDir, { recursive: true });
    fs.writeFileSync(path.join(leftoverDir, '1.1.0.zip'), leftover);

    const stateDir = path.join(tmpDir, 'packages-storage', 'installed');
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(
      path.join(stateDir, 'ecommerce-core.install-state.json'),
      JSON.stringify({
        schema: 'package-install-state',
        schemaVersion: '1.0.0',
        packageId: 'ecommerce-core',
        status: 'installed',
        activeVersion: '1.1.0',
        updatedAt: new Date().toISOString(),
      }),
    );

    const items = listPackages();
    const installed = items.find((item) => item.version === '1.1.0');
    const latest = items.find((item) => item.version === '1.2.0');
    expect(installed?.installStatus).toBe('installed');
    expect(installed?.activeInstalledVersion).toBe('1.1.0');
    expect(latest?.installStatus).toBe('not_installed');
    expect(latest?.activeInstalledVersion).toBe('1.1.0');

    const detail = getPackageDetail('ecommerce-core', '1.1.0');
    expect(detail?.installStatus).toBe('installed');
    expect(detail?.catalogVersions).toEqual(expect.arrayContaining(['1.1.0', '1.2.0']));
  });
});

// ---------------------------------------------------------------------------
// Detail tests
// ---------------------------------------------------------------------------

describe('PackageArtifactService – getPackageDetail', () => {
  it('returns null for unknown package', async () => {
    const { getPackageDetail } = await loadService();
    expect(getPackageDetail('nonexistent')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Delete tests
// ---------------------------------------------------------------------------

describe('PackageArtifactService – deletePackage', () => {
  it('deletes a not-installed package successfully', async () => {
    const { uploadPackageArtifact, deletePackage, listPackages } = await loadService();
    const buf = buildValidZip('ecommerce-core', '1.0.0');
    await uploadPackageArtifact(buf, 'ec.zip', 'admin');

    const result = deletePackage('ecommerce-core', 'admin');
    expect(result.success, (result as any).error).toBe(true);
    expect(listPackages()).toHaveLength(0);

    const artifactDir = path.join(tmpDir, 'packages-storage', 'artifacts', 'ecommerce-core');
    expect(fs.existsSync(artifactDir)).toBe(false);
  });

  it('rejects delete for unknown package', async () => {
    const { deletePackage } = await loadService();
    const result = deletePackage('nonexistent', 'admin');
    expect(result.success).toBe(false);
    expect((result as any).error).toMatch(/not found/);
  });

  it('rejects delete when package is installed', async () => {
    const { uploadPackageArtifact, deletePackage } = await loadService();
    const buf = buildValidZip('ecommerce-core', '1.0.0');
    await uploadPackageArtifact(buf, 'ec.zip', 'admin');

    // Simulate active install by writing install-state file
    const stateDir = path.join(tmpDir, 'packages-storage', 'installed');
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(
      path.join(stateDir, 'ecommerce-core.install-state.json'),
      JSON.stringify({
        schema: 'package-install-state',
        schemaVersion: '1.0.0',
        packageId: 'ecommerce-core',
        status: 'installed',
        activeVersion: '1.0.0',
        updatedAt: new Date().toISOString(),
      }),
    );

    const result = deletePackage('ecommerce-core', 'admin');
    expect(result.success).toBe(false);
    expect((result as any).error).toMatch(/installed/);
  });
});
