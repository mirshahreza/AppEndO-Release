import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { SETTINGS_PATH } from '../../../config/settingsFile';
import {
  bootstrapControlPlaneE2eEnvironment,
  isControlPlaneE2eReachable,
  shutdownControlPlaneE2eEnvironment,
} from '../../../test/authE2eTestHarness';
import { createTestWorkflowDefinition } from '../../../test/workflowE2eTestHarness';
import { publishWorkflowDefinition } from '../../../domain/workflow/publication/workflowPublicationService';
import { startWorkflowInstance } from '../../../domain/workflow/engine/startService';
import { dispatchNode } from '../../../domain/workflow/engine/dispatchService';
import { getWorkItemById } from '../../../domain/workflow/workItemRepository';
import { getNodeInstanceByOccurrence } from '../../../domain/workflow/workflowNodeInstanceRepository';
import { getWaitByOwningNodeInstance } from '../../../domain/workflow/workflowWaitRepository';
import { listWorkItemInbox } from '../../../domain/workflow/engine/workItemInboxService';
import { registerCoreActionPack } from '../../../domain/workflow/actions/corePack';
import { baseModel, workItemNode, workItemOutcomeEdge, endNode, lit } from '../../../domain/workflow/engine/__tests__/fixtures';
import { PersonalInboxService } from '../personalInbox.service';
import { FeedbackService } from '../../feedback/feedback.service';
import { createUserNotification } from '../../notifications/userNotification.service';
import { personalInboxProjectionRepository } from '../../../domain/personal-inbox/personalInboxProjection.repository';
import { collectPersonalInboxItems } from '../personalInboxLiveCollector';
import { USER_ID_SEQUENCE_START } from '../../../../core/db/database';

const dbReady = await isControlPlaneE2eReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'personal-inbox-e2e-worker';

/** Seeded admin user — required for notification FK + realistic inbox actor. */
const INBOX_USER_ID = USER_ID_SEQUENCE_START;

registerCoreActionPack();

async function createAssignedOpenWorkItem(input: { userId: number; titleMarker: string }) {
  const model = baseModel({
    nodes: [
      workItemNode('w1', {
        assignment: { strategy: 'USER', userId: String(input.userId) },
        allowedOutcomes: ['DONE'],
        title: lit(input.titleMarker),
      }),
      endNode('end-1'),
    ],
    edges: [workItemOutcomeEdge('e-w1-end', 'w1', 'end-1', 'DONE')],
    start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
  });
  const definition = await createTestWorkflowDefinition({
    key: uniqueKey('personal-inbox'),
    draftDefinitionJson: JSON.stringify(model),
  });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revision.id,
    input: {},
    startedByType: 'USER',
    startedById: 1,
  });
  const w1Node = await getNodeInstanceByOccurrence(instance.id, 'w1');
  await dispatchNode({ nodeInstanceId: w1Node!.id, leaseOwnerId: leaseOwner });
  const afterNode = await getNodeInstanceByOccurrence(instance.id, 'w1');
  const wait = await getWaitByOwningNodeInstance(afterNode!.id);
  expect(wait?.workItemId).toBeTruthy();
  const workItem = await getWorkItemById(wait!.workItemId!);
  expect(workItem?.status).toBe('OPEN');
  return workItem!;
}

describe.skipIf(!dbReady)('Personal inbox — workflow → list/summary (Phase A live + Phase B projection)', () => {
  let pool: Pool | undefined;
  let feedbackService: FeedbackService;
  const auth = { userId: INBOX_USER_ID, roles: ['ADMIN'], username: 'admin' };

  beforeAll(async () => {
    ({ pool } = await bootstrapControlPlaneE2eEnvironment());
    feedbackService = new FeedbackService(SETTINGS_PATH);
  }, 120_000);

  afterAll(async () => {
    await shutdownControlPlaneE2eEnvironment(pool);
  });

  it('Phase A (live): assigned work item appears in list and bell-style summary', async () => {
    const marker = uniqueKey('inbox-wi');
    const workItem = await createAssignedOpenWorkItem({ userId: INBOX_USER_ID, titleMarker: marker });

    const liveService = new PersonalInboxService(feedbackService, { readMode: 'live' });
    const assigned = await listWorkItemInbox('MINE_ASSIGNED', { userId: INBOX_USER_ID, roles: auth.roles });
    expect(assigned.some((wi) => wi.id === workItem.id)).toBe(true);

    const union = await collectPersonalInboxItems(auth, feedbackService);
    const row = union.find(
      (item) => item.ref?.type === 'work_item' && item.ref.id === workItem.id,
    );
    expect(row, 'work item row missing from Phase A live union').toBeDefined();
    expect(row!.attention).toBe('action_required');
    expect(row!.href).toBe(`my-inbox?workItemId=${workItem.id}`);
    expect(row!.title).toBe(marker);

    const list = await liveService.list(auth, { kind: 'work_item', take: 100 });
    expect(list.total).toBeGreaterThanOrEqual(1);
    expect(
      list.items.some((item) => item.id === `work_item:${workItem.id}`) || list.total > list.items.length,
    ).toBe(true);

    const summary = await liveService.summary(auth);
    expect(summary.breakdown.workItems).toBeGreaterThanOrEqual(1);
    expect(summary.attentionCount).toBeGreaterThanOrEqual(1);
    expect(summary.preview.length).toBeGreaterThan(0);
  });

  it('Phase A: alert tied to the same work item is deduped from the union', async () => {
    const marker = uniqueKey('inbox-dedup');
    const workItem = await createAssignedOpenWorkItem({ userId: INBOX_USER_ID, titleMarker: marker });

    await createUserNotification({
      userId: INBOX_USER_ID,
      title: 'Duplicate ping',
      body: 'Should not list separately',
      metadata: { workItemId: workItem.id },
    });

    const items = await collectPersonalInboxItems(auth, feedbackService);
    const alertsForWi = items.filter(
      (item) => item.kind === 'alert' && item.title === 'Duplicate ping',
    );
    expect(alertsForWi).toHaveLength(0);
    expect(items.some((item) => item.id === `work_item:${workItem.id}`)).toBe(true);
  });

  it('Phase B (projection): serves cached rows then refreshes after invalidation', async () => {
    const marker = uniqueKey('inbox-proj');
    const workItem = await createAssignedOpenWorkItem({ userId: INBOX_USER_ID, titleMarker: marker });

    const projectionService = new PersonalInboxService(feedbackService, { readMode: 'projection' });
    const first = await projectionService.list(auth, { kind: 'work_item', take: 50 });
    expect(first.items.some((i) => i.id === `work_item:${workItem.id}`)).toBe(true);

    const metaAfterFirst = await personalInboxProjectionRepository.getMeta(INBOX_USER_ID);
    expect(metaAfterFirst?.refreshedAt).toBeTruthy();

    await createUserNotification({
      userId: INBOX_USER_ID,
      title: uniqueKey('inbox-alert'),
      body: 'Standalone alert for projection refresh',
    });

    await personalInboxProjectionRepository.markStale(INBOX_USER_ID);

    const summary = await projectionService.summary(auth);
    expect(summary.breakdown.alerts).toBeGreaterThanOrEqual(1);
    expect(summary.preview.some((p) => p.kind === 'alert')).toBe(true);

    const second = await projectionService.list(auth, { kind: 'alert', take: 20 });
    expect(second.items.some((i) => i.kind === 'alert' && i.attention === 'unread')).toBe(true);
  });
});
