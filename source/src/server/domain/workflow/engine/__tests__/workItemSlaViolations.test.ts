import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { claimWorkItem, completeWorkItem } from '../workItemService';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { getWaitByOwningNodeInstance } from '../../workflowWaitRepository';
import { listWorkItemSlaViolations } from '../workItemSlaService';
import { registerCoreActionPack } from '../../actions/corePack';
import { baseModel, workItemNode, workItemOutcomeEdge, endNode, lit } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'sla-violations-worker';
const ACTOR_USER_ID = 454545;

registerCoreActionPack();

function modelWithDueAt(dueIso: string) {
  return baseModel({
    nodes: [
      workItemNode('w1', { assignment: { strategy: 'USER', userId: String(ACTOR_USER_ID) }, allowedOutcomes: ['DONE'] }),
      endNode('end-1'),
    ],
    edges: [workItemOutcomeEdge('e-w1-end', 'w1', 'end-1', 'DONE')],
    start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
  });
}

async function publishStartAndClaim(dueIso: string) {
  const model = modelWithDueAt(dueIso);
  (model.nodes[0] as { dueAt?: unknown }).dueAt = lit(dueIso);
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('sla'), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER', startedById: 1 });
  const w1Node = await getNodeInstanceByOccurrence(instance.id, 'w1');
  await dispatchNode({ nodeInstanceId: w1Node!.id, leaseOwnerId: leaseOwner });
  const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'w1'))!.id);
  return claimWorkItem({ workItemId: wait!.workItemId!, actorUserId: ACTOR_USER_ID });
}

describe.skipIf(!dbReady)('listWorkItemSlaViolations (HWF-4.5, real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('a still-open Work Item whose dueAt has passed is reported as STILL_OPEN', async () => {
    const pastIso = new Date(Date.now() - 60_000).toISOString();
    const item = await publishStartAndClaim(pastIso);
    const violations = await listWorkItemSlaViolations();
    const found = violations.find((v) => v.id === item.id);
    expect(found).toBeDefined();
    expect(found!.breachKind).toBe('STILL_OPEN');
    expect(found!.overdueMs).toBeGreaterThan(0);
  });

  it('a still-open Work Item whose dueAt is in the future is NOT reported', async () => {
    const futureIso = new Date(Date.now() + 60 * 60_000).toISOString();
    const item = await publishStartAndClaim(futureIso);
    const violations = await listWorkItemSlaViolations();
    expect(violations.find((v) => v.id === item.id)).toBeUndefined();
  });

  it('a Work Item completed AFTER its dueAt is reported as COMPLETED_LATE', async () => {
    const pastIso = new Date(Date.now() - 60_000).toISOString();
    const item = await publishStartAndClaim(pastIso);
    const completed = await completeWorkItem({ workItemId: item.id, actorUserId: ACTOR_USER_ID, outcome: 'DONE', output: {} });
    const violations = await listWorkItemSlaViolations();
    const found = violations.find((v) => v.id === completed.id);
    expect(found).toBeDefined();
    expect(found!.breachKind).toBe('COMPLETED_LATE');
    expect(found!.overdueMs).toBeGreaterThan(0);
  });

  it('a Work Item completed BEFORE its dueAt is NOT reported', async () => {
    const futureIso = new Date(Date.now() + 60 * 60_000).toISOString();
    const item = await publishStartAndClaim(futureIso);
    const completed = await completeWorkItem({ workItemId: item.id, actorUserId: ACTOR_USER_ID, outcome: 'DONE', output: {} });
    const violations = await listWorkItemSlaViolations();
    expect(violations.find((v) => v.id === completed.id)).toBeUndefined();
  });

  it('a completed-late Work Item outside recentCompletedWindowMs is excluded (bounded query)', async () => {
    const pastIso = new Date(Date.now() - 60_000).toISOString();
    const item = await publishStartAndClaim(pastIso);
    const completed = await completeWorkItem({ workItemId: item.id, actorUserId: ACTOR_USER_ID, outcome: 'DONE', output: {} });
    // A negative window pushes the cutoff into the future, so nothing just-completed can satisfy
    // `completedAt >= cutoff` — a deterministic way to exercise the "outside window" branch without
    // a real sleep/timing race.
    const violations = await listWorkItemSlaViolations(-1000);
    expect(violations.find((v) => v.id === completed.id)).toBeUndefined();
  });

  it('a Work Item with no dueAt declared is never reported regardless of status', async () => {
    const model = baseModel({
      nodes: [workItemNode('w1', { assignment: { strategy: 'USER', userId: String(ACTOR_USER_ID) }, allowedOutcomes: ['DONE'] }), endNode('end-1')],
      edges: [workItemOutcomeEdge('e-w1-end', 'w1', 'end-1', 'DONE')],
      start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
    });
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('sla-no-due'), draftDefinitionJson: JSON.stringify(model) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER', startedById: 1 });
    const w1Node = await getNodeInstanceByOccurrence(instance.id, 'w1');
    await dispatchNode({ nodeInstanceId: w1Node!.id, leaseOwnerId: leaseOwner });
    const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'w1'))!.id);
    const item = await claimWorkItem({ workItemId: wait!.workItemId!, actorUserId: ACTOR_USER_ID });
    const violations = await listWorkItemSlaViolations();
    expect(violations.find((v) => v.id === item.id)).toBeUndefined();
  });
});
