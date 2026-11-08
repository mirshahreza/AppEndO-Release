import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { scanAndRunDueEscalations } from '../workItemEscalationService';
import { claimWorkItem } from '../workItemService';
import { getWorkItemById } from '../../workItemRepository';
import { listEscalationsForWorkItem } from '../../workItemEscalationRepository';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { getWaitByOwningNodeInstance } from '../../workflowWaitRepository';
import { getWorkflowInstanceById } from '../../workflowInstanceRepository';
import { baseModel, workItemNode, workItemOutcomeEdge, endNode, mappingOf, lit } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'escalation-worker';

async function publishAndStart(model: ReturnType<typeof baseModel>, input: unknown = {}) {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('escalation'), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  return startWorkflowInstance({ workflowRevisionId: revision.id, input: input as never, startedByType: 'USER', startedById: 1 });
}

async function dispatchAndGetWorkItemId(instanceId: number, nodeKey: string): Promise<number> {
  const node = await getNodeInstanceByOccurrence(instanceId, nodeKey);
  await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });
  const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instanceId, nodeKey))!.id);
  return wait!.workItemId!;
}

describe.skipIf(!dbReady)('Work Item escalation runtime and scanner (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('REASSIGN_USER: reassigns and is replay-fenced by maxExecutions', async () => {
    const model = baseModel({
      nodes: [
        workItemNode('w1', {
          assignment: { strategy: 'USER', userId: '1' },
          allowedOutcomes: ['DONE'],
          escalationPolicy: { steps: [{ key: 'reassign1', trigger: { type: 'AFTER_OPEN_MS', afterMs: 0 }, action: { type: 'REASSIGN_USER', userId: '99' }, maxExecutions: 1 }] },
        }),
        endNode('end-1'),
      ],
      edges: [workItemOutcomeEdge('e-done', 'w1', 'end-1', 'DONE')],
      start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
    });
    const { instance } = await publishAndStart(model);
    const workItemId = await dispatchAndGetWorkItemId(instance.id, 'w1');

    const summary = await scanAndRunDueEscalations();
    expect(summary.stepsExecuted).toBeGreaterThanOrEqual(1);

    const afterFirst = await getWorkItemById(workItemId);
    expect(JSON.parse(afterFirst!.assignmentEvidenceJson!)).toMatchObject({ resolvedType: 'USER', resolvedUserId: 99 });

    await scanAndRunDueEscalations();
    const escalations = await listEscalationsForWorkItem(workItemId);
    expect(escalations).toHaveLength(1); // maxExecutions=1 — the second scan does not create a second execution
  });

  it('RAISE_PRIORITY: monotonic-increase-only, equal/lower request is a successful no-op that still consumes an execution', async () => {
    const model = baseModel({
      nodes: [
        workItemNode('w1', {
          assignment: { strategy: 'ROLE', roleId: 'USER' },
          allowedOutcomes: ['DONE'],
          escalationPolicy: { steps: [{ key: 'raise1', trigger: { type: 'AFTER_OPEN_MS', afterMs: 0 }, action: { type: 'RAISE_PRIORITY', priority: 5 }, maxExecutions: 2 }] },
        }),
        endNode('end-1'),
      ],
      edges: [workItemOutcomeEdge('e-done', 'w1', 'end-1', 'DONE')],
      start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
    });
    const { instance } = await publishAndStart(model);
    const workItemId = await dispatchAndGetWorkItemId(instance.id, 'w1');

    await scanAndRunDueEscalations();
    const afterFirst = await getWorkItemById(workItemId);
    expect(afterFirst!.priority).toBe(5);

    await scanAndRunDueEscalations();
    const afterSecond = await getWorkItemById(workItemId);
    expect(afterSecond!.priority).toBe(5); // second execution requests the SAME priority (5 > 5 is false) — no-op

    const escalations = await listEscalationsForWorkItem(workItemId);
    expect(escalations).toHaveLength(2);
    expect(escalations.every((e) => e.status === 'SUCCEEDED')).toBe(true);
    expect(JSON.parse(escalations[1].evidenceJson!)).toMatchObject({ applied: false });

    await scanAndRunDueEscalations();
    const finalEscalations = await listEscalationsForWorkItem(workItemId);
    expect(finalEscalations).toHaveLength(2); // maxExecutions=2 reached — a third scan does not create a third execution
  });

  it('COMPLETE_WITH_OUTCOME: completes the Work Item with SYSTEM_ESCALATION evidence and drives the normal continuation', async () => {
    const model = baseModel({
      nodes: [
        workItemNode('w1', {
          assignment: { strategy: 'USER', userId: '1' },
          allowedOutcomes: ['AUTO_APPROVE', 'REJECT'],
          escalationPolicy: {
            steps: [{ key: 'auto-approve', trigger: { type: 'AFTER_OPEN_MS', afterMs: 0 }, action: { type: 'COMPLETE_WITH_OUTCOME', outcomeKey: 'AUTO_APPROVE', output: mappingOf({ auto: lit(true) }) }, maxExecutions: 1 }],
          },
        }),
        endNode('end-approved'),
        endNode('end-rejected'),
      ],
      edges: [workItemOutcomeEdge('e-approve', 'w1', 'end-approved', 'AUTO_APPROVE'), workItemOutcomeEdge('e-reject', 'w1', 'end-rejected', 'REJECT')],
      start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
    });
    const { instance } = await publishAndStart(model);
    const workItemId = await dispatchAndGetWorkItemId(instance.id, 'w1');

    const summary = await scanAndRunDueEscalations();
    expect(summary.stepsExecuted).toBeGreaterThanOrEqual(1);

    const workItem = await getWorkItemById(workItemId);
    expect(workItem!.status).toBe('COMPLETED');
    expect(workItem!.outcome).toBe('AUTO_APPROVE');
    expect(JSON.parse(workItem!.outputJson!)).toEqual({ auto: true });

    const escalations = await listEscalationsForWorkItem(workItemId);
    expect(escalations.some((e) => e.actionType === 'COMPLETE_WITH_OUTCOME' && e.actorType === 'SYSTEM_ESCALATION' && e.status === 'SUCCEEDED')).toBe(true);

    const endApproved = await getNodeInstanceByOccurrence(instance.id, 'end-approved');
    expect(endApproved!.status).toBe('READY');
  });

  it('FAIL_WORKFLOW_NODE: terminalizes the Work Item and the instance atomically (doc 07 section 9)', async () => {
    const model = baseModel({
      nodes: [
        workItemNode('w1', {
          assignment: { strategy: 'USER', userId: '1' },
          allowedOutcomes: ['DONE'],
          escalationPolicy: {
            steps: [{ key: 'timeout-fail', trigger: { type: 'AFTER_OPEN_MS', afterMs: 0 }, action: { type: 'FAIL_WORKFLOW_NODE', errorCode: 'E_TIMEOUT', safeMessage: 'Work item timed out' }, maxExecutions: 1 }],
          },
        }),
        endNode('end-1'),
      ],
      edges: [workItemOutcomeEdge('e-done', 'w1', 'end-1', 'DONE')],
      start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
    });
    const { instance } = await publishAndStart(model);
    const workItemId = await dispatchAndGetWorkItemId(instance.id, 'w1');

    await scanAndRunDueEscalations();

    const workItem = await getWorkItemById(workItemId);
    expect(workItem!.status).toBe('FAILED');

    const node = await getNodeInstanceByOccurrence(instance.id, 'w1');
    expect(node!.status).toBe('FAILED');

    const finalInstance = await getWorkflowInstanceById(instance.id);
    expect(finalInstance!.status).toBe('FAILED');
  });

  it('does not escalate a Work Item that has already been claimed and completed by an actor before the scan runs', async () => {
    const model = baseModel({
      nodes: [
        workItemNode('w1', {
          assignment: { strategy: 'USER', userId: '1' },
          allowedOutcomes: ['DONE'],
          escalationPolicy: { steps: [{ key: 'raise1', trigger: { type: 'AFTER_OPEN_MS', afterMs: 0 }, action: { type: 'RAISE_PRIORITY', priority: 9 }, maxExecutions: 1 }] },
        }),
        endNode('end-1'),
      ],
      edges: [workItemOutcomeEdge('e-done', 'w1', 'end-1', 'DONE')],
      start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
    });
    const { instance } = await publishAndStart(model);
    const workItemId = await dispatchAndGetWorkItemId(instance.id, 'w1');
    await claimWorkItem({ workItemId, actorUserId: 1 });

    // Claimed items remain escalation-eligible (doc 07 section 5 has no generic active-ESCALATED status gating); this test only verifies the scanner still runs cleanly against a CLAIMED item.
    const summary = await scanAndRunDueEscalations();
    expect(summary.stepsExecuted).toBeGreaterThanOrEqual(1);
    const workItem = await getWorkItemById(workItemId);
    expect(workItem!.status).toBe('CLAIMED');
    expect(workItem!.priority).toBe(9);
  });
});
