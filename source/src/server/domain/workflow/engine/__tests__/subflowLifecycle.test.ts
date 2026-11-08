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
  parallelSplitNode,
  parallelJoinNode,
  failNode,
  endNode,
  unconditionalEdge,
  workflowInputPath,
  workflowVariable,
  mappingOf,
  lit,
} from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'subflow-worker';

registerCoreActionPack();

async function publishDefinition(model: ReturnType<typeof baseModel>, keyPrefix: string) {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey(keyPrefix), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  return { definition, revision };
}

function childEchoModel() {
  return baseModel({
    nodes: [endNode('end-1', mappingOf({ echoed: workflowInputPath(['orderId']) }))],
    start: { type: 'MANUAL_API', targetNodeKey: 'end-1' },
  });
}

function childFailModel() {
  return baseModel({
    nodes: [failNode('fail-1', lit('E_CHILD_FAILED'), lit('child failed on purpose'))],
    start: { type: 'MANUAL_API', targetNodeKey: 'fail-1' },
  });
}

describe.skipIf(!dbReady)('Subflow lifecycle (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('SUBFLOW dispatch atomically starts a real child WorkflowInstance and creates an ACTIVE SUBFLOW wait; parent node goes RUNNING -> WAITING', async () => {
    const { definition: childDef } = await publishDefinition(childEchoModel(), 'child-echo');
    const parentModel = baseModel({
      nodes: [subflowNode('sub1', { workflowDefinitionRef: { workflowDefinitionKey: childDef.key }, input: mappingOf({ orderId: workflowInputPath(['orderId']) }) }), endNode('end-1')],
      edges: [unconditionalEdge('e-sub-end', 'sub1', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'sub1' },
    });
    const { revision: parentRevision } = await publishDefinition(parentModel, 'parent');
    const { instance } = await startWorkflowInstance({ workflowRevisionId: parentRevision.id, input: { orderId: 'ord-1' } as never, startedByType: 'USER', startedById: 1 });

    const node = await getNodeInstanceByOccurrence(instance.id, 'sub1');
    const outcome = await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });
    expect(outcome.status).toBe('DISPATCHED');
    if (outcome.status !== 'DISPATCHED') throw new Error('unreachable');
    expect(outcome.decision).toEqual(expect.objectContaining({ kind: 'CREATE_WAIT', waitType: 'SUBFLOW' }));

    const afterNode = await getNodeInstanceByOccurrence(instance.id, 'sub1');
    expect(afterNode!.status).toBe('WAITING');

    const wait = await getWaitByOwningNodeInstance(afterNode!.id);
    expect(wait!.status).toBe('ACTIVE');
    expect(wait!.waitType).toBe('SUBFLOW');
    expect(wait!.childInstanceId).not.toBeNull();

    const child = await getWorkflowInstanceById(wait!.childInstanceId!);
    expect(child!.status).toBe('RUNNING');
    expect(child!.startedByType).toBe('WORKFLOW');
    expect(child!.startedById).toBe(instance.id);
    expect(child!.startType).toBe('SUBFLOW');
    expect(JSON.parse(child!.inputJson!)).toEqual({ orderId: 'ord-1' });
  });

  it('child SUCCEEDED: the scanner satisfies the parent SUBFLOW wait, node SUCCEEDED with the child output, downstream target READY', async () => {
    const { definition: childDef } = await publishDefinition(childEchoModel(), 'child-echo');
    const parentModel = baseModel({
      variables: [{ key: 'echoedValue', schema: { type: 'INLINE', schema: {} } }],
      nodes: [
        subflowNode('sub1', {
          workflowDefinitionRef: { workflowDefinitionKey: childDef.key },
          input: mappingOf({ orderId: workflowInputPath(['orderId']) }),
          outputAssignments: [{ targetVariableKey: 'echoedValue', value: { op: 'PATH', path: { root: { type: 'NODE_OUTPUT', nodeKey: 'sub1' }, segments: ['echoed'] } } }],
        }),
        endNode('end-1', mappingOf({ echoedValue: workflowVariable('echoedValue') })),
      ],
      edges: [unconditionalEdge('e-sub-end', 'sub1', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'sub1' },
    });
    const { revision: parentRevision } = await publishDefinition(parentModel, 'parent');
    const { instance } = await startWorkflowInstance({ workflowRevisionId: parentRevision.id, input: { orderId: 'ord-2' } as never, startedByType: 'USER', startedById: 1 });

    const node = await getNodeInstanceByOccurrence(instance.id, 'sub1');
    await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });
    const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'sub1'))!.id);
    const childInstanceId = wait!.childInstanceId!;

    // Drive the child to completion directly (it's an independent instance dispatched like any other).
    const childEndNode = await getNodeInstanceByOccurrence(childInstanceId, 'end-1');
    await dispatchNode({ nodeInstanceId: childEndNode!.id, leaseOwnerId: leaseOwner });
    const childAfter = await getWorkflowInstanceById(childInstanceId);
    expect(childAfter!.status).toBe('SUCCEEDED');

    const summary = await scanAndApplySubflowResults();
    expect(summary.satisfiedParents).toBeGreaterThanOrEqual(1);

    const afterNode = await getNodeInstanceByOccurrence(instance.id, 'sub1');
    expect(afterNode!.status).toBe('SUCCEEDED');
    expect(JSON.parse(afterNode!.outputJson!)).toEqual({ echoed: 'ord-2' });

    const afterWait = await getWaitByOwningNodeInstance(afterNode!.id);
    expect(afterWait!.status).toBe('SATISFIED');

    const endNodeInstance = await getNodeInstanceByOccurrence(instance.id, 'end-1');
    expect(endNodeInstance!.status).toBe('READY');
    await dispatchNode({ nodeInstanceId: endNodeInstance!.id, leaseOwnerId: leaseOwner });
    const finalInstance = await getWorkflowInstanceById(instance.id);
    expect(finalInstance!.status).toBe('SUCCEEDED');
    expect(JSON.parse(finalInstance!.outputJson!)).toEqual({ echoedValue: 'ord-2' });
  });

  it('child FAILED: the scanner CANCELS the wait (not satisfies) and fails the parent node/instance (doc 05 section 31)', async () => {
    const { definition: childDef } = await publishDefinition(childFailModel(), 'child-fail');
    const parentModel = baseModel({
      nodes: [subflowNode('sub1', { workflowDefinitionRef: { workflowDefinitionKey: childDef.key } }), endNode('end-1')],
      edges: [unconditionalEdge('e-sub-end', 'sub1', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'sub1' },
    });
    const { revision: parentRevision } = await publishDefinition(parentModel, 'parent');
    const { instance } = await startWorkflowInstance({ workflowRevisionId: parentRevision.id, input: {} as never, startedByType: 'USER', startedById: 1 });

    const node = await getNodeInstanceByOccurrence(instance.id, 'sub1');
    await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });
    const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'sub1'))!.id);
    const childInstanceId = wait!.childInstanceId!;

    const childFailNode = await getNodeInstanceByOccurrence(childInstanceId, 'fail-1');
    await dispatchNode({ nodeInstanceId: childFailNode!.id, leaseOwnerId: leaseOwner });
    const childAfter = await getWorkflowInstanceById(childInstanceId);
    expect(childAfter!.status).toBe('FAILED');

    const summary = await scanAndApplySubflowResults();
    expect(summary.failedParents).toBeGreaterThanOrEqual(1);

    const afterNode = await getNodeInstanceByOccurrence(instance.id, 'sub1');
    expect(afterNode!.status).toBe('FAILED');
    const afterWait = await getWaitByOwningNodeInstance(afterNode!.id);
    expect(afterWait!.status).toBe('CANCELLED'); // not SATISFIED

    const finalInstance = await getWorkflowInstanceById(instance.id);
    expect(finalInstance!.status).toBe('FAILED');
  });

  it('a SUBFLOW node as the last node in an ALL PARALLEL_JOIN branch records a join arrival on child success', async () => {
    const { definition: childDef } = await publishDefinition(childEchoModel(), 'child-echo');
    const parentModel = baseModel({
      nodes: [
        parallelSplitNode('split1'),
        subflowNode('sub1', { workflowDefinitionRef: { workflowDefinitionKey: childDef.key }, input: mappingOf({ orderId: lit('ord-parallel') }) }),
        actionNode('other-branch', { input: mappingOf({ template: lit('ok'), variables: lit({}) }), retryPolicy: { maxAttempts: 1, strategy: 'FIXED', initialDelayMs: 0, retryOn: [] } }),
        parallelJoinNode('join1', 'ALL'),
        endNode('end-1'),
      ],
      edges: [
        unconditionalEdge('e-split-sub', 'split1', 'sub1'),
        unconditionalEdge('e-sub-join', 'sub1', 'join1'),
        unconditionalEdge('e-split-other', 'split1', 'other-branch'),
        unconditionalEdge('e-other-join', 'other-branch', 'join1'),
        unconditionalEdge('e-join-end', 'join1', 'end-1'),
      ],
      start: { type: 'MANUAL_API', targetNodeKey: 'split1' },
    });
    const { revision: parentRevision } = await publishDefinition(parentModel, 'parent-parallel');
    const { instance } = await startWorkflowInstance({ workflowRevisionId: parentRevision.id, input: {} as never, startedByType: 'USER', startedById: 1 });

    const split1 = await getNodeInstanceByOccurrence(instance.id, 'split1');
    await dispatchNode({ nodeInstanceId: split1!.id, leaseOwnerId: leaseOwner });

    const otherBranch = await getNodeInstanceByOccurrence(instance.id, 'other-branch');
    await dispatchNode({ nodeInstanceId: otherBranch!.id, leaseOwnerId: leaseOwner });

    const sub1 = await getNodeInstanceByOccurrence(instance.id, 'sub1');
    await dispatchNode({ nodeInstanceId: sub1!.id, leaseOwnerId: leaseOwner });
    const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'sub1'))!.id);
    const childInstanceId = wait!.childInstanceId!;

    const joinBefore = await getNodeInstanceByOccurrence(instance.id, 'join1');
    expect(joinBefore!.status).toBe('PENDING');

    const childEndNode = await getNodeInstanceByOccurrence(childInstanceId, 'end-1');
    await dispatchNode({ nodeInstanceId: childEndNode!.id, leaseOwnerId: leaseOwner });
    await scanAndApplySubflowResults();

    const joinAfter = await getNodeInstanceByOccurrence(instance.id, 'join1');
    expect(joinAfter!.status).toBe('READY');
    expect(joinAfter!.branchTokenId).toBeNull();
  });
});
