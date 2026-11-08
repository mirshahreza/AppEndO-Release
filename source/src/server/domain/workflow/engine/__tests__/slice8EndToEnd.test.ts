import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { claimWorkItem, completeWorkItem } from '../workItemService';
import { registerCoreActionPack } from '../../actions/corePack';
import { getWorkflowInstanceById } from '../../workflowInstanceRepository';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { getWaitByOwningNodeInstance } from '../../workflowWaitRepository';
import {
  baseModel,
  actionNode,
  workItemNode,
  workItemOutcomeEdge,
  decisionNode,
  decisionEdge,
  decisionDefaultEdge,
  endNode,
  unconditionalEdge,
  workflowVariable,
  mappingOf,
  lit,
} from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'slice8-e2e-worker';

registerCoreActionPack();

async function publishAndStart(model: ReturnType<typeof baseModel>, input: unknown = {}) {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('slice8-e2e'), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  return startWorkflowInstance({ workflowRevisionId: revision.id, input: input as never, startedByType: 'USER', startedById: 1 });
}

describe.skipIf(!dbReady)('Slice 8 end-to-end (real DB): ACTION -> WORK_ITEM (claim + complete) -> DECISION -> END', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('carries CURRENT_WORK_ITEM output through outputAssignments into a downstream DECISION and END', async () => {
    const model = baseModel({
      variables: [{ key: 'reviewOutcome', schema: { type: 'INLINE', schema: {} } }],
      nodes: [
        actionNode('render', {
          input: mappingOf({ template: lit('review-{{n}}'), variables: { op: 'PATH', path: { root: { type: 'WORKFLOW_INPUT' }, segments: [] } } }),
          retryPolicy: { maxAttempts: 1, strategy: 'FIXED', initialDelayMs: 0, retryOn: [] },
        }),
        workItemNode('review', {
          assignment: { strategy: 'ROLE', roleId: 'USER' },
          allowedOutcomes: ['APPROVE', 'REJECT'],
          outputAssignments: [{ targetVariableKey: 'reviewOutcome', value: { op: 'PATH', path: { root: { type: 'CURRENT_WORK_ITEM', projection: 'OUTCOME' }, segments: [] } } }],
        }),
        decisionNode('gate'),
        endNode('end-approved', mappingOf({ reviewOutcome: workflowVariable('reviewOutcome') })),
        endNode('end-rejected', mappingOf({ reviewOutcome: workflowVariable('reviewOutcome') })),
      ],
      edges: [
        unconditionalEdge('e-render-review', 'render', 'review'),
        workItemOutcomeEdge('e-approve', 'review', 'gate', 'APPROVE'),
        workItemOutcomeEdge('e-reject', 'review', 'gate', 'REJECT'),
        decisionEdge('e-gate-approved', 'gate', 'end-approved', { op: 'EQ', left: workflowVariable('reviewOutcome'), right: lit('APPROVE') }),
        decisionDefaultEdge('e-gate-rejected', 'gate', 'end-rejected'),
      ],
      start: { type: 'MANUAL_API', targetNodeKey: 'render' },
    });

    const { instance } = await publishAndStart(model, { n: 3 });

    const render = await getNodeInstanceByOccurrence(instance.id, 'render');
    await dispatchNode({ nodeInstanceId: render!.id, leaseOwnerId: leaseOwner });

    const review = await getNodeInstanceByOccurrence(instance.id, 'review');
    await dispatchNode({ nodeInstanceId: review!.id, leaseOwnerId: leaseOwner });
    const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'review'))!.id);
    const workItemId = wait!.workItemId!;

    const reviewerUserId = 7_654_321;
    await claimWorkItem({ workItemId, actorUserId: reviewerUserId });
    await completeWorkItem({ workItemId, actorUserId: reviewerUserId, outcome: 'APPROVE', output: { note: 'ship it' } });

    const gate = await getNodeInstanceByOccurrence(instance.id, 'gate');
    expect(gate!.status).toBe('READY');
    await dispatchNode({ nodeInstanceId: gate!.id, leaseOwnerId: leaseOwner });

    const endApproved = await getNodeInstanceByOccurrence(instance.id, 'end-approved');
    expect(endApproved!.status).toBe('READY');
    await dispatchNode({ nodeInstanceId: endApproved!.id, leaseOwnerId: leaseOwner });

    const finalInstance = await getWorkflowInstanceById(instance.id);
    expect(finalInstance!.status).toBe('SUCCEEDED');
    expect(JSON.parse(finalInstance!.outputJson!)).toEqual({ reviewOutcome: 'APPROVE' });
    expect(JSON.parse(finalInstance!.contextJson!)).toEqual({ reviewOutcome: 'APPROVE' });

    const endRejected = await getNodeInstanceByOccurrence(instance.id, 'end-rejected');
    expect(endRejected!.status).toBe('PENDING');
  });
});
