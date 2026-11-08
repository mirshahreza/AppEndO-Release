import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import type { PackageManifest } from '../../../../core/packages/PackageManifestValidator';
import type { EdgeModelDefinition, EdgeApiDefinition } from '../../../../shared/api/contracts/data-api';

const publishCalls: string[] = [];
const deleteCalls: string[] = [];

vi.mock('../../data-api/edgeApiPublisher', () => ({
  publishEdgeApiDefinition: (id: string) => {
    publishCalls.push(id);
    return null;
  },
  deleteEdgeApiDefinitionById: (id: string) => {
    deleteCalls.push(id);
  },
}));

function buildEdgeModel(id: string, objectName: string): EdgeModelDefinition {
  const now = new Date().toISOString();
  return {
    id,
    dataSourceId: 'default',
    schema: null,
    objectName,
    objectType: 'TABLE',
    sequelize: { modelName: id, tableName: objectName },
    columns: [{
      name: 'id', field: 'id', dataType: 'string', sequelizeType: 'STRING',
      allowNull: false, isPrimaryKey: true, isForeignKey: false,
    }],
    primaryKey: 'id',
    associations: [],
    schemaFingerprint: 'test',
    readOnly: false,
    labels: { title: objectName },
    status: 'ready',
    created_at: now,
    updated_at: now,
  };
}

