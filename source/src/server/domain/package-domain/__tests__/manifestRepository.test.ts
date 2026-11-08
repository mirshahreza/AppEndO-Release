import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdmZip from 'adm-zip';
import { computePackageArtifactHashFromZip } from '../../../../core/packages/packageArtifactHash';

let tmpDir = '';
let origCwd = '';

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-repo-'));
  origCwd = process.cwd();
  process.chdir(tmpDir);
  vi.resetModules();
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.resetModules();
});

function buildZip(packageId: string, version: string): Buffer {
  const manifestBase = {
    $schemaVersion: '1.0',
    id: packageId,
    name: `Package ${packageId}`,
    version,
    requiredAppVersion: '>=1.0.0',
    capabilities: {
      apis: [],
      ui_components: [],
      db_objects: [{
        objectType: 'seed',
        objectName: `${packageId}_install`,
        installScript: 'db/install/schema.sql',
        uninstallScript: 'db/uninstall/schema.sql',
        installMode: 'required',
      }],
      mcp_servers: [],
    },
    overridePolicy: { apis: 'deny', ui_components: 'deny', db_objects: 'deny' },
    integrity: { algorithm: 'sha256', artifactHash: '0'.repeat(64) },
  };
  const draft = new AdmZip();
  draft.addFile('db/install/schema.sql', Buffer.from('SELECT 1;\n'));
  draft.addFile('db/uninstall/schema.sql', Buffer.from('SELECT 1;\n'));
  const artifactHash = computePackageArtifactHashFromZip(draft);
  const zip = new AdmZip();
  zip.addFile('db/install/schema.sql', Buffer.from('SELECT 1;\n'));
  zip.addFile('db/uninstall/schema.sql', Buffer.from('SELECT 1;\n'));
  zip.addFile('package.json', Buffer.from(JSON.stringify({
    ...manifestBase,
    integrity: { algorithm: 'sha256', artifactHash },
  })));
  return zip.toBuffer();
}

describe('resolveVersionForInstall', () => {
  it('resolves an installed leftover version that is missing from the catalog index', async () => {
    const { uploadPackageArtifact } = await import('../../../../core/packages/PackageArtifactService');
    const { resolveVersionForInstall } = await import('../manifestRepository');

    await uploadPackageArtifact(buildZip('cms', '1.2.1'), 'cms-1.2.1.zip', 'admin');

    const leftoverDir = path.join(tmpDir, 'packages-storage', 'artifacts', 'cms');
    fs.mkdirSync(leftoverDir, { recursive: true });
    fs.writeFileSync(path.join(leftoverDir, '1.1.0.zip'), buildZip('cms', '1.1.0'));

    const selected = resolveVersionForInstall('cms', '1.1.0');
    expect(selected?.version).toBe('1.1.0');
    expect(selected?.manifestPath).toMatch(/manifests\/cms\/1\.1\.0\.manifest\.json$/);
  });
});
