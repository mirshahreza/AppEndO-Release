import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import type { PackageManifest } from '../../../../../core/packages/PackageManifestValidator';

function buildManifest(workflowActions: PackageManifest['capabilities']['workflow_actions'] = []): PackageManifest {
  return {
    $schemaVersion: '1.0',
    id: 'acme',
    name: 'Acme',
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
      install_hooks: [],
      workflow_actions: workflowActions,
    },
    overridePolicy: { apis: 'deny', ui_components: 'deny', db_objects: 'deny', mcp_servers: 'deny' },
    integrity: { algorithm: 'sha256', artifactHash: crypto.randomBytes(32).toString('hex') },
  };
}

function seedArtifact(packageId: string, manifest: PackageManifest, files: Record<string, string>): void {
  const zip = new AdmZip();
  zip.addFile('package.json', Buffer.from(JSON.stringify(manifest)));
  for (const [entryPath, content] of Object.entries(files)) {
    zip.addFile(entryPath, Buffer.from(content, 'utf8'));
  }

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

const validDefinition = {
  configSchema: { type: 'INLINE', schema: {} },
  inputSchema: { type: 'INLINE', schema: {} },
  outputSchema: { type: 'INLINE', schema: {} },
  executionTimeoutMs: 2_000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'PURE',
  riskClass: 'LOW',
  requiredCapabilities: [],
  requiredPermissions: [],
  secretReferenceFields: [],
  tags: ['acme'],
};

let tmpDir = '';
let origCwd = '';

/** Installs+enables the package and extracts its workflow actions, so the live resolver can see it. */
async function installAndExtract(manifest: PackageManifest): Promise<void> {
  const { extractPackageWorkflowActionRuntime } = await import('../../../../services/package-runtime/packageWorkflowActionRuntime.service');
  const { writeInstallState } = await import('../../../package-domain/installStateRepository');
  const { writeObjectRegistry } = await import('../../../package-domain/objectRegistryRepository');
  const { buildRegistryFromManifest } = await import('../../../package-domain/registryBuilder');
  const { makeBaseState } = await import('../../../package-domain/utils');

  const extractResult = extractPackageWorkflowActionRuntime(manifest.id, manifest.version, manifest);
  if (!extractResult.ok) throw new Error(`extraction failed: ${extractResult.details.join('; ')}`);

  writeInstallState({ ...makeBaseState(manifest.id), status: 'installed', activeVersion: manifest.version, enabled: true });
  writeObjectRegistry(buildRegistryFromManifest(manifest.id, manifest, manifest.version, 'default'));
}

describe('packageActionRegistry + packageActionSandboxExecutor', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'package-action-registry-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);
    fs.mkdirSync('packages-storage', { recursive: true });
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('returns undefined for an action key no installed package declares', async () => {
    const { resolvePackageActionDefinition, resolvePackageActionProvider, __resetPackageActionRegistryCacheForTests } = await import('../packageActionRegistry');
    __resetPackageActionRegistryCacheForTests();
    expect(resolvePackageActionDefinition('nobody.home', '1')).toBeUndefined();
    expect(resolvePackageActionProvider('nobody.home', '1')).toBeUndefined();
  });

  it('resolves a real installed package action, and its provider executes the sandboxed script end-to-end', async () => {
    const manifest = buildManifest([
      { key: 'acme.double', version: '1', definitionEntry: 'wf-actions/double.def.json', scriptEntry: 'wf-actions/double.js' },
    ]);
    seedArtifact('acme', manifest, {
      'wf-actions/double.def.json': JSON.stringify(validDefinition),
      'wf-actions/double.js': 'module.exports = async ({ input }) => ({ doubled: input.n * 2 });',
    });
    await installAndExtract(manifest);

    const { resolvePackageActionDefinition, resolvePackageActionProvider, listPackageActionDefinitions, __resetPackageActionRegistryCacheForTests } = await import('../packageActionRegistry');
    __resetPackageActionRegistryCacheForTests();

    const definition = resolvePackageActionDefinition('acme.double', '1');
    expect(definition?.contributor).toEqual({ type: 'PACKAGE', id: 'acme' });
    expect(listPackageActionDefinitions().map((d) => d.key)).toContain('acme.double');

    const provider = resolvePackageActionProvider('acme.double', '1');
    expect(provider?.contributorType).toBe('PACKAGE');
    expect(provider?.providerId).toBe('acme');

    const context = {
      workflowInstanceId: 'wi1', nodeInstanceId: 'ni1', logicalInvocationId: 'li1', idempotencyKey: 'ik1',
      effectiveIdentity: { type: 'SYSTEM' as const, id: null },
      cancellationSignal: new AbortController().signal,
      resolveSecret: async () => '',
      logger: { info: () => {}, warn: () => {}, error: () => {} },
      writeTraceMetadata: () => {},
    };
    const result = await provider!.executor.execute(context, null, { n: 21 });
    expect(result).toEqual({ status: 'SUCCEEDED', output: { doubled: 42 } });
  });

  it('maps a thrown script error to a FAILED result with a stable error code', async () => {
    const manifest = buildManifest([
      { key: 'acme.boom', version: '1', definitionEntry: 'wf-actions/boom.def.json', scriptEntry: 'wf-actions/boom.js' },
    ]);
    seedArtifact('acme', manifest, {
      'wf-actions/boom.def.json': JSON.stringify(validDefinition),
      'wf-actions/boom.js': 'module.exports = async () => { throw new Error("kaboom"); };',
    });
    await installAndExtract(manifest);

    const { resolvePackageActionProvider, __resetPackageActionRegistryCacheForTests } = await import('../packageActionRegistry');
    __resetPackageActionRegistryCacheForTests();

    const provider = resolvePackageActionProvider('acme.boom', '1');
    const context = {
      workflowInstanceId: 'wi1', nodeInstanceId: 'ni1', logicalInvocationId: 'li1', idempotencyKey: 'ik1',
      effectiveIdentity: { type: 'SYSTEM' as const, id: null },
      cancellationSignal: new AbortController().signal,
      resolveSecret: async () => '',
      logger: { info: () => {}, warn: () => {}, error: () => {} },
      writeTraceMetadata: () => {},
    };
    const result = await provider!.executor.execute(context, null, {});
    expect(result.status).toBe('FAILED');
    if (result.status === 'FAILED') {
      expect(result.errorCode).toBe('WF_PACKAGE_ACTION_RUNTIME_ERROR');
      expect(result.safeMessage).toContain('kaboom');
    }
  });
});
