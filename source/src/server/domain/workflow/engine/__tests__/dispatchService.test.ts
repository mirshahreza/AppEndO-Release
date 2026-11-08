import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { getWorkflowInstanceById } from '../../workflowInstanceRepository';
import { getNodeInstanceByOccurrence, listNodeInstancesForInstance } from '../../workflowNodeInstanceRepository';
import { listAttemptsForNode } from '../../workflowExecutionAttemptRepository';
import { registerCoreActionPack } from '../../actions/corePack';
import {
  baseModel,
  decisionNode,
  decisionEdge,
  decisionDefaultEdge,
  switchNode,
  endNode,
  failNode,
  actionNode,
  unconditionalEdge,
  workflowInputPath,
  nodeOutput,
  mappingOf,
  lit,
} from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'test-worker';

registerCoreActionPack();

async function publishAndStart(model: ReturnType<typeof baseModel>, input: unknown = {}) {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('dispatch'), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  return startWorkflowInstance({ workflowRevisionId: revision.id, input: input as never, startedByType: 'USER', startedById: 1 });
}

describe.skipIf(!dbReady)('dispatchService (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('DECISION: evaluates conditions, selects the true edge, and readies the target', async () => {
    const model = baseModel({
      nodes: [decisionNode('d1'), endNode('end-high'), endNode('end-low')],
      edges: [
        decisionEdge('e-high', 'd1', 'end-high', { op: 'GTE', left: workflowInputPath(['total']), right: lit(100) }),
        decisionDefaultEdge('e-low', 'd1', 'end-low'),
      ],
      start: { type: 'MANUAL_API', targetNodeKey: 'd1' },
    });
    const { instance } = await publishAndStart(model, { total: 200 });
    const d1 = await getNodeInstanceByOccurrence(instance.id, 'd1');
    const outcome = await dispatchNode({ nodeInstanceId: d1!.id, leaseOwnerId: leaseOwner });
    expect(outcome).toMatchObject({ status: 'DISPATCHED', decision: { kind: 'SELECT_EDGE', edgeKey: 'e-high' } });

    const endHigh = await getNodeInstanceByOccurrence(instance.id, 'end-high');
    const endLow = await getNodeInstanceByOccurrence(instance.id, 'end-low');
    expect(endHigh!.status).toBe('READY');
    expect(endHigh!.selectedIncomingEdgeKey).toBe('e-high');
    expect(endLow!.status).toBe('PENDING');
  });

  it('SWITCH: matches the case and selects that edge', async () => {
    const model = baseModel({
      nodes: [switchNode('s1', workflowInputPath(['tier'])), endNode('end-gold'), endNode('end-def')],
      edges: [
        { key: 'e-gold', fromNodeKey: 's1', toNodeKey: 'end-gold', selector: { type: 'SWITCH_CASE', value: 'gold' } },
        { key: 'e-def', fromNodeKey: 's1', toNodeKey: 'end-def', selector: { type: 'SWITCH_DEFAULT' } },
      ],
      start: { type: 'MANUAL_API', targetNodeKey: 's1' },
    });
    const { instance } = await publishAndStart(model, { tier: 'gold' });
    const s1 = await getNodeInstanceByOccurrence(instance.id, 's1');
    const outcome = await dispatchNode({ nodeInstanceId: s1!.id, leaseOwnerId: leaseOwner });
    expect(outcome).toMatchObject({ status: 'DISPATCHED', decision: { kind: 'SELECT_EDGE', edgeKey: 'e-gold' } });
  });

  it('END: completes the instance with the mapped output', async () => {
    const model = baseModel({
      nodes: [endNode('end-1', mappingOf({ total: workflowInputPath(['total']) }))],
      start: { type: 'MANUAL_API', targetNodeKey: 'end-1' },
    });
    const { instance } = await publishAndStart(model, { total: 42 });
    const end1 = await getNodeInstanceByOccurrence(instance.id, 'end-1');
    const outcome = await dispatchNode({ nodeInstanceId: end1!.id, leaseOwnerId: leaseOwner });
    expect(outcome).toMatchObject({ status: 'DISPATCHED', decision: { kind: 'COMPLETE_INSTANCE', output: { total: 42 } } });

    const reloaded = await getWorkflowInstanceById(instance.id);
    expect(reloaded!.status).toBe('SUCCEEDED');
    expect(JSON.parse(reloaded!.outputJson!)).toEqual({ total: 42 });
  });

  it('FAIL: fails the node and instance, and cancels sibling non-terminal occurrences', async () => {
    const model = baseModel({
      nodes: [decisionNode('d1'), failNode('fail-1', lit('WF_TEST_FAILURE'), lit('boom')), endNode('end-other')],
      edges: [decisionEdge('e-other', 'd1', 'end-other', lit(false)), decisionDefaultEdge('e-def', 'd1', 'fail-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'd1' },
    });
    const { instance } = await publishAndStart(model);
    const d1 = await getNodeInstanceByOccurrence(instance.id, 'd1');
    await dispatchNode({ nodeInstanceId: d1!.id, leaseOwnerId: leaseOwner });
    const fail1 = await getNodeInstanceByOccurrence(instance.id, 'fail-1');
    const outcome = await dispatchNode({ nodeInstanceId: fail1!.id, leaseOwnerId: leaseOwner });
    expect(outcome).toMatchObject({ status: 'DISPATCHED', decision: { kind: 'FAIL_INSTANCE', errorCode: 'WF_TEST_FAILURE', safeMessage: 'boom' } });

    const reloaded = await getWorkflowInstanceById(instance.id);
    expect(reloaded!.status).toBe('FAILED');
    const endOther = await getNodeInstanceByOccurrence(instance.id, 'end-other');
    expect(endOther!.status).toBe('CANCELLED');
  });

  it('ACTION (success): invokes the real text.template executor, applies outputAssignments, and readies the next node', async () => {
    const model = baseModel({
      variables: [{ key: 'greeting', schema: { type: 'INLINE', schema: {} } }],
      nodes: [
        actionNode('render', {
          input: mappingOf({ template: lit('Hello {{name}}!'), variables: lit({ name: 'World' }) as never }),
          outputAssignments: [{ targetVariableKey: 'greeting', value: nodeOutput('render', ['text']) }],
          retryPolicy: { maxAttempts: 1, strategy: 'FIXED', initialDelayMs: 0, retryOn: [] },
        }),
        endNode('end-1', mappingOf({ greeting: { op: 'PATH', path: { root: { type: 'WORKFLOW_VARIABLE', variableKey: 'greeting' }, segments: [] } } })),
      ],
      edges: [unconditionalEdge('e1', 'render', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'render' },
    });
    const { instance } = await publishAndStart(model);
    const render = await getNodeInstanceByOccurrence(instance.id, 'render');
    const outcome = await dispatchNode({ nodeInstanceId: render!.id, leaseOwnerId: leaseOwner });
    expect(outcome).toMatchObject({ status: 'DISPATCHED', decision: { kind: 'SELECT_EDGE', edgeKey: 'e1', nodeOutput: { text: 'Hello World!' } } });

    const attempts = await listAttemptsForNode(render!.id);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].status).toBe('SUCCEEDED');
    expect(attempts[0].logicalInvocationId).toBeTruthy();

    const reloadedInstance = await getWorkflowInstanceById(instance.id);
    expect(JSON.parse(reloadedInstance!.contextJson!)).toEqual({ greeting: 'Hello World!' });

    const end1 = await getNodeInstanceByOccurrence(instance.id, 'end-1');
    expect(end1!.status).toBe('READY');
  });

  it('ACTION (retryable failure then exhaustion): schedules RETRYING with nextEligibleAt, then fails the instance once retries are exhausted', async () => {
    const model = baseModel({
      nodes: [
        actionNode('bad', {
          input: mappingOf({ template: lit(123) as never }), // wrong type -> deterministic FAILED from text.template
          retryPolicy: { maxAttempts: 2, strategy: 'FIXED', initialDelayMs: 0, retryOn: [{ type: 'ERROR_CODE', codes: ['WF_EXEC_ACTION_OUTPUT_INVALID'] }] },
        }),
        endNode('end-1'),
      ],
      edges: [unconditionalEdge('e1', 'bad', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'bad' },
    });
    const { instance } = await publishAndStart(model);
    const bad = await getNodeInstanceByOccurrence(instance.id, 'bad');

    const firstOutcome = await dispatchNode({ nodeInstanceId: bad!.id, leaseOwnerId: leaseOwner });
    expect(firstOutcome).toMatchObject({ status: 'DISPATCHED', decision: { kind: 'RETRY_SCHEDULED' } });
    const afterFirst = await getNodeInstanceByOccurrence(instance.id, 'bad');
    expect(afterFirst!.status).toBe('RETRYING');
    expect(afterFirst!.leaseOwnerId).toBeNull();
    expect(afterFirst!.nextEligibleAt).not.toBeNull();

    const secondOutcome = await dispatchNode({ nodeInstanceId: bad!.id, leaseOwnerId: leaseOwner });
    expect(secondOutcome).toMatchObject({ status: 'DISPATCHED', decision: { kind: 'FAIL_INSTANCE' } });

    const attempts = await listAttemptsForNode(bad!.id);
    expect(attempts.map((a) => a.status)).toEqual(['FAILED', 'FAILED']);
    expect(attempts[0].logicalInvocationId).toBe(attempts[1].logicalInvocationId);
    expect(attempts[0].idempotencyKey).toBe(attempts[1].idempotencyKey);

    const reloadedInstance = await getWorkflowInstanceById(instance.id);
    expect(reloadedInstance!.status).toBe('FAILED');
  });

  it('ACTION (non-retryable failure): fails the instance on the first attempt when no retry selector matches', async () => {
    const model = baseModel({
      nodes: [
        actionNode('bad', {
          input: mappingOf({ template: lit(123) as never }),
          retryPolicy: { maxAttempts: 3, strategy: 'FIXED', initialDelayMs: 0, retryOn: [{ type: 'TIMEOUT' }] },
        }),
        endNode('end-1'),
      ],
      edges: [unconditionalEdge('e1', 'bad', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'bad' },
    });
    const { instance } = await publishAndStart(model);
    const bad = await getNodeInstanceByOccurrence(instance.id, 'bad');
    const outcome = await dispatchNode({ nodeInstanceId: bad!.id, leaseOwnerId: leaseOwner });
    expect(outcome).toMatchObject({ status: 'DISPATCHED', decision: { kind: 'FAIL_INSTANCE' } });

    const attempts = await listAttemptsForNode(bad!.id);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].status).toBe('FAILED');

    const reloadedInstance = await getWorkflowInstanceById(instance.id);
    expect(reloadedInstance!.status).toBe('FAILED');
  });

  it('dispatch is not eligible when the instance is not RUNNING or the node is not READY/due-RETRYING', async () => {
    const model = baseModel({ nodes: [endNode('end-1')], start: { type: 'MANUAL_API', targetNodeKey: 'end-1' } });
    const { instance } = await publishAndStart(model);
    const end1 = await getNodeInstanceByOccurrence(instance.id, 'end-1');
    await dispatchNode({ nodeInstanceId: end1!.id, leaseOwnerId: leaseOwner }); // completes the instance
    const outcome = await dispatchNode({ nodeInstanceId: end1!.id, leaseOwnerId: leaseOwner });
    expect(outcome).toEqual({ status: 'NOT_ELIGIBLE', reason: 'INSTANCE_NOT_EXECUTABLE' });
  });
});
