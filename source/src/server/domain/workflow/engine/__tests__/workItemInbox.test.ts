import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { claimWorkItem, completeWorkItem } from '../workItemService';
import { listWorkItemInbox } from '../workItemInboxService';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { getWaitByOwningNodeInstance } from '../../workflowWaitRepository';
import { baseModel, workItemNode, workItemOutcomeEdge, endNode } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'inbox-worker';
const uniqueUserId = () => 1_000_000 + Math.floor(Math.random() * 1_000_000);

async function publishAndStart(model: ReturnType<typeof baseModel>, input: unknown = {}) {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('inbox'), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  return startWorkflowInstance({ workflowRevisionId: revision.id, input: input as never, startedByType: 'USER', startedById: 1 });
}

function approvalModel(assignment: Parameters<typeof workItemNode>[1]['assignment']) {
  return baseModel({
    nodes: [workItemNode('w1', { assignment, allowedOutcomes: ['DONE'] }), endNode('end-1')],
    edges: [workItemOutcomeEdge('e-done', 'w1', 'end-1', 'DONE')],
    start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
  });
}

async function createOpenWorkItem(assignment: Parameters<typeof workItemNode>[1]['assignment']): Promise<number> {
  const { instance } = await publishAndStart(approvalModel(assignment));
  const node = await getNodeInstanceByOccurrence(instance.id, 'w1');
  await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });
  const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'w1'))!.id);
  return wait!.workItemId!;
}

describe.skipIf(!dbReady)('Work Item Inbox (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('MINE_ASSIGNED: returns only OPEN items directly USER-assigned to the actor', async () => {
    const actor = uniqueUserId();
    const other = uniqueUserId();
    const mine = await createOpenWorkItem({ strategy: 'USER', userId: String(actor) });
    const notMine = await createOpenWorkItem({ strategy: 'USER', userId: String(other) });

    const results = await listWorkItemInbox('MINE_ASSIGNED', { userId: actor, roles: ['USER'] });
    const ids = results.map((r) => r.id);
    expect(ids).toContain(mine);
    expect(ids).not.toContain(notMine);
  });

  it('MINE_CLAIMED: returns only items CLAIMED by the actor', async () => {
    const actor = uniqueUserId();
    const workItemId = await createOpenWorkItem({ strategy: 'USER', userId: String(actor) });
    await claimWorkItem({ workItemId, actorUserId: actor });

    const mineClaimed = await listWorkItemInbox('MINE_CLAIMED', { userId: actor, roles: ['USER'] });
    expect(mineClaimed.map((r) => r.id)).toContain(workItemId);

    const someoneElse = uniqueUserId();
    const theirsClaimed = await listWorkItemInbox('MINE_CLAIMED', { userId: someoneElse, roles: ['USER'] });
    expect(theirsClaimed.map((r) => r.id)).not.toContain(workItemId);
  });

  it('AVAILABLE_TO_CLAIM: ROLE-assigned OPEN items are visible to an eligible actor and disappear once claimed', async () => {
    const actor = uniqueUserId(); // no seeded BaseUserRole rows -> loadUserRoles defaults to ['USER']
    const workItemId = await createOpenWorkItem({ strategy: 'ROLE', roleId: 'USER' });

    const before = await listWorkItemInbox('AVAILABLE_TO_CLAIM', { userId: actor, roles: ['USER'] });
    expect(before.map((r) => r.id)).toContain(workItemId);

    await claimWorkItem({ workItemId, actorUserId: actor });

    const after = await listWorkItemInbox('AVAILABLE_TO_CLAIM', { userId: actor, roles: ['USER'] });
    expect(after.map((r) => r.id)).not.toContain(workItemId);
  });

  it('AVAILABLE_TO_CLAIM: an actor without the required role does not see the item', async () => {
    const workItemId = await createOpenWorkItem({ strategy: 'ROLE', roleId: 'USER' });
    const actorWithoutRole = uniqueUserId();
    const results = await listWorkItemInbox('AVAILABLE_TO_CLAIM', { userId: actorWithoutRole, roles: ['SOME_OTHER_ROLE_ONLY'] });
    expect(results.map((r) => r.id)).not.toContain(workItemId);
  });

  it('MINE_RECENT: includes items the actor completed, excludes items still active', async () => {
    const actor = uniqueUserId();
    const completedId = await createOpenWorkItem({ strategy: 'USER', userId: String(actor) });
    await completeWorkItem({ workItemId: completedId, actorUserId: actor, outcome: 'DONE', output: {} });
    const stillOpenId = await createOpenWorkItem({ strategy: 'USER', userId: String(actor) });

    const recent = await listWorkItemInbox('MINE_RECENT', { userId: actor, roles: ['USER'] });
    const ids = recent.map((r) => r.id);
    expect(ids).toContain(completedId);
    expect(ids).not.toContain(stillOpenId);
  });

  it('default ordering is priority DESC, createdAt ASC, id ASC', async () => {
    const actor = uniqueUserId();
    const low = await createOpenWorkItem({ strategy: 'USER', userId: String(actor) });
    const high = await createOpenWorkItem({ strategy: 'USER', userId: String(actor) });
    // priority is not author-settable at creation (doc 07 section 8: defaults to 0) — verify createdAt ASC/id ASC tie-break ordering among equal-priority items instead.
    const results = await listWorkItemInbox('MINE_ASSIGNED', { userId: actor, roles: ['USER'] });
    const ids = results.map((r) => r.id);
    const lowIndex = ids.indexOf(low);
    const highIndex = ids.indexOf(high);
    expect(lowIndex).toBeGreaterThanOrEqual(0);
    expect(highIndex).toBeGreaterThanOrEqual(0);
    expect(lowIndex).toBeLessThan(highIndex); // created first -> appears first among equal priority
  });

  it('never exposes raw inputJson/outputJson in the projection', async () => {
    const actor = uniqueUserId();
    const workItemId = await createOpenWorkItem({ strategy: 'USER', userId: String(actor) });
    const results = await listWorkItemInbox('MINE_ASSIGNED', { userId: actor, roles: ['USER'] });
    const item = results.find((r) => r.id === workItemId)!;
    expect(item).not.toHaveProperty('inputJson');
    expect(item).not.toHaveProperty('outputJson');
  });
});
