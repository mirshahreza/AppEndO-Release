import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { getWorkItemByNodeInstance } from '../../workItemRepository';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { isActorEligibleForWorkItem, claimWorkItem } from '../workItemService';
import { createWorkItemComment, listWorkItemComments, hasUserCommentedOnWorkItem } from '../../workItemCommentRepository';
import { registerCoreActionPack } from '../../actions/corePack';
import { baseModel, workItemNode, workItemOutcomeEdge, endNode } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'comments-worker';

registerCoreActionPack();

async function publishStartAndDispatch() {
  const model = baseModel({
    nodes: [
      workItemNode('w1', { assignment: { strategy: 'ROLE', roleId: 'DEVELOPER' }, allowedOutcomes: ['DONE'] }),
      endNode('end-1'),
    ],
    edges: [workItemOutcomeEdge('e-w1-end', 'w1', 'end-1', 'DONE')],
    start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
  });
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('comments'), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER', startedById: 1 });
  const w1Node = await getNodeInstanceByOccurrence(instance.id, 'w1');
  await dispatchNode({ nodeInstanceId: w1Node!.id, leaseOwnerId: leaseOwner });
  return getWorkItemByNodeInstance(w1Node!.id);
}

describe.skipIf(!dbReady)('WORK_ITEM comments access model (HWF-4.1, real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('records a comment and lists it back in chronological order', async () => {
    const workItem = await publishStartAndDispatch();
    await createWorkItemComment({ workItemId: workItem!.id, authorUserId: 71, text: 'First' });
    await createWorkItemComment({ workItemId: workItem!.id, authorUserId: 72, text: 'Second', mentionedUserIds: [71] });

    const comments = await listWorkItemComments(workItem!.id);
    expect(comments.map((c) => c.text)).toEqual(['First', 'Second']);
    expect(comments[1].mentionedUserIds).toEqual([71]);
  });

  it('access = current eligibility (ROLE pool member) works before anyone claims', async () => {
    const workItem = await publishStartAndDispatch();
    const eligible = await isActorEligibleForWorkItem(workItem!, { type: 'USER', id: 99 });
    expect(eligible).toBe(true);
  });

  it('a user who commented pre-claim keeps comment access after someone else claims (the bug the decision avoids)', async () => {
    const workItem = await publishStartAndDispatch();
    const commenterUserId = 88;
    await createWorkItemComment({ workItemId: workItem!.id, authorUserId: commenterUserId, text: 'I have a question before anyone claims this' });

    await claimWorkItem({ workItemId: workItem!.id, actorUserId: 77 });

    const claimedWorkItem = await getWorkItemByNodeInstance(workItem!.nodeInstanceId);
    const stillEligibleForWorkItem = await isActorEligibleForWorkItem(claimedWorkItem!, { type: 'USER', id: commenterUserId });
    expect(stillEligibleForWorkItem).toBe(false);

    const hasCommented = await hasUserCommentedOnWorkItem(workItem!.id, commenterUserId);
    expect(hasCommented).toBe(true);
    const combinedAccess = stillEligibleForWorkItem || hasCommented;
    expect(combinedAccess).toBe(true);
  });

  it('a user with neither eligibility nor prior comments has no access', async () => {
    const workItem = await publishStartAndDispatch();
    await claimWorkItem({ workItemId: workItem!.id, actorUserId: 77 });
    const claimedWorkItem = await getWorkItemByNodeInstance(workItem!.nodeInstanceId);

    const strangerUserId = 66;
    const eligible = await isActorEligibleForWorkItem(claimedWorkItem!, { type: 'USER', id: strangerUserId });
    const hasCommented = await hasUserCommentedOnWorkItem(workItem!.id, strangerUserId);
    expect(eligible || hasCommented).toBe(false);
  });
});
