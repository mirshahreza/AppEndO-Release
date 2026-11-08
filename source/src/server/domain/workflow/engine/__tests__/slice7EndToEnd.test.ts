import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { scanAndCompleteDueTimers } from '../dueTimerScannerService';
import { ingestWorkflowEvent } from '../eventIngressService';
import { registerCoreActionPack } from '../../actions/corePack';
import { getWorkflowInstanceById } from '../../workflowInstanceRepository';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { listJoinArrivalsForNode } from '../../workflowJoinArrivalRepository';
import {
  baseModel,
  actionNode,
  parallelSplitNode,
  parallelJoinNode,
  delayNode,
  waitEventNode,
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
const leaseOwner = 'slice7-e2e-worker';
const PAST_INSTANT = '2000-01-01T00:00:00.000Z';
const noRetry = { maxAttempts: 1, strategy: 'FIXED' as const, initialDelayMs: 0, retryOn: [] };

registerCoreActionPack();

async function publishAndStart(model: ReturnType<typeof baseModel>, input: unknown = {}) {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('slice7-e2e'), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  return startWorkflowInstance({ workflowRevisionId: revision.id, input: input as never, startedByType: 'USER', startedById: 1 });
}

describe.skipIf(!dbReady)('Slice 7 end-to-end (real DB): ACTION -> PARALLEL_SPLIT -> [DELAY, WAIT_EVENT] -> PARALLEL_JOIN(ALL) -> END', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('joins a DELAY branch (via the Due Timer Scanner) and a WAIT_EVENT branch (via event correlation) at an ALL PARALLEL_JOIN', async () => {
    const model = baseModel({
      variables: [{ key: 'orderId', schema: { type: 'INLINE', schema: {} } }],
      nodes: [
        actionNode('render', {
          input: mappingOf({ template: lit('order-{{n}}'), variables: workflowInputPath() }),
          outputAssignments: [{ targetVariableKey: 'orderId', value: nodeOutput('render', ['text']) }],
          retryPolicy: noRetry,
        }),
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

    const render = await getNodeInstanceByOccurrence(instance.id, 'render');
    await dispatchNode({ nodeInstanceId: render!.id, leaseOwnerId: leaseOwner });

    const split1 = await getNodeInstanceByOccurrence(instance.id, 'split1');
    await dispatchNode({ nodeInstanceId: split1!.id, leaseOwnerId: leaseOwner });

    const delayBranch = await getNodeInstanceByOccurrence(instance.id, 'delayBranch');
    await dispatchNode({ nodeInstanceId: delayBranch!.id, leaseOwnerId: leaseOwner }); // creates the past-due TIMER wait

    const scanSummary = await scanAndCompleteDueTimers();
    expect(scanSummary.timerWaitsCompleted).toBeGreaterThanOrEqual(1);

    const joinAfterDelay = await getNodeInstanceByOccurrence(instance.id, 'join1');
    expect(joinAfterDelay!.status).toBe('PENDING'); // ALL: only one of two branches has arrived

    const waitBranch = await getNodeInstanceByOccurrence(instance.id, 'waitBranch');
    await dispatchNode({ nodeInstanceId: waitBranch!.id, leaseOwnerId: leaseOwner }); // creates the EVENT wait, correlated on the assigned orderId

    const ingestOutcome = await ingestWorkflowEvent({
      eventName: 'order.paid',
      eventSourceIdentity: 'test-source',
      payload: { orderId: 'order-9' },
      correlationValue: 'order-9',
      leaseOwnerId: leaseOwner,
    });
    expect(ingestOutcome.correlation?.matchedWaitId).toBeDefined();

    const joinAfterWait = await getNodeInstanceByOccurrence(instance.id, 'join1');
    expect(joinAfterWait!.status).toBe('READY');
    const arrivals = await listJoinArrivalsForNode(joinAfterWait!.id);
    expect(arrivals).toHaveLength(2);

    await dispatchNode({ nodeInstanceId: joinAfterWait!.id, leaseOwnerId: leaseOwner });
    const endNodeInstance = await getNodeInstanceByOccurrence(instance.id, 'end-1');
    expect(endNodeInstance!.status).toBe('READY');
    await dispatchNode({ nodeInstanceId: endNodeInstance!.id, leaseOwnerId: leaseOwner });

    const finalInstance = await getWorkflowInstanceById(instance.id);
    expect(finalInstance!.status).toBe('SUCCEEDED');
    expect(JSON.parse(finalInstance!.outputJson!)).toEqual({ orderId: 'order-9' });
  });
});
