import { SETTINGS_PATH } from '../src/server/config/settingsFile';
import { ensureControlPlaneInitialized, resetControlPlaneInitState } from '../src/server/db/controlPlaneInit';
import { closePrismaControlPlane } from '../src/server/db/prismaControlPlane';
import { listHwyMemberTarghinMembers } from '../src/server/domain/hwy/hwyMemberTarghinMembersList.service';

async function main(): Promise<void> {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false, seedSampleData: false });
  const r = await listHwyMemberTarghinMembers({ page: 1, pageSize: 3 }, 'ar');
  console.log('total', r.total);
  for (const row of r.rows) {
    console.log({
      memberId: row.memberId,
      executorId: row.executor?.id ?? null,
      executorName: row.executor?.displayFullName ?? null,
      roles: row.executorRoleTitles,
      reason: row.latestRequestReasonCodeTitle ?? null,
      requestLen: row.latestRequestNote?.length ?? 0,
      finalLen: row.latestFinalNote?.length ?? 0,
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane();
  });
