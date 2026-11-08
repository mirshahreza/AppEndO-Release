import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { EdgeModelDefinition, EdgeApiDefinition } from '../../../../shared/api/contracts/data-api';

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

let tmpDir = '';
let origCwd = '';

describe('packageEdgeDataExport.service', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'package-edge-export-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('exports selected models + apis, auto-including a referenced model not separately selected', async () => {
    const { saveEdgeModel } = await import('../../data-api/edgeModelStore');
    const { saveEdgeApiDefinition } = await import('../../data-api/edgeApiStore');
    const { upsertEdgeModelStudioMeta } = await import('../../data-api/edgeModelStudioMetaStore');

    saveEdgeModel(buildEdgeModel('em_a', 'cms_contents'));
    saveEdgeModel(buildEdgeModel('em_b', 'cms_comments'));
    saveEdgeApiDefinition(buildEdgeApi('ea_a', 'em_a', 'cms-contents'));
    saveEdgeApiDefinition(buildEdgeApi('ea_b', 'em_b', 'cms-comments'));
    upsertEdgeModelStudioMeta('em_a', { tags: ['cms'] });
    // em_b's studio-meta stays empty (default) — should be skipped in export.

    const { buildPackageEdgeDataExportEntries } = await import('../packageEdgeDataExport.service');

    // Only select em_a explicitly + both APIs — ea_b's edgeModelId (em_b) should be auto-included.
    const result = buildPackageEdgeDataExportEntries({
      edgeModelIds: ['em_a'],
      edgeApiIds: ['ea_a', 'ea_b'],
    });

    if ('ok' in result && result.ok === false) {
      throw new Error(`export failed: ${result.details.join('; ')}`);
    }
    const success = result as Exclude<typeof result, { ok: false }>;

    expect(success.capabilities.edge_models.map((m) => m.id).sort()).toEqual(['em_a', 'em_b']);
    expect(success.capabilities.edge_apis.map((a) => a.id).sort()).toEqual(['ea_a', 'ea_b']);
    expect(success.warnings.some((w) => w.includes('em_b'))).toBe(true);

    // Only em_a has real studio-meta content — em_b's empty default should be skipped.
    expect(success.capabilities.edge_model_studio_meta.map((m) => m.edgeModelId)).toEqual(['em_a']);

    const entryPaths = success.zipEntries.map((entry) => entry.path).sort();
    expect(entryPaths).toEqual([
      'edge/apis/ea_a.json',
      'edge/apis/ea_b.json',
      'edge/models/em_a.json',
      'edge/models/em_b.json',
      'edge/studio-meta/em_a.json',
    ]);

    const modelEntry = success.zipEntries.find((entry) => entry.path === 'edge/models/em_a.json');
    const parsedModel = JSON.parse(modelEntry!.content.toString('utf8'));
    expect(parsedModel.objectName).toBe('cms_contents');
  });

  it('reports a clear error when a requested edge API does not exist', async () => {
    const { buildPackageEdgeDataExportEntries } = await import('../packageEdgeDataExport.service');
    const result = buildPackageEdgeDataExportEntries({ edgeModelIds: [], edgeApiIds: ['ea_missing'] });
    expect('ok' in result && result.ok === false).toBe(true);
    if ('ok' in result && result.ok === false) {
      expect(result.details[0]).toContain('ea_missing');
    }
  });
});
