import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { getWorkItemByNodeInstance } from '../../workItemRepository';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { listWorkItemInbox } from '../workItemInboxService';
import { registerCoreActionPack } from '../../actions/corePack';
import { lit, baseModel, workItemNode, workItemOutcomeEdge, endNode } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'due-date-worker';

registerCoreActionPack();

describe.skipIf(!dbReady)('WORK_ITEM dueAt/followUpAt (HWF-2.1, real DB) — pure metadata, no automatic behavior', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('evaluates dueAt/followUpAt once at creation and persists them as ISO timestamps', async () => {
    const dueIso = '2027-01-01T00:00:00.000Z';
    const followUpIso = '2026-12-25T00:00:00.000Z';
    const model = baseModel({
      nodes: [
        workItemNode('w1', {
          assignment: { strategy: 'ROLE', roleId: 'USER' },
          allowedOutcomes: ['DONE'],
        } as never),
        endNode('end-1'),
      ],
      edges: [workItemOutcomeEdge('e-w1-end', 'w1', 'end-1', 'DONE')],
      start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
    });
    (model.nodes[0] as { dueAt?: unknown; followUpAt?: unknown }).dueAt = lit(dueIso);
    (model.nodes[0] as { dueAt?: unknown; followUpAt?: unknown }).followUpAt = lit(followUpIso);

    const definition = await createTestWorkflowDefinition({ key: uniqueKey('due-date'), draftDefinitionJson: JSON.stringify(model) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    expect(revision.publicationStatus).toBe('PUBLISHED');

    const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER', startedById: 1 });
    const w1Node = await getNodeInstanceByOccurrence(instance.id, 'w1');
    await dispatchNode({ nodeInstanceId: w1Node!.id, leaseOwnerId: leaseOwner });

    const workItem = await getWorkItemByNodeInstance(w1Node!.id);
    expect(workItem!.dueAt).toBe(dueIso);
    expect(workItem!.followUpAt).toBe(followUpIso);
  });

  it('a WORK_ITEM with no dueAt/followUpAt declared leaves both null', async () => {
    const model = baseModel({
      nodes: [
        workItemNode('w1', { assignment: { strategy: 'ROLE', roleId: 'USER' }, allowedOutcomes: ['DONE'] }),
        endNode('end-1'),
      ],
      edges: [workItemOutcomeEdge('e-w1-end', 'w1', 'end-1', 'DONE')],
      start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
    });
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('due-date-none'), draftDefinitionJson: JSON.stringify(model) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER', startedById: 1 });
    const w1Node = await getNodeInstanceByOccurrence(instance.id, 'w1');
    await dispatchNode({ nodeInstanceId: w1Node!.id, leaseOwnerId: leaseOwner });

    const workItem = await getWorkItemByNodeInstance(w1Node!.id);
    expect(workItem!.dueAt).toBeNull();
    expect(workItem!.followUpAt).toBeNull();
  });

  it('overdueOnly inbox filter includes only items whose dueAt has already passed', async () => {
    const pastIso = new Date(Date.now() - 60_000).toISOString();
    const futureIso = new Date(Date.now() + 60 * 60_000).toISOString();
    const model = baseModel({
      nodes: [
        workItemNode('w1', { assignment: { strategy: 'ROLE', roleId: 'USER' }, allowedOutcomes: ['DONE'] }),
        endNode('end-1'),
      ],
      edges: [workItemOutcomeEdge('e-w1-end', 'w1', 'end-1', 'DONE')],
      start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
    });
    (model.nodes[0] as { dueAt?: unknown }).dueAt = lit(pastIso);
    const overdueDef = await createTestWorkflowDefinition({ key: uniqueKey('due-overdue'), draftDefinitionJson: JSON.stringify(model) });
    const { revision: overdueRev } = await publishWorkflowDefinition(overdueDef.id, overdueDef.draftVersion);
    const { instance: overdueInstance } = await startWorkflowInstance({ workflowRevisionId: overdueRev.id, input: {}, startedByType: 'USER', startedById: 1 });
    const overdueNode = await getNodeInstanceByOccurrence(overdueInstance.id, 'w1');
    await dispatchNode({ nodeInstanceId: overdueNode!.id, leaseOwnerId: leaseOwner });

    const notYetModel = baseModel({
      nodes: [
        workItemNode('w1', { assignment: { strategy: 'ROLE', roleId: 'USER' }, allowedOutcomes: ['DONE'] }),
        endNode('end-1'),
      ],
      edges: [workItemOutcomeEdge('e-w1-end', 'w1', 'end-1', 'DONE')],
      start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
    });
    (notYetModel.nodes[0] as { dueAt?: unknown }).dueAt = lit(futureIso);
    const notYetDef = await createTestWorkflowDefinition({ key: uniqueKey('due-not-yet'), draftDefinitionJson: JSON.stringify(notYetModel) });
    const { revision: notYetRev } = await publishWorkflowDefinition(notYetDef.id, notYetDef.draftVersion);
    const { instance: notYetInstance } = await startWorkflowInstance({ workflowRevisionId: notYetRev.id, input: {}, startedByType: 'USER', startedById: 1 });
    const notYetNode = await getNodeInstanceByOccurrence(notYetInstance.id, 'w1');
    await dispatchNode({ nodeInstanceId: notYetNode!.id, leaseOwnerId: leaseOwner });

    const overdueWorkItem = await getWorkItemByNodeInstance(overdueNode!.id);
    const notYetWorkItem = await getWorkItemByNodeInstance(notYetNode!.id);

    const items = await listWorkItemInbox('AVAILABLE_TO_CLAIM', { userId: 1, roles: ['USER'] }, { overdueOnly: true });
    const ids = items.map((i) => i.id);
    expect(ids).toContain(overdueWorkItem!.id);
    expect(ids).not.toContain(notYetWorkItem!.id);
  });
});
