import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { cancelInstance } from '../operationalCommands';
import { claimWorkItem } from '../workItemService';
import { registerCoreActionPack } from '../../actions/corePack';
import { getWorkItemById } from '../../workItemRepository';
import { listWorkItemTransitions } from '../../workItemTransitionRepository';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { getWaitByOwningNodeInstance } from '../../workflowWaitRepository';
import { getWorkflowInstanceById } from '../../workflowInstanceRepository';
import { baseModel, workItemNode, workItemOutcomeEdge, parallelSplitNode, parallelJoinNode, actionNode, unconditionalEdge, endNode, mappingOf } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'work-item-cancel-worker';

registerCoreActionPack();

async function publishAndStart(model: ReturnType<typeof baseModel>, input: unknown = {}) {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('work-item-cancel'), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  return startWorkflowInstance({ workflowRevisionId: revision.id, input: input as never, startedByType: 'USER', startedById: 1 });
}

describe.skipIf(!dbReady)('Work Item closure on instance cancel/fail (doc 07 section 6, real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('cancelInstance closes an OPEN Work Item as CANCELLED with transition evidence', async () => {
    const model = baseModel({
      nodes: [workItemNode('w1', { assignment: { strategy: 'USER', userId: '1' }, allowedOutcomes: ['DONE'] }), endNode('end-1')],
      edges: [workItemOutcomeEdge('e-done', 'w1', 'end-1', 'DONE')],
      start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
    });
    const { instance } = await publishAndStart(model);
    const node = await getNodeInstanceByOccurrence(instance.id, 'w1');
    await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });
    const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'w1'))!.id);
    const workItemId = wait!.workItemId!;

    await cancelInstance(instance.id, instance.stateVersion);

    const workItem = await getWorkItemById(workItemId);
    expect(workItem!.status).toBe('CANCELLED');
    const transitions = await listWorkItemTransitions(workItemId);
    expect(transitions.some((t) => t.transitionType === 'CANCEL' && t.reasonCode === 'INSTANCE_CANCELLED' && t.actorType === 'SYSTEM')).toBe(true);

    const afterNode = await getNodeInstanceByOccurrence(instance.id, 'w1');
    expect(afterNode!.status).toBe('CANCELLED');
    const afterWait = await getWaitByOwningNodeInstance(afterNode!.id);
    expect(afterWait!.status).toBe('CANCELLED');
  });

  it('cancelInstance closes a CLAIMED Work Item as CANCELLED without deleting the CLAIM transition history', async () => {
    const model = baseModel({
      nodes: [workItemNode('w1', { assignment: { strategy: 'USER', userId: '1' }, allowedOutcomes: ['DONE'] }), endNode('end-1')],
      edges: [workItemOutcomeEdge('e-done', 'w1', 'end-1', 'DONE')],
      start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
    });
    const { instance } = await publishAndStart(model);
    const node = await getNodeInstanceByOccurrence(instance.id, 'w1');
    await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });
    const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'w1'))!.id);
    const workItemId = wait!.workItemId!;

    await claimWorkItem({ workItemId, actorUserId: 1 });

    await cancelInstance(instance.id, instance.stateVersion);

    const workItem = await getWorkItemById(workItemId);
    expect(workItem!.status).toBe('CANCELLED');
    const transitions = await listWorkItemTransitions(workItemId);
    expect(transitions.some((t) => t.transitionType === 'CLAIM')).toBe(true);
    expect(transitions.some((t) => t.transitionType === 'CANCEL' && t.fromStatus === 'CLAIMED')).toBe(true);
  });

  it('an unhandled ACTION failure on a sibling branch closes an OPEN Work Item as CANCELLED (V1 unhandled failure propagation)', async () => {
    const model = baseModel({
      nodes: [
        parallelSplitNode('split1'),
        actionNode('branchFail', { retryPolicy: { maxAttempts: 1, strategy: 'FIXED', initialDelayMs: 0, retryOn: [] }, input: mappingOf({}) }),
        workItemNode('w1', { assignment: { strategy: 'USER', userId: '1' }, allowedOutcomes: ['DONE'] }),
        parallelJoinNode('join1', 'ALL'),
        endNode('end-1'),
      ],
      edges: [
        unconditionalEdge('e-split-fail', 'split1', 'branchFail'),
        unconditionalEdge('e-split-w1', 'split1', 'w1'),
        unconditionalEdge('e-fail-join', 'branchFail', 'join1'),
        workItemOutcomeEdge('e-w1-join', 'w1', 'join1', 'DONE'),
        unconditionalEdge('e-join-end', 'join1', 'end-1'),
      ],
      start: { type: 'MANUAL_API', targetNodeKey: 'split1' },
    });
    const { instance } = await publishAndStart(model);
    const split1 = await getNodeInstanceByOccurrence(instance.id, 'split1');
    await dispatchNode({ nodeInstanceId: split1!.id, leaseOwnerId: leaseOwner });

    const w1 = await getNodeInstanceByOccurrence(instance.id, 'w1');
    await dispatchNode({ nodeInstanceId: w1!.id, leaseOwnerId: leaseOwner });
    const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'w1'))!.id);
    const workItemId = wait!.workItemId!;

    const branchFail = await getNodeInstanceByOccurrence(instance.id, 'branchFail');
    const outcome = await dispatchNode({ nodeInstanceId: branchFail!.id, leaseOwnerId: leaseOwner });
    expect(outcome.status).toBe('DISPATCHED');
    if (outcome.status !== 'DISPATCHED') throw new Error('unreachable');
    expect(outcome.decision.kind).toBe('FAIL_INSTANCE');

    const finalInstance = await getWorkflowInstanceById(instance.id);
    expect(finalInstance!.status).toBe('FAILED');

    const workItem = await getWorkItemById(workItemId);
    expect(workItem!.status).toBe('CANCELLED');

    const transitions = await listWorkItemTransitions(workItemId);
    expect(transitions.some((t) => t.reasonCode === 'INSTANCE_FAILED')).toBe(true);
  });
});
