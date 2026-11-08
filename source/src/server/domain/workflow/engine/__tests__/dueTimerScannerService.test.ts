import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { scanAndCompleteDueTimers } from '../dueTimerScannerService';
import { suspendInstance } from '../operationalCommands';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { getWaitByOwningNodeInstance } from '../../workflowWaitRepository';
import { baseModel, endNode, unconditionalEdge, waitTimeoutEdge, delayNode, waitEventNode, workflowInputPath, lit } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'due-timer-worker';
const PAST_INSTANT = '2000-01-01T00:00:00.000Z';

async function publishAndStart(model: ReturnType<typeof baseModel>, input: unknown = {}) {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('due-timer'), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  return startWorkflowInstance({ workflowRevisionId: revision.id, input: input as never, startedByType: 'USER', startedById: 1 });
}

describe.skipIf(!dbReady)('dueTimerScannerService (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('completes a due DELAY (TIMER wait): SATISFIED, node SUCCEEDED with null output, next node READY', async () => {
    const model = baseModel({
      nodes: [delayNode('d1', { type: 'UNTIL', value: lit(PAST_INSTANT) }), endNode('end-1')],
      edges: [unconditionalEdge('e-d1-end', 'd1', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'd1' },
    });
    const { instance } = await publishAndStart(model);
    const node = await getNodeInstanceByOccurrence(instance.id, 'd1');
    await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });

    const summary = await scanAndCompleteDueTimers();
    expect(summary.timerWaitsScanned).toBeGreaterThanOrEqual(1);
    expect(summary.timerWaitsCompleted).toBeGreaterThanOrEqual(1);

    const afterNode = await getNodeInstanceByOccurrence(instance.id, 'd1');
    expect(afterNode!.status).toBe('SUCCEEDED');
    expect(JSON.parse(afterNode!.outputJson!)).toBeNull();

    const wait = await getWaitByOwningNodeInstance(afterNode!.id);
    expect(wait!.status).toBe('SATISFIED');

    const endNodeInstance = await getNodeInstanceByOccurrence(instance.id, 'end-1');
    expect(endNodeInstance!.status).toBe('READY');
    expect(endNodeInstance!.selectedIncomingEdgeKey).toBe('e-d1-end');
  });

  it('is idempotent under a second scan pass (already-SATISFIED wait is not touched again)', async () => {
    const model = baseModel({
      nodes: [delayNode('d1', { type: 'UNTIL', value: lit(PAST_INSTANT) }), endNode('end-1')],
      edges: [unconditionalEdge('e-d1-end', 'd1', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'd1' },
    });
    const { instance } = await publishAndStart(model);
    const node = await getNodeInstanceByOccurrence(instance.id, 'd1');
    await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });
    await scanAndCompleteDueTimers();
    const afterFirstScan = await getNodeInstanceByOccurrence(instance.id, 'd1');

    await expect(scanAndCompleteDueTimers()).resolves.toBeDefined();
    const afterSecondScan = await getNodeInstanceByOccurrence(instance.id, 'd1');
    expect(afterSecondScan!.stateVersion).toBe(afterFirstScan!.stateVersion);
  });

  it('completes a timed-out WAIT_EVENT: EXPIRED wait, node SUCCEEDED with {timeoutOutcomeKey}, WAIT_TIMEOUT edge target READY', async () => {
    const model = baseModel({
      nodes: [
        waitEventNode('w1', { eventName: 'order.paid', correlation: workflowInputPath(['orderId']), timeout: { afterMs: lit(0), outcomeKey: 'timedOut' } }),
        endNode('end-1'),
        endNode('end-timeout'),
      ],
      edges: [unconditionalEdge('e-w1-end', 'w1', 'end-1'), waitTimeoutEdge('e-w1-timeout', 'w1', 'end-timeout', 'timedOut')],
      start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
    });
    const { instance } = await publishAndStart(model, { orderId: 'ord-99' });
    const node = await getNodeInstanceByOccurrence(instance.id, 'w1');
    await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });

    // afterMs: 0 means timeoutAt === wait-creation instant; give the clock a moment to pass it.
    await new Promise((resolve) => setTimeout(resolve, 5));

    const summary = await scanAndCompleteDueTimers();
    expect(summary.eventTimeoutsScanned).toBeGreaterThanOrEqual(1);
    expect(summary.eventTimeoutsCompleted).toBeGreaterThanOrEqual(1);

    const afterNode = await getNodeInstanceByOccurrence(instance.id, 'w1');
    expect(afterNode!.status).toBe('SUCCEEDED');
    expect(JSON.parse(afterNode!.outputJson!)).toEqual({ timeoutOutcomeKey: 'timedOut' });

    const wait = await getWaitByOwningNodeInstance(afterNode!.id);
    expect(wait!.status).toBe('EXPIRED');

    const endTimeout = await getNodeInstanceByOccurrence(instance.id, 'end-timeout');
    expect(endTimeout!.status).toBe('READY');
    const endNormal = await getNodeInstanceByOccurrence(instance.id, 'end-1');
    expect(endNormal!.status).toBe('PENDING');
  });

  it('skips a due TIMER wait whose owning instance is SUSPENDED (doc 06 section 19)', async () => {
    const model = baseModel({
      nodes: [delayNode('d1', { type: 'UNTIL', value: lit(PAST_INSTANT) }), endNode('end-1')],
      edges: [unconditionalEdge('e-d1-end', 'd1', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'd1' },
    });
    const { instance } = await publishAndStart(model);
    const node = await getNodeInstanceByOccurrence(instance.id, 'd1');
    await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });
    await suspendInstance(instance.id, instance.stateVersion);

    await scanAndCompleteDueTimers();

    const afterNode = await getNodeInstanceByOccurrence(instance.id, 'd1');
    expect(afterNode!.status).toBe('WAITING');
    const wait = await getWaitByOwningNodeInstance(afterNode!.id);
    expect(wait!.status).toBe('ACTIVE');
  });
});
