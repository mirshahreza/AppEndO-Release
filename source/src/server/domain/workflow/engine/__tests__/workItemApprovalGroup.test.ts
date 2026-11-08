import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { completeWorkItem } from '../workItemService';
import { getWorkItemByNodeInstance } from '../../workItemRepository';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { listWorkItemInbox } from '../workItemInboxService';
import { registerCoreActionPack } from '../../actions/corePack';
import { baseModel, parallelSplitNode, parallelJoinNode, workItemNode, workItemOutcomeEdge, unconditionalEdge, endNode } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'approval-group-worker';

registerCoreActionPack();

/**
 * HWF-3.1 — Multi-approver via "macro-expansion": PARALLEL_SPLIT + N x WORK_ITEM (sharing a literal
 * `approvalGroupKey`) + PARALLEL_JOIN(THRESHOLD). `approvalGroupKey` is a pure UI-grouping label with
 * zero engine effect — this test proves both halves: the label propagates onto each created WorkItem
 * row untouched, and the existing THRESHOLD join semantics (already covered by
 * `parallelJoinThreshold.test.ts`) keep working exactly as before alongside it.
 */
function multiApproverModel() {
  return baseModel({
    nodes: [
      parallelSplitNode('split1'),
      workItemNode('approverA', { assignment: { strategy: 'ROLE', roleId: 'DEVELOPER' }, allowedOutcomes: ['APPROVE'] }),
      workItemNode('approverB', { assignment: { strategy: 'ROLE', roleId: 'DEVELOPER' }, allowedOutcomes: ['APPROVE'] }),
      workItemNode('approverC', { assignment: { strategy: 'ROLE', roleId: 'DEVELOPER' }, allowedOutcomes: ['APPROVE'] }),
      parallelJoinNode('join1', 'THRESHOLD', false, 2),
      endNode('end-1'),
    ],
    edges: [
      unconditionalEdge('e-split-a', 'split1', 'approverA'),
      unconditionalEdge('e-split-b', 'split1', 'approverB'),
      unconditionalEdge('e-split-c', 'split1', 'approverC'),
      workItemOutcomeEdge('e-a-join', 'approverA', 'join1', 'APPROVE'),
      workItemOutcomeEdge('e-b-join', 'approverB', 'join1', 'APPROVE'),
      workItemOutcomeEdge('e-c-join', 'approverC', 'join1', 'APPROVE'),
      unconditionalEdge('e-join-end', 'join1', 'end-1'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'split1' },
  });
}

async function publishAndStart(model: ReturnType<typeof baseModel>) {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('approval-group'), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  return startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER', startedById: 1 });
}

describe.skipIf(!dbReady)('WORK_ITEM approvalGroupKey (HWF-3.1, real DB) — UI-grouping label, zero engine effect', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('two branches sharing approvalGroupKey both persist the same key on their WorkItem row; the third (ungrouped) branch is null', async () => {
    const GROUP_KEY = uniqueKey('purchase-order-approval');
    const model = multiApproverModel();
    (model.nodes[1] as { approvalGroupKey?: string }).approvalGroupKey = GROUP_KEY;
    (model.nodes[2] as { approvalGroupKey?: string }).approvalGroupKey = GROUP_KEY;

    const { instance } = await publishAndStart(model);
    const split1 = await getNodeInstanceByOccurrence(instance.id, 'split1');
    await dispatchNode({ nodeInstanceId: split1!.id, leaseOwnerId: leaseOwner });

    const nodeA = await getNodeInstanceByOccurrence(instance.id, 'approverA');
    const nodeB = await getNodeInstanceByOccurrence(instance.id, 'approverB');
    const nodeC = await getNodeInstanceByOccurrence(instance.id, 'approverC');
    await dispatchNode({ nodeInstanceId: nodeA!.id, leaseOwnerId: leaseOwner });
    await dispatchNode({ nodeInstanceId: nodeB!.id, leaseOwnerId: leaseOwner });
    await dispatchNode({ nodeInstanceId: nodeC!.id, leaseOwnerId: leaseOwner });

    const workItemA = await getWorkItemByNodeInstance(nodeA!.id);
    const workItemB = await getWorkItemByNodeInstance(nodeB!.id);
    const workItemC = await getWorkItemByNodeInstance(nodeC!.id);

    expect(workItemA!.approvalGroupKey).toBe(GROUP_KEY);
    expect(workItemB!.approvalGroupKey).toBe(GROUP_KEY);
    expect(workItemC!.approvalGroupKey).toBeNull();

    const inboxItems = await listWorkItemInbox('AVAILABLE_TO_CLAIM', { userId: 1, roles: ['DEVELOPER'] });
    const grouped = inboxItems.filter((i) => i.approvalGroupKey === GROUP_KEY);
    expect(grouped.map((i) => i.id).sort()).toEqual([workItemA!.id, workItemB!.id].sort());
  });

  it('THRESHOLD(2) join still fires correctly once the two grouped approvers complete, leaving the ungrouped 3rd branch untouched', async () => {
    const GROUP_KEY = uniqueKey('purchase-order-approval');
    const model = multiApproverModel();
    (model.nodes[1] as { approvalGroupKey?: string }).approvalGroupKey = GROUP_KEY;
    (model.nodes[2] as { approvalGroupKey?: string }).approvalGroupKey = GROUP_KEY;

    const { instance } = await publishAndStart(model);
    const split1 = await getNodeInstanceByOccurrence(instance.id, 'split1');
    await dispatchNode({ nodeInstanceId: split1!.id, leaseOwnerId: leaseOwner });

    const nodeA = await getNodeInstanceByOccurrence(instance.id, 'approverA');
    const nodeB = await getNodeInstanceByOccurrence(instance.id, 'approverB');
    const nodeC = await getNodeInstanceByOccurrence(instance.id, 'approverC');
    await dispatchNode({ nodeInstanceId: nodeA!.id, leaseOwnerId: leaseOwner });
    await dispatchNode({ nodeInstanceId: nodeB!.id, leaseOwnerId: leaseOwner });
    await dispatchNode({ nodeInstanceId: nodeC!.id, leaseOwnerId: leaseOwner });

    const workItemA = await getWorkItemByNodeInstance(nodeA!.id);
    const workItemB = await getWorkItemByNodeInstance(nodeB!.id);

    const joinBefore = await getNodeInstanceByOccurrence(instance.id, 'join1');
    expect(joinBefore!.status).toBe('PENDING');

    await completeWorkItem({ workItemId: workItemA!.id, actorUserId: 501, outcome: 'APPROVE', output: {} });
    const joinAfterOne = await getNodeInstanceByOccurrence(instance.id, 'join1');
    expect(joinAfterOne!.status).toBe('PENDING');

    await completeWorkItem({ workItemId: workItemB!.id, actorUserId: 502, outcome: 'APPROVE', output: {} });
    const joinAfterTwo = await getNodeInstanceByOccurrence(instance.id, 'join1');
    expect(joinAfterTwo!.status).toBe('READY');

    const nodeCAfter = await getNodeInstanceByOccurrence(instance.id, 'approverC');
    expect(nodeCAfter!.status).toBe('WAITING_HUMAN');
  });
});
