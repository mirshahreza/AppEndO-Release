import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { registerCoreActionPack } from '../../actions/corePack';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { listJoinArrivalsForNode } from '../../workflowJoinArrivalRepository';
import { prisma, toId } from '../../prismaHelpers';
import {
  baseModel,
  decisionNode,
  decisionEdge,
  decisionDefaultEdge,
  parallelJoinNode,
  actionNode,
  endNode,
  unconditionalEdge,
  mappingOf,
  lit,
  workflowInputPath,
} from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'multi-match-worker';
const noRetry = { maxAttempts: 1, strategy: 'FIXED' as const, initialDelayMs: 0, retryOn: [] };
const trivialTemplateInput = () => mappingOf({ template: lit('ok'), variables: lit({}) });

registerCoreActionPack();

/**
 * Inclusive gateway: three authored condition edges + default, all reconverging on join ALL.
 * Join ALL uses spawned token count (not authored edge count) — a false branch is never started.
 */
function inclusiveGatewayModel() {
  const flag = (name: string) => ({
    op: 'EQ' as const,
    left: workflowInputPath([name]),
    right: lit(true),
  });
  return baseModel({
    nodes: [
      decisionNode('d1', 'MULTI_MATCH'),
      actionNode('branchA', { retryPolicy: noRetry, input: trivialTemplateInput() }),
      actionNode('branchB', { retryPolicy: noRetry, input: trivialTemplateInput() }),
      actionNode('branchC', { retryPolicy: noRetry, input: trivialTemplateInput() }),
      actionNode('branchDefault', { retryPolicy: noRetry, input: trivialTemplateInput() }),
      parallelJoinNode('join1', 'ALL'),
      endNode('end-1'),
    ],
    edges: [
      decisionEdge('e-a', 'd1', 'branchA', flag('a')),
      decisionEdge('e-b', 'd1', 'branchB', flag('b')),
      decisionEdge('e-c', 'd1', 'branchC', flag('c')),
      decisionDefaultEdge('e-def', 'd1', 'branchDefault'),
      unconditionalEdge('e-a-join', 'branchA', 'join1'),
      unconditionalEdge('e-b-join', 'branchB', 'join1'),
      unconditionalEdge('e-c-join', 'branchC', 'join1'),
      unconditionalEdge('e-def-join', 'branchDefault', 'join1'),
      unconditionalEdge('e-join-end', 'join1', 'end-1'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'd1' },
  });
}

async function publishAndStart(model: ReturnType<typeof baseModel>, input: unknown) {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('multi-match'), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  return startWorkflowInstance({ workflowRevisionId: revision.id, input: input as never, startedByType: 'USER', startedById: 1 });
}

async function countTokensForSplit(instanceId: number, splitNodeKey: string): Promise<number> {
  return prisma().workflowBranchToken.count({
    where: { workflowInstanceId: toId(instanceId), splitNodeKey },
  });
}

describe.skipIf(!dbReady)('DECISION MULTI_MATCH inclusive gateway (WFV2-17, real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('publish rejects MULTI_MATCH that does not reconverge on a PARALLEL_JOIN', async () => {
    const definition = await createTestWorkflowDefinition({
      key: uniqueKey('mm-no-join'),
      draftDefinitionJson: JSON.stringify(baseModel({
        nodes: [
          decisionNode('d1', 'MULTI_MATCH'),
          endNode('a'),
          endNode('b'),
        ],
        edges: [
          decisionEdge('e-a', 'd1', 'a', lit(true)),
          decisionDefaultEdge('e-def', 'd1', 'b'),
        ],
        start: { type: 'MANUAL_API', targetNodeKey: 'd1' },
      })),
    });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    expect(revision.publicationStatus).toBe('REJECTED');
  });

  it('spawns tokens only for true condition edges; the false branch stays PENDING and is not required for join ALL', async () => {
    const { instance } = await publishAndStart(inclusiveGatewayModel(), { a: true, b: true, c: false });
    const decision = await getNodeInstanceByOccurrence(instance.id, 'd1');
    const outcome = await dispatchNode({ nodeInstanceId: decision!.id, leaseOwnerId: leaseOwner });

    expect(outcome).toMatchObject({
      status: 'DISPATCHED',
      decision: {
        kind: 'START_PARALLEL',
        splitNodeKey: 'd1',
        branches: [
          { edgeKey: 'e-a', branchTokenDescriptor: 'e-a' },
          { edgeKey: 'e-b', branchTokenDescriptor: 'e-b' },
        ],
      },
    });

    expect(await countTokensForSplit(instance.id, 'd1')).toBe(2);

    const branchA = await getNodeInstanceByOccurrence(instance.id, 'branchA');
    const branchB = await getNodeInstanceByOccurrence(instance.id, 'branchB');
    const branchC = await getNodeInstanceByOccurrence(instance.id, 'branchC');
    const branchDefault = await getNodeInstanceByOccurrence(instance.id, 'branchDefault');
    expect(branchA!.status).toBe('READY');
    expect(branchB!.status).toBe('READY');
    expect(branchC!.status).toBe('PENDING');
    expect(branchDefault!.status).toBe('PENDING');

    await dispatchNode({ nodeInstanceId: branchA!.id, leaseOwnerId: leaseOwner });
    const joinAfterOne = await getNodeInstanceByOccurrence(instance.id, 'join1');
    expect(joinAfterOne!.status).toBe('PENDING');

    await dispatchNode({ nodeInstanceId: branchB!.id, leaseOwnerId: leaseOwner });
    const joinAfterTwo = await getNodeInstanceByOccurrence(instance.id, 'join1');
    expect(joinAfterTwo!.status).toBe('READY');

    const arrivals = await listJoinArrivalsForNode(joinAfterTwo!.id);
    expect(arrivals).toHaveLength(2);

    // The never-taken C/default branches must not block ALL — they were never spawned.
    expect((await getNodeInstanceByOccurrence(instance.id, 'branchC'))!.status).toBe('PENDING');
    expect((await getNodeInstanceByOccurrence(instance.id, 'branchDefault'))!.status).toBe('PENDING');
  });

  it('takes only DECISION_DEFAULT when no condition is true, and join ALL waits for that single spawned token', async () => {
    const { instance } = await publishAndStart(inclusiveGatewayModel(), { a: false, b: false, c: false });
    const decision = await getNodeInstanceByOccurrence(instance.id, 'd1');
    await dispatchNode({ nodeInstanceId: decision!.id, leaseOwnerId: leaseOwner });

    expect(await countTokensForSplit(instance.id, 'd1')).toBe(1);
    expect((await getNodeInstanceByOccurrence(instance.id, 'branchA'))!.status).toBe('PENDING');
    expect((await getNodeInstanceByOccurrence(instance.id, 'branchDefault'))!.status).toBe('READY');

    const branchDefault = await getNodeInstanceByOccurrence(instance.id, 'branchDefault');
    await dispatchNode({ nodeInstanceId: branchDefault!.id, leaseOwnerId: leaseOwner });

    const join1 = await getNodeInstanceByOccurrence(instance.id, 'join1');
    expect(join1!.status).toBe('READY');
  });

  it('a single true condition still starts parallel (one token) rather than SELECT_EDGE', async () => {
    const { instance } = await publishAndStart(inclusiveGatewayModel(), { a: true, b: false, c: false });
    const decision = await getNodeInstanceByOccurrence(instance.id, 'd1');
    const outcome = await dispatchNode({ nodeInstanceId: decision!.id, leaseOwnerId: leaseOwner });

    expect(outcome).toMatchObject({
      status: 'DISPATCHED',
      decision: { kind: 'START_PARALLEL', branches: [{ edgeKey: 'e-a' }] },
    });
    expect(await countTokensForSplit(instance.id, 'd1')).toBe(1);
    expect((await getNodeInstanceByOccurrence(instance.id, 'branchA'))!.status).toBe('READY');
    expect((await getNodeInstanceByOccurrence(instance.id, 'branchDefault'))!.status).toBe('PENDING');
  });
});
