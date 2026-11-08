import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { computeSubflowAncestorDepth } from '../subflowContinuationApply';
import { registerCoreActionPack } from '../../actions/corePack';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { getWaitByOwningNodeInstance } from '../../workflowWaitRepository';
import { baseModel, subflowNode, endNode, unconditionalEdge } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'subflow-recursion-worker';

registerCoreActionPack();

/** A workflow definition that calls itself via SUBFLOW — the only way to express "loop" per p-61 F-5/F-9. */
function selfReferencingModel(ownKey: string, maxSubflowRecursionDepth?: number) {
  const model = baseModel({
    nodes: [subflowNode('sub1', { workflowDefinitionRef: { workflowDefinitionKey: ownKey } }), endNode('end-1')],
    edges: [unconditionalEdge('e-sub-end', 'sub1', 'end-1')],
    start: { type: 'MANUAL_API', targetNodeKey: 'sub1' },
  });
  if (maxSubflowRecursionDepth !== undefined) {
    model.policies.limits.maxSubflowRecursionDepth = maxSubflowRecursionDepth;
  }
  return model;
}

describe.skipIf(!dbReady)('SUBFLOW recursion depth guardrail (WFV2-4, real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('rejects the first self-referencing recursion when maxSubflowRecursionDepth is 0 (no nesting allowed)', async () => {
    const key = uniqueKey('self-ref-depth0');
    const definition = await createTestWorkflowDefinition({ key, draftDefinitionJson: JSON.stringify(selfReferencingModel(key, 0)) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    expect(revision.publicationStatus).toBe('PUBLISHED');

    const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER', startedById: 1 });
    const node = await getNodeInstanceByOccurrence(instance.id, 'sub1');

    await expect(dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner })).rejects.toMatchObject({
      code: 'WF_EXEC_SUBFLOW_RECURSION_LIMIT_EXCEEDED',
    });
  });

  it('allows recursion up to the configured depth, then rejects the next level', async () => {
    const key = uniqueKey('self-ref-depth1');
    const definition = await createTestWorkflowDefinition({ key, draftDefinitionJson: JSON.stringify(selfReferencingModel(key, 1)) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);

    const { instance: rootInstance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER', startedById: 1 });
    const rootNode = await getNodeInstanceByOccurrence(rootInstance.id, 'sub1');

    // Depth 0 -> 1: allowed (limit is 1).
    const first = await dispatchNode({ nodeInstanceId: rootNode!.id, leaseOwnerId: leaseOwner });
    expect(first.status).toBe('DISPATCHED');
    const rootWait = await getWaitByOwningNodeInstance(rootNode!.id);
    const childInstanceId = rootWait!.childInstanceId!;
    expect(await computeSubflowAncestorDepth(childInstanceId)).toBe(1);

    // Depth 1 -> 2: rejected (would exceed limit of 1).
    const childNode = await getNodeInstanceByOccurrence(childInstanceId, 'sub1');
    await expect(dispatchNode({ nodeInstanceId: childNode!.id, leaseOwnerId: leaseOwner })).rejects.toMatchObject({
      code: 'WF_EXEC_SUBFLOW_RECURSION_LIMIT_EXCEEDED',
    });
  });

  it('defaults to DEFAULT_MAX_SUBFLOW_RECURSION_DEPTH (25) when the field is absent from an older pinned revision', async () => {
    const key = uniqueKey('self-ref-nodefault');
    const definition = await createTestWorkflowDefinition({ key, draftDefinitionJson: JSON.stringify(selfReferencingModel(key)) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    expect(JSON.parse(revision.definitionJson).policies.limits.maxSubflowRecursionDepth).toBeUndefined();

    const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER', startedById: 1 });
    const node = await getNodeInstanceByOccurrence(instance.id, 'sub1');

    const outcome = await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });
    expect(outcome.status).toBe('DISPATCHED');
  });

  it('computeSubflowAncestorDepth returns 0 for an instance with no SUBFLOW ancestors', async () => {
    const key = uniqueKey('self-ref-depth-check');
    const definition = await createTestWorkflowDefinition({ key, draftDefinitionJson: JSON.stringify(selfReferencingModel(key, 5)) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER', startedById: 1 });

    expect(await computeSubflowAncestorDepth(instance.id)).toBe(0);
  });
});
