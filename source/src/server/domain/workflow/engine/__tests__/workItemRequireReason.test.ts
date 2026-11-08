import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { claimWorkItem, completeWorkItem, resolveWorkItemFormConfig } from '../workItemService';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { getWaitByOwningNodeInstance } from '../../workflowWaitRepository';
import { getWorkItemById } from '../../workItemRepository';
import { registerCoreActionPack } from '../../actions/corePack';
import { isWorkflowDomainError } from '../../errors';
import { baseModel, workItemNode, workItemOutcomeEdge, endNode } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'require-reason-worker';
const ACTOR_USER_ID = 434343;

registerCoreActionPack();

/** HWF-4.5 — `requireReasonOutcomes: ['REJECT']` on a WORK_ITEM node; `APPROVE` has no such requirement. */
function approvalModel() {
  return baseModel({
    nodes: [
      workItemNode('w1', {
        assignment: { strategy: 'USER', userId: String(ACTOR_USER_ID) },
        allowedOutcomes: ['APPROVE', 'REJECT'],
      } as never),
      endNode('end-approved'),
      endNode('end-rejected'),
    ],
    edges: [
      workItemOutcomeEdge('e-approve', 'w1', 'end-approved', 'APPROVE'),
      workItemOutcomeEdge('e-reject', 'w1', 'end-rejected', 'REJECT'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
  });
}

async function publishStartAndClaim() {
  const model = approvalModel();
  (model.nodes[0] as { requireReasonOutcomes?: string[] }).requireReasonOutcomes = ['REJECT'];
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('require-reason'), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER', startedById: 1 });
  const w1Node = await getNodeInstanceByOccurrence(instance.id, 'w1');
  await dispatchNode({ nodeInstanceId: w1Node!.id, leaseOwnerId: leaseOwner });
  const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'w1'))!.id);
  const item = await claimWorkItem({ workItemId: wait!.workItemId!, actorUserId: ACTOR_USER_ID });
  return item;
}

describe.skipIf(!dbReady)('WORK_ITEM requireReasonOutcomes (HWF-4.5, real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('completing REJECT without output.reason is rejected with WF_EXEC_WORK_ITEM_REASON_REQUIRED', async () => {
    const item = await publishStartAndClaim();
    await expect(completeWorkItem({ workItemId: item.id, actorUserId: ACTOR_USER_ID, outcome: 'REJECT', output: {} })).rejects.toSatisfy(
      (error: unknown) => isWorkflowDomainError(error) && error.code === 'WF_EXEC_WORK_ITEM_REASON_REQUIRED',
    );
  });

  it('completing REJECT with a blank/whitespace-only output.reason is still rejected', async () => {
    const item = await publishStartAndClaim();
    await expect(completeWorkItem({ workItemId: item.id, actorUserId: ACTOR_USER_ID, outcome: 'REJECT', output: { reason: '   ' } })).rejects.toSatisfy(
      (error: unknown) => isWorkflowDomainError(error) && error.code === 'WF_EXEC_WORK_ITEM_REASON_REQUIRED',
    );
  });

  it('completing REJECT with a real output.reason succeeds', async () => {
    const item = await publishStartAndClaim();
    const completed = await completeWorkItem({ workItemId: item.id, actorUserId: ACTOR_USER_ID, outcome: 'REJECT', output: { reason: 'Missing required approval signature.' } });
    expect(completed.status).toBe('COMPLETED');
    expect(JSON.parse(completed.outputJson!)).toEqual({ reason: 'Missing required approval signature.' });
  });

  it('completing APPROVE (not in requireReasonOutcomes) with no reason is unaffected', async () => {
    const item = await publishStartAndClaim();
    const completed = await completeWorkItem({ workItemId: item.id, actorUserId: ACTOR_USER_ID, outcome: 'APPROVE', output: {} });
    expect(completed.status).toBe('COMPLETED');
  });

  it('resolveWorkItemFormConfig exposes requireReasonOutcomes so the client can enforce it before submit', async () => {
    const item = await publishStartAndClaim();
    const formConfig = await resolveWorkItemFormConfig((await getWorkItemById(item.id))!);
    expect(formConfig.requireReasonOutcomes).toEqual(['REJECT']);
  });

  it('a WORK_ITEM with no requireReasonOutcomes declared imposes no constraint (backward compatible)', async () => {
    const model = baseModel({
      nodes: [workItemNode('w1', { assignment: { strategy: 'USER', userId: String(ACTOR_USER_ID) }, allowedOutcomes: ['DONE'] }), endNode('end-1')],
      edges: [workItemOutcomeEdge('e-w1-end', 'w1', 'end-1', 'DONE')],
      start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
    });
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('require-reason-none'), draftDefinitionJson: JSON.stringify(model) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER', startedById: 1 });
    const w1Node = await getNodeInstanceByOccurrence(instance.id, 'w1');
    await dispatchNode({ nodeInstanceId: w1Node!.id, leaseOwnerId: leaseOwner });
    const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'w1'))!.id);
    const item = await claimWorkItem({ workItemId: wait!.workItemId!, actorUserId: ACTOR_USER_ID });
    const completed = await completeWorkItem({ workItemId: item.id, actorUserId: ACTOR_USER_ID, outcome: 'DONE', output: {} });
    expect(completed.status).toBe('COMPLETED');
  });
});
