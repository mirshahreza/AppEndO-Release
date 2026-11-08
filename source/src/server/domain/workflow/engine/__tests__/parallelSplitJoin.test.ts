import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { cancelInstance } from '../operationalCommands';
import { registerCoreActionPack } from '../../actions/corePack';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { getBranchTokenById } from '../../workflowBranchTokenRepository';
import { listJoinArrivalsForNode } from '../../workflowJoinArrivalRepository';
import { getWaitByOwningNodeInstance } from '../../workflowWaitRepository';
import { getWorkflowInstanceById } from '../../workflowInstanceRepository';
import {
  baseModel,
  parallelSplitNode,
  parallelJoinNode,
  actionNode,
  decisionNode,
  decisionEdge,
  decisionDefaultEdge,
  endNode,
  unconditionalEdge,
  waitEventNode,
  workflowInputPath,
  mappingOf,
  lit,
} from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'parallel-worker';
const noRetry = { maxAttempts: 1, strategy: 'FIXED' as const, initialDelayMs: 0, retryOn: [] };
/** `text.template` (doc 04 core pack) requires `input.template` (string) + `input.variables` (object). */
const trivialTemplateInput = () => mappingOf({ template: lit('ok'), variables: lit({}) });

registerCoreActionPack();

async function publishAndStart(model: ReturnType<typeof baseModel>, input: unknown = {}) {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('parallel'), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  return startWorkflowInstance({ workflowRevisionId: revision.id, input: input as never, startedByType: 'USER', startedById: 1 });
}

