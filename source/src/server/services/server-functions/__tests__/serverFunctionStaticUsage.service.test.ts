import { describe, expect, it, vi } from 'vitest';

const listManagedFunctions = vi.fn();
vi.mock('../../../domain/functions/functionRepository', () => ({
  listManagedFunctions: () => listManagedFunctions(),
}));

const listDesignerDrafts = vi.fn();
const getDesignerDraft = vi.fn();
vi.mock('../../../domain/component-designer/draftIo', () => ({
  listDesignerDrafts: () => listDesignerDrafts(),
  getDesignerDraft: (...args: Parameters<typeof getDesignerDraft>) => getDesignerDraft(...args),
}));

const listWorkflowDefinitions = vi.fn();
vi.mock('../../../domain/workflow/workflowDefinitionRepository', () => ({
  listWorkflowDefinitions: () => listWorkflowDefinitions(),
}));

const lookupComponentUsageLastHits = vi.fn();
vi.mock('../../component-usage/componentUsagePersistence.service', () => ({
  lookupComponentUsageLastHits: (...args: Parameters<typeof lookupComponentUsageLastHits>) => (
    lookupComponentUsageLastHits(...args)
  ),
}));

import { listUnusedServerFunctions } from '../serverFunctionStaticUsage.service';

describe('listUnusedServerFunctions', () => {
  it('returns custom functions not referenced in designer or workflow corpus', async () => {
    lookupComponentUsageLastHits.mockResolvedValue(new Map());
    listDesignerDrafts.mockReturnValue([]);
    listWorkflowDefinitions.mockResolvedValue([]);
    listManagedFunctions.mockResolvedValue([
      { id: 'custom.used-fn', name: 'used-fn', path: '/api/custom/used-fn', folder: 'general' },
      { id: 'custom.orphan-fn', name: 'orphan-fn', path: '/api/custom/orphan-fn', folder: 'general' },
      { id: 'pkg-api-crm.list', name: 'list', path: '/api/pkg/list', folder: 'packages/crm' },
    ]);
    getDesignerDraft.mockReturnValue({
      document: { nodes: [] },
      bindingDefinitions: { 'custom.used-fn': true },
    });
    listDesignerDrafts.mockReturnValue([{ id: 'draft-1', name: 'page' }]);
    listWorkflowDefinitions.mockResolvedValue([
      { draftDefinitionJson: '{"nodes":[{"functionId":"custom.used-fn"}]}' },
    ]);

    const unused = await listUnusedServerFunctions();

    expect(unused).toEqual([{
      id: 'custom.orphan-fn',
      name: 'orphan-fn',
      path: '/api/custom/orphan-fn',
      lastHitAt: null,
    }]);
  });
});
