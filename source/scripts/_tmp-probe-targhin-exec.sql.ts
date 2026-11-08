import { QueryTypes } from 'sequelize';

import { SETTINGS_PATH } from '../src/server/config/settingsFile';
import { ensureControlPlaneInitialized, resetControlPlaneInitState } from '../src/server/db/controlPlaneInit';
import { closePrismaControlPlane } from '../src/server/db/prismaControlPlane';
import { getControlPlaneSequelize } from '../src/server/db/controlPlaneSequelize';

async function main(): Promise<void> {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false, seedSampleData: false });
  const sequelize = getControlPlaneSequelize();
  const rows = await sequelize.query<Record<string, unknown>>(
    `
    SELECT TOP 3
      vm.id AS member_id,
      latest.final_by,
      vm.membership_status_updated_by,
      exec_u.id AS exec_u_id,
      exec_u.username AS exec_u_username,
      exec_hm.id AS exec_hm_id,
      exec_vm.id AS exec_vm_id,
      exec_vm_direct.id AS exec_vm_direct_id
    FROM dbo.vw_hwy_members vm WITH (NOLOCK)
    OUTER APPLY (
      SELECT TOP 1 t.final_by
      FROM dbo.hwy_member_targhin_requests t WITH (NOLOCK)
      WHERE t.member_id = vm.id AND t.status_code = N'approved'
      ORDER BY t.final_at DESC, t.id DESC
    ) latest
    LEFT JOIN dbo.base_users exec_u ON exec_u.id = COALESCE(latest.final_by, vm.membership_status_updated_by)
    LEFT JOIN dbo.hwy_members exec_hm ON exec_hm.user_id = exec_u.id
    LEFT JOIN dbo.vw_hwy_members exec_vm ON exec_vm.id = exec_hm.id
    LEFT JOIN dbo.vw_hwy_members exec_vm_direct ON exec_vm_direct.user_id = exec_u.id
    WHERE vm.membership_status_code = (
      SELECT TOP 1 id FROM dbo.base_info WHERE short_name = N'pending_cancellation'
    )
    ORDER BY vm.membership_status_updated_on DESC
    `,
    { type: QueryTypes.SELECT },
  );
  console.log(rows);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane();
  });
