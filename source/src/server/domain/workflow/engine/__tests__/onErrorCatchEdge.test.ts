import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { getWorkflowInstanceById } from '../../workflowInstanceRepository';
import {
  baseModel,
  endNode,
  actionNode,
  unconditionalEdge,
  errorEdge,
  workflowInputPath,
  mappingOf,
  nodeOutput,
} from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'on-error-worker';

// text.template with empty input/config deterministically fails (WFV2-1's memory-documented
// "deterministically-failing ACTION" pattern — missing required template/variables fields).
async function publishAndStart(model: ReturnType<typeof baseModel>, input: unknown = {}) {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('on-error'), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  return startWorkflowInstance({ workflowRevisionId: revision.id, input: input as never, startedByType: 'USER', startedById: 1 });
}

describe.skipIf(!dbReady)('ON_ERROR/CATCH edge on ACTION nodes (WFV2-1, real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('an unhandled ACTION failure with no ON_ERROR edge still fails the whole instance (regression)', async () => {
    const model = baseModel({
      nodes: [actionNode('a1', { retryPolicy: { maxAttempts: 1, strategy: 'FIXED', initialDelayMs: 0, retryOn: [] } }), endNode('end-1')],
      edges: [unconditionalEdge('e-a1-end', 'a1', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'a1' },
    });
    const { instance } = await publishAndStart(model);
    const node = await getNodeInstanceByOccurrence(instance.id, 'a1');
    const outcome = await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });
    expect(outcome.status).toBe('DISPATCHED');
    if (outcome.status !== 'DISPATCHED') throw new Error('unreachable');
    expect(outcome.decision.kind).toBe('FAIL_INSTANCE');
    const after = await getWorkflowInstanceById(instance.id);
    expect(after!.status).toBe('FAILED');
  });

  it('a caught ACTION failure routes to the ON_ERROR edge, completes the node SUCCEEDED, and keeps the instance RUNNING', async () => {
    const model = baseModel({
      nodes: [
        actionNode('a1', {
          retryPolicy: { maxAttempts: 1, strategy: 'FIXED', initialDelayMs: 0, retryOn: [] },
          outputAssignments: [{ targetVariableKey: 'lastError', value: nodeOutput('a1', ['errorCode']) }],
        }),
        endNode('end-ok'),
        endNode('end-caught', mappingOf({ caughtCode: nodeOutput('a1', ['errorCode']) })),
      ],
      edges: [
        unconditionalEdge('e-a1-ok', 'a1', 'end-ok'),
        errorEdge('e-a1-err', 'a1', 'end-caught'),
      ],
      start: { type: 'MANUAL_API', targetNodeKey: 'a1' },
    });
    const { instance } = await publishAndStart(model);
    const node = await getNodeInstanceByOccurrence(instance.id, 'a1');
    const outcome = await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });
    expect(outcome.status).toBe('DISPATCHED');
    if (outcome.status !== 'DISPATCHED') throw new Error('unreachable');
    expect(outcome.decision.kind).toBe('SELECT_EDGE');
    if (outcome.decision.kind !== 'SELECT_EDGE') throw new Error('unreachable');
    expect(outcome.decision.edgeKey).toBe('e-a1-err');

    const after = await getNodeInstanceByOccurrence(instance.id, 'a1');
    expect(after!.status).toBe('SUCCEEDED');
    const output = JSON.parse(after!.outputJson!);
    expect(typeof output.errorCode).toBe('string');

    const instanceAfter = await getWorkflowInstanceById(instance.id);
    expect(instanceAfter!.status).toBe('RUNNING');
    expect(JSON.parse(instanceAfter!.contextJson!).lastError).toBe(output.errorCode);

    const endCaught = await getNodeInstanceByOccurrence(instance.id, 'end-caught');
    expect(endCaught!.status).toBe('READY');
    const endOk = await getNodeInstanceByOccurrence(instance.id, 'end-ok');
    expect(endOk!.status).toBe('PENDING');

    const endOutcome = await dispatchNode({ nodeInstanceId: endCaught!.id, leaseOwnerId: leaseOwner });
    expect(endOutcome.status).toBe('DISPATCHED');
    const instanceFinal = await getWorkflowInstanceById(instance.id);
    expect(instanceFinal!.status).toBe('SUCCEEDED');
    expect(JSON.parse(instanceFinal!.outputJson!).caughtCode).toBe(output.errorCode);
  });

  it('an ACTION with an EXPRESSION-computed input that never fails still uses its UNCONDITIONAL edge (ON_ERROR present but unused)', async () => {
    const model = baseModel({
      nodes: [
        actionNode('a1', { input: mappingOf({ template: workflowInputPath(['tpl']), variables: workflowInputPath(['vars']) }) }),
        endNode('end-ok'),
        endNode('end-caught'),
      ],
      edges: [unconditionalEdge('e-a1-ok', 'a1', 'end-ok'), errorEdge('e-a1-err', 'a1', 'end-caught')],
      start: { type: 'MANUAL_API', targetNodeKey: 'a1' },
    });
    const { instance } = await publishAndStart(model, { tpl: 'hello {{name}}', vars: { name: 'world' } });
    const node = await getNodeInstanceByOccurrence(instance.id, 'a1');
    const outcome = await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });
    expect(outcome.status).toBe('DISPATCHED');
    if (outcome.status !== 'DISPATCHED') throw new Error('unreachable');
    expect(outcome.decision.kind).toBe('SELECT_EDGE');
    if (outcome.decision.kind !== 'SELECT_EDGE') throw new Error('unreachable');
    expect(outcome.decision.edgeKey).toBe('e-a1-ok');
  });
});
