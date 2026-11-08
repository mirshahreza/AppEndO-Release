/**
 * Smoke: GET /api/personal-inbox/items/detail envelope for visible inbox rows.
 * Run: npx tsx scripts/qa-personal-inbox-envelope-pass.ts
 */
import { SETTINGS_PATH } from '../src/server/config/settingsFile';
import { closeControlPlaneSequelize } from '../src/server/db/controlPlaneSequelize';
import {
  closePrismaControlPlane,
  getPrismaControlPlane,
  initPrismaControlPlaneFromSettings,
} from '../src/server/db/prismaControlPlane';
import { readControlPlaneDatabaseSettings } from '../src/server/db/controlPlaneDatabase';
import type { AuthRequestContext } from '../src/server/middleware/auth.middleware';
import { PersonalInboxEnvelopeService } from '../src/server/services/personal-inbox/personalInboxEnvelope.service';
import { PersonalInboxService } from '../src/server/services/personal-inbox/personalInbox.service';
import { FeedbackService } from '../src/server/services/feedback/feedback.service';
import { DirectMessageService } from '../src/server/services/direct-messages/directMessage.service';

const KINDS = ['feedback', 'alert', 'work_item', 'direct_message', 'message_dispatch'] as const;

async function resolveAdminAuth(): Promise<AuthRequestContext> {
  await initPrismaControlPlaneFromSettings(readControlPlaneDatabaseSettings(SETTINGS_PATH));
  const row = await getPrismaControlPlane().baseUser.findFirst({
    where: { username: 'admin' },
    select: { id: true, username: true },
  });
  if (!row) {
    throw new Error('admin user not found');
  }
  return { userId: Number(row.id), username: row.username, roles: ['ADMIN'] };
}

async function main() {
  const auth = await resolveAdminAuth();
  const settingsPath = SETTINGS_PATH;
  const feedbackService = new FeedbackService(settingsPath);
  const inbox = new PersonalInboxService(feedbackService);
  const envelope = new PersonalInboxEnvelopeService(
    inbox,
    feedbackService,
    new DirectMessageService(settingsPath),
  );

  for (const kind of KINDS) {
    const listed = await inbox.list(auth, { kind, take: 3, folder: 'inbox' });
    const row = listed.items[0];
    if (!row) {
      console.log(`SKIP  ${kind} (no row)`);
      continue;
    }
    const detail = await envelope.getItemDetail(auth, row.id);
    if (!detail.itemKey || detail.messages.length === 0) {
      throw new Error(`Envelope empty for ${row.id}`);
    }
    console.log(`OK    ${kind} ${row.id} messages=${detail.messages.length} reply=${detail.capabilities.reply} forward=${detail.capabilities.forward}`);
  }
  console.log('OK  personal inbox envelope pass');
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
