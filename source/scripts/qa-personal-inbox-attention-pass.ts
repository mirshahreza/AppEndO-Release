/**
 * Seed + verify personal inbox read/unread for work_item, feedback, alert (and DM when present).
 * Usage: npx tsx scripts/qa-personal-inbox-attention-pass.ts [--http]
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
import type { PersonalInboxItem } from '../src/shared/api/contracts/personal-inbox/types';
import { PersonalInboxService } from '../src/server/services/personal-inbox/personalInbox.service';
import { FeedbackService } from '../src/server/services/feedback/feedback.service';
import { createUserNotification } from '../src/server/services/notifications/userNotification.service';
import { personalInboxSeenRepository } from '../src/server/domain/personal-inbox/personalInboxSeen.repository';
import { DirectMessageService } from '../src/server/services/direct-messages/directMessage.service';

const BASE = (process.env.APPENDO_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const HTTP = process.argv.includes('--http');

const isUnseen = (item: PersonalInboxItem): boolean =>
  item.attention === 'unread' || item.attention === 'action_required';

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

async function seedFeedbackUnread(auth: AuthRequestContext): Promise<string> {
  const prisma = getPrismaControlPlane();
  const ticket = await prisma.baseAppFeedback.create({
    data: {
      type: 'general',
      title: `QA inbox feedback ${Date.now()}`,
      submitterUserId: BigInt(auth.userId),
      status: 'NEW',
      priority: 'NORMAL',
      messageCount: 2,
      lastMessageAt: new Date(),
    },
  });
  await prisma.baseAppFeedbackMessage.create({
    data: {
      feedbackId: ticket.id,
      kind: 'SUBMITTER',
      body: 'QA submitter opener',
      authorUserId: BigInt(auth.userId),
    },
  });
  await prisma.baseAppFeedbackMessage.create({
    data: {
      feedbackId: ticket.id,
      kind: 'STAFF',
      body: 'QA staff reply (should count unread for submitter)',
      authorUserId: BigInt(auth.userId),
    },
  });
  const itemKey = `feedback:${Number(ticket.id)}`;
  await personalInboxSeenRepository.clearSeen(auth.userId, itemKey);
  return itemKey;
}

/** Submitter-only thread: inbox flag must not rely on STAFF unreadCount alone. */
async function seedFeedbackSubmitterOnly(auth: AuthRequestContext): Promise<string> {
  const prisma = getPrismaControlPlane();
  const ticket = await prisma.baseAppFeedback.create({
    data: {
      type: 'general',
      title: `QA feedback submitter-only ${Date.now()}`,
      submitterUserId: BigInt(auth.userId),
      status: 'NEW',
      priority: 'NORMAL',
      messageCount: 1,
      lastMessageAt: new Date(),
    },
  });
  await prisma.baseAppFeedbackMessage.create({
    data: {
      feedbackId: ticket.id,
      kind: 'SUBMITTER',
      body: 'Only submitter message — inbox read/unread uses seen row',
      authorUserId: BigInt(auth.userId),
    },
  });
  const itemKey = `feedback:${Number(ticket.id)}`;
  await personalInboxSeenRepository.clearSeen(auth.userId, itemKey);
  await prisma.baseAppFeedbackReadCursor.deleteMany({
    where: { feedbackId: ticket.id, userId: BigInt(auth.userId) },
  });
  return itemKey;
}

