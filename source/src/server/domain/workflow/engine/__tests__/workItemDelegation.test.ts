import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { getWorkItemByNodeInstance } from '../../workItemRepository';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { createDelegationRule } from '../../workItemDelegationRuleRepository';
import { registerCoreActionPack } from '../../actions/corePack';
import { baseModel, workItemNode, workItemOutcomeEdge, endNode } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'delegation-worker';
const ABSENT_USER_ID = 828282;
const DELEGATE_USER_ID = 929292;
const OTHER_USER_ID = 303030;

registerCoreActionPack();

async function publishAndDispatch(targetUserId: number) {
  const model = baseModel({
    nodes: [
      workItemNode('w1', { assignment: { strategy: 'USER', userId: String(targetUserId) }, allowedOutcomes: ['DONE'] }),
      endNode('end-1'),
    ],
    edges: [workItemOutcomeEdge('e-w1-end', 'w1', 'end-1', 'DONE')],
    start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
  });
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('delegation'), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER', startedById: 1 });
  const w1Node = await getNodeInstanceByOccurrence(instance.id, 'w1');
  await dispatchNode({ nodeInstanceId: w1Node!.id, leaseOwnerId: leaseOwner });
  return getWorkItemByNodeInstance(w1Node!.id);
}

describe.skipIf(!dbReady)('WORK_ITEM Out-of-Office delegation (HWF-2.4, real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('redirects a new USER-strategy assignment to the delegate while an active rule covers now()', async () => {
    await createDelegationRule({
      userId: ABSENT_USER_ID,
      delegateUserId: DELEGATE_USER_ID,
      startAt: new Date(Date.now() - 60_000).toISOString(),
      endAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    });

    const workItem = await publishAndDispatch(ABSENT_USER_ID);
    const evidence = JSON.parse(workItem!.assignmentEvidenceJson!) as { resolvedUserId?: number; delegatedFromUserId?: number };
    expect(evidence.resolvedUserId).toBe(DELEGATE_USER_ID);
    expect(evidence.delegatedFromUserId).toBe(ABSENT_USER_ID);
  });

  it('does not redirect when no active rule covers the target user', async () => {
    const workItem = await publishAndDispatch(OTHER_USER_ID);
    const evidence = JSON.parse(workItem!.assignmentEvidenceJson!) as { resolvedUserId?: number; delegatedFromUserId?: number };
    expect(evidence.resolvedUserId).toBe(OTHER_USER_ID);
    expect(evidence.delegatedFromUserId).toBeUndefined();
  });

  it('does not redirect once the rule window has ended', async () => {
    const expiredUserId = 404040;
    await createDelegationRule({
      userId: expiredUserId,
      delegateUserId: DELEGATE_USER_ID,
      startAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
      endAt: new Date(Date.now() - 60 * 60_000).toISOString(),
    });

    const workItem = await publishAndDispatch(expiredUserId);
    const evidence = JSON.parse(workItem!.assignmentEvidenceJson!) as { resolvedUserId?: number };
    expect(evidence.resolvedUserId).toBe(expiredUserId);
  });
});
