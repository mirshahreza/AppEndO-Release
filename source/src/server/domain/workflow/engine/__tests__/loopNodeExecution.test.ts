import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { registerCoreActionPack } from '../../actions/corePack';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { getWorkflowInstanceById } from '../../workflowInstanceRepository';
import type { CanonicalExpression, CanonicalMapping } from '../../awm/types';
import {
  baseModel,
  loopNode,
  endNode,
  actionNode,
  unconditionalEdge,
  errorEdge,
  currentItem,
  currentItemIndex,
  mappingOf,
  lit,
  nodeOutput,
} from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'loop-worker';
const noRetry = { maxAttempts: 1, strategy: 'FIXED' as const, initialDelayMs: 0, retryOn: [] };

registerCoreActionPack();

const ltIndex = (n: number): CanonicalExpression => ({
  op: 'LT',
  left: currentItemIndex(),
  right: lit(n),
});

/** `text.template` input that renders the 0-based CURRENT_ITEM_INDEX. */
const indexTemplateInput = (): CanonicalMapping => ({
  type: 'OBJECT',
  fields: {
    template: { type: 'EXPRESSION', expression: lit('n={{i}}') },
    variables: {
      type: 'OBJECT',
      fields: { i: { type: 'EXPRESSION', expression: currentItemIndex() } },
    },
  },
});

/** Chains previous LOOP output (`CURRENT_ITEM.text`) into the next template. */
const chainingTemplateInput = (): CanonicalMapping => ({
  type: 'OBJECT',
  fields: {
    template: { type: 'EXPRESSION', expression: lit('{{prev}}+{{i}}') },
    variables: {
      type: 'OBJECT',
      fields: {
        i: { type: 'EXPRESSION', expression: currentItemIndex() },
        prev: {
          type: 'EXPRESSION',
          expression: { op: 'COALESCE', values: [currentItem(['text']), lit('start')] },
        },
      },
    },
  },
});

async function publishAndStart(model: ReturnType<typeof baseModel>, input: unknown = {}) {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('loop'), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  return startWorkflowInstance({ workflowRevisionId: revision.id, input: input as never, startedByType: 'USER', startedById: 1 });
}

