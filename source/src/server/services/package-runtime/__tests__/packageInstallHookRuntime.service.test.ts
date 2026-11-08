import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import type { PackageManifest } from '../../../../core/packages/PackageManifestValidator';

const insertedNodes: Array<{ id: string; title: string | null }> = [];
const invalidateCalls: number[] = [];

vi.mock('../packageInstallHookApi', () => ({
  createPackageInstallHookApi: (_packageId: string, onLog: (line: string) => void) => ({
    baseInfo: {
      insertNode: async (input: { title?: string | null }) => {
        const id = `test-${insertedNodes.length + 1}`;
        insertedNodes.push({ id, title: input.title ?? null });
        return { id };
      },
    },
    navigation: {
      addGroupWithItems: async () => ({ groupCreated: false, itemsAdded: 0 }),
    },
    log: (...args: unknown[]) => onLog(args.map(String).join(' ')),
  }),
}));

vi.mock('../../baseInfoOptionsCache', () => ({
  invalidateBaseInfoOptionsCache: () => {
    invalidateCalls.push(Date.now());
  },
}));

function buildManifest(packageId: string, hookEntry: string, timeoutMs?: number): PackageManifest {
  return {
    $schemaVersion: '1.0',
    id: packageId,
    name: `Package ${packageId}`,
    version: '1.0.0',
    requiredAppVersion: '>=1.0.0',
    dependencies: [],
    capabilities: {
      apis: [],
      ui_components: [],
      db_objects: [],
      mcp_servers: [],
      edge_models: [],
      edge_apis: [],
      edge_model_studio_meta: [],
      install_hooks: [{ id: 'seed-hook', entry: hookEntry, timeoutMs }],
    },
    overridePolicy: { apis: 'deny', ui_components: 'deny', db_objects: 'deny', mcp_servers: 'deny' },
    integrity: { algorithm: 'sha256', artifactHash: crypto.randomBytes(32).toString('hex') },
  };
}

function seedArtifact(packageId: string, manifest: PackageManifest, hookEntry: string, hookSource: string): void {
  const zip = new AdmZip();
  zip.addFile('package.json', Buffer.from(JSON.stringify(manifest)));
  zip.addFile(hookEntry, Buffer.from(hookSource, 'utf8'));

  const artifactRel = path.join('artifacts', packageId, '1.0.0.zip').replace(/\\/g, '/');
  const artifactAbs = path.join('packages-storage', artifactRel);
  fs.mkdirSync(path.dirname(artifactAbs), { recursive: true });
  fs.writeFileSync(artifactAbs, zip.toBuffer());

  fs.writeFileSync(
    path.join('packages-storage', 'index.json'),
    JSON.stringify({
      schema: 'package-index',
      schemaVersion: '1.0.0',
      updatedAt: new Date().toISOString(),
      packages: [{
        packageId,
        displayName: packageId,
        latestVersion: '1.0.0',
        versions: [{
          version: '1.0.0',
          artifactPath: artifactRel,
          manifestPath: path.join('manifests', packageId, '1.0.0.manifest.json').replace(/\\/g, '/'),
          artifactSha256: crypto.randomBytes(32).toString('hex'),
          requiredAppVersion: '>=1.0.0',
          createdAt: new Date().toISOString(),
        }],
      }],
    }, null, 2),
  );
}

let tmpDir = '';
let origCwd = '';

describe('packageInstallHookRuntime.service', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'package-install-hook-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);
    fs.mkdirSync('packages-storage', { recursive: true });
    insertedNodes.length = 0;
    invalidateCalls.length = 0;
  });

  afterEach(() => {
    process.chdir(origCwd);
    // esbuild's persistent transform service may still hold tmpDir as its cwd briefly on Windows.
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('is a no-op when the manifest declares no install hooks', async () => {
    const manifest = buildManifest('demo-package', 'hooks/seed.ts');
    manifest.capabilities.install_hooks = [];
    const { runPackageInstallHooks } = await import('../packageInstallHookRuntime.service');

    const result = await runPackageInstallHooks('demo-package', '1.0.0', manifest);
    expect(result).toEqual({ ok: true, executed: [], logs: [] });
    expect(invalidateCalls).toHaveLength(0);
  });

  it('runs a hook, inserts a Base Info node via the scoped API, and invalidates the cache once', async () => {
    const manifest = buildManifest('demo-package', 'hooks/seed.js');
    seedArtifact('demo-package', manifest, 'hooks/seed.js', `
      module.exports = async function seed(api) {
        api.log('starting seed');
        await api.baseInfo.insertNode({ title: 'CMS' });
      };
    `);

    const { runPackageInstallHooks } = await import('../packageInstallHookRuntime.service');
    const result = await runPackageInstallHooks('demo-package', '1.0.0', manifest);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.executed).toEqual(['seed-hook']);
    expect(result.logs.some((line) => line.includes('starting seed'))).toBe(true);
    expect(insertedNodes).toEqual([{ id: 'test-1', title: 'CMS' }]);
    expect(invalidateCalls).toHaveLength(1);
  });

  it('fails with a clear error and does not invalidate the cache when the hook throws', async () => {
    const manifest = buildManifest('demo-package', 'hooks/seed.js');
    seedArtifact('demo-package', manifest, 'hooks/seed.js', `
      module.exports = async function seed(_api) {
        throw new Error('boom');
      };
    `);

    const { runPackageInstallHooks } = await import('../packageInstallHookRuntime.service');
    const result = await runPackageInstallHooks('demo-package', '1.0.0', manifest);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('boom');
    expect(invalidateCalls).toHaveLength(0);
  });

  it('cannot reach node globals like process or require from inside the sandbox', async () => {
    const manifest = buildManifest('demo-package', 'hooks/seed.js');
    seedArtifact('demo-package', manifest, 'hooks/seed.js', `
      module.exports = async function seed(_api) {
        if (typeof process !== 'undefined') throw new Error('process leaked into sandbox');
        if (typeof require !== 'undefined') throw new Error('require leaked into sandbox');
      };
    `);

    const { runPackageInstallHooks } = await import('../packageInstallHookRuntime.service');
    const result = await runPackageInstallHooks('demo-package', '1.0.0', manifest);
    expect(result.ok).toBe(true);
  });

  it('fails clearly when the hook entry is missing from the artifact', async () => {
    const manifest = buildManifest('demo-package', 'hooks/missing.js');
    seedArtifact('demo-package', manifest, 'hooks/seed.js', 'module.exports = async function seed() {};');

    const { runPackageInstallHooks } = await import('../packageInstallHookRuntime.service');
    const result = await runPackageInstallHooks('demo-package', '1.0.0', manifest);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('hooks/missing.js');
  });
});
