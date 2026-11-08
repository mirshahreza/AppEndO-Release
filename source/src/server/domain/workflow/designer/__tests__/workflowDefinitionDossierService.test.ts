import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { loadWorkflowDefinitionDossier } from '../workflowDefinitionDossierService';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe.skipIf(!dbReady)('workflowDefinitionDossierService (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('loads a dossier when draft JSON omits nodes and edges arrays', async () => {
    const key = uniqueKey('dossier-malformed');
    const definition = await createTestWorkflowDefinition({
      key,
      draftDefinitionJson: JSON.stringify({
        schemaVersion: '1',
        key,
        name: key,
        start: { type: 'MANUAL_API', targetNodeKey: 'start' },
      }),
    });

    const dossier = await loadWorkflowDefinitionDossier(definition.id);

    expect(dossier.definition.key).toBe(key);
    expect(dossier.definition.nodeCount).toBe(0);
    expect(dossier.definition.edgeCount).toBe(0);
  });
});