async function seedDirectMessageUnread(auth: AuthRequestContext): Promise<string | null> {
  try {
    const prisma = getPrismaControlPlane();
    const peer = await prisma.baseUser.findFirst({
      where: { id: { not: BigInt(auth.userId) } },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    if (!peer) {
      return null;
    }
    const dm = new DirectMessageService(SETTINGS_PATH);
    const { thread } = await dm.createThread(auth, {
      recipientUserId: Number(peer.id),
      body: `QA DM ${Date.now()}`,
    });
    const itemKey = `direct_message:${thread.id}`;
    await personalInboxSeenRepository.clearSeen(auth.userId, itemKey);
    return itemKey;
  } catch (error) {
    console.log(`SKIP direct_message seed (${error instanceof Error ? error.message : error})`);
    return null;
  }
}

async function seedAlertUnread(auth: AuthRequestContext): Promise<string> {
  const { id } = await createUserNotification({
    userId: auth.userId,
    title: `QA inbox alert ${Date.now()}`,
    body: 'Unread alert for attention pass',
    severity: 'info',
    source: 'qa.inbox',
    href: '/studio/my-inbox',
  });
  return `alert:${id}`;
}

async function assertAttentionCycle(
  service: PersonalInboxService,
  auth: AuthRequestContext,
  itemKey: string,
  label: string,
): Promise<void> {
  const findRow = async (): Promise<PersonalInboxItem | undefined> => {
    const listed = await service.list(auth, { kind: 'all', take: 100 });
    return listed.items.find((row) => row.id === itemKey);
  };

  let row = await findRow();
  if (!row) {
    throw new Error(`[${label}] Item ${itemKey} not in inbox list.`);
  }

  if (!isUnseen(row)) {
    await service.markUnread(auth, itemKey);
    row = await findRow();
    if (!row || !isUnseen(row)) {
      throw new Error(`[${label}] Expected unread before mark-read test.`);
    }
  }

  const dismissed = await service.dismissAttention(auth, itemKey);
  if (!dismissed.dismissed) {
    throw new Error(`[${label}] dismissAttention returned dismissed=false.`);
  }

  const seen = await personalInboxSeenRepository.listSeenItemKeys(auth.userId);
  if (!seen.has(itemKey)) {
    throw new Error(`[${label}] Seen row missing in DB for ${itemKey}.`);
  }

  row = await findRow();
  if (!row || isUnseen(row)) {
    throw new Error(`[${label}] Still unseen after dismiss (attention=${row?.attention ?? 'missing'}).`);
  }

  const unread = await service.markUnread(auth, itemKey);
  if (!unread.updated) {
    throw new Error(`[${label}] markUnread returned updated=false.`);
  }

  row = await findRow();
  if (!row || !isUnseen(row)) {
    throw new Error(`[${label}] Expected unread after markUnread (attention=${row?.attention ?? 'missing'}).`);
  }

  await service.dismissAttention(auth, itemKey);
  row = await findRow();
  if (!row || isUnseen(row)) {
    throw new Error(`[${label}] Final dismiss failed.`);
  }

  console.log(`OK  ${label} ${itemKey}`);
}

async function httpMarkUnread(cookie: string, itemKey: string): Promise<void> {
  const res = await fetch(`${BASE}/api/personal-inbox/mark-unread`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({ itemKey }),
  });
  const body = await res.json().catch(() => ({})) as { success?: boolean; updated?: boolean };
  if (!res.ok || !body.success || !body.updated) {
    throw new Error(`HTTP mark-unread failed for ${itemKey}: ${res.status} ${JSON.stringify(body)}`);
  }
}

async function loginHttp(): Promise<string> {
  const password = process.env.APPENDO_SMOKE_PASSWORD?.trim() || 'admin123';
  const attempts = [
    { email: process.env.APPENDO_SMOKE_USER?.trim() || 'admin@append.os', password },
    { identifier: 'admin', password },
  ];
  for (const body of attempts) {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({})) as { success?: boolean };
    const setCookies = typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : [];
    const cookieHeader = setCookies.length > 0
      ? setCookies.map((row) => row.split(';')[0]).join('; ')
      : res.headers.get('set-cookie')?.split(',').map((p) => p.split(';')[0].trim()).join('; ');
    if (res.ok && data.success && cookieHeader) {
      return cookieHeader;
    }
  }
  throw new Error('HTTP login failed (expected HttpOnly cookie session).');
}

