import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { claimWorkItem, forwardWorkItem } from '../workItemService';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { getWaitByOwningNodeInstance } from '../../workflowWaitRepository';
import { listWorkItemTransitions } from '../../workItemTransitionRepository';
import { registerCoreActionPack } from '../../actions/corePack';
import { isWorkflowDomainError } from '../../errors';
import { baseModel, workItemNode, workItemOutcomeEdge, endNode } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'forward-worker';
const CLAIMANT_ID = 515151;
const OTHER_USER_ID = 616161;
const TARGET_USER_ID = 717171;

registerCoreActionPack();

async function publishStartAndClaim() {
  const model = baseModel({
    nodes: [
      workItemNode('w1', { assignment: { strategy: 'USER', userId: String(CLAIMANT_ID) }, allowedOutcomes: ['DONE'] }),
      endNode('end-1'),
    ],
    edges: [workItemOutcomeEdge('e-w1-end', 'w1', 'end-1', 'DONE')],
    start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
  });
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('forward'), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER', startedById: 1 });
  const w1Node = await getNodeInstanceByOccurrence(instance.id, 'w1');
  await dispatchNode({ nodeInstanceId: w1Node!.id, leaseOwnerId: leaseOwner });
  const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'w1'))!.id);
  const item = await claimWorkItem({ workItemId: wait!.workItemId!, actorUserId: CLAIMANT_ID });
  return item;
}

describe.skipIf(!dbReady)('WORK_ITEM self-service Forward (HWF-2.5, real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('lets the current claimant forward to another specific user, clearing the claim', async () => {
    const item = await publishStartAndClaim();
    const forwarded = await forwardWorkItem({ workItemId: item.id, actorUserId: CLAIMANT_ID, newAssignment: { strategy: 'USER', userId: TARGET_USER_ID } });
    expect(forwarded.status).toBe('OPEN');
    expect(forwarded.claimedByUserId).toBeNull();

    const claimedByTarget = await claimWorkItem({ workItemId: item.id, actorUserId: TARGET_USER_ID });
    expect(claimedByTarget.claimedByUserId).toBe(TARGET_USER_ID);
  });

  it('records a FORWARD transition type, distinct from REASSIGN', async () => {
    const item = await publishStartAndClaim();
    await forwardWorkItem({ workItemId: item.id, actorUserId: CLAIMANT_ID, newAssignment: { strategy: 'USER', userId: TARGET_USER_ID } });
    const transitions = await listWorkItemTransitions(item.id);
    const forwardTransition = transitions.find((t) => t.transitionType === 'FORWARD');
    expect(forwardTransition).toBeDefined();
    expect(forwardTransition?.actorId).toBe(CLAIMANT_ID);
  });

  it('rejects a forward attempt from someone who is not the current claimant', async () => {
    const item = await publishStartAndClaim();
    await expect(forwardWorkItem({ workItemId: item.id, actorUserId: OTHER_USER_ID, newAssignment: { strategy: 'USER', userId: TARGET_USER_ID } })).rejects.toSatisfy(
      (error: unknown) => isWorkflowDomainError(error) && error.code === 'WF_AUTH_FORBIDDEN',
    );
  });

  it('rejects forwarding an item that is not currently CLAIMED (e.g. already OPEN)', async () => {
    const item = await publishStartAndClaim();
    await forwardWorkItem({ workItemId: item.id, actorUserId: CLAIMANT_ID, newAssignment: { strategy: 'USER', userId: TARGET_USER_ID } });
    await expect(forwardWorkItem({ workItemId: item.id, actorUserId: CLAIMANT_ID, newAssignment: { strategy: 'USER', userId: TARGET_USER_ID } })).rejects.toSatisfy(
      (error: unknown) => isWorkflowDomainError(error) && error.code === 'WF_EXEC_WORK_ITEM_NOT_ACTIVE',
    );
  });
});
