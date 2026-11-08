import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import type { PackageManifest } from '../../../../core/packages/PackageManifestValidator';
import { manifestApiPathToHttpPath } from '../../../domain/package-domain/registryBuilder';

function buildManifest(packageId: string, version: string): PackageManifest {
  return {
    $schemaVersion: '1.0',
    id: packageId,
    name: `Package ${packageId}`,
    version,
    requiredAppVersion: '>=1.0.0',
    dependencies: [],
    capabilities: {
      apis: [
        {
          id: `${packageId}.health`,
          method: 'GET',
          path: '/packages/health',
          entry: 'edge/health.js',
          auth: 'public',
        },
      ],
      ui_components: [],
      db_objects: [],
      mcp_servers: [],
      edge_models: [],
      edge_apis: [],
      edge_model_studio_meta: [],
      install_hooks: [],
    },
    overridePolicy: { apis: 'deny', ui_components: 'deny', db_objects: 'deny', mcp_servers: 'deny' },
    integrity: {
      algorithm: 'sha256',
      artifactHash: crypto.randomBytes(32).toString('hex'),
    },
  };
}

function seedInstalledPackage(packageId: string, version: string, enabled = true, handlerSource?: string): PackageManifest {
  const manifest = buildManifest(packageId, version);
  const zip = new AdmZip();
  zip.addFile('package.json', Buffer.from(JSON.stringify(manifest)));
  zip.addFile(
    'edge/health.js',
    Buffer.from(handlerSource ?? `module.exports = async function handler(_req, res) {
  return res.json({ success: true, packageId: '${packageId}' });
};`),
  );

  const artifactRel = path.join('artifacts', packageId, `${version}.zip`).replace(/\\/g, '/');
  const manifestRel = path.join('manifests', packageId, `${version}.manifest.json`).replace(/\\/g, '/');
  const artifactAbs = path.join('packages-storage', artifactRel);
  const manifestAbs = path.join('packages-storage', manifestRel);

  fs.mkdirSync(path.dirname(artifactAbs), { recursive: true });
  fs.mkdirSync(path.dirname(manifestAbs), { recursive: true });
  fs.writeFileSync(artifactAbs, zip.toBuffer());
  fs.writeFileSync(manifestAbs, JSON.stringify(manifest, null, 2));

  fs.writeFileSync(
    path.join('packages-storage', 'index.json'),
    JSON.stringify({
      schema: 'package-index',
      schemaVersion: '1.0.0',
      updatedAt: new Date().toISOString(),
      plugins: [{
        packageId,
        displayName: packageId,
        latestVersion: version,
        versions: [{
          version,
          artifactPath: artifactRel,
          manifestPath: manifestRel,
          artifactSha256: crypto.randomBytes(32).toString('hex'),
          requiredAppVersion: '>=1.0.0',
          createdAt: new Date().toISOString(),
        }],
      }],
    }, null, 2),
  );

  fs.mkdirSync(path.join('packages-storage', 'installed'), { recursive: true });
  fs.writeFileSync(
    path.join('packages-storage', 'installed', `${packageId}.install-state.json`),
    JSON.stringify({
      schema: 'package-install-state',
      schemaVersion: '1.0.0',
      packageId,
      status: 'installed',
      activeVersion: version,
      enabled,
      updatedAt: new Date().toISOString(),
    }, null, 2),
  );

  fs.mkdirSync(path.join('packages-storage', 'objects'), { recursive: true });
  fs.writeFileSync(
    path.join('packages-storage', 'objects', `${packageId}.object-registry.json`),
    JSON.stringify({
      schema: 'package-object-registry',
      schemaVersion: '1.0.0',
      packageId,
      activeVersion: version,
      records: {
        apis: manifest.capabilities.apis.map((api) => ({
          apiId: api.id,
          conflictKey: `${api.method} ${api.path}`,
          method: api.method,
          path: api.path,
          httpPath: manifestApiPathToHttpPath(api.path),
          entry: api.entry,
          auth: api.auth ?? 'admin',
          registeredAt: new Date().toISOString(),
        })),
        uiComponents: [],
        uiRoutes: [],
        dbObjects: [],
        mcpServers: [],
      },
      updatedAt: new Date().toISOString(),
    }, null, 2),
  );

  return manifest;
}