describe.skipIf(!dbReady)('LOOP node (in-process while, real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('skips the Action entirely when the condition is false on the first pass (0 iterations)', async () => {
    const model = baseModel({
      nodes: [
        loopNode('loop1', { condition: lit(false), input: indexTemplateInput(), retryPolicy: noRetry }),
        endNode('end-1'),
      ],
      edges: [unconditionalEdge('e-loop-end', 'loop1', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'loop1' },
    });
    const { instance } = await publishAndStart(model);
    const loop = await getNodeInstanceByOccurrence(instance.id, 'loop1');
    const outcome = await dispatchNode({ nodeInstanceId: loop!.id, leaseOwnerId: leaseOwner });

    expect(outcome).toMatchObject({ status: 'DISPATCHED', decision: { kind: 'SELECT_EDGE', edgeKey: 'e-loop-end' } });
    const after = await getNodeInstanceByOccurrence(instance.id, 'loop1');
    expect(after!.status).toBe('SUCCEEDED');
    expect(JSON.parse(after!.outputJson!)).toEqual([]);

    const end = await getNodeInstanceByOccurrence(instance.id, 'end-1');
    expect(end!.status).toBe('READY');
  });

  it('runs N iterations, binding CURRENT_ITEM_INDEX each pass, then takes the success edge', async () => {
    const model = baseModel({
      nodes: [
        loopNode('loop1', { condition: ltIndex(3), input: indexTemplateInput(), retryPolicy: noRetry, maxIterations: 10 }),
        endNode('end-1'),
      ],
      edges: [unconditionalEdge('e-loop-end', 'loop1', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'loop1' },
    });
    const { instance } = await publishAndStart(model);
    const loop = await getNodeInstanceByOccurrence(instance.id, 'loop1');
    await dispatchNode({ nodeInstanceId: loop!.id, leaseOwnerId: leaseOwner });

    const after = await getNodeInstanceByOccurrence(instance.id, 'loop1');
    expect(after!.status).toBe('SUCCEEDED');
    const output = JSON.parse(after!.outputJson!) as Array<{ index: number; status: string; output: { text: string } }>;
    expect(output).toHaveLength(3);
    expect(output.map((row) => row.output.text)).toEqual(['n=0', 'n=1', 'n=2']);
    expect(output.every((row) => row.status === 'SUCCEEDED')).toBe(true);
  });

  it('feeds the previous Action output as CURRENT_ITEM on the next pass (COALESCE over .text)', async () => {
    const model = baseModel({
      nodes: [
        loopNode('loop1', { condition: ltIndex(3), input: chainingTemplateInput(), retryPolicy: noRetry, maxIterations: 10 }),
        endNode('end-1', mappingOf({ last: nodeOutput('loop1') })),
      ],
      edges: [unconditionalEdge('e-loop-end', 'loop1', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'loop1' },
    });
    const { instance } = await publishAndStart(model);
    const loop = await getNodeInstanceByOccurrence(instance.id, 'loop1');
    await dispatchNode({ nodeInstanceId: loop!.id, leaseOwnerId: leaseOwner });

    const after = await getNodeInstanceByOccurrence(instance.id, 'loop1');
    const output = JSON.parse(after!.outputJson!) as Array<{ output: { text: string } }>;
    expect(output.map((row) => row.output.text)).toEqual(['start+0', 'start+0+1', 'start+0+1+2']);
  });

  it('fails the instance with WF_EXEC_LOOP_LIMIT_EXCEEDED when the condition is still true at the cap', async () => {
    const model = baseModel({
      nodes: [
        loopNode('loop1', { condition: lit(true), input: indexTemplateInput(), retryPolicy: noRetry, maxIterations: 2 }),
        endNode('end-1'),
      ],
      edges: [unconditionalEdge('e-loop-end', 'loop1', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'loop1' },
    });
    const { instance } = await publishAndStart(model);
    const loop = await getNodeInstanceByOccurrence(instance.id, 'loop1');
    const outcome = await dispatchNode({ nodeInstanceId: loop!.id, leaseOwnerId: leaseOwner });

    expect(outcome).toMatchObject({ status: 'DISPATCHED', decision: { kind: 'FAIL_INSTANCE', errorCode: 'WF_EXEC_LOOP_LIMIT_EXCEEDED' } });
    const after = await getNodeInstanceByOccurrence(instance.id, 'loop1');
    expect(after!.status).toBe('FAILED');
    const finalInstance = await getWorkflowInstanceById(instance.id);
    expect(finalInstance!.status).toBe('FAILED');
  });

  it('routes a per-iteration Action failure onto the ON_ERROR edge instead of failing the instance', async () => {
    const model = baseModel({
      nodes: [
        loopNode('loop1', { condition: ltIndex(2), retryPolicy: noRetry }),
        endNode('ok'),
        actionNode('caught', { input: mappingOf({ template: lit('caught'), variables: lit({}) }), retryPolicy: noRetry }),
        endNode('caught-end'),
      ],
      edges: [
        unconditionalEdge('e-ok', 'loop1', 'ok'),
        errorEdge('e-catch', 'loop1', 'caught'),
        unconditionalEdge('e-caught-end', 'caught', 'caught-end'),
      ],
      start: { type: 'MANUAL_API', targetNodeKey: 'loop1' },
    });
    const { instance } = await publishAndStart(model);
    const loop = await getNodeInstanceByOccurrence(instance.id, 'loop1');
    const outcome = await dispatchNode({ nodeInstanceId: loop!.id, leaseOwnerId: leaseOwner });

    expect(outcome).toMatchObject({ status: 'DISPATCHED', decision: { kind: 'SELECT_EDGE', edgeKey: 'e-catch' } });
    const after = await getNodeInstanceByOccurrence(instance.id, 'loop1');
    expect(after!.status).toBe('SUCCEEDED');
    const caught = await getNodeInstanceByOccurrence(instance.id, 'caught');
    expect(caught!.status).toBe('READY');
    const finalInstance = await getWorkflowInstanceById(instance.id);
    expect(finalInstance!.status).toBe('RUNNING');
  });

  it('an unhandled LOOP Action failure with no ON_ERROR edge still fails the instance', async () => {
    const model = baseModel({
      nodes: [
        loopNode('loop1', { condition: ltIndex(1), retryPolicy: noRetry }),
        endNode('end-1'),
      ],
      edges: [unconditionalEdge('e-loop-end', 'loop1', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'loop1' },
    });
    const { instance } = await publishAndStart(model);
    const loop = await getNodeInstanceByOccurrence(instance.id, 'loop1');
    const outcome = await dispatchNode({ nodeInstanceId: loop!.id, leaseOwnerId: leaseOwner });

    expect(outcome).toMatchObject({ status: 'DISPATCHED', decision: { kind: 'FAIL_INSTANCE', errorCode: 'WF_EXEC_UNHANDLED_NODE_FAILURE' } });
    const finalInstance = await getWorkflowInstanceById(instance.id);
    expect(finalInstance!.status).toBe('FAILED');
  });

  it('publish rejects a LOOP missing its UNCONDITIONAL success edge', async () => {
    const definition = await createTestWorkflowDefinition({
      key: uniqueKey('loop-no-edge'),
      draftDefinitionJson: JSON.stringify(baseModel({
        nodes: [loopNode('loop1', { condition: lit(false), retryPolicy: noRetry }), endNode('end-1')],
        edges: [],
        start: { type: 'MANUAL_API', targetNodeKey: 'loop1' },
      })),
    });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    expect(revision.publicationStatus).toBe('REJECTED');
  });
});
