import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { ingestWorkflowEvent } from '../eventIngressService';
import { scanAndApplySubflowResults } from '../subflowContinuationService';
import { registerCoreActionPack } from '../../actions/corePack';
import { getWorkflowInstanceById } from '../../workflowInstanceRepository';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { getWaitByOwningNodeInstance } from '../../workflowWaitRepository';
import { baseModel, endNode, subflowNode, delayNode, unconditionalEdge, cancelRegionEdge, workflowInputPath, lit } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'subflow-cancel-region-worker';
const FAR_FUTURE = '2099-01-01T00:00:00.000Z';

registerCoreActionPack();

async function publishDefinition(model: ReturnType<typeof baseModel>, keyPrefix: string) {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey(keyPrefix), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  return { definition, revision };
}

/** Never reaches a terminal state on its own within test timescales — a far-future DELAY. */
function longRunningChildModel() {
  return baseModel({
    nodes: [delayNode('d1', { type: 'UNTIL', value: lit(FAR_FUTURE) }), endNode('end-1')],
    edges: [unconditionalEdge('e-d1-end', 'd1', 'end-1')],
    start: { type: 'MANUAL_API', targetNodeKey: 'd1' },
  });
}

function quickEchoChildModel() {
  return baseModel({
    nodes: [endNode('end-1')],
    start: { type: 'MANUAL_API', targetNodeKey: 'end-1' },
  });
}

function parentModelWithCancelEvent(childDefinitionKey: string) {
  return baseModel({
    nodes: [
      subflowNode('sub1', {
        workflowDefinitionRef: { workflowDefinitionKey: childDefinitionKey },
        cancelEvent: { eventName: 'order.cancelled', correlation: workflowInputPath(['orderId']) },
      }),
      endNode('ok'),
      endNode('cancelled'),
    ],
    edges: [unconditionalEdge('e-sub-ok', 'sub1', 'ok'), cancelRegionEdge('e-sub-cancelled', 'sub1', 'cancelled')],
    start: { type: 'MANUAL_API', targetNodeKey: 'sub1' },
  });
}

