import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { scanAndApplySubflowResults } from '../subflowContinuationService';
import { cancelInstance, suspendInstance, resumeInstance } from '../operationalCommands';
import { getWorkflowInstanceById } from '../../workflowInstanceRepository';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { getWaitByOwningNodeInstance } from '../../workflowWaitRepository';
import { baseModel, subflowNode, endNode, unconditionalEdge, workflowInputPath, mappingOf } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'subflow-cancel-worker';

async function publishDefinition(model: ReturnType<typeof baseModel>, keyPrefix: string) {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey(keyPrefix), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  return { definition, revision };
}

function idleModel() {
  return baseModel({ nodes: [endNode('end-1')], start: { type: 'MANUAL_API', targetNodeKey: 'end-1' } });
}

function echoModel() {
  return baseModel({
    nodes: [endNode('end-1', mappingOf({ echoed: workflowInputPath(['orderId']) }))],
    start: { type: 'MANUAL_API', targetNodeKey: 'end-1' },
  });
}

describe.skipIf(!dbReady)('Subflow cancellation propagation and suspend/resume (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('cancelling the parent recursively cancels an active child and grandchild subflow (doc 05 section 16)', async () => {
    const { definition: grandchildDef } = await publishDefinition(idleModel(), 'grandchild');
    const childModel = baseModel({
      nodes: [subflowNode('gsub', { workflowDefinitionRef: { workflowDefinitionKey: grandchildDef.key } }), endNode('end-1')],
      edges: [unconditionalEdge('e-gsub-end', 'gsub', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'gsub' },
    });
    const { definition: childDef } = await publishDefinition(childModel, 'child');
    const parentModel = baseModel({
      nodes: [subflowNode('csub', { workflowDefinitionRef: { workflowDefinitionKey: childDef.key } }), endNode('end-1')],
      edges: [unconditionalEdge('e-csub-end', 'csub', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'csub' },
    });
    const { revision: parentRevision } = await publishDefinition(parentModel, 'parent');
    const { instance: parent } = await startWorkflowInstance({ workflowRevisionId: parentRevision.id, input: {} as never, startedByType: 'USER', startedById: 1 });

    const csub = await getNodeInstanceByOccurrence(parent.id, 'csub');
    await dispatchNode({ nodeInstanceId: csub!.id, leaseOwnerId: leaseOwner });
    const parentWait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(parent.id, 'csub'))!.id);
    const childId = parentWait!.childInstanceId!;

    const gsub = await getNodeInstanceByOccurrence(childId, 'gsub');
    await dispatchNode({ nodeInstanceId: gsub!.id, leaseOwnerId: leaseOwner });
    const childWait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(childId, 'gsub'))!.id);
    const grandchildId = childWait!.childInstanceId!;

    const grandchildBefore = await getWorkflowInstanceById(grandchildId);
    expect(grandchildBefore!.status).toBe('RUNNING');

    await cancelInstance(parent.id, parent.stateVersion);

    const finalParent = await getWorkflowInstanceById(parent.id);
    expect(finalParent!.status).toBe('CANCELLED');
    const finalChild = await getWorkflowInstanceById(childId);
    expect(finalChild!.status).toBe('CANCELLED');
    const finalGrandchild = await getWorkflowInstanceById(grandchildId);
    expect(finalGrandchild!.status).toBe('CANCELLED');

    const finalParentWait = await getWaitByOwningNodeInstance(csub!.id);
    expect(finalParentWait!.status).toBe('CANCELLED');
    const finalChildWait = await getWaitByOwningNodeInstance(gsub!.id);
    expect(finalChildWait!.status).toBe('CANCELLED');
  });

  it('parent cancellation racing a late child SUCCEEDED result: parent cancellation wins, late child notification is evidence only', async () => {
    const { definition: childDef } = await publishDefinition(echoModel(), 'child-race');
    const parentModel = baseModel({
      nodes: [subflowNode('sub1', { workflowDefinitionRef: { workflowDefinitionKey: childDef.key }, input: mappingOf({ orderId: workflowInputPath(['orderId']) }) }), endNode('end-1')],
      edges: [unconditionalEdge('e-sub-end', 'sub1', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'sub1' },
    });
    const { revision: parentRevision } = await publishDefinition(parentModel, 'parent-race');
    const { instance } = await startWorkflowInstance({ workflowRevisionId: parentRevision.id, input: { orderId: 'ord-race' } as never, startedByType: 'USER', startedById: 1 });

    const node = await getNodeInstanceByOccurrence(instance.id, 'sub1');
    await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });
    const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'sub1'))!.id);
    const childId = wait!.childInstanceId!;

    // The child finishes successfully BEFORE the scanner ever runs...
    const childEnd = await getNodeInstanceByOccurrence(childId, 'end-1');
    await dispatchNode({ nodeInstanceId: childEnd!.id, leaseOwnerId: leaseOwner });
    expect((await getWorkflowInstanceById(childId))!.status).toBe('SUCCEEDED');

    // ...but the parent is cancelled first, winning the race.
    const freshInstance = await getWorkflowInstanceById(instance.id);
    await cancelInstance(freshInstance!.id, freshInstance!.stateVersion);

    const summary = await scanAndApplySubflowResults();
    // The wait was already cancelled by cancelInstance's own sweep — the scanner either skips it
    // (status no longer ACTIVE) or, if it hadn't been swept yet, sees the parent is not RUNNING and skips.

    const finalNode = await getNodeInstanceByOccurrence(instance.id, 'sub1');
    expect(finalNode!.status).toBe('CANCELLED'); // never SUCCEEDED — the late child result was not applied
    const finalInstance = await getWorkflowInstanceById(instance.id);
    expect(finalInstance!.status).toBe('CANCELLED'); // not SUCCEEDED
    expect(summary.satisfiedParents).toBe(0);
  });

  it('child CANCELLED not caused by parent cancellation fails the parent (WF_EXEC_SUBFLOW_CANCELLED case, doc 05 section 31)', async () => {
    const { definition: childDef } = await publishDefinition(idleModel(), 'child-directcancel');
    const parentModel = baseModel({
      nodes: [subflowNode('sub1', { workflowDefinitionRef: { workflowDefinitionKey: childDef.key } }), endNode('end-1')],
      edges: [unconditionalEdge('e-sub-end', 'sub1', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'sub1' },
    });
    const { revision: parentRevision } = await publishDefinition(parentModel, 'parent-directcancel');
    const { instance } = await startWorkflowInstance({ workflowRevisionId: parentRevision.id, input: {} as never, startedByType: 'USER', startedById: 1 });

    const node = await getNodeInstanceByOccurrence(instance.id, 'sub1');
    await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });
    const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'sub1'))!.id);
    const childId = wait!.childInstanceId!;

    // Cancel the CHILD directly (an operator action on the child, not a parent-triggered cascade) — the parent instance stays RUNNING throughout.
    const child = await getWorkflowInstanceById(childId);
    await cancelInstance(childId, child!.stateVersion);
    expect((await getWorkflowInstanceById(childId))!.status).toBe('CANCELLED');
    expect((await getWorkflowInstanceById(instance.id))!.status).toBe('RUNNING'); // parent untouched by the direct child cancel

    const summary = await scanAndApplySubflowResults();
    expect(summary.failedParents).toBeGreaterThanOrEqual(1);

    const finalNode = await getNodeInstanceByOccurrence(instance.id, 'sub1');
    expect(finalNode!.status).toBe('FAILED');
    const finalInstance = await getWorkflowInstanceById(instance.id);
    expect(finalInstance!.status).toBe('FAILED');
  });

  it('parent SUSPENDED defers child-result application; Resume lets the next scan apply it (doc 05 section 31)', async () => {
    const { definition: childDef } = await publishDefinition(echoModel(), 'child-suspend');
    const parentModel = baseModel({
      nodes: [subflowNode('sub1', { workflowDefinitionRef: { workflowDefinitionKey: childDef.key }, input: mappingOf({ orderId: workflowInputPath(['orderId']) }) }), endNode('end-1')],
      edges: [unconditionalEdge('e-sub-end', 'sub1', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'sub1' },
    });
    const { revision: parentRevision } = await publishDefinition(parentModel, 'parent-suspend');
    const { instance } = await startWorkflowInstance({ workflowRevisionId: parentRevision.id, input: { orderId: 'ord-suspend' } as never, startedByType: 'USER', startedById: 1 });

    const node = await getNodeInstanceByOccurrence(instance.id, 'sub1');
    await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });
    const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'sub1'))!.id);
    const childId = wait!.childInstanceId!;

    const freshInstance = await getWorkflowInstanceById(instance.id);
    await suspendInstance(freshInstance!.id, freshInstance!.stateVersion);

    const childEnd = await getNodeInstanceByOccurrence(childId, 'end-1');
    await dispatchNode({ nodeInstanceId: childEnd!.id, leaseOwnerId: leaseOwner });
    expect((await getWorkflowInstanceById(childId))!.status).toBe('SUCCEEDED');

    const summaryWhileSuspended = await scanAndApplySubflowResults();
    expect(summaryWhileSuspended.satisfiedParents).toBe(0);
    const nodeWhileSuspended = await getNodeInstanceByOccurrence(instance.id, 'sub1');
    expect(nodeWhileSuspended!.status).toBe('WAITING'); // untouched

    const suspended = await getWorkflowInstanceById(instance.id);
    await resumeInstance(suspended!.id, suspended!.stateVersion);

    const summaryAfterResume = await scanAndApplySubflowResults();
    expect(summaryAfterResume.satisfiedParents).toBeGreaterThanOrEqual(1);
    const nodeAfterResume = await getNodeInstanceByOccurrence(instance.id, 'sub1');
    expect(nodeAfterResume!.status).toBe('SUCCEEDED');
    expect(JSON.parse(nodeAfterResume!.outputJson!)).toEqual({ echoed: 'ord-suspend' });
  });
});
