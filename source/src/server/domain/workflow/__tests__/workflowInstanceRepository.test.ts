import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../publication/workflowPublicationService';
import { startWorkflowInstance } from '../engine/startService';
import { dispatchNode } from '../engine/dispatchService';
import { listWorkflowInstances } from '../workflowInstanceRepository';
import { baseModel, endNode } from '../engine/__tests__/fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Operations Cockpit "Instances" list source — new (Slice 5-12 only ever needed single-id Inspect). */
describe.skipIf(!dbReady)('listWorkflowInstances (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('filters by workflowDefinitionId and by status, enriching each row with definition key/revisionNumber', async () => {
    const key = uniqueKey('list-instances');
    const definition = await createTestWorkflowDefinition({ key, draftDefinitionJson: JSON.stringify(baseModel({ nodes: [endNode('end-1')], start: { type: 'MANUAL_API', targetNodeKey: 'end-1' } })) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);

    const { instance, nodeInstances } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER' });

    const forThisDefinition = await listWorkflowInstances({ workflowDefinitionId: definition.id });
    const found = forThisDefinition.find((i) => i.id === instance.id);
    expect(found).toBeDefined();
    expect(found!.workflowDefinitionKey).toBe(key);
    expect(found!.workflowDefinitionId).toBe(definition.id);
    expect(found!.revisionNumber).toBe(revision.revisionNumber);

    // Start only readies the target node — it never auto-dispatches (that's the background
    // engine worker's job live, or an explicit dispatchNode call here), so the instance is still
    // RUNNING (not yet SUCCEEDED) at this point.
    const runningOnly = await listWorkflowInstances({ workflowDefinitionId: definition.id, status: 'RUNNING' });
    expect(runningOnly.some((i) => i.id === instance.id)).toBe(true);

    const end1 = nodeInstances.find((n) => n.semanticNodeKey === 'end-1')!;
    await dispatchNode({ nodeInstanceId: end1.id, leaseOwnerId: 'test-owner' });

    const succeededOnly = await listWorkflowInstances({ workflowDefinitionId: definition.id, status: 'SUCCEEDED' });
    expect(succeededOnly.some((i) => i.id === instance.id)).toBe(true);

    const runningAfterDispatch = await listWorkflowInstances({ workflowDefinitionId: definition.id, status: 'RUNNING' });
    expect(runningAfterDispatch.some((i) => i.id === instance.id)).toBe(false);

    const otherDefinition = await createTestWorkflowDefinition({ key: uniqueKey('list-instances-other'), draftDefinitionJson: JSON.stringify(baseModel({ nodes: [endNode('end-1')], start: { type: 'MANUAL_API', targetNodeKey: 'end-1' } })) });
    const forOtherDefinition = await listWorkflowInstances({ workflowDefinitionId: otherDefinition.id });
    expect(forOtherDefinition.some((i) => i.id === instance.id)).toBe(false);
  });
});
