import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { suspendInstance, resumeInstance, cancelInstance, forceNewInvocationForNode } from '../operationalCommands';
import { getWorkflowInstanceById } from '../../workflowInstanceRepository';
import { getNodeInstanceByOccurrence, claimReadyOrRetryingNode } from '../../workflowNodeInstanceRepository';
import { createStartedAttempt } from '../../workflowExecutionAttemptRepository';
import { computeLogicalInvocationKey } from '../../actions/logicalInvocationKey';
import { registerCoreActionPack } from '../../actions/corePack';
import { listTraceByInstance } from '../../workflowTraceRepository';
import { listProofEntriesForInstance, buildDeterministicProofForInstance, typedCoreEvidence } from '../../proofProjection';
import { baseModel, decisionNode, decisionEdge, decisionDefaultEdge, endNode, failNode, actionNode, delayNode, unconditionalEdge, workflowInputPath, workflowVariable, nodeOutput, mappingOf, lit } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'trace-test-worker';

registerCoreActionPack();

async function publishAndStart(model: ReturnType<typeof baseModel>, input: unknown = {}) {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('trace-core'), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: input as never, startedByType: 'USER', startedById: 1 });
  return { revision, instance };
}

async function dispatchByKey(instanceId: number, nodeKey: string) {
  const node = await getNodeInstanceByOccurrence(instanceId, nodeKey);
  if (!node) throw new Error(`Node "${nodeKey}" was never materialized.`);
  const outcome = await dispatchNode({ nodeInstanceId: node.id, leaseOwnerId: leaseOwner });
  if (outcome.status !== 'DISPATCHED') throw new Error(`Node "${nodeKey}" was not dispatchable: ${JSON.stringify(outcome)}`);
  return outcome;
}

