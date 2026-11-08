import { SETTINGS_PATH } from '../src/server/config/settingsFile';
import { ensureControlPlaneInitialized } from '../src/server/db/controlPlaneInit';
import { closePrismaControlPlane } from '../src/server/db/prismaControlPlane';
import { listHwyMemberTarghinMembers } from '../src/server/domain/hwy/hwyMemberTarghinMembersList.service';

async function main(): Promise<void> {
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false, seedSampleData: false });

  const data = await listHwyMemberTarghinMembers({ page: 1, pageSize: 8 }, 'ar');
  console.log('rows', data.rows.length, 'total', data.total);
  for (const row of data.rows) {
    console.log('---');
    console.log('executor', row.executor?.username, row.executor?.displayFullName);
    console.log('executorRoleTitles', row.executorRoleTitles);
  }

  await closePrismaControlPlane();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
