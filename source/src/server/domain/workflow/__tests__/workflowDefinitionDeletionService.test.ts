import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition, getWorkflowDefinitionById } from '../workflowDefinitionRepository';
import { deleteWorkflowDefinition, getWorkflowDeleteImpact } from '../workflowDefinitionDeletionService';
import { publishWorkflowDefinition, unpublishWorkflowDefinition } from '../publication/workflowPublicationService';
import { startWorkflowInstance } from '../engine/startService';
import { dispatchNode } from '../engine/dispatchService';
import { getNodeInstanceByOccurrence } from '../workflowNodeInstanceRepository';
import { getWorkItemByNodeInstance } from '../workItemRepository';
import { getWaitByOwningNodeInstance } from '../workflowWaitRepository';
import { prisma, toId } from '../prismaHelpers';
import { baseModel, endNode } from '../publication/__tests__/fixtures';
import { workItemNode, workItemOutcomeEdge, lit } from '../engine/__tests__/fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const manualApiModel = () => baseModel({ nodes: [endNode('end-1')], start: { type: 'MANUAL_API', targetNodeKey: 'end-1' } });
const humanWorkItemModel = () =>
  baseModel({
    nodes: [
      workItemNode('approve', {
        workItemType: 'APPROVAL',
        assignment: { strategy: 'USER', userId: '1' },
        allowedOutcomes: ['APPROVE', 'REJECT'],
        title: lit('Approve'),
      }),
      endNode('end-approved'),
      endNode('end-rejected'),
    ],
    edges: [
      workItemOutcomeEdge('e-approve', 'approve', 'end-approved', 'APPROVE'),
      workItemOutcomeEdge('e-reject', 'approve', 'end-rejected', 'REJECT'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'approve' },
  });

describe.skipIf(!dbReady)('workflowDefinitionDeletionService (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('allows deleting an unpublished draft with no execution history', async () => {
    const definition = await createTestWorkflowDefinition({
      key: uniqueKey('delete-draft'),
      draftDefinitionJson: JSON.stringify(manualApiModel()),
    });

    const impact = await getWorkflowDeleteImpact(definition.id);
    expect(impact.canDelete).toBe(true);
    expect(impact.hasExecutionHistory).toBe(false);

    await deleteWorkflowDefinition(definition.id, definition.stateVersion);
    expect(await getWorkflowDefinitionById(definition.id)).toBeUndefined();
  });

  it('blocks deleting a published workflow', async () => {
    const definition = await createTestWorkflowDefinition({
      key: uniqueKey('delete-published'),
      draftDefinitionJson: JSON.stringify(manualApiModel()),
    });
    await publishWorkflowDefinition(definition.id, definition.draftVersion);

    const impact = await getWorkflowDeleteImpact(definition.id);
    expect(impact.canDelete).toBe(false);
    expect(impact.isPublished).toBe(true);

    await expect(deleteWorkflowDefinition(definition.id, definition.stateVersion)).rejects.toMatchObject({
      code: 'WF_DEF_NOT_STARTABLE',
    });
  });

  it('allows deleting an unpublished workflow that previously had execution history', async () => {
    const definition = await createTestWorkflowDefinition({
      key: uniqueKey('delete-history'),
      draftDefinitionJson: JSON.stringify(manualApiModel()),
    });
    await publishWorkflowDefinition(definition.id, definition.draftVersion);
    const published = (await getWorkflowDefinitionById(definition.id))!;
    await unpublishWorkflowDefinition(published.id, published.stateVersion);
    const unpublished = (await getWorkflowDefinitionById(definition.id))!;

    const impact = await getWorkflowDeleteImpact(unpublished.id);
    expect(impact.canDelete).toBe(true);
    expect(impact.hasExecutionHistory).toBe(false);
    expect(impact.revisionCount).toBeGreaterThan(0);

    await deleteWorkflowDefinition(unpublished.id, unpublished.stateVersion);
    expect(await getWorkflowDefinitionById(definition.id)).toBeUndefined();
  });

  it('removes all durable rows owned by the definition (revisions, designer views, validation reports)', async () => {
    const definition = await createTestWorkflowDefinition({
      key: uniqueKey('delete-cascade'),
      draftDefinitionJson: JSON.stringify(manualApiModel()),
    });
    await publishWorkflowDefinition(definition.id, definition.draftVersion);
    const published = (await getWorkflowDefinitionById(definition.id))!;
    await unpublishWorkflowDefinition(published.id, published.stateVersion);
    const unpublished = (await getWorkflowDefinitionById(definition.id))!;

    const definitionIdBig = toId(unpublished.id);
    const beforeRevisions = await prisma().workflowRevision.count({ where: { workflowDefinitionId: definitionIdBig } });
    const beforeDesignerViews = await prisma().workflowDesignerView.count({ where: { workflowDefinitionId: definitionIdBig } });
    const beforeValidationReports = await prisma().workflowValidationReport.count({ where: { workflowDefinitionId: definitionIdBig } });
    expect(beforeRevisions).toBeGreaterThan(0);

    await deleteWorkflowDefinition(unpublished.id, unpublished.stateVersion);

    expect(await getWorkflowDefinitionById(unpublished.id)).toBeUndefined();
    expect(await prisma().workflowRevision.count({ where: { workflowDefinitionId: definitionIdBig } })).toBe(0);
    expect(await prisma().workflowDesignerView.count({ where: { workflowDefinitionId: definitionIdBig } })).toBe(0);
    expect(await prisma().workflowValidationReport.count({ where: { workflowDefinitionId: definitionIdBig } })).toBe(0);
    expect(await prisma().workflowInstance.count({ where: { revision: { workflowDefinitionId: definitionIdBig } } })).toBe(0);
    expect(beforeDesignerViews + beforeValidationReports).toBeGreaterThanOrEqual(0);
  });

  it('removes work items and waits when deleting a workflow with human execution history', async () => {
    const definition = await createTestWorkflowDefinition({
      key: uniqueKey('delete-human-history'),
      draftDefinitionJson: JSON.stringify(humanWorkItemModel()),
    });
    await publishWorkflowDefinition(definition.id, definition.draftVersion);
    const published = (await getWorkflowDefinitionById(definition.id))!;
    const revisions = await prisma().workflowRevision.findMany({
      where: { workflowDefinitionId: toId(published.id), publicationStatus: 'PUBLISHED' },
      orderBy: { id: 'desc' },
      take: 1,
    });
    const revision = revisions[0]!;
    const { instance } = await startWorkflowInstance({
      workflowRevisionId: revision.id,
      input: null,
      startedByType: 'USER',
      startedById: 1,
    });

    const approveNode = await getNodeInstanceByOccurrence(instance.id, 'approve');
    await dispatchNode({ nodeInstanceId: approveNode!.id, leaseOwnerId: 'delete-human-history' });

    const workItem = await getWorkItemByNodeInstance(approveNode!.id);
    expect(workItem).toBeDefined();
    const wait = await getWaitByOwningNodeInstance(approveNode!.id);
    expect(wait).toBeDefined();
    expect(wait!.workItemId).toBe(workItem!.id);

    await unpublishWorkflowDefinition(published.id, published.stateVersion);
    const unpublished = (await getWorkflowDefinitionById(definition.id))!;

    const impact = await getWorkflowDeleteImpact(unpublished.id);
    expect(impact.canDelete).toBe(true);
    expect(impact.hasExecutionHistory).toBe(true);
    expect(impact.instanceCount).toBeGreaterThan(0);

    await deleteWorkflowDefinition(unpublished.id, unpublished.stateVersion);

    expect(await getWorkflowDefinitionById(unpublished.id)).toBeUndefined();
    expect(await prisma().workflowInstance.count({ where: { id: instance.id } })).toBe(0);
    expect(await prisma().workItem.count({ where: { id: workItem!.id } })).toBe(0);
    expect(await prisma().workflowWait.count({ where: { id: wait!.id } })).toBe(0);
    expect(await prisma().workflowRevision.count({ where: { workflowDefinitionId: toId(unpublished.id) } })).toBe(0);
  });
});
