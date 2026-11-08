import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { scanAndCompleteDueTimers } from '../dueTimerScannerService';
import { ingestWorkflowEvent } from '../eventIngressService';
import { claimWorkItem, completeWorkItem } from '../workItemService';
import { scanAndRunDueEscalations } from '../workItemEscalationService';
import { scanAndApplySubflowResults } from '../subflowContinuationService';
import { scanAndRecoverExpiredLeases } from '../recoveryService';
import { registerCoreActionPack } from '../../actions/corePack';
import { getWorkflowInstanceById } from '../../workflowInstanceRepository';
import { getNodeInstanceByOccurrence, claimReadyOrRetryingNode } from '../../workflowNodeInstanceRepository';
import { getWaitByOwningNodeInstance } from '../../workflowWaitRepository';
import { listTraceByInstance } from '../../workflowTraceRepository';
import {
  baseModel,
  actionNode,
  parallelSplitNode,
  parallelJoinNode,
  delayNode,
  waitEventNode,
  workItemNode,
  workItemOutcomeEdge,
  subflowNode,
  decisionNode,
  decisionEdge,
  decisionDefaultEdge,
  endNode,
  unconditionalEdge,
  workflowInputPath,
  workflowVariable,
  mappingOf,
  lit,
  nodeOutput,
} from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'trace-adv-worker';
const PAST_INSTANT = '2000-01-01T00:00:00.000Z';
const noRetry = { maxAttempts: 1, strategy: 'FIXED' as const, initialDelayMs: 0, retryOn: [] };

registerCoreActionPack();

async function publishAndStart(model: ReturnType<typeof baseModel>, input: unknown = {}, keyPrefix = 'trace-adv') {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey(keyPrefix), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: input as never, startedByType: 'USER', startedById: 1 });
  return { revision, instance, definition };
}

async function dispatchByKey(instanceId: number, nodeKey: string) {
  const node = await getNodeInstanceByOccurrence(instanceId, nodeKey);
  if (!node) throw new Error(`Node "${nodeKey}" was never materialized.`);
  const outcome = await dispatchNode({ nodeInstanceId: node.id, leaseOwnerId: leaseOwner });
  if (outcome.status !== 'DISPATCHED') throw new Error(`Node "${nodeKey}" was not dispatchable: ${JSON.stringify(outcome)}`);
  return outcome;
}

