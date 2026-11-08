/**
 * Wipe test / demo messaging data: in-app notifications, MSGI dispatches,
 * digest queue rows, and personal inbox projection cache (rebuilds on next inbox load).
 *
 * Usage:
 *   npx tsx scripts/clear-personal-inbox-messages.ts
 */
import { SETTINGS_PATH } from '../src/server/config/settingsFile';
import { readControlPlaneDatabaseSettings } from '../src/server/db/controlPlaneDatabase';
import { closeControlPlaneSequelize } from '../src/server/db/controlPlaneSequelize';
import {
  closePrismaControlPlane,
  getPrismaControlPlane,
  initPrismaControlPlaneFromSettings,
} from '../src/server/db/prismaControlPlane';
import {
  ensurePersonalInboxProjectionTables,
  getPersonalInboxProjectionItemModel,
  getPersonalInboxProjectionMetaModel,
} from '../src/server/domain/personal-inbox/personalInboxProjectionSequelizeModels';
import { ensureUserMessageDispatchTables } from '../src/server/domain/user-message-dispatches/userMessageDispatchSequelizeModels';
import { clearHotUserMessageDispatches } from '../src/server/services/notifications/userMessageDispatch.service';

const main = async () => {
  const settings = readControlPlaneDatabaseSettings(SETTINGS_PATH);
  await initPrismaControlPlaneFromSettings(settings);
  await ensureUserMessageDispatchTables();
  await ensurePersonalInboxProjectionTables();

  const prisma = getPrismaControlPlane();
  const notifications = await prisma.baseUserNotification.deleteMany({});
  const digestItems = await prisma.userNotificationDigestItem.deleteMany({});
  const dispatches = await clearHotUserMessageDispatches();

  const Item = getPersonalInboxProjectionItemModel();
  const Meta = getPersonalInboxProjectionMetaModel();
  const projectionItems = await Item.destroy({ where: {} });
  const projectionMeta = await Meta.destroy({ where: {} });

  console.log('Cleared personal inbox messaging data:');
  console.log(`  base_user_notifications: ${notifications.count}`);
  console.log(`  base_user_notification_digest_items: ${digestItems.count}`);
  console.log(`  base_user_message_dispatches: ${dispatches.deleted}`);
  console.log(`  base_personal_inbox_projection_items: ${projectionItems}`);
  console.log(`  base_personal_inbox_projection_meta: ${projectionMeta}`);
  console.log('Work items / feedback in inbox are unchanged; projection will refresh on next open.');
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
