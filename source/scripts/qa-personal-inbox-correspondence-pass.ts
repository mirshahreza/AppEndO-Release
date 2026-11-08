/**
 * Verify inbox reply/forward markers and eligibility rules.
 * Usage: npx tsx scripts/qa-personal-inbox-correspondence-pass.ts
 */
import { SETTINGS_PATH } from '../src/server/config/settingsFile';
import { ensureControlPlaneInitialized, resetControlPlaneInitState } from '../src/server/db/controlPlaneInit';
import { closeControlPlaneSequelize } from '../src/server/db/controlPlaneSequelize';
import {
  closePrismaControlPlane,
  getPrismaControlPlane,
  initPrismaControlPlaneFromSettings,
} from '../src/server/db/prismaControlPlane';
import { readControlPlaneDatabaseSettings } from '../src/server/db/controlPlaneDatabase';
import type { AuthRequestContext } from '../src/server/middleware/auth.middleware';
import { PersonalInboxService } from '../src/server/services/personal-inbox/personalInbox.service';
import { FeedbackService } from '../src/server/services/feedback/feedback.service';
import { PersonalInboxCorrespondenceService } from '../src/server/services/personal-inbox/personalInboxCorrespondence.service';
import { DirectMessageService } from '../src/server/services/direct-messages/directMessage.service';
import { inboxSupportsCorrespondenceAction } from '../src/shared/personal-inbox/inboxCorrespondencePolicy';
import { createUserNotification } from '../src/server/services/notifications/userNotification.service';
import { invalidatePersonalInboxProjection } from '../src/server/services/personal-inbox/personalInboxProjectionInvalidate';

async function resolveAdminAuth(): Promise<{ auth: AuthRequestContext; peerId: number }> {
  await initPrismaControlPlaneFromSettings(readControlPlaneDatabaseSettings(SETTINGS_PATH));
  const prisma = getPrismaControlPlane();
  const row = await prisma.baseUser.findFirst({
    where: { username: 'admin' },
    select: { id: true, username: true },
  });
  if (!row) {
    throw new Error('User "admin" not found.');
  }
  const peer = await prisma.baseUser.findFirst({
    where: { id: { not: row.id } },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  if (!peer) {
    throw new Error('Need a second user to test forward.');
  }
  return {
    auth: { userId: Number(row.id), username: row.username, roles: ['ADMIN', 'USER'] },
    peerId: Number(peer.id),
  };
}

async function main(): Promise<void> {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });
  const { auth, peerId } = await resolveAdminAuth();
  const inbox = new PersonalInboxService(new FeedbackService(SETTINGS_PATH));
  const feedbackService = new FeedbackService(SETTINGS_PATH);
  const correspondence = new PersonalInboxCorrespondenceService(
    feedbackService,
    new DirectMessageService(SETTINGS_PATH),
  );

  if (inboxSupportsCorrespondenceAction('message_dispatch', 'reply')) {
    throw new Error('message_dispatch must not allow reply.');
  }
  if (!inboxSupportsCorrespondenceAction('feedback', 'forward')) {
    throw new Error('feedback must allow forward.');
  }

  const prisma = getPrismaControlPlane();
  const ticket = await prisma.baseAppFeedback.create({
    data: {
      type: 'general',
      title: `QA correspondence ${Date.now()}`,
      submitterUserId: BigInt(auth.userId),
      status: 'NEW',
      priority: 'NORMAL',
      messageCount: 2,
      lastMessageAt: new Date(),
    },
  });
  await prisma.baseAppFeedbackMessage.createMany({
    data: [
      {
        feedbackId: ticket.id,
        kind: 'SUBMITTER',
        body: 'Correspondence QA opener',
        authorUserId: BigInt(auth.userId),
      },
      {
        feedbackId: ticket.id,
        kind: 'STAFF',
        body: 'Staff line for reply test',
        authorUserId: BigInt(auth.userId),
      },
    ],
  });
  const itemKey = `feedback:${Number(ticket.id)}`;
  invalidatePersonalInboxProjection(auth.userId);
  let row = (await inbox.list(auth, { kind: 'feedback', take: 50 })).items.find((item) => item.id === itemKey);
  if (!row) {
    throw new Error('Seeded feedback missing from inbox list.');
  }

  await correspondence.reply(auth, itemKey, 'Thanks — we are looking into this.', '');
  row = (await inbox.list(auth, { kind: 'feedback', take: 50 })).items.find((item) => item.id === itemKey);
  if (!row?.correspondence?.replied) {
    throw new Error('Expected replied badge after reply.');
  }

  await correspondence.forward(auth, itemKey, peerId, row, 'Please take a look.');
  row = (await inbox.list(auth, { kind: 'feedback', take: 50 })).items.find((item) => item.id === itemKey);
  if (!row?.correspondence?.forwarded) {
    throw new Error('Expected forwarded badge after forward.');
  }

  const peerAlerts = await prisma.baseUserNotification.count({
    where: { userId: BigInt(peerId), source: 'inbox.forward.feedback' },
  });
  if (peerAlerts < 1) {
    throw new Error('Recipient did not receive forwarded notification.');
  }

  console.log('OK  personal inbox correspondence pass');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane().catch(() => undefined);
    await closeControlPlaneSequelize().catch(() => undefined);
  });
