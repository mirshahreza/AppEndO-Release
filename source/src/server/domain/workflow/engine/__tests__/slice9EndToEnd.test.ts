import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { scanAndApplySubflowResults } from '../subflowContinuationService';
import { registerCoreActionPack } from '../../actions/corePack';
import { getWorkflowInstanceById } from '../../workflowInstanceRepository';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { getWaitByOwningNodeInstance } from '../../workflowWaitRepository';
import {
  baseModel,
  actionNode,
  subflowNode,
  decisionNode,
  decisionEdge,
  decisionDefaultEdge,
  endNode,
  unconditionalEdge,
  workflowInputPath,
  workflowVariable,
  nodeOutput,
  mappingOf,
  lit,
} from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'slice9-e2e-worker';
const noRetry = { maxAttempts: 1, strategy: 'FIXED' as const, initialDelayMs: 0, retryOn: [] };

registerCoreActionPack();

async function publishDefinition(model: ReturnType<typeof baseModel>, keyPrefix: string) {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey(keyPrefix), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  return { definition, revision };
}

describe.skipIf(!dbReady)('Slice 9 end-to-end (real DB): ACTION -> SUBFLOW (child ACTION -> END) -> DECISION -> END', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('runs a real child ACTION inside the subflow and carries its output back through the parent DECISION/END', async () => {
    const childModel = baseModel({
      nodes: [
        actionNode('childRender', {
          input: mappingOf({ template: lit('processed-{{orderId}}'), variables: workflowInputPath() }),
          retryPolicy: noRetry,
        }),
        endNode('child-end', mappingOf({ processed: nodeOutput('childRender', ['text']) })),
      ],
      edges: [unconditionalEdge('e-render-end', 'childRender', 'child-end')],
      start: { type: 'MANUAL_API', targetNodeKey: 'childRender' },
    });
    const { definition: childDef } = await publishDefinition(childModel, 'child-e2e');

    const parentModel = baseModel({
      variables: [{ key: 'processedValue', schema: { type: 'INLINE', schema: {} } }],
      nodes: [
        actionNode('parentRender', {
          input: mappingOf({ template: lit('order-{{n}}'), variables: workflowInputPath() }),
          retryPolicy: noRetry,
        }),
        subflowNode('sub1', {
          workflowDefinitionRef: { workflowDefinitionKey: childDef.key },
          input: mappingOf({ orderId: nodeOutput('parentRender', ['text']) }),
          outputAssignments: [{ targetVariableKey: 'processedValue', value: { op: 'PATH', path: { root: { type: 'NODE_OUTPUT', nodeKey: 'sub1' }, segments: ['processed'] } } }],
        }),
        decisionNode('gate'),
        endNode('end-yes', mappingOf({ processedValue: workflowVariable('processedValue') })),
        endNode('end-no', mappingOf({ processedValue: workflowVariable('processedValue') })),
      ],
      edges: [
        unconditionalEdge('e-render-sub', 'parentRender', 'sub1'),
        unconditionalEdge('e-sub-gate', 'sub1', 'gate'),
        decisionEdge('e-gate-yes', 'gate', 'end-yes', { op: 'IS_NOT_NULL', value: workflowVariable('processedValue') }),
        decisionDefaultEdge('e-gate-no', 'gate', 'end-no'),
      ],
      start: { type: 'MANUAL_API', targetNodeKey: 'parentRender' },
    });
    const { revision: parentRevision } = await publishDefinition(parentModel, 'parent-e2e');

    const { instance } = await startWorkflowInstance({ workflowRevisionId: parentRevision.id, input: { n: 5 } as never, startedByType: 'USER', startedById: 1 });

    const parentRender = await getNodeInstanceByOccurrence(instance.id, 'parentRender');
    await dispatchNode({ nodeInstanceId: parentRender!.id, leaseOwnerId: leaseOwner });

    const sub1 = await getNodeInstanceByOccurrence(instance.id, 'sub1');
    await dispatchNode({ nodeInstanceId: sub1!.id, leaseOwnerId: leaseOwner });
    const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'sub1'))!.id);
    const childId = wait!.childInstanceId!;

    const childRender = await getNodeInstanceByOccurrence(childId, 'childRender');
    await dispatchNode({ nodeInstanceId: childRender!.id, leaseOwnerId: leaseOwner });
    const childEnd = await getNodeInstanceByOccurrence(childId, 'child-end');
    await dispatchNode({ nodeInstanceId: childEnd!.id, leaseOwnerId: leaseOwner });
    const childFinal = await getWorkflowInstanceById(childId);
    expect(childFinal!.status).toBe('SUCCEEDED');
    expect(JSON.parse(childFinal!.outputJson!)).toEqual({ processed: 'processed-order-5' });

    const scanSummary = await scanAndApplySubflowResults();
    expect(scanSummary.satisfiedParents).toBeGreaterThanOrEqual(1);

    const gate = await getNodeInstanceByOccurrence(instance.id, 'gate');
    expect(gate!.status).toBe('READY');
    await dispatchNode({ nodeInstanceId: gate!.id, leaseOwnerId: leaseOwner });

    const endYes = await getNodeInstanceByOccurrence(instance.id, 'end-yes');
    expect(endYes!.status).toBe('READY');
    await dispatchNode({ nodeInstanceId: endYes!.id, leaseOwnerId: leaseOwner });

    const finalInstance = await getWorkflowInstanceById(instance.id);
    expect(finalInstance!.status).toBe('SUCCEEDED');
    expect(JSON.parse(finalInstance!.outputJson!)).toEqual({ processedValue: 'processed-order-5' });
  });
});
