import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import type { PackageManifest } from '../../../../core/packages/PackageManifestValidator';

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
  executionTimeoutMs: 5_000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'PURE',
  riskClass: 'LOW',
  requiredCapabilities: [],
  requiredPermissions: [],
  secretReferenceFields: [],
  tags: ['acme'],
};

const validScript = `export default async ({ input }) => ({ doubled: input.n * 2 });`;

let tmpDir = '';
let origCwd = '';

describe('packageWorkflowActionRuntime.service', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'package-workflow-actions-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);
    fs.mkdirSync('packages-storage', { recursive: true });
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('is a no-op when the manifest declares no workflow actions', async () => {
    const { extractPackageWorkflowActionRuntime } = await import('../packageWorkflowActionRuntime.service');
    const result = extractPackageWorkflowActionRuntime('acme', '1.0.0', buildManifest());
    expect(result).toEqual({ ok: true, extractedCount: 0 });
  });

  it('extracts a valid action and forces contributor/availability/executionMode regardless of the package JSON', async () => {
    const manifest = buildManifest([
      { key: 'acme.double', version: '1', definitionEntry: 'wf-actions/double.def.json', scriptEntry: 'wf-actions/double.js' },
    ]);
    const dishonestDefinition = {
      ...validDefinition,
      contributor: { type: 'CORE', id: 'not-acme' },
      availability: 'UNAVAILABLE',
      executionMode: 'AGENTIC',
    };
    seedArtifact('acme', manifest, {
      'wf-actions/double.def.json': JSON.stringify(dishonestDefinition),
      'wf-actions/double.js': validScript,
    });

    const { extractPackageWorkflowActionRuntime } = await import('../packageWorkflowActionRuntime.service');
    const { getPackageRuntimeRoot, resolveRuntimeEntryPath } = await import('../packageUiRuntime.service');

    const result = extractPackageWorkflowActionRuntime('acme', '1.0.0', manifest);
    expect(result).toEqual({ ok: true, extractedCount: 1 });

    const runtimeRoot = getPackageRuntimeRoot('acme', '1.0.0');
    expect(fs.existsSync(runtimeRoot)).toBe(true);

    const definitionPath = resolveRuntimeEntryPath('acme', '1.0.0', 'wf-actions/double.def.json')!;
    const written = JSON.parse(fs.readFileSync(definitionPath, 'utf8'));
    expect(written.contributor).toEqual({ type: 'PACKAGE', id: 'acme' });
    expect(written.availability).toBe('AVAILABLE');
    expect(written.executionMode).toBe('DETERMINISTIC');
    expect(written.key).toBe('acme.double');
    expect(written.version).toBe('1');

    const scriptPath = resolveRuntimeEntryPath('acme', '1.0.0', 'wf-actions/double.js')!;
    expect(fs.readFileSync(scriptPath, 'utf8')).toBe(validScript);
  });

  it('fails the whole extraction when a definition is malformed, without extracting anything', async () => {
    const manifest = buildManifest([
      { key: 'acme.broken', version: '1', definitionEntry: 'wf-actions/broken.def.json', scriptEntry: 'wf-actions/broken.js' },
    ]);
    seedArtifact('acme', manifest, {
      // Missing every required ActionDefinition field.
      'wf-actions/broken.def.json': JSON.stringify({}),
      'wf-actions/broken.js': validScript,
    });

    const { extractPackageWorkflowActionRuntime } = await import('../packageWorkflowActionRuntime.service');
    const result = extractPackageWorkflowActionRuntime('acme', '1.0.0', manifest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.details.length).toBeGreaterThan(0);
      expect(result.details[0]).toContain('acme.broken@1');
    }
  });

  it('fails when a declared entry is missing from the artifact', async () => {
    const manifest = buildManifest([
      { key: 'acme.missing', version: '1', definitionEntry: 'wf-actions/missing.def.json', scriptEntry: 'wf-actions/missing.js' },
    ]);
    seedArtifact('acme', manifest, {});

    const { extractPackageWorkflowActionRuntime } = await import('../packageWorkflowActionRuntime.service');
    const result = extractPackageWorkflowActionRuntime('acme', '1.0.0', manifest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.details.some((d) => d.includes('definition entry'))).toBe(true);
    }
  });
});
