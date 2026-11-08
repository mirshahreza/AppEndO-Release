import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { scanAndCompleteDueTimers } from '../dueTimerScannerService';
import { ingestWorkflowEvent } from '../eventIngressService';
import { cancelInstance } from '../operationalCommands';
import { applyFailInstanceContinuation } from '../continuationApply';
import { getWorkflowInstanceById } from '../../workflowInstanceRepository';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { getWaitByOwningNodeInstance } from '../../workflowWaitRepository';
import { registerCoreActionPack } from '../../actions/corePack';
import { baseModel, endNode, actionNode, unconditionalEdge, delayNode, waitEventNode, workflowInputPath, nodeOutput, mappingOf, lit } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'slice6-e2e-worker';
const PAST_INSTANT = '2000-01-01T00:00:00.000Z';

registerCoreActionPack();

async function publishAndStart(model: ReturnType<typeof baseModel>, input: unknown = {}) {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('slice6-e2e'), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  return startWorkflowInstance({ workflowRevisionId: revision.id, input: input as never, startedByType: 'USER', startedById: 1 });
}

describe.skipIf(!dbReady)('Slice 6 end-to-end (real DB): ACTION -> DELAY -> WAIT_EVENT -> END', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('chains ACTION -> DELAY (due-timer completion) -> WAIT_EVENT (event correlation) -> END, carrying context through the whole run', async () => {
    const model = baseModel({
      variables: [{ key: 'orderId', schema: { type: 'INLINE', schema: {} } }],
      nodes: [
        actionNode('render', {
          input: mappingOf({ template: lit('order-{{n}}'), variables: { op: 'PATH', path: { root: { type: 'WORKFLOW_INPUT' }, segments: [] } } }),
          outputAssignments: [{ targetVariableKey: 'orderId', value: nodeOutput('render', ['text']) }],
          retryPolicy: { maxAttempts: 1, strategy: 'FIXED', initialDelayMs: 0, retryOn: [] },
        }),
        delayNode('d1', { type: 'UNTIL', value: lit(PAST_INSTANT) }),
        waitEventNode('w1', { eventName: 'order.paid', correlation: { op: 'PATH', path: { root: { type: 'WORKFLOW_VARIABLE', variableKey: 'orderId' }, segments: [] } } }),
        endNode('end-1', { type: 'OBJECT', fields: { orderId: { type: 'EXPRESSION', expression: { op: 'PATH', path: { root: { type: 'WORKFLOW_VARIABLE', variableKey: 'orderId' }, segments: [] } } }, paidEvent: { type: 'EXPRESSION', expression: nodeOutput('w1') } } }),
      ],
      edges: [unconditionalEdge('e-render-d1', 'render', 'd1'), unconditionalEdge('e-d1-w1', 'd1', 'w1'), unconditionalEdge('e-w1-end', 'w1', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'render' },
    });

    const { instance } = await publishAndStart(model, { n: 7 });

    const render = await getNodeInstanceByOccurrence(instance.id, 'render');
    const renderOutcome = await dispatchNode({ nodeInstanceId: render!.id, leaseOwnerId: leaseOwner });
    expect(renderOutcome.status).toBe('DISPATCHED');

    const d1 = await getNodeInstanceByOccurrence(instance.id, 'd1');
    await dispatchNode({ nodeInstanceId: d1!.id, leaseOwnerId: leaseOwner }); // creates the past-due TIMER wait

    const scanSummary = await scanAndCompleteDueTimers();
    expect(scanSummary.timerWaitsCompleted).toBeGreaterThanOrEqual(1);

    const w1Before = await getNodeInstanceByOccurrence(instance.id, 'w1');
    expect(w1Before!.status).toBe('READY'); // readied by the due-timer completion's SELECT_EDGE
    await dispatchNode({ nodeInstanceId: w1Before!.id, leaseOwnerId: leaseOwner }); // creates the EVENT wait

    const ingestOutcome = await ingestWorkflowEvent({
      eventName: 'order.paid',
      eventSourceIdentity: 'test-source',
      payload: { orderId: 'order-7', paidAt: '2026-01-01T00:00:00.000Z' },
      correlationValue: 'order-7',
      leaseOwnerId: leaseOwner,
    });
    expect(ingestOutcome.correlation?.matchedWaitId).toBeDefined();

    const endReady = await getNodeInstanceByOccurrence(instance.id, 'end-1');
    expect(endReady!.status).toBe('READY');
    await dispatchNode({ nodeInstanceId: endReady!.id, leaseOwnerId: leaseOwner });

    const finalInstance = await getWorkflowInstanceById(instance.id);
    expect(finalInstance!.status).toBe('SUCCEEDED');
    expect(JSON.parse(finalInstance!.outputJson!)).toEqual({ orderId: 'order-7', paidEvent: { orderId: 'order-7', paidAt: '2026-01-01T00:00:00.000Z' } });
  });

  it('cancelInstance cancels an ACTIVE wait owned by a WAITING node (doc 05 section 9 fix carried over from Slice 5)', async () => {
    const model = baseModel({
      nodes: [waitEventNode('w1', { eventName: 'order.paid', correlation: workflowInputPath(['orderId']) }), endNode('end-1')],
      edges: [unconditionalEdge('e-w1-end', 'w1', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
    });
    const { instance } = await publishAndStart(model, { orderId: 'ord-cancel' });
    const w1 = await getNodeInstanceByOccurrence(instance.id, 'w1');
    await dispatchNode({ nodeInstanceId: w1!.id, leaseOwnerId: leaseOwner });

    const beforeWait = await getWaitByOwningNodeInstance(w1!.id);
    expect(beforeWait!.status).toBe('ACTIVE');

    await cancelInstance(instance.id, instance.stateVersion);

    const afterNode = await getNodeInstanceByOccurrence(instance.id, 'w1');
    expect(afterNode!.status).toBe('CANCELLED');
    const afterWait = await getWaitByOwningNodeInstance(w1!.id);
    expect(afterWait!.status).toBe('CANCELLED');
  });

  it('terminal failure of a WAITING node cancels its own ACTIVE wait (doc 05 section 29 fix carried over from Slice 5)', async () => {
    const model = baseModel({
      nodes: [waitEventNode('w1', { eventName: 'order.paid', correlation: workflowInputPath(['orderId']) }), endNode('end-1')],
      edges: [unconditionalEdge('e-w1-end', 'w1', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
    });
    const { instance } = await publishAndStart(model, { orderId: 'ord-fail' });
    const w1 = await getNodeInstanceByOccurrence(instance.id, 'w1');
    await dispatchNode({ nodeInstanceId: w1!.id, leaseOwnerId: leaseOwner });
    const waitingNode = await getNodeInstanceByOccurrence(instance.id, 'w1');
    expect(waitingNode!.status).toBe('WAITING');

    await applyFailInstanceContinuation({
      workflowInstanceId: instance.id,
      failingNodeInstanceId: waitingNode!.id,
      expectedNodeStateVersion: waitingNode!.stateVersion,
      expectedInstanceStateVersion: instance.stateVersion,
    });

    const afterNode = await getNodeInstanceByOccurrence(instance.id, 'w1');
    expect(afterNode!.status).toBe('FAILED');
    const afterInstance = await getWorkflowInstanceById(instance.id);
    expect(afterInstance!.status).toBe('FAILED');
    const afterWait = await getWaitByOwningNodeInstance(waitingNode!.id);
    expect(afterWait!.status).toBe('CANCELLED');
  });
});
