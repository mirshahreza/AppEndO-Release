import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { claimWorkItem, completeWorkItem } from '../workItemService';
import { getWorkItemById } from '../../workItemRepository';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { getWaitByOwningNodeInstance } from '../../workflowWaitRepository';
import { registerCoreActionPack } from '../../actions/corePack';
import { baseModel, workItemNode, workItemOutcomeEdge, endNode } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'sod-worker';

registerCoreActionPack();

async function publishAndStart(model: ReturnType<typeof baseModel>) {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('sod'), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  return { definition, revision };
}

/** w1 (open to anyone, ROLE-based) -> w2 (excludes whoever claimed w1) -> end. */
function twoStageApprovalModel(excludeW1: boolean) {
  return baseModel({
    nodes: [
      workItemNode('w1', { assignment: { strategy: 'ROLE', roleId: 'USER' }, allowedOutcomes: ['DONE'] }),
      workItemNode('w2', {
        assignment: { strategy: 'ROLE', roleId: 'USER' },
        allowedOutcomes: ['APPROVE'],
        excludeUsersFromWorkItemKeys: excludeW1 ? ['w1'] : undefined,
      }),
      endNode('end-1'),
    ],
    edges: [workItemOutcomeEdge('e-w1-w2', 'w1', 'w2', 'DONE'), workItemOutcomeEdge('e-w2-end', 'w2', 'end-1', 'APPROVE')],
    start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
  });
}

describe.skipIf(!dbReady)('WORK_ITEM Separation of Duties / Four-Eyes (WFV2-19, real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('publish rejects excludeUsersFromWorkItemKeys referencing a missing node', async () => {
    const model = twoStageApprovalModel(true);
    (model.nodes[1] as { excludeUsersFromWorkItemKeys?: string[] }).excludeUsersFromWorkItemKeys = ['does-not-exist'];
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('sod-bad-ref'), draftDefinitionJson: JSON.stringify(model) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    expect(revision.publicationStatus).toBe('REJECTED');
  });

  it('publish rejects excludeUsersFromWorkItemKeys referencing a non-WORK_ITEM node', async () => {
    const model = twoStageApprovalModel(true);
    (model.nodes[1] as { excludeUsersFromWorkItemKeys?: string[] }).excludeUsersFromWorkItemKeys = ['end-1'];
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('sod-bad-kind'), draftDefinitionJson: JSON.stringify(model) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    expect(revision.publicationStatus).toBe('REJECTED');
  });

  it('without the exclusion, the same user CAN claim both w1 and w2', async () => {
    const { revision } = await publishAndStart(twoStageApprovalModel(false));
    const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER', startedById: 1 });

    const w1Node = await getNodeInstanceByOccurrence(instance.id, 'w1');
    await dispatchNode({ nodeInstanceId: w1Node!.id, leaseOwnerId: leaseOwner });
    const w1Wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'w1'))!.id);
    const w1Item = await claimWorkItem({ workItemId: w1Wait!.workItemId!, actorUserId: 7 });
    await completeWorkItem({ workItemId: w1Item.id, actorUserId: 7, outcome: 'DONE', output: {} });

    const w2Node = await getNodeInstanceByOccurrence(instance.id, 'w2');
    await dispatchNode({ nodeInstanceId: w2Node!.id, leaseOwnerId: leaseOwner });
    const w2Wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'w2'))!.id);

    const w2Item = await claimWorkItem({ workItemId: w2Wait!.workItemId!, actorUserId: 7 });
    expect(w2Item.claimedByUserId).toBe(7);
  });

  it('with the exclusion, the user who completed w1 is FORBIDDEN from claiming w2; a different user can', async () => {
    const { revision } = await publishAndStart(twoStageApprovalModel(true));
    const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER', startedById: 1 });

    const w1Node = await getNodeInstanceByOccurrence(instance.id, 'w1');
    await dispatchNode({ nodeInstanceId: w1Node!.id, leaseOwnerId: leaseOwner });
    const w1Wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'w1'))!.id);
    const w1Item = await claimWorkItem({ workItemId: w1Wait!.workItemId!, actorUserId: 7 });
    await completeWorkItem({ workItemId: w1Item.id, actorUserId: 7, outcome: 'DONE', output: {} });

    const w2Node = await getNodeInstanceByOccurrence(instance.id, 'w2');
    await dispatchNode({ nodeInstanceId: w2Node!.id, leaseOwnerId: leaseOwner });
    const w2Wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'w2'))!.id);

    await expect(claimWorkItem({ workItemId: w2Wait!.workItemId!, actorUserId: 7 })).rejects.toMatchObject({ code: 'WF_AUTH_FORBIDDEN' });

    const w2Item = await claimWorkItem({ workItemId: w2Wait!.workItemId!, actorUserId: 8 });
    expect(w2Item.claimedByUserId).toBe(8);
    expect((await getWorkItemById(w2Item.id))!.claimedByUserId).toBe(8);
  });
});
