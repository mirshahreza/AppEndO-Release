import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { ingestWorkflowEvent } from '../eventIngressService';
import { scanAndRecheckUnmatchedEvents } from '../eventCorrelationService';
import { suspendInstance } from '../operationalCommands';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { getWaitByOwningNodeInstance } from '../../workflowWaitRepository';
import { getWorkflowInstanceById } from '../../workflowInstanceRepository';
import { baseModel, endNode, unconditionalEdge, waitEventNode, workflowInputPath, workflowVariable } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'event-correlation-worker';

async function publishAndStart(model: ReturnType<typeof baseModel>, input: unknown = {}) {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('event-corr'), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  return startWorkflowInstance({ workflowRevisionId: revision.id, input: input as never, startedByType: 'USER', startedById: 1 });
}

function waitEventModel(orderId = 'orderId') {
  return baseModel({
    variables: [{ key: 'paidAmount', schema: { type: 'INLINE', schema: {} } }],
    nodes: [
      waitEventNode('w1', {
        eventName: 'order.paid',
        correlation: workflowInputPath([orderId]),
        outputAssignments: [{ targetVariableKey: 'paidAmount', value: { op: 'PATH', path: { root: { type: 'CURRENT_EVENT' }, segments: ['amount'] } } }],
      }),
      endNode('end-1', { type: 'OBJECT', fields: { paidAmount: { type: 'EXPRESSION', expression: workflowVariable('paidAmount') } } }),
    ],
    edges: [unconditionalEdge('e-w1-end', 'w1', 'end-1')],
    start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
  });
}

