/**
 * Replace demo/QA inbox rows with meaningful samples (admin user).
 *
 * Usage: npx tsx scripts/seed-personal-inbox-demo-items.ts
 */
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { runtimeDirs } from '../src/core/runtime/runtimePaths';
import { SETTINGS_PATH } from '../src/server/config/settingsFile';
import { ensureControlPlaneInitialized, resetControlPlaneInitState } from '../src/server/db/controlPlaneInit';
import { closeControlPlaneSequelize } from '../src/server/db/controlPlaneSequelize';
import {
  closePrismaControlPlane,
  getPrismaControlPlane,
  initPrismaControlPlaneFromSettings,
} from '../src/server/db/prismaControlPlane';
import { readControlPlaneDatabaseSettings } from '../src/server/db/controlPlaneDatabase';
import { createUserNotification } from '../src/server/services/notifications/userNotification.service';
import { personalInboxSeenRepository } from '../src/server/domain/personal-inbox/personalInboxSeen.repository';
import { personalInboxCorrespondenceRepository } from '../src/server/domain/personal-inbox/personalInboxCorrespondence.repository';
import { PersonalInboxService } from '../src/server/services/personal-inbox/personalInbox.service';
import { PersonalInboxCorrespondenceService } from '../src/server/services/personal-inbox/personalInboxCorrespondence.service';
import { FeedbackService } from '../src/server/services/feedback/feedback.service';
import { DirectMessageService } from '../src/server/services/direct-messages/directMessage.service';
import { invalidatePersonalInboxProjection } from '../src/server/services/personal-inbox/personalInboxProjectionInvalidate';
import type { AuthRequestContext } from '../src/server/middleware/auth.middleware';
import type { PersonalInboxItem } from '../src/shared/api/contracts/personal-inbox/types';

async function resolveAdminAuth(): Promise<AuthRequestContext> {
  await initPrismaControlPlaneFromSettings(readControlPlaneDatabaseSettings(SETTINGS_PATH));
  const row = await getPrismaControlPlane().baseUser.findFirst({
    where: { username: 'admin' },
    select: { id: true, username: true },
  });
  if (!row) {
    throw new Error('User "admin" not found — run setup first.');
  }
  return { userId: Number(row.id), username: row.username, roles: ['ADMIN', 'USER'] };
}

