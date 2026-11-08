import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition, findWorkflowDefinitionByScopeAndKey } from '../../workflowDefinitionRepository';
import { upsertDraftView, getViewByDraftIdentity } from '../../workflowDesignerViewRepository';
import {
  exportWorkflowDefinition,
  importWorkflowDefinition,
  parseWorkflowDefinitionBundle,
  WORKFLOW_BUNDLE_FORMAT,
} from '../workflowDefinitionPortabilityService';
import { baseModel, endNode } from '../../publication/__tests__/fixtures';
import type { WorkflowModel } from '../../awm/types';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const manualApiModel = (key: string): WorkflowModel =>
  baseModel({ key, name: key, nodes: [endNode('end-1')], start: { type: 'MANUAL_API', targetNodeKey: 'end-1' } });

describe.skipIf(!dbReady)('WFV2-23 workflow definition portability (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('exports a draft + designer view and re-imports under a new key', async () => {
    const key = uniqueKey('port-src');
    const created = await createTestWorkflowDefinition({
      key,
      draftDefinitionJson: JSON.stringify(manualApiModel(key)),
      creationMode: 'NEW',
    });
    await upsertDraftView({
      workflowDefinitionId: created.id,
      draftVersion: created.draftVersion,
      viewSchemaVersion: 1,
      viewJson: JSON.stringify({ nodes: [{ id: 'n1', position: { x: 1, y: 2 } }], edges: [] }),
    });

    const { bundle } = await exportWorkflowDefinition(created.id);
    expect(bundle.format).toBe(WORKFLOW_BUNDLE_FORMAT);
    expect(bundle.definition.key).toBe(key);
    expect(bundle.definition.designerViewJson).toContain('"x":1');

    const importKey = uniqueKey('port-imported');
    const result = await importWorkflowDefinition(bundle, { key: importKey });
    expect(result.created).toBe(true);
    expect(result.definition.key).toBe(importKey);
    expect(result.definition.creationMode).toBe('IMPORT');

    const view = await getViewByDraftIdentity(result.definition.id, result.definition.draftVersion);
    expect(view?.viewJson).toContain('"x":1');
  });

  it('rejects collision without overwrite and accepts DRAFT overwrite', async () => {
    const key = uniqueKey('port-overwrite');
    const model = manualApiModel(key);
    await createTestWorkflowDefinition({
      key,
      draftDefinitionJson: JSON.stringify(model),
      creationMode: 'NEW',
    });

    const bundle = parseWorkflowDefinitionBundle({
      format: WORKFLOW_BUNDLE_FORMAT,
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      definition: {
        scopeKey: 'global',
        key,
        draftModel: { ...model, name: 'Renamed After Import' },
      },
    });

    await expect(importWorkflowDefinition(bundle)).rejects.toMatchObject({ code: 'WF_DEF_INVALID_REFERENCE' });

    const overwritten = await importWorkflowDefinition(bundle, { overwrite: true });
    expect(overwritten.overwritten).toBe(true);
    expect(JSON.parse(overwritten.definition.draftDefinitionJson).name).toBe('Renamed After Import');

    const found = await findWorkflowDefinitionByScopeAndKey('global', key);
    expect(found?.id).toBe(overwritten.definition.id);
  });
});