function buildEdgeApi(id: string, edgeModelId: string, key: string): EdgeApiDefinition {
  return {
    id,
    edgeModelId,
    key,
    label: key,
    basePath: `/api/testkit/${key}`,
    operations: [],
    accessControl: { allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
    openapi: { tags: [] },
    publishedAt: null,
    version: 1,
    runtime: { useGlobalConfig: true },
  };
}

function buildManifest(): PackageManifest {
  return {
    $schemaVersion: '1.0',
    id: 'cms',
    name: 'CMS',
    version: '1.0.0',
    requiredAppVersion: '>=1.0.0',
    dependencies: [],
    capabilities: {
      apis: [],
      ui_components: [],
      db_objects: [],
      mcp_servers: [],
      edge_models: [{ id: 'em_test1', entry: 'edge/models/em_test1.json' }],
      edge_apis: [{ id: 'ea_test1', edgeModelId: 'em_test1', entry: 'edge/apis/ea_test1.json' }],
      edge_model_studio_meta: [{ edgeModelId: 'em_test1', entry: 'edge/studio-meta/em_test1.json' }],
      install_hooks: [],
    },
    overridePolicy: { apis: 'deny', ui_components: 'deny', db_objects: 'deny', mcp_servers: 'deny' },
    integrity: { algorithm: 'sha256', artifactHash: crypto.randomBytes(32).toString('hex') },
  };
}

function seedArtifact(packageId: string, manifest: PackageManifest, files: Record<string, unknown>): void {
  const zip = new AdmZip();
  zip.addFile('package.json', Buffer.from(JSON.stringify(manifest)));
  for (const [entryPath, content] of Object.entries(files)) {
    zip.addFile(entryPath, Buffer.from(JSON.stringify(content), 'utf8'));
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

let tmpDir = '';
let origCwd = '';

describe('packageEdgeDataRuntime.service', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'package-edge-data-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);
    fs.mkdirSync('packages-storage', { recursive: true });
    publishCalls.length = 0;
    deleteCalls.length = 0;
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('is a no-op when the manifest declares no edge data', async () => {
    const manifest = buildManifest();
    manifest.capabilities.edge_models = [];
    manifest.capabilities.edge_apis = [];
    manifest.capabilities.edge_model_studio_meta = [];
    const { installPackageEdgeData } = await import('../packageEdgeDataRuntime.service');

    const result = await installPackageEdgeData('cms', '1.0.0', manifest);
    expect(result).toEqual({
      ok: true,
      installed: { models: [], apis: [], studioMeta: [] },
      created: { models: [], apis: [], studioMeta: [] },
    });
  });

  it('installs models, apis (publishing them), and studio-meta in order, then can be listed', async () => {
    const manifest = buildManifest();
    seedArtifact('cms', manifest, {
      'edge/models/em_test1.json': buildEdgeModel('em_test1', 'cms_contents'),
      'edge/apis/ea_test1.json': buildEdgeApi('ea_test1', 'em_test1', 'cms-contents'),
      'edge/studio-meta/em_test1.json': {
        edgeModelId: 'em_test1', tags: ['cms'], columnMeta: [], associationMeta: [], extensions: {},
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      },
    });

    const { installPackageEdgeData } = await import('../packageEdgeDataRuntime.service');
    const { listEdgeModels } = await import('../../data-api/edgeModelStore');
    const { listEdgeApiDefinitions } = await import('../../data-api/edgeApiStore');
    const { getEdgeModelStudioMeta } = await import('../../data-api/edgeModelStudioMetaStore');

    const result = await installPackageEdgeData('cms', '1.0.0', manifest);
    expect(result).toEqual({
      ok: true,
      installed: { models: ['em_test1'], apis: ['ea_test1'], studioMeta: ['em_test1'] },
      created: { models: ['em_test1'], apis: ['ea_test1'], studioMeta: ['em_test1'] },
    });
    expect(publishCalls).toEqual(['ea_test1']);
    expect(listEdgeModels().map((m) => m.id)).toEqual(['em_test1']);
    expect(listEdgeApiDefinitions().map((a) => a.id)).toEqual(['ea_test1']);
    expect(getEdgeModelStudioMeta('em_test1').tags).toEqual(['cms']);
  });

  it('fails with details and does not install anything else when an edge API references an undeclared model entry', async () => {
    const manifest = buildManifest();
    // Entry declared in the manifest but missing from the zip.
    seedArtifact('cms', manifest, {
      'edge/models/em_test1.json': buildEdgeModel('em_test1', 'cms_contents'),
      'edge/studio-meta/em_test1.json': {
        edgeModelId: 'em_test1', tags: [], columnMeta: [], associationMeta: [], extensions: {},
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      },
      // edge/apis/ea_test1.json intentionally omitted
    });

    const { installPackageEdgeData } = await import('../packageEdgeDataRuntime.service');
    const result = await installPackageEdgeData('cms', '1.0.0', manifest);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.details.some((line) => line.includes('edge/apis/ea_test1.json'))).toBe(true);
    expect(result.created.models).toEqual(['em_test1']);
    expect(result.created.apis).toEqual([]);
    expect(publishCalls).toEqual([]);
  });

  it('uninstalls edge data using the registry snapshot, deleting apis then models/studio-meta', async () => {
    const manifest = buildManifest();
    seedArtifact('cms', manifest, {
      'edge/models/em_test1.json': buildEdgeModel('em_test1', 'cms_contents'),
      'edge/apis/ea_test1.json': buildEdgeApi('ea_test1', 'em_test1', 'cms-contents'),
      'edge/studio-meta/em_test1.json': {
        edgeModelId: 'em_test1', tags: [], columnMeta: [], associationMeta: [], extensions: {},
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      },
    });

    const { installPackageEdgeData, uninstallPackageEdgeData } = await import('../packageEdgeDataRuntime.service');
    const { listEdgeModels } = await import('../../data-api/edgeModelStore');

    await installPackageEdgeData('cms', '1.0.0', manifest);
    expect(listEdgeModels()).toHaveLength(1);

    uninstallPackageEdgeData({
      schema: 'package-object-registry',
      schemaVersion: '1.0.0',
      packageId: 'cms',
      activeVersion: '1.0.0',
      records: {
        apis: [], uiComponents: [], uiRoutes: [], dbObjects: [], mcpServers: [],
        edgeModels: [{ conflictKey: 'edge_model::em_test1', edgeModelId: 'em_test1', entry: 'edge/models/em_test1.json', registeredAt: new Date().toISOString() }],
        edgeApis: [{ conflictKey: 'edge_api::ea_test1', edgeApiId: 'ea_test1', edgeModelId: 'em_test1', entry: 'edge/apis/ea_test1.json', registeredAt: new Date().toISOString() }],
      },
      updatedAt: new Date().toISOString(),
    });

    expect(deleteCalls).toEqual(['ea_test1']);
    expect(listEdgeModels()).toHaveLength(0);
  });

  it('does not mark already-published APIs as created so rollback will not delete them', async () => {
    const manifest = buildManifest();
    const model = buildEdgeModel('em_test1', 'cms_contents');
    const api = {
      ...buildEdgeApi('ea_test1', 'em_test1', 'cms-contents'),
      publishedAt: '2026-01-01T00:00:00.000Z',
    };
    seedArtifact('cms', manifest, {
      'edge/models/em_test1.json': model,
      'edge/apis/ea_test1.json': api,
      'edge/studio-meta/em_test1.json': {
        edgeModelId: 'em_test1', tags: [], columnMeta: [], associationMeta: [], extensions: {},
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      },
    });

    const { saveEdgeModel } = await import('../../data-api/edgeModelStore');
    const { saveEdgeApiDefinition } = await import('../../data-api/edgeApiStore');
    const { upsertEdgeModelStudioMeta } = await import('../../data-api/edgeModelStudioMetaStore');
    saveEdgeModel(model);
    saveEdgeApiDefinition(api);
    upsertEdgeModelStudioMeta('em_test1', { tags: [], columnMeta: [], associationMeta: [], extensions: {} });

    const { installPackageEdgeData } = await import('../packageEdgeDataRuntime.service');
    const result = await installPackageEdgeData('cms', '1.0.0', manifest);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.created).toEqual({ models: [], apis: [], studioMeta: [] });
    expect(publishCalls).toEqual([]);
  });
});