describe.skipIf(!dbReady)('eventIngressService / eventCorrelationService (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('immediate correlation: an event matching an already-ACTIVE wait satisfies it in the same ingest call, applying outputAssignments from CURRENT_EVENT', async () => {
    const { instance } = await publishAndStart(waitEventModel(), { orderId: 'ord-a1' });
    const node = await getNodeInstanceByOccurrence(instance.id, 'w1');
    await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });

    const outcome = await ingestWorkflowEvent({
      eventName: 'order.paid',
      eventSourceIdentity: 'test-source',
      payload: { orderId: 'ord-a1', amount: 4200 },
      correlationValue: 'ord-a1',
      leaseOwnerId: leaseOwner,
    });

    expect(outcome.wasCreated).toBe(true);
    expect(outcome.correlation?.matchedWaitId).toBeDefined();
    expect(outcome.inbox.status).toBe('CORRELATED');

    const afterNode = await getNodeInstanceByOccurrence(instance.id, 'w1');
    expect(afterNode!.status).toBe('SUCCEEDED');
    expect(JSON.parse(afterNode!.outputJson!)).toEqual({ orderId: 'ord-a1', amount: 4200 });

    const wait = await getWaitByOwningNodeInstance(afterNode!.id);
    expect(wait!.status).toBe('SATISFIED');

    const finalInstance = await getWorkflowInstanceById(instance.id);
    expect(JSON.parse(finalInstance!.contextJson!)).toEqual({ paidAmount: 4200 });

    const endNodeInstance = await getNodeInstanceByOccurrence(instance.id, 'end-1');
    expect(endNodeInstance!.status).toBe('READY');
  });

  it('no correlationValue supplied: inbox is stored but never matches any EVENT wait', async () => {
    const { instance } = await publishAndStart(waitEventModel(), { orderId: 'ord-nohash' });
    const node = await getNodeInstanceByOccurrence(instance.id, 'w1');
    await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });

    const outcome = await ingestWorkflowEvent({
      eventName: 'order.paid',
      eventSourceIdentity: 'test-source',
      payload: { note: 'no correlation value' },
      leaseOwnerId: leaseOwner,
    });

    expect(outcome.correlation?.matchedWaitId).toBeUndefined();
    expect(outcome.inbox.status).toBe('UNMATCHED');

    const afterNode = await getNodeInstanceByOccurrence(instance.id, 'w1');
    expect(afterNode!.status).toBe('WAITING');
  });

  it('bounded recheck: an event that arrives before its matching wait exists is later correlated by the recheck sweep', async () => {
    const orderId = uniqueKey('ord-recheck');
    const outcome = await ingestWorkflowEvent({
      eventName: 'order.paid',
      eventSourceIdentity: 'test-source',
      payload: { orderId, amount: 999 },
      correlationValue: orderId,
      leaseOwnerId: leaseOwner,
    });
    expect(outcome.correlation?.matchedWaitId).toBeUndefined();
    expect(outcome.inbox.status).toBe('UNMATCHED');

    // The matching wait is created only now — simulating the event-before-wait race doc 03 section 23 covers.
    const { instance } = await publishAndStart(waitEventModel(), { orderId });
    const node = await getNodeInstanceByOccurrence(instance.id, 'w1');
    await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });

    const sweepSummary = await scanAndRecheckUnmatchedEvents(leaseOwner);
    expect(sweepSummary.scanned).toBeGreaterThanOrEqual(1);
    expect(sweepSummary.correlated).toBeGreaterThanOrEqual(1);

    const afterNode = await getNodeInstanceByOccurrence(instance.id, 'w1');
    expect(afterNode!.status).toBe('SUCCEEDED');
    expect(JSON.parse(afterNode!.outputJson!)).toEqual({ orderId, amount: 999 });
  });

  it('deterministic ordering: two ACTIVE waits for the same (eventName, correlationValue) — the earlier-created wait wins, the later one stays ACTIVE', async () => {
    const orderId = uniqueKey('ord-order');
    const { instance: firstInstance } = await publishAndStart(waitEventModel(), { orderId });
    const firstNode = await getNodeInstanceByOccurrence(firstInstance.id, 'w1');
    await dispatchNode({ nodeInstanceId: firstNode!.id, leaseOwnerId: leaseOwner });

    const { instance: secondInstance } = await publishAndStart(waitEventModel(), { orderId });
    const secondNode = await getNodeInstanceByOccurrence(secondInstance.id, 'w1');
    await dispatchNode({ nodeInstanceId: secondNode!.id, leaseOwnerId: leaseOwner });

    await ingestWorkflowEvent({
      eventName: 'order.paid',
      eventSourceIdentity: 'test-source',
      payload: { orderId, amount: 1 },
      correlationValue: orderId,
      leaseOwnerId: leaseOwner,
    });

    const afterFirst = await getNodeInstanceByOccurrence(firstInstance.id, 'w1');
    const afterSecond = await getNodeInstanceByOccurrence(secondInstance.id, 'w1');
    expect(afterFirst!.status).toBe('SUCCEEDED');
    expect(afterSecond!.status).toBe('WAITING');

    const secondWait = await getWaitByOwningNodeInstance(afterSecond!.id);
    expect(secondWait!.status).toBe('ACTIVE');
  });

  it('duplicate delivery (same deduplicationKey) does not double-correlate', async () => {
    const orderId = uniqueKey('ord-dedup');
    const { instance } = await publishAndStart(waitEventModel(), { orderId });
    const node = await getNodeInstanceByOccurrence(instance.id, 'w1');
    await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });

    const dedupKey = uniqueKey('dedup');
    const first = await ingestWorkflowEvent({
      eventName: 'order.paid',
      eventSourceIdentity: 'test-source',
      payload: { orderId, amount: 55 },
      correlationValue: orderId,
      deduplicationKey: dedupKey,
      leaseOwnerId: leaseOwner,
    });
    expect(first.wasCreated).toBe(true);
    expect(first.correlation?.matchedWaitId).toBeDefined();

    const second = await ingestWorkflowEvent({
      eventName: 'order.paid',
      eventSourceIdentity: 'test-source',
      payload: { orderId, amount: 55 },
      correlationValue: orderId,
      deduplicationKey: dedupKey,
      leaseOwnerId: leaseOwner,
    });
    expect(second.wasCreated).toBe(false);
    expect(second.inbox.id).toBe(first.inbox.id);
    expect(second.correlation).toBeUndefined();
  });

  it('SUSPENDED owner: an EVENT wait owned by a SUSPENDED instance cannot be satisfied by ingress', async () => {
    const orderId = uniqueKey('ord-suspended');
    const { instance } = await publishAndStart(waitEventModel(), { orderId });
    const node = await getNodeInstanceByOccurrence(instance.id, 'w1');
    await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });
    await suspendInstance(instance.id, instance.stateVersion);

    const outcome = await ingestWorkflowEvent({
      eventName: 'order.paid',
      eventSourceIdentity: 'test-source',
      payload: { orderId, amount: 1 },
      correlationValue: orderId,
      leaseOwnerId: leaseOwner,
    });

    expect(outcome.correlation?.matchedWaitId).toBeUndefined();
    expect(outcome.inbox.status).toBe('UNMATCHED');

    const afterNode = await getNodeInstanceByOccurrence(instance.id, 'w1');
    expect(afterNode!.status).toBe('WAITING');
    const wait = await getWaitByOwningNodeInstance(afterNode!.id);
    expect(wait!.status).toBe('ACTIVE');
  });
});