describe.skipIf(!dbReady)('Slice 10 trace emission (real DB, no mocks)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  function linearModel() {
    return baseModel({
      variables: [{ key: 'greeting', schema: { type: 'INLINE', schema: {} } }],
      nodes: [
        actionNode('render', {
          input: mappingOf({ template: lit('Hello {{name}}!'), variables: workflowInputPath([]) }),
          outputAssignments: [{ targetVariableKey: 'greeting', value: nodeOutput('render', ['text']) }],
          retryPolicy: { maxAttempts: 1, strategy: 'FIXED', initialDelayMs: 0, retryOn: [] },
        }),
        decisionNode('gate'),
        endNode('end-approved', mappingOf({ greeting: workflowVariable('greeting') })),
        endNode('end-rejected', mappingOf({ greeting: workflowVariable('greeting') })),
      ],
      edges: [
        unconditionalEdge('e-render-gate', 'render', 'gate'),
        decisionEdge('e-approve', 'gate', 'end-approved', { op: 'EQ', left: workflowInputPath(['approve']), right: lit(true) }),
        decisionDefaultEdge('e-reject', 'gate', 'end-rejected'),
      ],
      start: { type: 'MANUAL_API', targetNodeKey: 'render' },
    });
  }

  it('emits a correctly-ordered, sequenceNumber-fenced trace stream for Start -> ACTION -> DECISION -> END', async () => {
    const { revision, instance } = await publishAndStart(linearModel(), { name: 'World', approve: true });
    await dispatchByKey(instance.id, 'render');
    await dispatchByKey(instance.id, 'gate');
    await dispatchByKey(instance.id, 'end-approved');

    const traces = await listTraceByInstance(instance.id);
    const types = traces.map((t) => t.traceType);

    // Doc 03 section 12/29 — sequenceNumber ASC is the sole Proof order; verify it is strictly increasing and gap-free from 1.
    traces.forEach((t, i) => expect(t.sequenceNumber).toBe(i + 1));

    expect(types).toEqual([
      'INSTANCE_STARTED',
      'NODE_READY', // start-target "render" readied
      'NODE_CLAIMED', // render claimed
      'ACTION_RESOLVED',
      'ACTION_ATTEMPT_STARTED',
      'ACTION_ATTEMPT_SUCCEEDED',
      'EXPRESSION_EVALUATED', // outputAssignments for "render"
      'EDGE_SELECTED', // render -> gate
      'NODE_READY', // gate readied
      'NODE_CLAIMED', // gate claimed
      'EDGE_SELECTED', // gate -> end-approved (DECISION true)
      'NODE_READY', // end-approved readied
      'NODE_CLAIMED', // end-approved claimed
      'INSTANCE_SUCCEEDED',
    ]);

    // Every row carries workflowRevisionId as classification-safe core evidence (doc 03 section 29).
    for (const t of traces) {
      const core = JSON.parse(t.coreEvidenceJson) as { workflowRevisionId?: string };
      expect(core.workflowRevisionId).toBe(String(revision.id));
    }

    // ACTION_RESOLVED/ACTION_ATTEMPT_STARTED/ACTION_ATTEMPT_SUCCEEDED all key off the same attemptId, logicalInvocationId.
    const resolved = JSON.parse(traces.find((t) => t.traceType === 'ACTION_RESOLVED')!.coreEvidenceJson) as Record<string, unknown>;
    const started = JSON.parse(traces.find((t) => t.traceType === 'ACTION_ATTEMPT_STARTED')!.coreEvidenceJson) as Record<string, unknown>;
    const succeeded = JSON.parse(traces.find((t) => t.traceType === 'ACTION_ATTEMPT_SUCCEEDED')!.coreEvidenceJson) as Record<string, unknown>;
    expect(resolved.attemptId).toBe(started.attemptId);
    expect(started.attemptId).toBe(succeeded.attemptId);
    expect(started.logicalInvocationId).toBe(succeeded.logicalInvocationId);
    expect(resolved.actionKey).toBe('text.template');
    expect(resolved.bindingMode).toBe('EXACT_PROVIDER');

    const edgeSelectedForGate = JSON.parse(traces.filter((t) => t.traceType === 'EDGE_SELECTED')[1].coreEvidenceJson) as Record<string, unknown>;
    expect(edgeSelectedForGate.selectionMode).toBe('EXACT_ONE');
    expect(edgeSelectedForGate.selectedEdgeKey).toBe('e-approve');

    const outputAssignmentTrace = JSON.parse(traces.find((t) => t.traceType === 'EXPRESSION_EVALUATED')!.coreEvidenceJson) as { result: { kind: string; typedResult: unknown } };
    expect(outputAssignmentTrace.result.kind).toBe('VALUE');
    expect(outputAssignmentTrace.result.typedResult).toEqual({ greeting: 'Hello World!' });
  });

  it('rejected DECISION path selects the DECISION_DEFAULT edge and records that as the selectionReason', async () => {
    const { instance } = await publishAndStart(linearModel(), { name: 'Ada', approve: false });
    await dispatchByKey(instance.id, 'render');
    await dispatchByKey(instance.id, 'gate');

    const traces = await listTraceByInstance(instance.id);
    const gateEdgeSelected = traces.filter((t) => t.traceType === 'EDGE_SELECTED')[1];
    const core = JSON.parse(gateEdgeSelected.coreEvidenceJson) as Record<string, unknown>;
    expect(core.selectedEdgeKey).toBe('e-reject');
    expect(core.selectionReason).toMatch(/DECISION_DEFAULT/);
  });

  function failingModel() {
    return baseModel({
      nodes: [
        actionNode('boom', { retryPolicy: { maxAttempts: 1, strategy: 'FIXED', initialDelayMs: 0, retryOn: [] } }),
        endNode('end-1'),
      ],
      edges: [unconditionalEdge('e1', 'boom', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'boom' },
    });
  }

  it('unhandled ACTION failure emits ACTION_ATTEMPT_FAILED then INSTANCE_FAILED with the same machineErrorCode', async () => {
    const { instance } = await publishAndStart(failingModel(), {});
    await dispatchByKey(instance.id, 'boom'); // text.template with no input.template/variables -> deterministic FAILED, no retry configured

    const finalInstance = await getWorkflowInstanceById(instance.id);
    expect(finalInstance!.status).toBe('FAILED');

    const traces = await listTraceByInstance(instance.id);
    const types = traces.map((t) => t.traceType);
    expect(types).toContain('ACTION_ATTEMPT_FAILED');
    expect(types).toContain('INSTANCE_FAILED');
    expect(types.indexOf('ACTION_ATTEMPT_FAILED')).toBeLessThan(types.indexOf('INSTANCE_FAILED'));

    const failedAttempt = JSON.parse(traces.find((t) => t.traceType === 'ACTION_ATTEMPT_FAILED')!.coreEvidenceJson) as Record<string, unknown>;
    const instanceFailed = JSON.parse(traces.find((t) => t.traceType === 'INSTANCE_FAILED')!.coreEvidenceJson) as Record<string, unknown>;
    expect(typeof failedAttempt.machineErrorCode).toBe('string');
    expect(typeof instanceFailed.machineErrorCode).toBe('string');
    expect(instanceFailed.causalIdentity).toBe('boom');
  });

  function retryableModel() {
    return baseModel({
      nodes: [
        actionNode('flaky', { input: { type: 'OBJECT', fields: {} }, retryPolicy: { maxAttempts: 3, strategy: 'FIXED', initialDelayMs: 60_000, retryOn: [{ type: 'ERROR_CODE', codes: ['WF_EXEC_ACTION_OUTPUT_INVALID'] }] } }),
        endNode('end-1'),
      ],
      edges: [unconditionalEdge('e1', 'flaky', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'flaky' },
    });
  }

  it('a retryable ACTION failure emits ACTION_ATTEMPT_FAILED and ACTION_RETRY_SCHEDULED, node stays RETRYING (no INSTANCE_FAILED yet)', async () => {
    const { instance } = await publishAndStart(retryableModel(), {});
    await dispatchByKey(instance.id, 'flaky');

    const finalInstance = await getWorkflowInstanceById(instance.id);
    expect(finalInstance!.status).toBe('RUNNING');

    const node = await getNodeInstanceByOccurrence(instance.id, 'flaky');
    expect(node!.status).toBe('RETRYING');

    const traces = await listTraceByInstance(instance.id);
    const types = traces.map((t) => t.traceType);
    expect(types).toContain('ACTION_ATTEMPT_FAILED');
    expect(types).toContain('ACTION_RETRY_SCHEDULED');
    expect(types).not.toContain('INSTANCE_FAILED');

    const retryScheduled = JSON.parse(traces.find((t) => t.traceType === 'ACTION_RETRY_SCHEDULED')!.coreEvidenceJson) as Record<string, unknown>;
    expect(retryScheduled.attemptNumber).toBe(1);
    expect(typeof retryScheduled.matchedRetrySelectorIdentity).toBe('string');
    expect(typeof retryScheduled.nextEligibleAt).toBe('string');
  });

  function failNodeModel() {
    return baseModel({
      nodes: [decisionNode('gate'), failNode('boom', lit('WF_APP_REJECTED'), lit('Rejected by policy.')), endNode('end-other')],
      edges: [decisionEdge('e-other', 'gate', 'end-other', lit(false)), decisionDefaultEdge('e-def', 'gate', 'boom')],
      start: { type: 'MANUAL_API', targetNodeKey: 'gate' },
    });
  }

  it('FAIL node dispatch emits INSTANCE_FAILED with the node-authored errorCode as machineErrorCode/causalIdentity', async () => {
    const { instance } = await publishAndStart(failNodeModel(), {});
    await dispatchByKey(instance.id, 'gate');
    await dispatchByKey(instance.id, 'boom');

    const traces = await listTraceByInstance(instance.id);
    const instanceFailed = JSON.parse(traces.find((t) => t.traceType === 'INSTANCE_FAILED')!.coreEvidenceJson) as Record<string, unknown>;
    expect(instanceFailed.machineErrorCode).toBe('WF_APP_REJECTED');
    expect(instanceFailed.causalIdentity).toBe('boom');
    expect(instanceFailed.nodeKey).toBe('boom');
  });

  it('Suspend/Resume/Cancel operational commands each emit their own instance-level trace', async () => {
    const { instance } = await publishAndStart(linearModel(), { name: 'X', approve: true });
    await suspendInstance(instance.id, (await getWorkflowInstanceById(instance.id))!.stateVersion);
    let current = (await getWorkflowInstanceById(instance.id))!;
    await resumeInstance(instance.id, current.stateVersion);
    current = (await getWorkflowInstanceById(instance.id))!;
    await cancelInstance(instance.id, current.stateVersion);

    const traces = await listTraceByInstance(instance.id);
    const types = traces.map((t) => t.traceType);
    expect(types).toContain('INSTANCE_SUSPENDED');
    expect(types).toContain('INSTANCE_RESUMED');
    expect(types).toContain('INSTANCE_CANCELLED');
    expect(types.indexOf('INSTANCE_SUSPENDED')).toBeLessThan(types.indexOf('INSTANCE_RESUMED'));
    expect(types.indexOf('INSTANCE_RESUMED')).toBeLessThan(types.indexOf('INSTANCE_CANCELLED'));
  });

  it('cancelling an instance with an ACTIVE wait emits WAIT_CANCELLED for that wait', async () => {
    const model = baseModel({
      nodes: [delayNode('wait-a-bit', { type: 'DURATION_MS', value: lit(3_600_000) }), endNode('end-1')],
      edges: [unconditionalEdge('e1', 'wait-a-bit', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'wait-a-bit' },
    });
    const { instance } = await publishAndStart(model, {});
    await dispatchByKey(instance.id, 'wait-a-bit');

    const current = (await getWorkflowInstanceById(instance.id))!;
    await cancelInstance(instance.id, current.stateVersion);

    const traces = await listTraceByInstance(instance.id);
    const waitCancelled = traces.find((t) => t.traceType === 'WAIT_CANCELLED');
    expect(waitCancelled).toBeDefined();
    const core = JSON.parse(waitCancelled!.coreEvidenceJson) as Record<string, unknown>;
    expect(core.waitType).toBe('TIMER');
    expect(core.owningNodeKey).toBe('wait-a-bit');
  });

  it('ForceNewInvocation emits ACTION_ATTEMPT_CANCELLED for the superseded attempt', async () => {
    const { instance } = await publishAndStart(retryableModel(), {});
    const node = await getNodeInstanceByOccurrence(instance.id, 'flaky');
    const claimed = await claimReadyOrRetryingNode(node!.id, node!.stateVersion, leaseOwner, 1); // 1ms lease — deliberately already-expired by the time ForceNewInvocation checks it
    const logicalInvocationId = 'force-new-invocation-fixture';
    await createStartedAttempt({
      workflowInstanceId: instance.id,
      nodeInstanceId: claimed.id,
      logicalInvocationId,
      idempotencyKey: computeLogicalInvocationKey({ workflowInstanceId: String(instance.id), nodeInstanceId: String(claimed.id), logicalInvocationId }),
      selectedProviderId: 'core',
      selectedProviderVersion: '1',
      deadlineAt: new Date(Date.now() - 1000),
    });
    await new Promise((resolve) => setTimeout(resolve, 25)); // let the 1ms lease actually expire

    await forceNewInvocationForNode({ nodeInstanceId: claimed.id, leaseOwnerId: leaseOwner, acknowledgeDuplicateEffectRisk: true });

    const traces = await listTraceByInstance(instance.id);
    const cancelled = traces.find((t) => t.traceType === 'ACTION_ATTEMPT_CANCELLED');
    expect(cancelled).toBeDefined();
    const core = JSON.parse(cancelled!.coreEvidenceJson) as Record<string, unknown>;
    expect(core.logicalInvocationId).toBe(logicalInvocationId);
  });

  it('Proof projection returns entries sequenceNumber-ordered and filters to registered types only', async () => {
    const { instance } = await publishAndStart(linearModel(), { name: 'World', approve: true });
    await dispatchByKey(instance.id, 'render');
    await dispatchByKey(instance.id, 'gate');

    const entries = await listProofEntriesForInstance(instance.id);
    expect(entries.length).toBeGreaterThan(0);
    for (let i = 1; i < entries.length; i += 1) {
      expect(entries[i].sequenceNumber).toBeGreaterThan(entries[i - 1].sequenceNumber);
    }
    expect(entries.every((e) => e.isRegisteredType)).toBe(true);

    const deterministic = await buildDeterministicProofForInstance(instance.id);
    expect(deterministic).toHaveLength(entries.length);

    const startedEntry = entries.find((e) => e.traceType === 'INSTANCE_STARTED')!;
    const typed = typedCoreEvidence(startedEntry, 'INSTANCE_STARTED');
    expect(typed.startType).toBe('MANUAL_API');
    expect(typed.startedByType).toBe('USER');
  });
});
