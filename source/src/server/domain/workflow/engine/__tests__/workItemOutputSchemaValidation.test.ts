import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { claimWorkItem, completeWorkItem } from '../workItemService';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { getWaitByOwningNodeInstance } from '../../workflowWaitRepository';
import { registerCoreActionPack } from '../../actions/corePack';
import { isWorkflowDomainError } from '../../errors';
import { baseModel, workItemNode, workItemOutcomeEdge, endNode } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'output-schema-worker';
const ACTOR_USER_ID = 424242;

registerCoreActionPack();

/** Direct USER assignment — no role-membership lookup involved, so eligibility is purely `resolvedUserId === actor.id`. */
function approvalModel() {
  return baseModel({
    nodes: [
      workItemNode('w1', {
        assignment: { strategy: 'USER', userId: String(ACTOR_USER_ID) },
        allowedOutcomes: ['DONE'],
        outputSchema: { type: 'INLINE', schema: { type: 'object', properties: { approved: { type: 'boolean' } }, required: ['approved'] } },
      }),
      endNode('end-1'),
    ],
    edges: [workItemOutcomeEdge('e-w1-end', 'w1', 'end-1', 'DONE')],
    start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
  });
}

async function publishStartAndClaim() {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('output-schema'), draftDefinitionJson: JSON.stringify(approvalModel()) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER', startedById: 1 });
  const w1Node = await getNodeInstanceByOccurrence(instance.id, 'w1');
  await dispatchNode({ nodeInstanceId: w1Node!.id, leaseOwnerId: leaseOwner });
  const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'w1'))!.id);
  const item = await claimWorkItem({ workItemId: wait!.workItemId!, actorUserId: ACTOR_USER_ID });
  return item;
}

describe.skipIf(!dbReady)('WORK_ITEM completion output vs. outputSchema (HWF-1.2, real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('accepts an output that satisfies the declared outputSchema', async () => {
    const item = await publishStartAndClaim();
    const completed = await completeWorkItem({ workItemId: item.id, actorUserId: ACTOR_USER_ID, outcome: 'DONE', output: { approved: true } });
    expect(completed.status).toBe('COMPLETED');
  });

  it('rejects an output missing a required property with WF_EXEC_WORK_ITEM_OUTPUT_INVALID', async () => {
    const item = await publishStartAndClaim();
    await expect(completeWorkItem({ workItemId: item.id, actorUserId: ACTOR_USER_ID, outcome: 'DONE', output: {} })).rejects.toSatisfy((error: unknown) => isWorkflowDomainError(error) && error.code === 'WF_EXEC_WORK_ITEM_OUTPUT_INVALID');
  });

  it('rejects an output with a wrong-typed property with WF_EXEC_WORK_ITEM_OUTPUT_INVALID', async () => {
    const item = await publishStartAndClaim();
    await expect(completeWorkItem({ workItemId: item.id, actorUserId: ACTOR_USER_ID, outcome: 'DONE', output: { approved: 'yes' } })).rejects.toSatisfy((error: unknown) => isWorkflowDomainError(error) && error.code === 'WF_EXEC_WORK_ITEM_OUTPUT_INVALID');
  });

  it('a WORK_ITEM with an empty/default outputSchema imposes no constraint (backward compatible)', async () => {
    const definition = await createTestWorkflowDefinition({
      key: uniqueKey('output-schema-empty'),
      draftDefinitionJson: JSON.stringify(baseModel({
        nodes: [workItemNode('w1', { assignment: { strategy: 'USER', userId: String(ACTOR_USER_ID) }, allowedOutcomes: ['DONE'] }), endNode('end-1')],
        edges: [workItemOutcomeEdge('e-w1-end', 'w1', 'end-1', 'DONE')],
        start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
      })),
    });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER', startedById: 1 });
    const w1Node = await getNodeInstanceByOccurrence(instance.id, 'w1');
    await dispatchNode({ nodeInstanceId: w1Node!.id, leaseOwnerId: leaseOwner });
    const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'w1'))!.id);
    const item = await claimWorkItem({ workItemId: wait!.workItemId!, actorUserId: ACTOR_USER_ID });
    const completed = await completeWorkItem({ workItemId: item.id, actorUserId: ACTOR_USER_ID, outcome: 'DONE', output: { anything: 'goes' } });
    expect(completed.status).toBe('COMPLETED');
  });
});
