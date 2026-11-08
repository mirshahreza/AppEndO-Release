import { describe, expect, it, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment } from '../../../test/workflowE2eTestHarness';
import { insertUser, findUserIdByUsername, deleteUser } from '../../../domain/users/userRepository';
import { insertUserRole, deleteUserRoles } from '../../../domain/users/userRoleRepository';
import { listUserNotifications } from '../userNotification.service';
import {
  getUserNotificationPreference,
  listUserNotificationPreferences,
  upsertUserNotificationPreference,
  deleteUserNotificationPreference,
} from '../../../domain/users/userNotificationPreferenceRepository';
import { listPendingDigestItemsForUser } from '../../../domain/users/userNotificationDigestRepository';
import { dispatchNotification, dispatchNotificationForRole } from '../notificationDispatch';
import { scanAndSendDueNotificationDigests } from '../notificationDigestScanner';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Deliberately uses the lighter `bootstrapWorkflowE2eEnvironment` (binds Prisma to a real Postgres
 * pool, nothing else) rather than `bootstrapAuthE2eEnvironment` — the latter's
 * `ensureControlPlaneInitialized` can invoke a schema-push code path that this repo's own CLI-level
 * safety guard (`controlPlaneSchemaPush.ts`) refuses to run for an AI agent without explicit human
 * consent (confirmed by actually hitting that refusal while writing this file). Consequence: the app
 * settings cache is never initialized in this suite, so `sendEmail` always throws
 * "App settings cache is not initialized" — which is exactly the EMAIL-channel-failed path
 * `dispatchNotification`/the digest scanner are supposed to degrade gracefully from. Tests below are
 * written around that real constraint: they verify the graceful-degradation behavior for real
 * (a genuine `sendEmail` failure, not a mock), not a successful SMTP round-trip — that would need a
 * fully-initialized settings cache, which this suite must not trigger.
 */
async function createThrowawayUser(email: string | null): Promise<number> {
  const username = uniqueKey('notif-dispatch-user');
  await insertUser(username, email, 'not-a-real-hash', null);
  const found = await findUserIdByUsername(username);
  return found!.id;
}

