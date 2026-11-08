/**
 * Create base_personal_inbox_archived_items if boot markers skipped it (local dev).
 *   npx tsx scripts/ensure-personal-inbox-archived-table.ts
 */
import { SETTINGS_PATH } from '../src/server/config/settingsFile';
import { readControlPlaneDatabaseSettings } from '../src/server/db/controlPlaneDatabase';
import { closeControlPlaneSequelize } from '../src/server/db/controlPlaneSequelize';
import {
  closePrismaControlPlane,
  initPrismaControlPlaneFromSettings,
} from '../src/server/db/prismaControlPlane';
import { ensurePersonalInboxArchivedTables } from '../src/server/domain/personal-inbox/personalInboxArchivedSequelizeModels';
import { ensurePersonalInboxProjectionTables } from '../src/server/domain/personal-inbox/personalInboxProjectionSequelizeModels';

async function main(): Promise<void> {
  const settings = readControlPlaneDatabaseSettings(SETTINGS_PATH);
  await initPrismaControlPlaneFromSettings(settings);
  await ensurePersonalInboxProjectionTables();
  await ensurePersonalInboxArchivedTables();
  console.log('Ensured base_personal_inbox_archived_items');
  await closePrismaControlPlane();
  await closeControlPlaneSequelize();
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
