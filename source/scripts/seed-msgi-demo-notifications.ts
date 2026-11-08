/**
 * Seed a few in-app + MSGI ledger rows for the builtin `admin` user (bell + inbox send-log filter).
 *
 * Usage:
 *   npx tsx scripts/seed-msgi-demo-notifications.ts
 */
import { SETTINGS_PATH } from '../src/server/config/settingsFile';
import { readControlPlaneDatabaseSettings } from '../src/server/db/controlPlaneDatabase';
import { closeControlPlaneSequelize } from '../src/server/db/controlPlaneSequelize';
import {
  closePrismaControlPlane,
  getPrismaControlPlane,
  initPrismaControlPlaneFromSettings,
} from '../src/server/db/prismaControlPlane';
import { ensureUserMessageDispatchTables } from '../src/server/domain/user-message-dispatches/userMessageDispatchSequelizeModels';
import {
  createUserMessageDispatch,
  newMessageDispatchCorrelationId,
} from '../src/server/services/notifications/userMessageDispatch.service';
import { createUserNotification } from '../src/server/services/notifications/userNotification.service';

const SAMPLES = [
  {
    title: 'Welcome to Messages',
    body: 'This is a sample in-app notification. Open the bell or visit Studio → Messages to see the dispatch ledger.',
    eventType: 'workflow',
    href: '/studio/my-inbox?kind=message_dispatch',
    severity: 'info',
  },
  {
    title: 'Workflow escalation (demo)',
    body: 'MSGI records outbound delivery per channel. This row simulates a workflow escalation notice.',
    eventType: 'workflow.escalation',
    href: '/studio/my-inbox',
    severity: 'warn',
  },
  {
    title: 'Comment mention (demo)',
    body: 'A teammate mentioned you. In production this comes from workflow comment notify.',
    eventType: 'workflow.comment',
    href: null,
    severity: 'info',
  },
  {
    title: 'Platform notice',
    body: 'User Message Inbox v1 is live: ledger, retention, and unseen bell badge.',
    eventType: 'agent_task',
    href: '/studio/my-inbox?kind=message_dispatch',
    severity: 'info',
  },
] as const;

const main = async () => {
  const settings = readControlPlaneDatabaseSettings(SETTINGS_PATH);
  await initPrismaControlPlaneFromSettings(settings);
  await ensureUserMessageDispatchTables();

  const adminRow = await getPrismaControlPlane().baseUser.findFirst({
    where: { username: 'admin' },
    select: { id: true },
  });
  if (!adminRow) {
    throw new Error('Builtin user "admin" was not found. Complete install or seed users first.');
  }
  const admin = { id: Number(adminRow.id) };

  for (const sample of SAMPLES) {
    const correlationId = newMessageDispatchCorrelationId();
    const { id: inAppNotificationId } = await createUserNotification({
      userId: admin.id,
      title: sample.title,
      body: sample.body,
      severity: sample.severity,
      href: sample.href,
      source: sample.eventType,
    });
    await createUserMessageDispatch({
      userId: admin.id,
      correlationId,
      eventType: sample.eventType,
      channel: 'IN_APP',
      deliveryStatus: 'sent',
      title: sample.title,
      body: sample.body,
      href: sample.href,
      severity: sample.severity,
      inAppNotificationId,
    });
  }

  console.log(`Seeded ${SAMPLES.length} notifications for admin (userId=${admin.id}).`);
};

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane().catch(() => undefined);
    await closeControlPlaneSequelize().catch(() => undefined);
  });