describe.skipIf(!dbReady)('Notification channel dispatch (HWF-4.2, real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];
  let userId: number;

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  beforeEach(async () => {
    userId = await createThrowawayUser(`${uniqueKey('notif')}@example.test`);
  });

  afterEach(async () => {
    await deleteUserRoles(userId).catch(() => {});
    await deleteUser(userId).catch(() => {});
  });

  it('preference repository: absent by default, upsert persists, delete reverts to absent', async () => {
    expect(await getUserNotificationPreference(userId, 'workflow.escalation')).toBeUndefined();

    const created = await upsertUserNotificationPreference({ userId, eventType: 'workflow.escalation', channel: 'EMAIL', digest: true });
    expect(created).toMatchObject({ userId, eventType: 'workflow.escalation', channel: 'EMAIL', digest: true });

    const listed = await listUserNotificationPreferences(userId);
    expect(listed).toHaveLength(1);

    const updated = await upsertUserNotificationPreference({ userId, eventType: 'workflow.escalation', channel: 'IN_APP', digest: false });
    expect(updated.channel).toBe('IN_APP');
    expect((await listUserNotificationPreferences(userId))).toHaveLength(1);

    await deleteUserNotificationPreference(userId, 'workflow.escalation');
    expect(await getUserNotificationPreference(userId, 'workflow.escalation')).toBeUndefined();
  });

  it('with no preference set, dispatchNotification defaults to IN_APP', async () => {
    await dispatchNotification({ userId, title: 'Hello', body: 'Body', eventType: 'workflow.comment' });
    const items = await listUserNotifications(userId, { take: 10 });
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Hello');
  });

  it('with EMAIL preference but NO email address on file, dispatchNotification falls back to IN_APP without ever attempting a send', async () => {
    const noEmailUserId = await createThrowawayUser(null);
    try {
      await upsertUserNotificationPreference({ userId: noEmailUserId, eventType: 'workflow.comment', channel: 'EMAIL', digest: false });
      await dispatchNotification({ userId: noEmailUserId, title: 'Hello', body: 'Body', eventType: 'workflow.comment' });
      const items = await listUserNotifications(noEmailUserId, { take: 10 });
      expect(items).toHaveLength(1);
    } finally {
      await deleteUser(noEmailUserId).catch(() => {});
    }
  });

  it('when the EMAIL channel itself fails (a real sendEmail failure, not a mock), dispatchNotification degrades to IN_APP instead of dropping the notification', async () => {
    await upsertUserNotificationPreference({ userId, eventType: 'workflow.comment', channel: 'EMAIL', digest: false });
    await dispatchNotification({ userId, title: 'Hello', body: 'Body', eventType: 'workflow.comment' });
    const items = await listUserNotifications(userId, { take: 10 });
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Hello');
  });

  it('with EMAIL + digest preference, dispatchNotification queues a digest item and never even attempts an immediate send or IN_APP write', async () => {
    await upsertUserNotificationPreference({ userId, eventType: 'workflow.escalation', channel: 'EMAIL', digest: true });
    await dispatchNotification({ userId, title: 'Escalated', body: 'Needs attention', eventType: 'workflow.escalation' });

    const items = await listUserNotifications(userId, { take: 10 });
    expect(items).toHaveLength(0);

    const pending = await listPendingDigestItemsForUser(userId);
    expect(pending).toHaveLength(1);
    expect(pending[0].title).toBe('Escalated');
    expect(pending[0].sentAt).toBeNull();
  });

  it('dispatchNotificationForRole fans out to every member and applies each member\'s own preference (default IN_APP vs. digest-queued)', async () => {
    const digestUserId = await createThrowawayUser(`${uniqueKey('notif-role')}@example.test`);
    // Reuses the pre-registered 'DEVELOPER' role (roleName is FK-constrained to a role catalog, not
    // free-form) — the shared dev DB may already have other DEVELOPER members, so assertions below
    // check containment, not exact fanout membership.
    const roleName = 'DEVELOPER';
    try {
      await insertUserRole(userId, roleName);
      await insertUserRole(digestUserId, roleName);
      await upsertUserNotificationPreference({ userId: digestUserId, eventType: 'workflow', channel: 'EMAIL', digest: true });

      const fanout = await dispatchNotificationForRole({ roleId: roleName, title: 'Role blast', body: 'Body', eventType: 'workflow' });
      expect(fanout.userIds).toContain(userId);
      expect(fanout.userIds).toContain(digestUserId);

      const defaultUserItems = await listUserNotifications(userId, { take: 10 });
      expect(defaultUserItems).toHaveLength(1);
      const digestUserItems = await listUserNotifications(digestUserId, { take: 10 });
      expect(digestUserItems).toHaveLength(0);
      expect(await listPendingDigestItemsForUser(digestUserId)).toHaveLength(1);
    } finally {
      await deleteUserRoles(digestUserId).catch(() => {});
      await deleteUser(digestUserId).catch(() => {});
    }
  });

  it('scanAndSendDueNotificationDigests correctly identifies a due user even when the actual send fails (settings cache not initialized here) — item stays pending for the next scan, never silently dropped', async () => {
    await upsertUserNotificationPreference({ userId, eventType: 'workflow.escalation', channel: 'EMAIL', digest: true });
    await dispatchNotification({ userId, title: 'Digest me', body: 'Body', eventType: 'workflow.escalation' });
    expect(await listPendingDigestItemsForUser(userId)).toHaveLength(1);

    const summary = await scanAndSendDueNotificationDigests(0);
    expect(summary.usersDue).toBeGreaterThanOrEqual(1);
    expect(summary.sendErrors).toBeGreaterThanOrEqual(1);
    expect(await listPendingDigestItemsForUser(userId)).toHaveLength(1);
  });

  it('scanAndSendDueNotificationDigests with a huge interval leaves a freshly-queued item untouched (never even attempts a send)', async () => {
    await upsertUserNotificationPreference({ userId, eventType: 'workflow.escalation', channel: 'EMAIL', digest: true });
    await dispatchNotification({ userId, title: 'Not due yet', body: 'Body', eventType: 'workflow.escalation' });

    const summary = await scanAndSendDueNotificationDigests(365 * 24 * 60 * 60 * 1000);
    expect(summary.usersDue).toBe(0);
    expect(await listPendingDigestItemsForUser(userId)).toHaveLength(1);
  });
});
