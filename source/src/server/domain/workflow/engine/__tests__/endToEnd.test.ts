import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { getWorkflowInstanceById } from '../../workflowInstanceRepository';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { listAttemptsForNode } from '../../workflowExecutionAttemptRepository';
import { registerCoreActionPack } from '../../actions/corePack';
import { baseModel, decisionNode, decisionEdge, decisionDefaultEdge, endNode, actionNode, unconditionalEdge, workflowInputPath, workflowVariable, nodeOutput, mappingOf, lit } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'e2e-worker';

registerCoreActionPack();

/** Drives every READY/RETRYING node to completion by repeatedly dispatching the exact target node key (deterministic single-path graphs only — no concurrency to race). */
async function runToCompletion(instanceId: number, nodeKeysInOrder: string[]): Promise<void> {
  for (const nodeKey of nodeKeysInOrder) {
    const node = await getNodeInstanceByOccurrence(instanceId, nodeKey);
    if (!node) throw new Error(`Node "${nodeKey}" was never materialized.`);
    const outcome = await dispatchNode({ nodeInstanceId: node.id, leaseOwnerId: leaseOwner });
    if (outcome.status !== 'DISPATCHED') throw new Error(`Node "${nodeKey}" was not dispatchable: ${JSON.stringify(outcome)}`);
  }
}

describe.skipIf(!dbReady)('Slice 5 end-to-end (real DB): Start -> ACTION -> DECISION -> ACTION -> END/FAIL', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  function buildModel() {
    return baseModel({
      variables: [{ key: 'greeting', schema: { type: 'INLINE', schema: {} } }],
      nodes: [
        actionNode('render', {
          input: mappingOf({ template: lit('Hello {{name}}!'), variables: { op: 'PATH', path: { root: { type: 'WORKFLOW_INPUT' }, segments: [] } } }),
          outputAssignments: [{ targetVariableKey: 'greeting', value: nodeOutput('render', ['text']) }],
          retryPolicy: { maxAttempts: 1, strategy: 'FIXED', initialDelayMs: 0, retryOn: [] },
        }),
        decisionNode('gate'),
        actionNode('followUp', {
          input: {
            type: 'OBJECT',
            fields: {
              template: { type: 'EXPRESSION', expression: lit('{{greeting}} (approved)') },
              variables: { type: 'OBJECT', fields: { greeting: { type: 'EXPRESSION', expression: workflowVariable('greeting') } } },
            },
          },
          retryPolicy: { maxAttempts: 1, strategy: 'FIXED', initialDelayMs: 0, retryOn: [] },
        }),
        endNode('end-approved', mappingOf({ greeting: workflowVariable('greeting'), followUp: nodeOutput('followUp', ['text']) })),
        endNode('end-rejected', mappingOf({ greeting: workflowVariable('greeting') })),
      ],
      edges: [
        unconditionalEdge('e-render-gate', 'render', 'gate'),
        decisionEdge('e-approve', 'gate', 'followUp', { op: 'EQ', left: workflowInputPath(['approve']), right: lit(true) }),
        decisionDefaultEdge('e-reject', 'gate', 'end-rejected'),
        unconditionalEdge('e-followup-end', 'followUp', 'end-approved'),
      ],
      start: { type: 'MANUAL_API', targetNodeKey: 'render' },
    });
  }

  it('approved path: ACTION -> DECISION(true) -> ACTION -> END, with context assignments and NODE_OUTPUT references flowing through the whole run', async () => {
    const model = buildModel();
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('e2e-approve'), draftDefinitionJson: JSON.stringify(model) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    expect(revision.publicationStatus).toBe('PUBLISHED');

    const { instance } = await startWorkflowInstance({
      workflowRevisionId: revision.id,
      input: { name: 'World', approve: true },
      startedByType: 'USER',
      startedById: 1,
    });

    await runToCompletion(instance.id, ['render', 'gate', 'followUp', 'end-approved']);

    const finalInstance = await getWorkflowInstanceById(instance.id);
    expect(finalInstance!.status).toBe('SUCCEEDED');
    expect(JSON.parse(finalInstance!.outputJson!)).toEqual({ greeting: 'Hello World!', followUp: 'Hello World! (approved)' });
    expect(JSON.parse(finalInstance!.contextJson!)).toEqual({ greeting: 'Hello World!' });

    const renderAttempts = await listAttemptsForNode((await getNodeInstanceByOccurrence(instance.id, 'render'))!.id);
    expect(renderAttempts).toHaveLength(1);
    expect(renderAttempts[0].status).toBe('SUCCEEDED');

    const endRejected = await getNodeInstanceByOccurrence(instance.id, 'end-rejected');
    expect(endRejected!.status).toBe('PENDING'); // the unchosen branch is never touched (doc 03 section 24)
  });

  it('rejected path: ACTION -> DECISION(false, default edge) -> END, skipping the second ACTION entirely', async () => {
    const model = buildModel();
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('e2e-reject'), draftDefinitionJson: JSON.stringify(model) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);

    const { instance } = await startWorkflowInstance({
      workflowRevisionId: revision.id,
      input: { name: 'Ada', approve: false },
      startedByType: 'USER',
      startedById: 1,
    });

    await runToCompletion(instance.id, ['render', 'gate', 'end-rejected']);

    const finalInstance = await getWorkflowInstanceById(instance.id);
    expect(finalInstance!.status).toBe('SUCCEEDED');
    expect(JSON.parse(finalInstance!.outputJson!)).toEqual({ greeting: 'Hello Ada!' });

    const followUp = await getNodeInstanceByOccurrence(instance.id, 'followUp');
    expect(followUp!.status).toBe('PENDING');
    const endApproved = await getNodeInstanceByOccurrence(instance.id, 'end-approved');
    expect(endApproved!.status).toBe('PENDING');
  });
});