let tmpDir = '';
let origCwd = '';

describe('packageApiRuntime.service', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'package-api-runtime-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);
    fs.mkdirSync('packages-storage', { recursive: true });
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('maps manifest API paths to /api/packages/...', () => {
    expect(manifestApiPathToHttpPath('/packages/health')).toBe('/api/packages/health');
    expect(manifestApiPathToHttpPath('/api/test/test')).toBe('/api/test/test');
  });

  it('extracts API handlers into runtime storage on install', async () => {
    const manifest = seedInstalledPackage('demo-package', '1.0.0');
    const { extractPackageApiRuntime } = await import('../packageApiRuntime.service');

    const result = extractPackageApiRuntime('demo-package', '1.0.0', manifest);
    expect(result.ok).toBe(true);

    const runtimePath = path.join(
      'packages-storage',
      'runtimes',
      'demo-package',
      '1.0.0',
      'edge',
      'health.js',
    );
    expect(fs.existsSync(runtimePath)).toBe(true);
  });

  it('resolves enabled package API routes and skips disabled packages', async () => {
    const manifest = seedInstalledPackage('demo-package', '1.0.0', true);
    const { extractPackageApiRuntime, resolvePackageApiRoute } = await import('../packageApiRuntime.service');
    extractPackageApiRuntime('demo-package', '1.0.0', manifest);

    const match = resolvePackageApiRoute('GET', '/api/packages/health');
    expect(match).not.toBeNull();
    expect(match?.packageId).toBe('demo-package');

    const installStatePath = path.join('packages-storage', 'installed', 'demo-package.install-state.json');
    const installState = JSON.parse(fs.readFileSync(installStatePath, 'utf8')) as { enabled: boolean };
    installState.enabled = false;
    fs.writeFileSync(installStatePath, JSON.stringify(installState, null, 2));

    expect(resolvePackageApiRoute('GET', '/api/packages/health')).toBeNull();
  });

  it('executes a package API handler through the sandbox', async () => {
    const manifest = seedInstalledPackage('demo-package', '1.0.0', true);
    const {
      extractPackageApiRuntime,
      resolvePackageApiRoute,
      executePluginApiHandler,
    } = await import('../packageApiRuntime.service');
    extractPackageApiRuntime('demo-package', '1.0.0', manifest);

    const match = resolvePackageApiRoute('GET', '/api/packages/health');
    expect(match).not.toBeNull();
    if (!match) return;

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

    const result = await executePluginApiHandler(match, { method: 'GET', query: {}, params: {} }, res);
    expect(result.ok).toBe(true);
    expect(statusCode).toBe(200);
    expect(body).toMatchObject({ success: true, packageId: 'demo-package' });
  });

  it('exposes util.regexMatch/util.validateSchema to package API handlers', async () => {
    const manifest = seedInstalledPackage('util-demo', '1.0.0', true, `module.exports = async function handler(_req, res) {
  const match = util.regexMatch('(\\\\w+)@(\\\\w+)', 'ada@example', { flags: 'i' });
  const schema = util.validateSchema({ type: 'object', required: ['a'] }, {});
  return res.json({ success: true, matched: match.matched, schemaValid: schema.valid });
};`);
    const { extractPackageApiRuntime, resolvePackageApiRoute, executePluginApiHandler } = await import('../packageApiRuntime.service');
    extractPackageApiRuntime('util-demo', '1.0.0', manifest);
    const match = resolvePackageApiRoute('GET', '/api/packages/health');
    expect(match).not.toBeNull();
    if (!match) return;

    let body: unknown;
    const res = {
      headersSent: false,
      status: () => res,
      json: (payload: unknown) => { body = payload; },
      send: (payload: unknown) => { body = payload; },
    };
    const result = await executePluginApiHandler(match, { method: 'GET', query: {}, params: {} }, res);
    expect(result.ok).toBe(true);
    expect(body).toEqual({ success: true, matched: true, schemaValid: false });
  });
});