describe.skipIf(!dbReady)('SUBFLOW Cancel Region (p-99/WFT-9, real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('a matching cancel event cascades-cancels the child instance, cancels the SUBFLOW node, and routes the parent through CANCEL_REGION — without failing the parent instance', async () => {
    const { definition: childDef } = await publishDefinition(longRunningChildModel(), 'cancel-region-child');
    const { revision: parentRevision } = await publishDefinition(parentModelWithCancelEvent(childDef.key), 'cancel-region-parent');
    const orderId = uniqueKey('ord');
    const { instance } = await startWorkflowInstance({ workflowRevisionId: parentRevision.id, input: { orderId } as never, startedByType: 'USER', startedById: 1 });

    const sub1 = await getNodeInstanceByOccurrence(instance.id, 'sub1');
    await dispatchNode({ nodeInstanceId: sub1!.id, leaseOwnerId: leaseOwner });

    const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'sub1'))!.id);
    expect(wait!.eventName).toBe('order.cancelled');
    const childInstanceId = wait!.childInstanceId!;

    // Put the child into a genuinely non-terminal state (WAITING on a far-future TIMER) before cancelling it.
    const childDelayNode = await getNodeInstanceByOccurrence(childInstanceId, 'd1');
    await dispatchNode({ nodeInstanceId: childDelayNode!.id, leaseOwnerId: leaseOwner });
    expect((await getWorkflowInstanceById(childInstanceId))!.status).toBe('RUNNING');

    const outcome = await ingestWorkflowEvent({
      eventName: 'order.cancelled',
      eventSourceIdentity: 'test-source',
      payload: { orderId, reason: 'customer requested' },
      correlationValue: orderId,
      leaseOwnerId: leaseOwner,
    });

    expect(outcome.correlation?.matchedWaitId).toBe(wait!.id);
    expect(outcome.inbox.status).toBe('CORRELATED');

    // The SUBFLOW node itself: CANCELLED, not SUCCEEDED/FAILED.
    const afterSub1 = await getNodeInstanceByOccurrence(instance.id, 'sub1');
    expect(afterSub1!.status).toBe('CANCELLED');
    expect(JSON.parse(afterSub1!.outputJson!)).toEqual({ orderId, reason: 'customer requested' });

    const afterWait = await getWaitByOwningNodeInstance(afterSub1!.id);
    expect(afterWait!.status).toBe('SATISFIED');

    // The parent instance itself is NOT affected — non-interrupting.
    const parentAfter = await getWorkflowInstanceById(instance.id);
    expect(parentAfter!.status).toBe('RUNNING');

    // Routed via CANCEL_REGION, not the normal UNCONDITIONAL edge.
    const cancelledNode = await getNodeInstanceByOccurrence(instance.id, 'cancelled');
    expect(cancelledNode!.status).toBe('READY');
    const okNode = await getNodeInstanceByOccurrence(instance.id, 'ok');
    expect(okNode!.status).toBe('PENDING');

    // The child instance (and its own in-flight node/wait) were cascade-cancelled.
    const childAfter = await getWorkflowInstanceById(childInstanceId);
    expect(childAfter!.status).toBe('CANCELLED');
    const childDelayAfter = await getNodeInstanceByOccurrence(childInstanceId, 'd1');
    expect(childDelayAfter!.status).toBe('CANCELLED');
    const childWait = await getWaitByOwningNodeInstance(childDelayAfter!.id);
    expect(childWait!.status).toBe('CANCELLED');
  });

  it('race: the child completing normally first wins — a cancel event arriving afterward simply does not match anything', async () => {
    const { definition: childDef } = await publishDefinition(quickEchoChildModel(), 'cancel-region-race-child');
    const { revision: parentRevision } = await publishDefinition(parentModelWithCancelEvent(childDef.key), 'cancel-region-race-parent');
    const orderId = uniqueKey('ord-race');
    const { instance } = await startWorkflowInstance({ workflowRevisionId: parentRevision.id, input: { orderId } as never, startedByType: 'USER', startedById: 1 });

    const sub1 = await getNodeInstanceByOccurrence(instance.id, 'sub1');
    await dispatchNode({ nodeInstanceId: sub1!.id, leaseOwnerId: leaseOwner });
    const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'sub1'))!.id);
    const childInstanceId = wait!.childInstanceId!;

    const childEndNode = await getNodeInstanceByOccurrence(childInstanceId, 'end-1');
    await dispatchNode({ nodeInstanceId: childEndNode!.id, leaseOwnerId: leaseOwner });
    expect((await getWorkflowInstanceById(childInstanceId))!.status).toBe('SUCCEEDED');

    const summary = await scanAndApplySubflowResults();
    expect(summary.satisfiedParents).toBeGreaterThanOrEqual(1);

    const afterSub1 = await getNodeInstanceByOccurrence(instance.id, 'sub1');
    expect(afterSub1!.status).toBe('SUCCEEDED'); // won by the normal completion path, not CANCELLED

    const outcome = await ingestWorkflowEvent({
      eventName: 'order.cancelled',
      eventSourceIdentity: 'test-source',
      payload: { orderId },
      correlationValue: orderId,
      leaseOwnerId: leaseOwner,
    });
    expect(outcome.correlation?.matchedWaitId).toBeUndefined();
    expect(outcome.inbox.status).toBe('UNMATCHED');

    // Routed via the normal UNCONDITIONAL edge, not CANCEL_REGION.
    const okNode = await getNodeInstanceByOccurrence(instance.id, 'ok');
    expect(okNode!.status).toBe('READY');
    const cancelledNode = await getNodeInstanceByOccurrence(instance.id, 'cancelled');
    expect(cancelledNode!.status).toBe('PENDING');
  });

  it('a SUBFLOW node with no cancelEvent configured never matches a same-named event (regression: this pathway stays opt-in)', async () => {
    const { definition: childDef } = await publishDefinition(longRunningChildModel(), 'no-cancel-event-child');
    const parentModel = baseModel({
      nodes: [subflowNode('sub1', { workflowDefinitionRef: { workflowDefinitionKey: childDef.key } }), endNode('ok')],
      edges: [unconditionalEdge('e-sub-ok', 'sub1', 'ok')],
      start: { type: 'MANUAL_API', targetNodeKey: 'sub1' },
    });
    const { revision: parentRevision } = await publishDefinition(parentModel, 'no-cancel-event-parent');
    const orderId = uniqueKey('ord-no-cancel');
    const { instance } = await startWorkflowInstance({ workflowRevisionId: parentRevision.id, input: { orderId } as never, startedByType: 'USER', startedById: 1 });

    const sub1 = await getNodeInstanceByOccurrence(instance.id, 'sub1');
    await dispatchNode({ nodeInstanceId: sub1!.id, leaseOwnerId: leaseOwner });

    const outcome = await ingestWorkflowEvent({
      eventName: 'order.cancelled',
      eventSourceIdentity: 'test-source',
      payload: { orderId },
      correlationValue: orderId,
      leaseOwnerId: leaseOwner,
    });
    expect(outcome.correlation?.matchedWaitId).toBeUndefined();

    const afterSub1 = await getNodeInstanceByOccurrence(instance.id, 'sub1');
    expect(afterSub1!.status).toBe('WAITING');
  });
});
