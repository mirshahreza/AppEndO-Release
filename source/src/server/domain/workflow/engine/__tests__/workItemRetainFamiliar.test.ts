import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { claimWorkItem, completeWorkItem, resolveSameAsWorkItemAssignment } from '../workItemService';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { getWaitByOwningNodeInstance } from '../../workflowWaitRepository';
import { getWorkItemById } from '../../workItemRepository';
import { registerCoreActionPack } from '../../actions/corePack';
import { baseModel, workItemNode, workItemOutcomeEdge, endNode } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'retain-familiar-worker';

registerCoreActionPack();

/** w1 (ROLE-based, open to anyone) -> w2 (SAME_AS_WORK_ITEM: w1) -> end. */
function retainFamiliarModel() {
  return baseModel({
    nodes: [
      workItemNode('w1', { assignment: { strategy: 'ROLE', roleId: 'USER' }, allowedOutcomes: ['DONE'] }),
      workItemNode('w2', { assignment: { strategy: 'SAME_AS_WORK_ITEM', workItemNodeKey: 'w1' }, allowedOutcomes: ['APPROVE'] }),
      endNode('end-1'),
    ],
    edges: [workItemOutcomeEdge('e-w1-w2', 'w1', 'w2', 'DONE'), workItemOutcomeEdge('e-w2-end', 'w2', 'end-1', 'APPROVE')],
    start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
  });
}

describe.skipIf(!dbReady)('WORK_ITEM assignment SAME_AS_WORK_ITEM / Retain Familiar (WFV2-20, real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('publish rejects SAME_AS_WORK_ITEM referencing a missing node', async () => {
    const model = retainFamiliarModel();
    (model.nodes[1] as { assignment: { workItemNodeKey?: string } }).assignment.workItemNodeKey = 'does-not-exist';
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('retain-bad-ref'), draftDefinitionJson: JSON.stringify(model) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    expect(revision.publicationStatus).toBe('REJECTED');
  });

  it('publish rejects SAME_AS_WORK_ITEM self-reference', async () => {
    const model = retainFamiliarModel();
    (model.nodes[1] as { assignment: { workItemNodeKey?: string } }).assignment.workItemNodeKey = 'w2';
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('retain-self-ref'), draftDefinitionJson: JSON.stringify(model) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    expect(revision.publicationStatus).toBe('REJECTED');
  });

  it('w2 is auto-assigned to whoever actually claimed w1', async () => {
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('retain-ok'), draftDefinitionJson: JSON.stringify(retainFamiliarModel()) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    expect(revision.publicationStatus).toBe('PUBLISHED');
    const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER', startedById: 1 });

    const w1Node = await getNodeInstanceByOccurrence(instance.id, 'w1');
    await dispatchNode({ nodeInstanceId: w1Node!.id, leaseOwnerId: leaseOwner });
    const w1Wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'w1'))!.id);
    const w1Item = await claimWorkItem({ workItemId: w1Wait!.workItemId!, actorUserId: 55 });
    await completeWorkItem({ workItemId: w1Item.id, actorUserId: 55, outcome: 'DONE', output: {} });

    const w2Node = await getNodeInstanceByOccurrence(instance.id, 'w2');
    const outcome = await dispatchNode({ nodeInstanceId: w2Node!.id, leaseOwnerId: leaseOwner });
    expect(outcome.status).toBe('DISPATCHED');
    const w2Wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'w2'))!.id);
    const w2Item = await getWorkItemById(w2Wait!.workItemId!);
    expect(JSON.parse(w2Item!.assignmentEvidenceJson!)).toMatchObject({ resolvedType: 'USER', resolvedUserId: 55, strategy: 'SAME_AS_WORK_ITEM' });

    // The retained user (and only them) can claim w2 directly.
    const claimed = await claimWorkItem({ workItemId: w2Wait!.workItemId!, actorUserId: 55 });
    expect(claimed.claimedByUserId).toBe(55);
  });

  it('degrades to the same resolved ROLE (not a specific user) when the prior Work Item was never individually claimed', async () => {
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('retain-no-claimant'), draftDefinitionJson: JSON.stringify(retainFamiliarModel()) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER', startedById: 1 });

    const w1Node = await getNodeInstanceByOccurrence(instance.id, 'w1');
    await dispatchNode({ nodeInstanceId: w1Node!.id, leaseOwnerId: leaseOwner });
    const w1Wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'w1'))!.id);
    // Completed directly (via the ROLE-resolved eligibility path) without ever calling claimWorkItem first.
    await completeWorkItem({ workItemId: w1Wait!.workItemId!, actorUserId: 55, outcome: 'DONE', output: {} });

    const preset = await resolveSameAsWorkItemAssignment(instance.id, 'w1');
    expect(preset).toMatchObject({ resolved: { type: 'ROLE', roleId: 'USER' }, evidence: { strategy: 'SAME_AS_WORK_ITEM', resolvedType: 'ROLE', resolvedRoleId: 'USER' } });
  });

  it('resolveSameAsWorkItemAssignment throws when the referenced node has no Work Item yet in this instance', async () => {
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('retain-not-yet'), draftDefinitionJson: JSON.stringify(retainFamiliarModel()) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER', startedById: 1 });

    await expect(resolveSameAsWorkItemAssignment(instance.id, 'w1')).rejects.toMatchObject({ code: 'WF_EXEC_ASSIGNMENT_RESOLUTION_FAILED' });
  });
});
