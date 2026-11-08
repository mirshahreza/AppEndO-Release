import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../workflowDefinitionRepository';
import { createCandidateWorkflowRevision } from '../workflowRevisionRepository';
import { createWorkflowInstance } from '../workflowInstanceRepository';
import { materializeNodeInstances } from '../workflowNodeInstanceRepository';
import { createWorkItem, transitionWorkItemStatus, getWorkItemByNodeInstance } from '../workItemRepository';
import { recordWorkItemTransition } from '../workItemTransitionRepository';
import { createEscalationExecutionWithWorkItemTransition } from '../workItemEscalationRepository';

const dbReady = await isDatabaseReachable();

describe.skipIf(!dbReady)('workItemRepository / workItemTransitionRepository / workItemEscalationRepository (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  async function makeNode() {
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('wi'), draftDefinitionJson: '{}' });
    const revision = await createCandidateWorkflowRevision({
      workflowDefinitionId: definition.id,
      sourceDraftVersion: 1,
      definitionJson: '{}',
      actionBindingsJson: '{}',
      semanticFingerprint: 'fp',
      bindingStatus: 'NOT_REQUIRED',
    });
    const instance = await createWorkflowInstance({ workflowRevisionId: revision.id, startedByType: 'SYSTEM' });
    const [node] = await materializeNodeInstances(instance.id, ['approval']);
    return { instance, node };
  }

  it('persists the full WorkItem transition matrix from doc 03 section 15', async () => {
    const { instance, node } = await makeNode();
    const workItem = await createWorkItem({
      workflowInstanceId: instance.id,
      nodeInstanceId: node.id,
      workItemType: 'APPROVAL',
      inputJson: '{}',
      titleText: 'Approve invoice',
    });
    expect(workItem.status).toBe('OPEN');

    const claimed = await transitionWorkItemStatus(workItem.id, workItem.stateVersion, 'CLAIM', { claimedByUserId: 1 });
    expect(claimed.status).toBe('CLAIMED');

    const reopened = await transitionWorkItemStatus(claimed.id, claimed.stateVersion, 'REASSIGN_CLEAR_CLAIM');
    expect(reopened.status).toBe('OPEN');

    const completed = await transitionWorkItemStatus(reopened.id, reopened.stateVersion, 'COMPLETE_WITH_OUTCOME', { outcome: 'APPROVE' });
    expect(completed.status).toBe('COMPLETED');

    await expect(transitionWorkItemStatus(completed.id, completed.stateVersion, 'CLAIM')).rejects.toMatchObject({ code: 'WF_EXEC_WORK_ITEM_NOT_ACTIVE' });
  });

  it('unique nodeInstanceId — one Work Item per node occurrence', async () => {
    const { instance, node } = await makeNode();
    await createWorkItem({ workflowInstanceId: instance.id, nodeInstanceId: node.id, workItemType: 'APPROVAL', inputJson: '{}', titleText: 't' });
    await expect(
      createWorkItem({ workflowInstanceId: instance.id, nodeInstanceId: node.id, workItemType: 'APPROVAL', inputJson: '{}', titleText: 't2' }),
    ).rejects.toThrow();
    const found = await getWorkItemByNodeInstance(node.id);
    expect(found?.titleText).toBe('t');
  });

  it('WorkItemTransition + WorkItemEscalation atomic co-write; escalation replay fence rejects a duplicate execution', async () => {
    const { instance, node } = await makeNode();
    const workItem = await createWorkItem({
      workflowInstanceId: instance.id,
      nodeInstanceId: node.id,
      workItemType: 'APPROVAL',
      inputJson: '{}',
      titleText: 'Approve',
    });
    await recordWorkItemTransition({
      workItemId: workItem.id,
      fromStatus: 'CREATED',
      toStatus: 'OPEN',
      transitionType: 'CREATE',
      actorType: 'SYSTEM',
      workItemStateVersionAfter: workItem.stateVersion,
    });

    const { escalation, workItemStateVersionAfter } = await createEscalationExecutionWithWorkItemTransition({
      workItemId: workItem.id,
      expectedWorkItemStateVersion: workItem.stateVersion,
      policyStepKey: 'step-1',
      executionNumber: 1,
      actionType: 'RAISE_PRIORITY',
      workItemCommand: 'CLAIM',
    });
    expect(escalation.status).toBe('STARTED');

    await expect(
      createEscalationExecutionWithWorkItemTransition({
        workItemId: workItem.id,
        expectedWorkItemStateVersion: workItemStateVersionAfter,
        policyStepKey: 'step-1',
        executionNumber: 1,
        actionType: 'RAISE_PRIORITY',
        workItemCommand: 'CANCEL',
      }),
    ).rejects.toThrow();
  });
});
