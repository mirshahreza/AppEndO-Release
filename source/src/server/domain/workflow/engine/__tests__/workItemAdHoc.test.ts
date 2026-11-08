import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { claimWorkItem, completeWorkItem, attachAdHocWorkItem } from '../workItemService';
import { getWorkItemByNodeInstance, getWorkItemById } from '../../workItemRepository';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { getWorkflowInstanceById } from '../../workflowInstanceRepository';
import { registerCoreActionPack } from '../../actions/corePack';
import { baseModel, workItemNode, workItemOutcomeEdge, endNode } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'adhoc-worker';

registerCoreActionPack();

function singleApprovalModel() {
  return baseModel({
    nodes: [
      workItemNode('w1', { assignment: { strategy: 'USER', userId: '42' } as never, allowedOutcomes: ['DONE'] }),
      endNode('end-1'),
    ],
    edges: [workItemOutcomeEdge('e-w1-end', 'w1', 'end-1', 'DONE')],
    start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
  });
}

async function publishAndStart() {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('adhoc'), draftDefinitionJson: JSON.stringify(singleApprovalModel()) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER', startedById: 1 });
  const w1Node = await getNodeInstanceByOccurrence(instance.id, 'w1');
  await dispatchNode({ nodeInstanceId: w1Node!.id, leaseOwnerId: leaseOwner });
  return { instance, w1Node: w1Node! };
}

/**
 * HWF-3.2 — ad-hoc Work Item: an operator (or an existing participant) attaches a brand-new Work Item
 * to an already-RUNNING instance, entirely outside the published graph. Per user decision
 * 2026-08-30: authorized actors are ADMIN or anyone who has ever held a Work Item (open or closed) on
 * this same instance.
 */
describe.skipIf(!dbReady)('attachAdHocWorkItem (HWF-3.2, real DB) — case-management escape hatch outside the graph', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('rejects an actor who is neither ADMIN nor a prior participant on this instance', async () => {
    const { instance } = await publishAndStart();
    await expect(
      attachAdHocWorkItem({
        workflowInstanceId: instance.id,
        actorUserId: 999,
        actorRoles: ['DEVELOPER'],
        workItemType: 'EXCEPTION',
        titleText: 'Handle a surprise exception',
        assignment: { strategy: 'USER', userId: 999 },
        allowedOutcomes: ['DONE'],
      }),
    ).rejects.toEqual(expect.objectContaining({ code: 'WF_AUTH_FORBIDDEN' }));
  });

  it('allows ADMIN even with zero prior participation, and creates a real Work Item off the graph', async () => {
    const { instance } = await publishAndStart();
    const workItem = await attachAdHocWorkItem({
      workflowInstanceId: instance.id,
      actorUserId: 1,
      actorRoles: ['ADMIN'],
      workItemType: 'EXCEPTION',
      titleText: 'Handle a surprise exception',
      summaryText: 'Customer called in about a data mismatch',
      assignment: { strategy: 'ROLE', roleId: 'DEVELOPER' },
      allowedOutcomes: ['RESOLVED', 'ESCALATED'],
      input: { note: 'raised by phone' },
    });

    expect(workItem.workflowInstanceId).toBe(instance.id);
    expect(workItem.workItemType).toBe('EXCEPTION');
    expect(workItem.status).toBe('OPEN');
    expect(workItem.titleText).toBe('Handle a surprise exception');
    expect(JSON.parse(workItem.allowedOutcomesJson)).toEqual(['RESOLVED', 'ESCALATED']);
    expect(JSON.parse(workItem.assignmentEvidenceJson!)).toMatchObject({ resolvedType: 'ROLE', resolvedRoleId: 'DEVELOPER' });

    const reloaded = await getWorkItemById(workItem.id);
    expect(reloaded!.approvalGroupKey).toBeNull();
    expect(reloaded!.dueAt).toBeNull();
  });

  it('allows a non-admin user who was merely assigned (never claimed) the original WORK_ITEM — assignment alone counts as participation', async () => {
    const { instance } = await publishAndStart();
    const workItem = await attachAdHocWorkItem({
      workflowInstanceId: instance.id,
      actorUserId: 42,
      actorRoles: ['DEVELOPER'],
      workItemType: 'DATA_ENTRY',
      titleText: 'Follow-up data correction',
      assignment: { strategy: 'USER', userId: 42 },
      allowedOutcomes: ['DONE'],
    });
    expect(workItem.status).toBe('OPEN');
  });

  it('allows a non-admin user who claimed and completed the original WORK_ITEM — a past (closed) participation still counts', async () => {
    const { instance, w1Node } = await publishAndStart();
    const w1Item = await getWorkItemByNodeInstance(w1Node.id);
    await claimWorkItem({ workItemId: w1Item!.id, actorUserId: 42 });
    await completeWorkItem({ workItemId: w1Item!.id, actorUserId: 42, outcome: 'DONE', output: {} });

    const workItem = await attachAdHocWorkItem({
      workflowInstanceId: instance.id,
      actorUserId: 42,
      actorRoles: ['DEVELOPER'],
      workItemType: 'DATA_ENTRY',
      titleText: 'Post-completion follow-up',
      assignment: { strategy: 'USER', userId: 42 },
      allowedOutcomes: ['DONE'],
    });
    expect(workItem.status).toBe('OPEN');
  });

  it('rejects attaching to a non-RUNNING (already-completed) instance', async () => {
    const { instance, w1Node } = await publishAndStart();
    const w1Item = await getWorkItemByNodeInstance(w1Node.id);
    await completeWorkItem({ workItemId: w1Item!.id, actorUserId: 42, outcome: 'DONE', output: {} });
    const endNode1 = await getNodeInstanceByOccurrence(instance.id, 'end-1');
    await dispatchNode({ nodeInstanceId: endNode1!.id, leaseOwnerId: leaseOwner });

    const finished = await getWorkflowInstanceById(instance.id);
    expect(finished!.status).toBe('SUCCEEDED');

    await expect(
      attachAdHocWorkItem({
        workflowInstanceId: instance.id,
        actorUserId: 1,
        actorRoles: ['ADMIN'],
        workItemType: 'EXCEPTION',
        titleText: 'Too late',
        assignment: { strategy: 'USER', userId: 1 },
        allowedOutcomes: ['DONE'],
      }),
    ).rejects.toEqual(expect.objectContaining({ code: 'WF_EXEC_INSTANCE_NOT_EXECUTABLE' }));
  });

  it('an ad-hoc Work Item left OPEN does not block the underlying instance from reaching SUCCEEDED via its normal graph path', async () => {
    const { instance, w1Node } = await publishAndStart();
    await attachAdHocWorkItem({
      workflowInstanceId: instance.id,
      actorUserId: 1,
      actorRoles: ['ADMIN'],
      workItemType: 'EXCEPTION',
      titleText: 'Left open on purpose',
      assignment: { strategy: 'USER', userId: 1 },
      allowedOutcomes: ['DONE'],
    });

    const w1Item = await getWorkItemByNodeInstance(w1Node.id);
    await completeWorkItem({ workItemId: w1Item!.id, actorUserId: 42, outcome: 'DONE', output: {} });
    const endNode1 = await getNodeInstanceByOccurrence(instance.id, 'end-1');
    await dispatchNode({ nodeInstanceId: endNode1!.id, leaseOwnerId: leaseOwner });

    const finished = await getWorkflowInstanceById(instance.id);
    expect(finished!.status).toBe('SUCCEEDED');
  });
});
