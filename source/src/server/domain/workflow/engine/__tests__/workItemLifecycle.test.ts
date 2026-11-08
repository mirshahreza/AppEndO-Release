import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { claimWorkItem, completeWorkItem, reassignWorkItem } from '../workItemService';
import { getWorkItemById } from '../../workItemRepository';
import { listWorkItemTransitions } from '../../workItemTransitionRepository';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { getWaitByOwningNodeInstance } from '../../workflowWaitRepository';
import { getWorkflowInstanceById } from '../../workflowInstanceRepository';
import { registerCoreActionPack } from '../../actions/corePack';
import {
  baseModel,
  parallelSplitNode,
  parallelJoinNode,
  workItemNode,
  workItemOutcomeEdge,
  actionNode,
  mappingOf,
  lit,
  endNode,
  unconditionalEdge,
} from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'work-item-worker';

registerCoreActionPack();

async function publishAndStart(model: ReturnType<typeof baseModel>, input: unknown = {}) {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('work-item'), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  return startWorkflowInstance({ workflowRevisionId: revision.id, input: input as never, startedByType: 'USER', startedById: 1 });
}

function approvalModel() {
  return baseModel({
    nodes: [
      workItemNode('w1', { assignment: { strategy: 'USER', userId: '42' }, allowedOutcomes: ['APPROVE', 'REJECT'] }),
      endNode('end-approved'),
      endNode('end-rejected'),
    ],
    edges: [workItemOutcomeEdge('e-approve', 'w1', 'end-approved', 'APPROVE'), workItemOutcomeEdge('e-reject', 'w1', 'end-rejected', 'REJECT')],
    start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
  });
}