describe.skipIf(!dbReady)('Slice 10 trace emission — parallel/wait/work-item/subflow/recovery (real DB, no mocks)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('PARALLEL_SPLIT/JOIN(ALL): PARALLEL_SPLIT_CREATED, WAIT_CREATED/WAIT_SATISFIED (TIMER), EVENT_CORRELATED, PARALLEL_JOIN_ARRIVAL x2, PARALLEL_JOIN_WON exactly once', async () => {
    const model = baseModel({
      variables: [{ key: 'orderId', schema: { type: 'INLINE', schema: {} } }],
      nodes: [
        actionNode('render', { input: mappingOf({ template: lit('order-{{n}}'), variables: workflowInputPath() }), outputAssignments: [{ targetVariableKey: 'orderId', value: nodeOutput('render', ['text']) }], retryPolicy: noRetry }),
        parallelSplitNode('split1'),
        delayNode('delayBranch', { type: 'UNTIL', value: lit(PAST_INSTANT) }),
        waitEventNode('waitBranch', { eventName: 'order.paid', correlation: workflowVariable('orderId') }),
        parallelJoinNode('join1', 'ALL'),
        endNode('end-1', mappingOf({ orderId: workflowVariable('orderId') })),
      ],
      edges: [
        unconditionalEdge('e-render-split', 'render', 'split1'),
        unconditionalEdge('e-split-delay', 'split1', 'delayBranch'),
        unconditionalEdge('e-split-wait', 'split1', 'waitBranch'),
        unconditionalEdge('e-delay-join', 'delayBranch', 'join1'),
        unconditionalEdge('e-wait-join', 'waitBranch', 'join1'),
        unconditionalEdge('e-join-end', 'join1', 'end-1'),
      ],
      start: { type: 'MANUAL_API', targetNodeKey: 'render' },
    });

    const { instance } = await publishAndStart(model, { n: 9 });
    await dispatchByKey(instance.id, 'render');
    await dispatchByKey(instance.id, 'split1');
    await dispatchByKey(instance.id, 'delayBranch');
    await scanAndCompleteDueTimers();
    await dispatchByKey(instance.id, 'waitBranch');
    await ingestWorkflowEvent({ eventName: 'order.paid', eventSourceIdentity: 'test-source', payload: { orderId: 'order-9' }, correlationValue: 'order-9', leaseOwnerId: leaseOwner });

    const traces = await listTraceByInstance(instance.id);
    const types = traces.map((t) => t.traceType);

    expect(types).toContain('PARALLEL_SPLIT_CREATED');
    expect(types.filter((t) => t === 'WAIT_CREATED')).toHaveLength(2); // delayBranch + waitBranch
    expect(types).toContain('WAIT_SATISFIED'); // delayBranch's due-timer completion
    expect(types).toContain('EVENT_CORRELATED');
    expect(types.filter((t) => t === 'PARALLEL_JOIN_ARRIVAL')).toHaveLength(2);
    expect(types.filter((t) => t === 'PARALLEL_JOIN_WON')).toHaveLength(1);

    const splitCreated = JSON.parse(traces.find((t) => t.traceType === 'PARALLEL_SPLIT_CREATED')!.coreEvidenceJson) as Record<string, unknown>;
    expect(splitCreated.splitNodeKey).toBe('split1');
    expect(splitCreated.joinNodeKey).toBe('join1');

    const eventCorrelated = JSON.parse(traces.find((t) => t.traceType === 'EVENT_CORRELATED')!.coreEvidenceJson) as Record<string, unknown>;
    expect(eventCorrelated.eventName).toBe('order.paid');
    expect(typeof eventCorrelated.candidateOrderPosition).toBe('number');

    await dispatchByKey(instance.id, 'join1');
    await dispatchByKey(instance.id, 'end-1');
    const finalInstance = await getWorkflowInstanceById(instance.id);
    expect(finalInstance!.status).toBe('SUCCEEDED');
  });

  it('PARALLEL_JOIN(ANY, cancelRemaining): PARALLEL_SIBLINGS_CANCELLED emitted once when the winning branch cancels the loser', async () => {
    const model = baseModel({
      nodes: [
        parallelSplitNode('split1'),
        delayNode('fastBranch', { type: 'UNTIL', value: lit(PAST_INSTANT) }),
        delayNode('slowBranch', { type: 'DURATION_MS', value: lit(3_600_000) }),
        parallelJoinNode('join1', 'ANY', true),
        endNode('end-1'),
      ],
      edges: [
        unconditionalEdge('e-split-fast', 'split1', 'fastBranch'),
        unconditionalEdge('e-split-slow', 'split1', 'slowBranch'),
        unconditionalEdge('e-fast-join', 'fastBranch', 'join1'),
        unconditionalEdge('e-slow-join', 'slowBranch', 'join1'),
        unconditionalEdge('e-join-end', 'join1', 'end-1'),
      ],
      start: { type: 'MANUAL_API', targetNodeKey: 'split1' },
    });

    const { instance } = await publishAndStart(model, {});
    await dispatchByKey(instance.id, 'split1');
    await dispatchByKey(instance.id, 'fastBranch');
    await dispatchByKey(instance.id, 'slowBranch');
    await scanAndCompleteDueTimers(); // only fastBranch is due

    const traces = await listTraceByInstance(instance.id);
    const types = traces.map((t) => t.traceType);
    expect(types.filter((t) => t === 'PARALLEL_JOIN_WON')).toHaveLength(1);
    expect(types).toContain('PARALLEL_SIBLINGS_CANCELLED');
    expect(types).toContain('WAIT_CANCELLED'); // slowBranch's still-ACTIVE wait cancelled as a sibling

    const slowBranchNode = await getNodeInstanceByOccurrence(instance.id, 'slowBranch');
    expect(slowBranchNode!.status).toBe('CANCELLED');
  });

  function workItemModel() {
    return baseModel({
      nodes: [
        actionNode('render', { input: mappingOf({ template: lit('review-{{n}}'), variables: workflowInputPath() }), retryPolicy: noRetry }),
        workItemNode('review', { assignment: { strategy: 'ROLE', roleId: 'USER' }, allowedOutcomes: ['APPROVE', 'REJECT'] }),
        endNode('end-approved'),
        endNode('end-rejected'),
      ],
      edges: [
        unconditionalEdge('e-render-review', 'render', 'review'),
        workItemOutcomeEdge('e-approve', 'review', 'end-approved', 'APPROVE'),
        workItemOutcomeEdge('e-reject', 'review', 'end-rejected', 'REJECT'),
      ],
      start: { type: 'MANUAL_API', targetNodeKey: 'render' },
    });
  }

  it('Work Item lifecycle: WAIT_CREATED(HUMAN), WORK_ITEM_CREATED, WORK_ITEM_CLAIMED, WORK_ITEM_COMPLETED, WAIT_SATISFIED', async () => {
    const { instance } = await publishAndStart(workItemModel(), { n: 3 }, 'trace-wi');
    await dispatchByKey(instance.id, 'render');
    await dispatchByKey(instance.id, 'review');

    const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'review'))!.id);
    const workItemId = wait!.workItemId!;
    const reviewerUserId = 7_654_321;
    await claimWorkItem({ workItemId, actorUserId: reviewerUserId });
    await completeWorkItem({ workItemId, actorUserId: reviewerUserId, outcome: 'APPROVE', output: { note: 'ok' } });

    const traces = await listTraceByInstance(instance.id);
    const types = traces.map((t) => t.traceType);
    expect(types).toContain('WORK_ITEM_CREATED');
    expect(types).toContain('WORK_ITEM_CLAIMED');
    expect(types).toContain('WORK_ITEM_COMPLETED');
    expect(types).toContain('WAIT_SATISFIED');
    expect(types.indexOf('WORK_ITEM_CLAIMED')).toBeLessThan(types.indexOf('WORK_ITEM_COMPLETED'));

    const claimedEvidence = JSON.parse(traces.find((t) => t.traceType === 'WORK_ITEM_CLAIMED')!.coreEvidenceJson) as Record<string, unknown>;
    expect(claimedEvidence.workItemId).toBe(String(workItemId));
    expect(claimedEvidence.actorType).toBe('USER');

    const completedEvidence = JSON.parse(traces.find((t) => t.traceType === 'WORK_ITEM_COMPLETED')!.coreEvidenceJson) as Record<string, unknown>;
    expect(completedEvidence.outcomeKey).toBe('APPROVE');
  });

  it('escalation RAISE_PRIORITY emits WORK_ITEM_ESCALATION_STARTED then WORK_ITEM_ESCALATION_SUCCEEDED', async () => {
    const model = baseModel({
      nodes: [
        actionNode('render', { input: mappingOf({ template: lit('t'), variables: workflowInputPath() }), retryPolicy: noRetry }),
        workItemNode('review', {
          assignment: { strategy: 'ROLE', roleId: 'USER' },
          allowedOutcomes: ['APPROVE'],
          escalationPolicy: { steps: [{ key: 'raise1', trigger: { type: 'AFTER_OPEN_MS', afterMs: 0 }, action: { type: 'RAISE_PRIORITY', priority: 5 }, maxExecutions: 1 }] },
        }),
        endNode('end-1'),
      ],
      edges: [unconditionalEdge('e-render-review', 'render', 'review'), workItemOutcomeEdge('e-approve', 'review', 'end-1', 'APPROVE')],
      start: { type: 'MANUAL_API', targetNodeKey: 'render' },
    });
    const { instance } = await publishAndStart(model, {}, 'trace-esc');
    await dispatchByKey(instance.id, 'render');
    await dispatchByKey(instance.id, 'review');

    await scanAndRunDueEscalations();

    const traces = await listTraceByInstance(instance.id);
    const types = traces.map((t) => t.traceType);
    expect(types).toContain('WORK_ITEM_ESCALATION_STARTED');
    expect(types).toContain('WORK_ITEM_ESCALATION_SUCCEEDED');
    expect(types.indexOf('WORK_ITEM_ESCALATION_STARTED')).toBeLessThan(types.indexOf('WORK_ITEM_ESCALATION_SUCCEEDED'));

    const started = JSON.parse(traces.find((t) => t.traceType === 'WORK_ITEM_ESCALATION_STARTED')!.coreEvidenceJson) as Record<string, unknown>;
    expect(started.actorType).toBe('SYSTEM_ESCALATION');
    expect(started.transitionType).toBe('RAISE_PRIORITY');
  });

  it('SUBFLOW success: SUBFLOW_STARTED on the parent, child gets its own INSTANCE_STARTED, SUBFLOW_COMPLETED + WAIT_SATISFIED once the scanner applies the result', async () => {
    const childModel = baseModel({
      nodes: [actionNode('childRender', { input: mappingOf({ template: lit('processed-{{orderId}}'), variables: workflowInputPath() }), retryPolicy: noRetry }), endNode('child-end', mappingOf({ processed: nodeOutput('childRender', ['text']) }))],
      edges: [unconditionalEdge('e-render-end', 'childRender', 'child-end')],
      start: { type: 'MANUAL_API', targetNodeKey: 'childRender' },
    });
    const { definition: childDef } = await publishAndStart(childModel, {}, 'trace-sub-child');

    const parentModel = baseModel({
      variables: [{ key: 'processedValue', schema: { type: 'INLINE', schema: {} } }],
      nodes: [
        actionNode('parentRender', { input: mappingOf({ template: lit('order-{{n}}'), variables: workflowInputPath() }), retryPolicy: noRetry }),
        subflowNode('sub1', { workflowDefinitionRef: { workflowDefinitionKey: childDef.key }, input: mappingOf({ orderId: nodeOutput('parentRender', ['text']) }), outputAssignments: [{ targetVariableKey: 'processedValue', value: { op: 'PATH', path: { root: { type: 'NODE_OUTPUT', nodeKey: 'sub1' }, segments: ['processed'] } } }] }),
        endNode('end-1', mappingOf({ processedValue: workflowVariable('processedValue') })),
      ],
      edges: [unconditionalEdge('e-render-sub', 'parentRender', 'sub1'), unconditionalEdge('e-sub-end', 'sub1', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'parentRender' },
    });
    const { instance } = await publishAndStart(parentModel, { n: 5 }, 'trace-sub-parent');
    await dispatchByKey(instance.id, 'parentRender');
    await dispatchByKey(instance.id, 'sub1');

    const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'sub1'))!.id);
    const childId = wait!.childInstanceId!;
    await dispatchByKey(childId, 'childRender');
    await dispatchByKey(childId, 'child-end');
    expect((await getWorkflowInstanceById(childId))!.status).toBe('SUCCEEDED');

    const childTraces = await listTraceByInstance(childId);
    expect(childTraces.map((t) => t.traceType)).toContain('INSTANCE_STARTED');
    const childStarted = JSON.parse(childTraces.find((t) => t.traceType === 'INSTANCE_STARTED')!.coreEvidenceJson) as Record<string, unknown>;
    expect(childStarted.startType).toBe('SUBFLOW');
    expect(childStarted.startedByType).toBe('WORKFLOW');

    const parentTracesBeforeScan = await listTraceByInstance(instance.id);
    expect(parentTracesBeforeScan.map((t) => t.traceType)).toContain('SUBFLOW_STARTED');

    const scanSummary = await scanAndApplySubflowResults();
    expect(scanSummary.satisfiedParents).toBeGreaterThanOrEqual(1);

    const parentTraces = await listTraceByInstance(instance.id);
    const types = parentTraces.map((t) => t.traceType);
    expect(types).toContain('SUBFLOW_COMPLETED');
    expect(types).toContain('WAIT_SATISFIED');

    await dispatchByKey(instance.id, 'end-1');
    expect((await getWorkflowInstanceById(instance.id))!.status).toBe('SUCCEEDED');
  });

  it('SUBFLOW failure propagates to the parent: child INSTANCE_FAILED, then the scanner applies WF_EXEC_SUBFLOW_FAILED to the parent (SUBFLOW_COMPLETED diagnostic + INSTANCE_FAILED)', async () => {
    const childModel = baseModel({
      nodes: [actionNode('childBoom', { retryPolicy: noRetry }), endNode('child-end')],
      edges: [unconditionalEdge('e1', 'childBoom', 'child-end')],
      start: { type: 'MANUAL_API', targetNodeKey: 'childBoom' },
    });
    const { definition: childDef } = await publishAndStart(childModel, {}, 'trace-subfail-child');

    const parentModel = baseModel({
      nodes: [subflowNode('sub1', { workflowDefinitionRef: { workflowDefinitionKey: childDef.key } }), endNode('end-1')],
      edges: [unconditionalEdge('e-sub-end', 'sub1', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'sub1' },
    });
    const { instance } = await publishAndStart(parentModel, {}, 'trace-subfail-parent');
    await dispatchByKey(instance.id, 'sub1');

    const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'sub1'))!.id);
    const childId = wait!.childInstanceId!;
    await dispatchByKey(childId, 'childBoom'); // text.template with no input -> deterministic FAILED, no retry
    expect((await getWorkflowInstanceById(childId))!.status).toBe('FAILED');

    await scanAndApplySubflowResults();

    const parentTraces = await listTraceByInstance(instance.id);
    const types = parentTraces.map((t) => t.traceType);
    expect(types).toContain('SUBFLOW_COMPLETED');
    expect(types).toContain('INSTANCE_FAILED');

    const subflowCompleted = parentTraces.find((t) => t.traceType === 'SUBFLOW_COMPLETED')!;
    expect(subflowCompleted.diagnosticPayloadJson).toBeTruthy();
    expect(JSON.parse(subflowCompleted.diagnosticPayloadJson!)).toEqual({ childInstanceStatus: 'FAILED' });

    const instanceFailed = JSON.parse(parentTraces.find((t) => t.traceType === 'INSTANCE_FAILED')!.coreEvidenceJson) as Record<string, unknown>;
    expect(instanceFailed.machineErrorCode).toBe('WF_EXEC_SUBFLOW_FAILED');

    expect((await getWorkflowInstanceById(instance.id))!.status).toBe('FAILED');
  });

  it('RECOVERY_CLAIMED is emitted when the recovery scanner reclaims a stale RUNNING node with no in-flight attempt', async () => {
    const model = baseModel({ nodes: [decisionNode('gate'), endNode('end-yes'), endNode('end-no')], edges: [decisionEdge('e-yes', 'gate', 'end-yes', lit(true)), decisionDefaultEdge('e-no', 'gate', 'end-no')], start: { type: 'MANUAL_API', targetNodeKey: 'gate' } });
    const { instance } = await publishAndStart(model, {}, 'trace-recovery');
    const gate = await getNodeInstanceByOccurrence(instance.id, 'gate');
    // Claim with an already-past lease so the node is RUNNING with an expired lease and no attempt row (DECISION has none) — exactly recoverStaleRunningNode's target shape.
    await claimReadyOrRetryingNode(gate!.id, gate!.stateVersion, leaseOwner, 1);
    await new Promise((resolve) => setTimeout(resolve, 25));

    const summary = await scanAndRecoverExpiredLeases(leaseOwner);
    expect(summary.staleReclaimed).toBeGreaterThanOrEqual(1);

    const traces = await listTraceByInstance(instance.id);
    const recoveryClaimed = traces.find((t) => t.traceType === 'RECOVERY_CLAIMED');
    expect(recoveryClaimed).toBeDefined();
    const core = JSON.parse(recoveryClaimed!.coreEvidenceJson) as Record<string, unknown>;
    expect(core.recoveryPathClassification).toBe('STALE_NODE_REDRIVE');
    expect(core.nodeOrAttemptIdentity).toBe(`node:${gate!.id}`);
  });
});