function twoBranchModel(joinMode: 'ALL' | 'ANY', cancelRemaining?: boolean) {
  return baseModel({
    nodes: [
      parallelSplitNode('split1'),
      actionNode('branchA', { retryPolicy: noRetry, input: trivialTemplateInput() }),
      actionNode('branchB', { retryPolicy: noRetry, input: trivialTemplateInput() }),
      parallelJoinNode('join1', joinMode, cancelRemaining),
      endNode('end-1'),
    ],
    edges: [
      unconditionalEdge('e-split-a', 'split1', 'branchA'),
      unconditionalEdge('e-split-b', 'split1', 'branchB'),
      unconditionalEdge('e-a-join', 'branchA', 'join1'),
      unconditionalEdge('e-b-join', 'branchB', 'join1'),
      unconditionalEdge('e-join-end', 'join1', 'end-1'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'split1' },
  });
}

describe.skipIf(!dbReady)('PARALLEL_SPLIT / PARALLEL_JOIN (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('PARALLEL_SPLIT creates one ACTIVE branch token per branch and readies both branch entry nodes with distinct tokens', async () => {
    const { instance } = await publishAndStart(twoBranchModel('ALL'));
    const split1 = await getNodeInstanceByOccurrence(instance.id, 'split1');
    const outcome = await dispatchNode({ nodeInstanceId: split1!.id, leaseOwnerId: leaseOwner });
    expect(outcome.status).toBe('DISPATCHED');
    if (outcome.status !== 'DISPATCHED') throw new Error('unreachable');
    expect(outcome.decision.kind).toBe('START_PARALLEL');

    const branchA = await getNodeInstanceByOccurrence(instance.id, 'branchA');
    const branchB = await getNodeInstanceByOccurrence(instance.id, 'branchB');
    expect(branchA!.status).toBe('READY');
    expect(branchB!.status).toBe('READY');
    expect(branchA!.branchTokenId).not.toBeNull();
    expect(branchB!.branchTokenId).not.toBeNull();
    expect(branchA!.branchTokenId).not.toBe(branchB!.branchTokenId);

    const tokenA = await getBranchTokenById(branchA!.branchTokenId!);
    expect(tokenA!.status).toBe('ACTIVE');
    expect(tokenA!.splitNodeKey).toBe('split1');
    expect(tokenA!.joinNodeKey).toBe('join1');
  });

  it('ALL join: satisfies only after both branches arrive; join node stays PENDING after the first arrival', async () => {
    const { instance } = await publishAndStart(twoBranchModel('ALL'));
    const split1 = await getNodeInstanceByOccurrence(instance.id, 'split1');
    await dispatchNode({ nodeInstanceId: split1!.id, leaseOwnerId: leaseOwner });

    const branchA = await getNodeInstanceByOccurrence(instance.id, 'branchA');
    await dispatchNode({ nodeInstanceId: branchA!.id, leaseOwnerId: leaseOwner });

    const afterA = await getNodeInstanceByOccurrence(instance.id, 'branchA');
    expect(afterA!.status).toBe('SUCCEEDED');
    const tokenA = await getBranchTokenById(afterA!.branchTokenId!);
    expect(tokenA!.status).toBe('ARRIVED');

    const joinAfterFirstArrival = await getNodeInstanceByOccurrence(instance.id, 'join1');
    expect(joinAfterFirstArrival!.status).toBe('PENDING'); // ALL: not satisfied yet
    expect(joinAfterFirstArrival!.branchTokenId).toBeNull(); // doc 03 section 32: the join never inherits a branch token

    const arrivalsAfterFirst = await listJoinArrivalsForNode(joinAfterFirstArrival!.id);
    expect(arrivalsAfterFirst).toHaveLength(1);

    const branchB = await getNodeInstanceByOccurrence(instance.id, 'branchB');
    await dispatchNode({ nodeInstanceId: branchB!.id, leaseOwnerId: leaseOwner });

    const joinAfterSecondArrival = await getNodeInstanceByOccurrence(instance.id, 'join1');
    expect(joinAfterSecondArrival!.status).toBe('READY');
    const arrivalsAfterSecond = await listJoinArrivalsForNode(joinAfterSecondArrival!.id);
    expect(arrivalsAfterSecond).toHaveLength(2);
    expect(joinAfterSecondArrival!.joinGroupKey).toBe('split1');

    await dispatchNode({ nodeInstanceId: joinAfterSecondArrival!.id, leaseOwnerId: leaseOwner });
    const joinFinal = await getNodeInstanceByOccurrence(instance.id, 'join1');
    expect(joinFinal!.status).toBe('SUCCEEDED');
    expect(joinFinal!.branchTokenId).toBeNull();
    const endNodeInstance = await getNodeInstanceByOccurrence(instance.id, 'end-1');
    expect(endNodeInstance!.status).toBe('READY');

    await dispatchNode({ nodeInstanceId: endNodeInstance!.id, leaseOwnerId: leaseOwner });
    const finalInstance = await getWorkflowInstanceById(instance.id);
    expect(finalInstance!.status).toBe('SUCCEEDED');
  });

  it('ANY join without cancelRemaining: first arrival wins and readies the join; the later branch still completes as evidence but does not re-win', async () => {
    const { instance } = await publishAndStart(twoBranchModel('ANY', false));
    const split1 = await getNodeInstanceByOccurrence(instance.id, 'split1');
    await dispatchNode({ nodeInstanceId: split1!.id, leaseOwnerId: leaseOwner });

    const branchA = await getNodeInstanceByOccurrence(instance.id, 'branchA');
    await dispatchNode({ nodeInstanceId: branchA!.id, leaseOwnerId: leaseOwner });
    const joinAfterA = await getNodeInstanceByOccurrence(instance.id, 'join1');
    expect(joinAfterA!.status).toBe('READY');

    const branchB = await getNodeInstanceByOccurrence(instance.id, 'branchB');
    expect(branchB!.status).toBe('READY'); // not cancelled — cancelRemaining is false
    await dispatchNode({ nodeInstanceId: branchB!.id, leaseOwnerId: leaseOwner });
    const afterB = await getNodeInstanceByOccurrence(instance.id, 'branchB');
    expect(afterB!.status).toBe('SUCCEEDED'); // completes as evidence/terminal branch work
    const tokenB = await getBranchTokenById(afterB!.branchTokenId!);
    expect(tokenB!.status).toBe('ARRIVED');

    // The join itself is unaffected by the second, non-winning arrival — still exactly READY once.
    const joinAfterB = await getNodeInstanceByOccurrence(instance.id, 'join1');
    expect(joinAfterB!.status).toBe('READY');
    expect(joinAfterB!.stateVersion).toBe(joinAfterA!.stateVersion);
    const arrivals = await listJoinArrivalsForNode(joinAfterB!.id);
    expect(arrivals).toHaveLength(2);
  });

  it('ANY + cancelRemaining=true: durably cancels the sibling branch node and its branch token exactly once', async () => {
    const { instance } = await publishAndStart(twoBranchModel('ANY', true));
    const split1 = await getNodeInstanceByOccurrence(instance.id, 'split1');
    await dispatchNode({ nodeInstanceId: split1!.id, leaseOwnerId: leaseOwner });

    const branchA = await getNodeInstanceByOccurrence(instance.id, 'branchA');
    await dispatchNode({ nodeInstanceId: branchA!.id, leaseOwnerId: leaseOwner });

    const branchB = await getNodeInstanceByOccurrence(instance.id, 'branchB');
    expect(branchB!.status).toBe('CANCELLED');
    const tokenB = await getBranchTokenById(branchB!.branchTokenId!);
    expect(tokenB!.status).toBe('CANCELLED');

    const outcome = await dispatchNode({ nodeInstanceId: branchB!.id, leaseOwnerId: leaseOwner });
    expect(outcome.status).toBe('NOT_ELIGIBLE');

    const joinNode = await getNodeInstanceByOccurrence(instance.id, 'join1');
    expect(joinNode!.status).toBe('READY');
  });

  it('branchTokenId propagates through a multi-node branch (DECISION then ACTION) before reaching the join', async () => {
    const model = baseModel({
      nodes: [
        parallelSplitNode('split1'),
        decisionNode('gateA'),
        actionNode('actionA', { retryPolicy: noRetry, input: trivialTemplateInput() }),
        actionNode('branchB', { retryPolicy: noRetry, input: trivialTemplateInput() }),
        parallelJoinNode('join1', 'ALL'),
        endNode('end-1'),
      ],
      edges: [
        unconditionalEdge('e-split-gate', 'split1', 'gateA'),
        decisionEdge('e-gate-never', 'gateA', 'actionA', lit(false)),
        decisionDefaultEdge('e-gate-action', 'gateA', 'actionA'),
        unconditionalEdge('e-action-join', 'actionA', 'join1'),
        unconditionalEdge('e-split-b', 'split1', 'branchB'),
        unconditionalEdge('e-b-join', 'branchB', 'join1'),
        unconditionalEdge('e-join-end', 'join1', 'end-1'),
      ],
      start: { type: 'MANUAL_API', targetNodeKey: 'split1' },
    });
    const { instance } = await publishAndStart(model);
    const split1 = await getNodeInstanceByOccurrence(instance.id, 'split1');
    await dispatchNode({ nodeInstanceId: split1!.id, leaseOwnerId: leaseOwner });

    const gateA = await getNodeInstanceByOccurrence(instance.id, 'gateA');
    const tokenIdAtSplit = gateA!.branchTokenId;
    expect(tokenIdAtSplit).not.toBeNull();

    await dispatchNode({ nodeInstanceId: gateA!.id, leaseOwnerId: leaseOwner });
    const actionA = await getNodeInstanceByOccurrence(instance.id, 'actionA');
    expect(actionA!.branchTokenId).toBe(tokenIdAtSplit); // propagated across the DECISION -> ACTION edge within the same branch

    await dispatchNode({ nodeInstanceId: actionA!.id, leaseOwnerId: leaseOwner });
    const tokenAfterArrival = await getBranchTokenById(tokenIdAtSplit!);
    expect(tokenAfterArrival!.status).toBe('ARRIVED');
  });

  it('two concurrent last-arrivals for an ALL join with 3 branches: only the true last one satisfies the join, exactly once', async () => {
    const model = baseModel({
      nodes: [
        parallelSplitNode('split1'),
        actionNode('branchA', { retryPolicy: noRetry, input: trivialTemplateInput() }),
        actionNode('branchB', { retryPolicy: noRetry, input: trivialTemplateInput() }),
        actionNode('branchC', { retryPolicy: noRetry, input: trivialTemplateInput() }),
        parallelJoinNode('join1', 'ALL'),
        endNode('end-1'),
      ],
      edges: [
        unconditionalEdge('e-split-a', 'split1', 'branchA'),
        unconditionalEdge('e-split-b', 'split1', 'branchB'),
        unconditionalEdge('e-split-c', 'split1', 'branchC'),
        unconditionalEdge('e-a-join', 'branchA', 'join1'),
        unconditionalEdge('e-b-join', 'branchB', 'join1'),
        unconditionalEdge('e-c-join', 'branchC', 'join1'),
        unconditionalEdge('e-join-end', 'join1', 'end-1'),
      ],
      start: { type: 'MANUAL_API', targetNodeKey: 'split1' },
    });
    const { instance } = await publishAndStart(model);
    const split1 = await getNodeInstanceByOccurrence(instance.id, 'split1');
    await dispatchNode({ nodeInstanceId: split1!.id, leaseOwnerId: leaseOwner });

    const branchA = await getNodeInstanceByOccurrence(instance.id, 'branchA');
    await dispatchNode({ nodeInstanceId: branchA!.id, leaseOwnerId: leaseOwner });

    const [branchB, branchC] = await Promise.all([getNodeInstanceByOccurrence(instance.id, 'branchB'), getNodeInstanceByOccurrence(instance.id, 'branchC')]);
    await Promise.all([
      dispatchNode({ nodeInstanceId: branchB!.id, leaseOwnerId: `${leaseOwner}-b` }),
      dispatchNode({ nodeInstanceId: branchC!.id, leaseOwnerId: `${leaseOwner}-c` }),
    ]);

    const joinNode = await getNodeInstanceByOccurrence(instance.id, 'join1');
    expect(joinNode!.status).toBe('READY');
    const arrivals = await listJoinArrivalsForNode(joinNode!.id);
    expect(arrivals).toHaveLength(3);
  });

  it('cancelInstance cancels every ACTIVE branch token, including ones whose branch never arrived (doc 03 section 26)', async () => {
    const model = baseModel({
      nodes: [
        parallelSplitNode('split1'),
        waitEventNode('waitA', { eventName: 'evt.a', correlation: workflowInputPath(['k']) }),
        waitEventNode('waitB', { eventName: 'evt.b', correlation: workflowInputPath(['k']) }),
        parallelJoinNode('join1', 'ALL'),
        endNode('end-1'),
      ],
      edges: [
        unconditionalEdge('e-split-a', 'split1', 'waitA'),
        unconditionalEdge('e-split-b', 'split1', 'waitB'),
        unconditionalEdge('e-a-join', 'waitA', 'join1'),
        unconditionalEdge('e-b-join', 'waitB', 'join1'),
        unconditionalEdge('e-join-end', 'join1', 'end-1'),
      ],
      start: { type: 'MANUAL_API', targetNodeKey: 'split1' },
    });
    const { instance } = await publishAndStart(model, { k: 'v' });
    const split1 = await getNodeInstanceByOccurrence(instance.id, 'split1');
    await dispatchNode({ nodeInstanceId: split1!.id, leaseOwnerId: leaseOwner });

    const waitA = await getNodeInstanceByOccurrence(instance.id, 'waitA');
    await dispatchNode({ nodeInstanceId: waitA!.id, leaseOwnerId: leaseOwner }); // creates the ACTIVE EVENT wait; waitB stays READY, never dispatched

    const waitBBefore = await getNodeInstanceByOccurrence(instance.id, 'waitB');
    const tokenAId = (await getNodeInstanceByOccurrence(instance.id, 'waitA'))!.branchTokenId!;
    const tokenBId = waitBBefore!.branchTokenId!;

    await cancelInstance(instance.id, instance.stateVersion);

    const waitANode = await getNodeInstanceByOccurrence(instance.id, 'waitA');
    expect(waitANode!.status).toBe('CANCELLED');
    const waitAWait = await getWaitByOwningNodeInstance(waitANode!.id);
    expect(waitAWait!.status).toBe('CANCELLED');

    const waitBNode = await getNodeInstanceByOccurrence(instance.id, 'waitB');
    expect(waitBNode!.status).toBe('CANCELLED');

    const tokenA = await getBranchTokenById(tokenAId);
    const tokenB = await getBranchTokenById(tokenBId);
    expect(tokenA!.status).toBe('CANCELLED');
    expect(tokenB!.status).toBe('CANCELLED');
  });

  it('an unhandled ACTION failure in one branch cancels the sibling branch (node, ACTIVE wait, both branch tokens) via V1 unhandled failure propagation (doc 05 section 29) — a FAIL node cannot itself be a branch member (doc 05 section 32 rejects a branch that terminates before its join)', async () => {
    const model = baseModel({
      nodes: [
        parallelSplitNode('split1'),
        actionNode('branchFail', { retryPolicy: noRetry, input: mappingOf({}) }), // text.template with missing input -> deterministic non-retryable FAILED
        waitEventNode('branchWait', { eventName: 'evt.x', correlation: workflowInputPath(['k']) }),
        parallelJoinNode('join1', 'ALL'),
        endNode('end-1'),
      ],
      edges: [
        unconditionalEdge('e-split-fail', 'split1', 'branchFail'),
        unconditionalEdge('e-split-wait', 'split1', 'branchWait'),
        unconditionalEdge('e-fail-join', 'branchFail', 'join1'),
        unconditionalEdge('e-wait-join', 'branchWait', 'join1'),
        unconditionalEdge('e-join-end', 'join1', 'end-1'),
      ],
      start: { type: 'MANUAL_API', targetNodeKey: 'split1' },
    });
    const { instance } = await publishAndStart(model, { k: 'v' });
    const split1 = await getNodeInstanceByOccurrence(instance.id, 'split1');
    await dispatchNode({ nodeInstanceId: split1!.id, leaseOwnerId: leaseOwner });

    const branchWait = await getNodeInstanceByOccurrence(instance.id, 'branchWait');
    await dispatchNode({ nodeInstanceId: branchWait!.id, leaseOwnerId: leaseOwner }); // creates the ACTIVE wait
    const branchWaitTokenId = (await getNodeInstanceByOccurrence(instance.id, 'branchWait'))!.branchTokenId!;

    const branchFail = await getNodeInstanceByOccurrence(instance.id, 'branchFail');
    const branchFailTokenId = branchFail!.branchTokenId!;
    const outcome = await dispatchNode({ nodeInstanceId: branchFail!.id, leaseOwnerId: leaseOwner });
    expect(outcome.status).toBe('DISPATCHED');
    if (outcome.status !== 'DISPATCHED') throw new Error('unreachable');
    expect(outcome.decision.kind).toBe('FAIL_INSTANCE');

    const finalInstance = await getWorkflowInstanceById(instance.id);
    expect(finalInstance!.status).toBe('FAILED');

    const branchFailAfter = await getNodeInstanceByOccurrence(instance.id, 'branchFail');
    expect(branchFailAfter!.status).toBe('FAILED');

    const branchWaitAfter = await getNodeInstanceByOccurrence(instance.id, 'branchWait');
    expect(branchWaitAfter!.status).toBe('CANCELLED');
    const branchWaitWait = await getWaitByOwningNodeInstance(branchWaitAfter!.id);
    expect(branchWaitWait!.status).toBe('CANCELLED');

    const tokenFail = await getBranchTokenById(branchFailTokenId);
    const tokenWait = await getBranchTokenById(branchWaitTokenId);
    expect(tokenFail!.status).toBe('CANCELLED');
    expect(tokenWait!.status).toBe('CANCELLED');
  });
});