async function httpDismiss(cookie: string, itemKey: string): Promise<void> {
  const res = await fetch(`${BASE}/api/personal-inbox/dismiss-attention`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({ itemKey }),
  });
  const body = await res.json().catch(() => ({})) as { success?: boolean; dismissed?: boolean };
  if (!res.ok || !body.success || !body.dismissed) {
    throw new Error(`HTTP dismiss failed for ${itemKey}: ${res.status} ${JSON.stringify(body)}`);
  }
}

async function httpList(cookie: string): Promise<PersonalInboxItem[]> {
  const res = await fetch(`${BASE}/api/personal-inbox?kind=all&take=100`, {
    headers: { Cookie: cookie },
  });
  const body = await res.json().catch(() => ({})) as { success?: boolean; items?: PersonalInboxItem[] };
  if (!res.ok || !body.success) {
    throw new Error(`HTTP list failed: ${res.status}`);
  }
  return body.items ?? [];
}

async function main(): Promise<void> {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });
  const auth = await resolveAdminAuth();
  const feedbackService = new FeedbackService(SETTINGS_PATH);
  const service = new PersonalInboxService(feedbackService);

  const feedbackKey = await seedFeedbackUnread(auth);
  const feedbackSubmitterKey = await seedFeedbackSubmitterOnly(auth);
  const alertKey = await seedAlertUnread(auth);
  const dmKey = await seedDirectMessageUnread(auth);

  await assertAttentionCycle(service, auth, feedbackKey, 'feedback');
  await assertAttentionCycle(service, auth, feedbackSubmitterKey, 'feedback_submitter_only');
  await assertAttentionCycle(service, auth, alertKey, 'alert');

  const listed = await service.list(auth, { kind: 'all', take: 100 });
  const workItem = listed.items.find((row) => row.kind === 'work_item');
  if (workItem) {
    await assertAttentionCycle(service, auth, workItem.id, 'work_item');
  } else {
    console.log('SKIP work_item (none in inbox — assign a workflow task to admin to cover)');
  }

  if (dmKey) {
    await assertAttentionCycle(service, auth, dmKey, 'direct_message');
  } else {
    console.log('SKIP direct_message (no peer user to message)');
  }

  const dispatchCount = (await service.list(auth, { kind: 'message_dispatch', take: 5 })).total;
  console.log(`INFO message_dispatch rows in send log: ${dispatchCount}`);

  console.log('Service-layer inbox attention pass completed.');

  if (HTTP) {
    const cookie = await loginHttp();
    for (const [label, itemKey] of [
      ['feedback', feedbackKey],
      ['alert', alertKey],
    ] as const) {
      let items = await httpList(cookie);
      let row = items.find((item) => item.id === itemKey);
      if (!row) {
        throw new Error(`HTTP list missing ${label} row ${itemKey}.`);
      }
      if (!isUnseen(row)) {
        await httpMarkUnread(cookie, itemKey);
        items = await httpList(cookie);
        row = items.find((item) => item.id === itemKey);
        if (!row || !isUnseen(row)) {
          throw new Error(`HTTP ${label} not unread before dismiss test.`);
        }
      }
      await httpDismiss(cookie, itemKey);
      items = await httpList(cookie);
      row = items.find((item) => item.id === itemKey);
      if (!row || isUnseen(row)) {
        throw new Error(`HTTP ${label} still unseen after dismiss (${row?.attention}).`);
      }
      await httpMarkUnread(cookie, itemKey);
      items = await httpList(cookie);
      row = items.find((item) => item.id === itemKey);
      if (!row || !isUnseen(row)) {
        throw new Error(`HTTP ${label} not unread after mark-unread (${row?.attention}).`);
      }
      await httpDismiss(cookie, itemKey);
      console.log(`OK  HTTP ${label} ${itemKey}`);
    }
    console.log('HTTP inbox attention pass completed.');
  }
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
