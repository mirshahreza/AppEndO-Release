import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { scanAndRunDueEscalations } from '../workItemEscalationService';
import { listEscalationsForWorkItem } from '../../workItemEscalationRepository';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { getWaitByOwningNodeInstance } from '../../workflowWaitRepository';
import { baseModel, workItemNode, workItemOutcomeEdge, endNode, mappingOf, lit } from './fixtures';

const createUserNotification = vi.fn(async () => ({ id: 1 }));
const createNotificationsForRole = vi.fn(async () => ({ created: 1, userIds: [1] }));

vi.mock('../../../../services/notifications/userNotification.service', () => ({
  createUserNotification: (...args: unknown[]) => createUserNotification(...args),
  createNotificationsForRole: (...args: unknown[]) => createNotificationsForRole(...args),
  parseNotificationUserId: (value: unknown) => {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
    if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
      const n = Number(value.trim());
      return Number.isInteger(n) && n > 0 ? n : null;
    }
    return null;
  },
}));

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'notify-escalation-worker';

async function publishAndStart(model: ReturnType<typeof baseModel>) {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('notify-esc'), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  return startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER', startedById: 1 });
}

describe.skipIf(!dbReady)('Work Item NOTIFY escalation (in-app notification primitive)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('NOTIFY uses the mapped title/body and falls back to the USER assignee when input.userId is omitted', async () => {
    createUserNotification.mockClear();
    const model = baseModel({
      nodes: [
        workItemNode('w1', {
          assignment: { strategy: 'USER', userId: '1' },
          allowedOutcomes: ['DONE'],
          escalationPolicy: {
            steps: [{
              key: 'ping',
              trigger: { type: 'AFTER_OPEN_MS', afterMs: 0 },
              action: {
                type: 'NOTIFY',
                notificationRef: { bindingType: 'in-app', bindingId: 'assignee' },
                input: mappingOf({ title: lit('SLA warning'), body: lit('Please complete this task.') }),
              },
              maxExecutions: 1,
            }],
          },
        }),
        endNode('end-1'),
      ],
      edges: [workItemOutcomeEdge('e-done', 'w1', 'end-1', 'DONE')],
      start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
    });
    const { instance } = await publishAndStart(model);
    const node = await getNodeInstanceByOccurrence(instance.id, 'w1');
    await dispatchNode({ nodeInstanceId: node!.id, leaseOwnerId: leaseOwner });
    const wait = await getWaitByOwningNodeInstance((await getNodeInstanceByOccurrence(instance.id, 'w1'))!.id);
    const workItemId = wait!.workItemId!;

    const summary = await scanAndRunDueEscalations();
    expect(summary.stepsExecuted).toBeGreaterThanOrEqual(1);

    expect(createUserNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      title: 'SLA warning',
      body: 'Please complete this task.',
      source: 'workflow.escalation',
      metadata: expect.objectContaining({ workItemId, policyStepKey: 'ping' }),
    }));

    const escalations = await listEscalationsForWorkItem(workItemId);
    expect(escalations.some((e) => e.actionType === 'NOTIFY' && e.status === 'SUCCEEDED')).toBe(true);
  });
});