async function resolveForwardPeerUserId(adminUserId: number): Promise<number> {
  const peer = await getPrismaControlPlane().baseUser.findFirst({
    where: { id: { not: BigInt(adminUserId) } },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  if (!peer) {
    throw new Error('Need a second user account to demo inbox forward.');
  }
  return Number(peer.id);
}

async function seedCorrespondenceSamples(
  auth: AuthRequestContext,
  inbox: PersonalInboxService,
  correspondence: PersonalInboxCorrespondenceService,
  feedbackKeys: string[],
  alertKeys: string[],
  peerUserId: number,
): Promise<void> {
  invalidatePersonalInboxProjection(auth.userId);
  const listed = await inbox.list(auth, { kind: 'all', take: 120 });
  const byId = new Map<string, PersonalInboxItem>(listed.items.map((item) => [item.id, item]));
  const requireRow = (itemKey: string): PersonalInboxItem => {
    const row = byId.get(itemKey);
    if (!row) {
      throw new Error(`Inbox row missing after seed: ${itemKey}`);
    }
    return row;
  };

  await correspondence.reply(
    auth,
    feedbackKeys[0]!,
    'Thanks — finance is reconciling the export with billing.',
    '',
  );
  await correspondence.forward(
    auth,
    feedbackKeys[0]!,
    peerUserId,
    requireRow(feedbackKeys[0]!),
    'Can you confirm totals on your side?',
  );

  await correspondence.reply(
    auth,
    feedbackKeys[1]!,
    'Logged for mobile shell — we will post mockups in the thread.',
    '',
  );

  await correspondence.forward(
    auth,
    feedbackKeys[2]!,
    peerUserId,
    requireRow(feedbackKeys[2]!),
    'Safari attachment issue — please try from your machine.',
  );

  await correspondence.forward(
    auth,
    alertKeys[0]!,
    peerUserId,
    requireRow(alertKeys[0]!),
    'Please confirm the maintenance window with your team.',
  );

  invalidatePersonalInboxProjection(auth.userId);
}

async function cleanupDemoRows(auth: AuthRequestContext): Promise<void> {
  const prisma = getPrismaControlPlane();
  const demoFeedback = await prisma.baseAppFeedback.findMany({
    where: {
      OR: [
        { title: { contains: 'QA inbox' } },
        { title: { contains: 'QA feedback' } },
        { title: { contains: 'Demo feedback' } },
        { title: { contains: '[Demo' } },
      ],
    },
    select: { id: true },
  });
  if (demoFeedback.length > 0) {
    const ids = demoFeedback.map((row) => row.id);
    await prisma.baseAppFeedbackMessage.deleteMany({ where: { feedbackId: { in: ids } } });
    await prisma.baseAppFeedbackReadCursor.deleteMany({ where: { feedbackId: { in: ids } } });
    await prisma.baseAppFeedback.deleteMany({ where: { id: { in: ids } } });
  }

  await prisma.baseUserNotification.deleteMany({
    where: {
      userId: BigInt(auth.userId),
      OR: [
        { source: { startsWith: 'demo.inbox' } },
        { source: { startsWith: 'qa.inbox' } },
        { title: { contains: 'Demo alert' } },
        { title: { contains: 'QA inbox alert' } },
        { title: { contains: '[Demo alert' } },
      ],
    },
  });
}

type SeedFeedbackAttachmentSpec = {
  fileName: string;
  mimeType: string;
  content: Buffer;
};

async function seedFeedbackAttachment(
  auth: AuthRequestContext,
  feedbackId: bigint,
  messageId: bigint,
  spec: SeedFeedbackAttachmentSpec,
): Promise<void> {
  const prisma = getPrismaControlPlane();
  const attachmentId = crypto.randomUUID();
  const safeName = spec.fileName.replace(/[^\w.\-() ]+/g, '_').slice(0, 200) || 'attachment';
  const storageKey = path.join('seed', String(feedbackId), `${attachmentId}-${safeName}`);
  const absolutePath = path.join(runtimeDirs.feedbackAttachments, storageKey);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, spec.content);

  await prisma.baseAppFeedbackAttachment.create({
    data: {
      feedbackId,
      messageId,
      fileName: safeName,
      mimeType: spec.mimeType,
      sizeBytes: spec.content.byteLength,
      storageKey,
      uploadedByUserId: BigInt(auth.userId),
      stagedSessionKey: null,
    },
  });
}

async function seedFeedback(
  auth: AuthRequestContext,
  input: {
    title: string;
    submitterOnly: boolean;
    staffReply?: string;
    attachments?: SeedFeedbackAttachmentSpec[];
  },
): Promise<string> {
  const prisma = getPrismaControlPlane();
  const messageCount = input.submitterOnly ? 1 : 2;
  const ticket = await prisma.baseAppFeedback.create({
    data: {
      type: 'general',
      title: input.title,
      submitterUserId: BigInt(auth.userId),
      status: 'NEW',
      priority: 'NORMAL',
      messageCount,
      lastMessageAt: new Date(),
    },
  });
  const submitterMessage = await prisma.baseAppFeedbackMessage.create({
    data: {
      feedbackId: ticket.id,
      kind: 'SUBMITTER',
      body: 'I need help understanding the workflow approval steps for my team.',
      authorUserId: BigInt(auth.userId),
    },
  });
  if (input.attachments?.length) {
    for (const attachment of input.attachments) {
      await seedFeedbackAttachment(auth, ticket.id, submitterMessage.id, attachment);
    }
  }
  if (!input.submitterOnly && input.staffReply) {
    await prisma.baseAppFeedbackMessage.create({
      data: {
        feedbackId: ticket.id,
        kind: 'STAFF',
        body: input.staffReply,
        authorUserId: BigInt(auth.userId),
      },
    });
  }
  const itemKey = `feedback:${Number(ticket.id)}`;
  await personalInboxSeenRepository.clearSeen(auth.userId, itemKey);
  await personalInboxCorrespondenceRepository.clearForUserItem(auth.userId, itemKey);
  await prisma.baseAppFeedbackReadCursor.deleteMany({
    where: { feedbackId: ticket.id, userId: BigInt(auth.userId) },
  });
  return itemKey;
}

async function seedAlert(auth: AuthRequestContext, title: string, body: string, source: string): Promise<string> {
  const { id } = await createUserNotification({
    userId: auth.userId,
    title,
    body,
    severity: 'info',
    source,
    href: '/studio/my-inbox?kind=alert',
  });
  return `alert:${id}`;
}

async function main(): Promise<void> {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });
  const auth = await resolveAdminAuth();

  await cleanupDemoRows(auth);

  const feedbackKeys = await Promise.all([
    seedFeedback(auth, {
      title: 'Billing export shows wrong totals after month close',
      submitterOnly: false,
      staffReply: 'We reproduced this on staging — patch scheduled for tonight.',
      attachments: [
        {
          fileName: 'billing-export-november.csv',
          mimeType: 'text/csv',
          content: Buffer.from('month,region,total\n2026-11,EMEA,18420.50\n2026-11,APAC,9210.00\n', 'utf8'),
        },
        {
          fileName: 'expected-totals.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          content: Buffer.from('PK demo spreadsheet bytes for inbox list preview', 'utf8'),
        },
      ],
    }),
    seedFeedback(auth, {
      title: 'Request: add inbox filters to mobile shell',
      submitterOnly: false,
      staffReply: 'Logged for the shell team; targeting next sprint.',
      attachments: [
        {
          fileName: 'inbox-filters-mockup.png',
          mimeType: 'image/png',
          content: Buffer.from('PNG mockup placeholder for mobile inbox filters', 'utf8'),
        },
      ],
    }),
    seedFeedback(auth, {
      title: 'Cannot attach PDF to feedback from Safari',
      submitterOnly: true,
      attachments: [
        {
          fileName: 'safari-upload-failure.pdf',
          mimeType: 'application/pdf',
          content: Buffer.from('%PDF-1.1\n% demo attachment for Safari feedback\n', 'utf8'),
        },
      ],
    }),
  ]);

  const alertKeys = await Promise.all([
    seedAlert(
      auth,
      'Scheduled maintenance — Sunday 02:00 UTC',
      'Studio may be unavailable for up to 20 minutes while databases are patched.',
      'demo.inbox.maintenance',
    ),
    seedAlert(
      auth,
      'Your role now includes Package Publisher',
      'You can publish packages from Settings → Packages when ready.',
      'demo.inbox.role',
    ),
    seedAlert(
      auth,
      'Workflow SLA reminder: 3 items need action',
      'Open your inbox work items filter to review tasks before end of day.',
      'demo.inbox.workflow',
    ),
  ]);

  const feedbackService = new FeedbackService(SETTINGS_PATH);
  const service = new PersonalInboxService(feedbackService);
  const correspondence = new PersonalInboxCorrespondenceService(
    feedbackService,
    new DirectMessageService(SETTINGS_PATH),
  );
  const peerUserId = await resolveForwardPeerUserId(auth.userId);
  await seedCorrespondenceSamples(auth, service, correspondence, feedbackKeys, alertKeys, peerUserId);
  const listed = await service.list(auth, { kind: 'all', take: 120 });

  console.log('[seed-personal-inbox-demo] Cleaned prior QA/demo rows.');
  console.log('[seed-personal-inbox-demo] Feedback:', feedbackKeys);
  console.log('[seed-personal-inbox-demo] Alerts:', alertKeys);
  console.log('[seed-personal-inbox-demo] Correspondence: billing=Replied+Forwarded, mobile=Replied, safari=Forwarded, maintenance alert=Forwarded');
  console.log('[seed-personal-inbox-demo] Attachments: billing=2, mobile mockup=1, safari PDF=1 (paperclip column)');
  console.log('[seed-personal-inbox-demo] Inbox totals:', {
    all: listed.total,
    feedback: listed.items.filter((i) => i.kind === 'feedback').length,
    alert: listed.items.filter((i) => i.kind === 'alert').length,
    work_item: listed.items.filter((i) => i.kind === 'work_item').length,
  });
  console.log('[seed-personal-inbox-demo] Run: npx tsx scripts/seed-msgi-demo-notifications.ts for send log samples.');
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
