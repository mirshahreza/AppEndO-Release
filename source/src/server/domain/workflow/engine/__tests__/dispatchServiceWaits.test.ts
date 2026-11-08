import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { getWaitByOwningNodeInstance } from '../../workflowWaitRepository';
import { encodeCorrelationValue } from '../eventCorrelation';
import { baseModel, endNode, unconditionalEdge, waitTimeoutEdge, delayNode, waitEventNode, workflowInputPath, lit } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'wait-dispatch-worker';

async function publishAndStart(model: ReturnType<typeof baseModel>, input: unknown = {}) {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('wait-dispatch'), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  return startWorkflowInstance({ workflowRevisionId: revision.id, input: input as never, startedByType: 'USER', startedById: 1 });
}

describe.skipIf(!dbReady)('dispatchService DELAY/WAIT_EVENT wait creation (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('DELAY DURATION_MS: RUNNING -> WAITING and creates one ACTIVE TIMER wait with the correct dueAt', async () => {
    const model = baseModel({
      nodes: [delayNode('d1', { type: 'DURATION_MS', value: lit(60_000) }), endNode('end-1')],
      edges: [unconditionalEdge('e-d1-end', 'd1', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'd1' },
    });
    const { instance } = await publishAndStart(model);
    const node = await getNodeInstanceByOccurrence(instance.id, 'd1');
    const before = Date.now();
    const outcome = await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });
    expect(outcome.status).toBe('DISPATCHED');
    if (outcome.status !== 'DISPATCHED') throw new Error('unreachable');
    expect(outcome.decision.kind).toBe('CREATE_WAIT');

    const after = await getNodeInstanceByOccurrence(instance.id, 'd1');
    expect(after!.status).toBe('WAITING');

    const wait = await getWaitByOwningNodeInstance(after!.id);
    expect(wait).toBeDefined();
    expect(wait!.waitType).toBe('TIMER');
    expect(wait!.status).toBe('ACTIVE');
    const dueAtMs = new Date(wait!.dueAt!).getTime();
    expect(dueAtMs).toBeGreaterThanOrEqual(before + 60_000);
    expect(dueAtMs).toBeLessThanOrEqual(Date.now() + 60_000);
  });

  it('DELAY UNTIL: persists the exact evaluated instant as dueAt', async () => {
    const targetInstant = new Date(Date.now() + 3_600_000).toISOString();
    const model = baseModel({
      nodes: [delayNode('d1', { type: 'UNTIL', value: lit(targetInstant) }), endNode('end-1')],
      edges: [unconditionalEdge('e-d1-end', 'd1', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'd1' },
    });
    const { instance } = await publishAndStart(model);
    const node = await getNodeInstanceByOccurrence(instance.id, 'd1');
    await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });
    const wait = await getWaitByOwningNodeInstance(node!.id);
    expect(wait!.dueAt).toBe(targetInstant);
  });

  it('WAIT_EVENT untimed: RUNNING -> WAITING and creates one ACTIVE EVENT wait with the correct correlation encoding', async () => {
    const model = baseModel({
      nodes: [waitEventNode('w1', { eventName: 'order.paid', correlation: workflowInputPath(['orderId']) }), endNode('end-1')],
      edges: [unconditionalEdge('e-w1-end', 'w1', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
    });
    const { instance } = await publishAndStart(model, { orderId: 'ord-42' });
    const node = await getNodeInstanceByOccurrence(instance.id, 'w1');
    const outcome = await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });
    expect(outcome.status).toBe('DISPATCHED');

    const after = await getNodeInstanceByOccurrence(instance.id, 'w1');
    expect(after!.status).toBe('WAITING');

    const wait = await getWaitByOwningNodeInstance(after!.id);
    expect(wait!.waitType).toBe('EVENT');
    expect(wait!.eventName).toBe('order.paid');
    expect(wait!.correlationValueHash).toBe(encodeCorrelationValue('ord-42').correlationValueHash);
    expect(wait!.timeoutAt).toBeNull();
  });

  it('WAIT_EVENT timed: persists the correct timeoutAt', async () => {
    const model = baseModel({
      nodes: [
        waitEventNode('w1', { eventName: 'order.paid', correlation: workflowInputPath(['orderId']), timeout: { afterMs: lit(30_000), outcomeKey: 'timedOut' } }),
        endNode('end-1'),
        endNode('end-timeout'),
      ],
      edges: [unconditionalEdge('e-w1-end', 'w1', 'end-1'), waitTimeoutEdge('e-w1-timeout', 'w1', 'end-timeout', 'timedOut')],
      start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
    });
    const { instance } = await publishAndStart(model, { orderId: 'ord-7' });
    const node = await getNodeInstanceByOccurrence(instance.id, 'w1');
    const before = Date.now();
    await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });
    const wait = await getWaitByOwningNodeInstance(node!.id);
    expect(wait!.timeoutAt).not.toBeNull();
    const timeoutAtMs = new Date(wait!.timeoutAt!).getTime();
    expect(timeoutAtMs).toBeGreaterThanOrEqual(before + 30_000);
  });
});
