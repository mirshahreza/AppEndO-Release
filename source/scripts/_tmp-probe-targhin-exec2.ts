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
    SELECT TOP 5
      vm.id AS member_id,
      latest.final_by,
      latest.final_at,
      vm.membership_status_updated_by,
      exec_u.id AS exec_u_id,
      exec_u.username AS exec_u_username,
      exec_vm_direct.id AS exec_vm_direct_id,
      exec_vm_direct.display_full_name AS exec_name
    FROM dbo.vw_hwy_members vm WITH (NOLOCK)
    OUTER APPLY (
      SELECT TOP 1 t.final_by, t.final_at
      FROM dbo.hwy_member_targhin_requests t WITH (NOLOCK)
      WHERE t.member_id = vm.id AND t.status_code = N'approved'
      ORDER BY t.final_at DESC, t.id DESC
    ) latest
    LEFT JOIN dbo.base_users exec_u ON exec_u.id = COALESCE(latest.final_by, vm.membership_status_updated_by)
    LEFT JOIN dbo.vw_hwy_members exec_vm_direct ON exec_vm_direct.user_id = exec_u.id
    WHERE vm.id IN (1887771, 1882538, 1882450)
    `,
    { type: QueryTypes.SELECT },
  );
  console.log(rows);

  const stats = await sequelize.query<Record<string, unknown>>(
    `
    SELECT
      SUM(CASE WHEN latest.final_by IS NOT NULL THEN 1 ELSE 0 END) AS with_final_by,
      SUM(CASE WHEN vm.membership_status_updated_by IS NOT NULL THEN 1 ELSE 0 END) AS with_status_by,
      SUM(CASE WHEN COALESCE(latest.final_by, vm.membership_status_updated_by) IS NOT NULL THEN 1 ELSE 0 END) AS with_either,
      COUNT(*) AS total
    FROM dbo.vw_hwy_members vm WITH (NOLOCK)
    OUTER APPLY (
      SELECT TOP 1 t.final_by
      FROM dbo.hwy_member_targhin_requests t WITH (NOLOCK)
      WHERE t.member_id = vm.id AND t.status_code = N'approved'
      ORDER BY t.final_at DESC, t.id DESC
    ) latest
    WHERE vm.membership_status_code = (
      SELECT TOP 1 id FROM dbo.base_info WHERE short_name = N'pending_cancellation'
    )
    `,
    { type: QueryTypes.SELECT },
  );
  console.log('stats', stats[0]);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane();
  });