describe.skipIf(!dbReady)('Work Item lifecycle (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('WORK_ITEM dispatch creates an OPEN WorkItem + ACTIVE HUMAN wait, node goes RUNNING -> WAITING_HUMAN', async () => {
    const { instance } = await publishAndStart(approvalModel());
    const node = await getNodeInstanceByOccurrence(instance.id, 'w1');
    const outcome = await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });
    expect(outcome.status).toBe('DISPATCHED');
    if (outcome.status !== 'DISPATCHED') throw new Error('unreachable');
    expect(outcome.decision).toEqual(expect.objectContaining({ kind: 'CREATE_WAIT', waitType: 'HUMAN' }));

    const afterNode = await getNodeInstanceByOccurrence(instance.id, 'w1');
    expect(afterNode!.status).toBe('WAITING_HUMAN');

    const wait = await getWaitByOwningNodeInstance(afterNode!.id);
    expect(wait!.status).toBe('ACTIVE');
    expect(wait!.waitType).toBe('HUMAN');
    expect(wait!.workItemId).not.toBeNull();

    const workItem = await getWorkItemById(wait!.workItemId!);
    expect(workItem!.status).toBe('OPEN');
    expect(workItem!.assignmentStrategy).toBe('USER');
    expect(JSON.parse(workItem!.assignmentEvidenceJson!)).toMatchObject({ resolvedType: 'USER', resolvedUserId: 42 });
    expect(workItem!.allowedOutcomesJson).toBe(JSON.stringify(['APPROVE', 'REJECT']));
  });

  it('claim: eligible actor succeeds; ineligible actor is forbidden; a claimed item cannot be claimed again', async () => {
    const { instance } = await publishAndStart(approvalModel());
    const node = await getNodeInstanceByOccurrence(instance.id, 'w1');
    await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });
    const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'w1'))!.id);
    const workItemId = wait!.workItemId!;

    await expect(claimWorkItem({ workItemId, actorUserId: 999 })).rejects.toEqual(expect.objectContaining({ code: 'WF_AUTH_FORBIDDEN' }));

    const claimed = await claimWorkItem({ workItemId, actorUserId: 42 });
    expect(claimed.status).toBe('CLAIMED');
    expect(claimed.claimedByUserId).toBe(42);
    expect(claimed.claimedAt).not.toBeNull();

    await expect(claimWorkItem({ workItemId, actorUserId: 42 })).rejects.toEqual(expect.objectContaining({ code: 'WF_EXEC_WORK_ITEM_NOT_ACTIVE' }));

    const transitions = await listWorkItemTransitions(workItemId);
    expect(transitions.some((t) => t.transitionType === 'CLAIM' && t.toStatus === 'CLAIMED')).toBe(true);
  });

  it('concurrent claim: only one actor wins', async () => {
    const { instance } = await publishAndStart(baseModel({
      nodes: [workItemNode('w1', { assignment: { strategy: 'ROLE', roleId: 'USER' }, allowedOutcomes: ['DONE'] }), endNode('end-1')],
      edges: [workItemOutcomeEdge('e-done', 'w1', 'end-1', 'DONE')],
      start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
    }));
    const node = await getNodeInstanceByOccurrence(instance.id, 'w1');
    await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });
    const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'w1'))!.id);
    const workItemId = wait!.workItemId!;

    const results = await Promise.allSettled([
      claimWorkItem({ workItemId, actorUserId: 501 }),
      claimWorkItem({ workItemId, actorUserId: 502 }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });

  it('complete with a valid outcome: WorkItem COMPLETED, wait SATISFIED, node SUCCEEDED with {outcome,output}, correct edge target READY', async () => {
    const { instance } = await publishAndStart(approvalModel());
    const node = await getNodeInstanceByOccurrence(instance.id, 'w1');
    await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });
    const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'w1'))!.id);
    const workItemId = wait!.workItemId!;

    const completed = await completeWorkItem({ workItemId, actorUserId: 42, outcome: 'APPROVE', output: { comment: 'looks good' } });
    expect(completed.status).toBe('COMPLETED');
    expect(completed.outcome).toBe('APPROVE');
    expect(JSON.parse(completed.outputJson!)).toEqual({ comment: 'looks good' });

    const afterWait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'w1'))!.id);
    expect(afterWait!.status).toBe('SATISFIED');

    const afterNode = await getNodeInstanceByOccurrence(instance.id, 'w1');
    expect(afterNode!.status).toBe('SUCCEEDED');
    expect(JSON.parse(afterNode!.outputJson!)).toEqual({ outcome: 'APPROVE', output: { comment: 'looks good' } });

    const endApproved = await getNodeInstanceByOccurrence(instance.id, 'end-approved');
    expect(endApproved!.status).toBe('READY');
    const endRejected = await getNodeInstanceByOccurrence(instance.id, 'end-rejected');
    expect(endRejected!.status).toBe('PENDING');

    await dispatchNode({ nodeInstanceId: endApproved!.id, leaseOwnerId: leaseOwner });
    const finalInstance = await getWorkflowInstanceById(instance.id);
    expect(finalInstance!.status).toBe('SUCCEEDED');
  });

  it('complete: rejects an outcome not in allowedOutcomes', async () => {
    const { instance } = await publishAndStart(approvalModel());
    const node = await getNodeInstanceByOccurrence(instance.id, 'w1');
    await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });
    const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'w1'))!.id);

    await expect(completeWorkItem({ workItemId: wait!.workItemId!, actorUserId: 42, outcome: 'MAYBE', output: {} })).rejects.toEqual(
      expect.objectContaining({ code: 'WF_EXEC_WORK_ITEM_OUTCOME_INVALID' }),
    );
  });

  it('complete: rejects an ineligible actor', async () => {
    const { instance } = await publishAndStart(approvalModel());
    const node = await getNodeInstanceByOccurrence(instance.id, 'w1');
    await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });
    const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'w1'))!.id);

    await expect(completeWorkItem({ workItemId: wait!.workItemId!, actorUserId: 999, outcome: 'APPROVE', output: {} })).rejects.toEqual(
      expect.objectContaining({ code: 'WF_AUTH_FORBIDDEN' }),
    );
  });

  it('reassignment: OPEN item — old assignee loses eligibility, new assignee gains it', async () => {
    const { instance } = await publishAndStart(approvalModel());
    const node = await getNodeInstanceByOccurrence(instance.id, 'w1');
    await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });
    const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'w1'))!.id);
    const workItemId = wait!.workItemId!;

    const reassigned = await reassignWorkItem({ workItemId, newAssignment: { strategy: 'USER', userId: 43 }, actorType: 'USER', actorId: 1, reasonCode: 'delegate' });
    expect(reassigned.status).toBe('OPEN');
    expect(JSON.parse(reassigned.assignmentEvidenceJson!)).toMatchObject({ resolvedType: 'USER', resolvedUserId: 43 });

    await expect(claimWorkItem({ workItemId, actorUserId: 42 })).rejects.toEqual(expect.objectContaining({ code: 'WF_AUTH_FORBIDDEN' }));
    const claimed = await claimWorkItem({ workItemId, actorUserId: 43 });
    expect(claimed.status).toBe('CLAIMED');
  });

  it('reassignment: clears an incompatible existing claim', async () => {
    const { instance } = await publishAndStart(approvalModel());
    const node = await getNodeInstanceByOccurrence(instance.id, 'w1');
    await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });
    const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'w1'))!.id);
    const workItemId = wait!.workItemId!;

    await claimWorkItem({ workItemId, actorUserId: 42 });
    const reassigned = await reassignWorkItem({ workItemId, newAssignment: { strategy: 'USER', userId: 43 }, actorType: 'USER', actorId: 1 });
    expect(reassigned.status).toBe('OPEN');
    expect(reassigned.claimedByUserId).toBeNull();
  });

  it('a WORK_ITEM node as the last node in an ALL PARALLEL_JOIN branch records a join arrival instead of a plain readying', async () => {
    const model = baseModel({
      nodes: [
        parallelSplitNode('split1'),
        workItemNode('w1', { assignment: { strategy: 'USER', userId: '42' }, allowedOutcomes: ['DONE'] }),
        actionNode('other-branch', { input: mappingOf({ template: lit('ok'), variables: lit({}) }), retryPolicy: { maxAttempts: 1, strategy: 'FIXED', initialDelayMs: 0, retryOn: [] } }),
        parallelJoinNode('join1', 'ALL'),
        endNode('end-1'),
      ],
      edges: [
        unconditionalEdge('e-split-w1', 'split1', 'w1'),
        workItemOutcomeEdge('e-w1-join', 'w1', 'join1', 'DONE'),
        unconditionalEdge('e-split-other', 'split1', 'other-branch'),
        unconditionalEdge('e-other-join', 'other-branch', 'join1'),
        unconditionalEdge('e-join-end', 'join1', 'end-1'),
      ],
      start: { type: 'MANUAL_API', targetNodeKey: 'split1' },
    });
    const { instance } = await publishAndStart(model);
    const split1 = await getNodeInstanceByOccurrence(instance.id, 'split1');
    await dispatchNode({ nodeInstanceId: split1!.id, leaseOwnerId: leaseOwner });

    const otherBranch = await getNodeInstanceByOccurrence(instance.id, 'other-branch');
    await dispatchNode({ nodeInstanceId: otherBranch!.id, leaseOwnerId: leaseOwner });

    const w1 = await getNodeInstanceByOccurrence(instance.id, 'w1');
    await dispatchNode({ nodeInstanceId: w1!.id, leaseOwnerId: leaseOwner });
    const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'w1'))!.id);

    const joinBeforeCompletion = await getNodeInstanceByOccurrence(instance.id, 'join1');
    expect(joinBeforeCompletion!.status).toBe('PENDING');

    await completeWorkItem({ workItemId: wait!.workItemId!, actorUserId: 42, outcome: 'DONE', output: {} });

    const joinAfterCompletion = await getNodeInstanceByOccurrence(instance.id, 'join1');
    expect(joinAfterCompletion!.status).toBe('READY');
    expect(joinAfterCompletion!.branchTokenId).toBeNull();
  });
});
