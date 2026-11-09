import { QueryTypes } from 'sequelize';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { ensureControlPlaneInitialized } from '../../src/server/db/controlPlaneInit';
import { getControlPlaneSequelize } from '../../src/server/db/controlPlaneSequelize';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import {
  vxLegacyImportParityReady,
  vxLegacyImportParityTablesReady,
} from '../../src/server/domain/vx/vxLegacyImportParityState.service';

const main = async (): Promise<void> => {
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });
  const s = getControlPlaneSequelize();
  const rows = await s.query<Record<string, number>>(
    `
    SELECT
      CASE WHEN OBJECT_ID(N'dbo.VX_Members', N'U') IS NOT NULL THEN 1 ELSE 0 END AS has_vx_members,
      CASE WHEN OBJECT_ID(N'dbo.vx_member_card_printing_flow_steps', N'U') IS NOT NULL THEN 1 ELSE 0 END AS has_card_steps,
      CASE WHEN OBJECT_ID(N'dbo.vx_member_security_statuses', N'U') IS NOT NULL THEN 1 ELSE 0 END AS has_sec_status,
      CASE WHEN COL_LENGTH(N'dbo.VX_Members', N'Picture_FileBody_xs') IS NOT NULL THEN 1 ELSE 0 END AS has_picture_xs_vx,
      CASE WHEN COL_LENGTH(N'dbo.vx_members', N'picture_file_body_xs') IS NOT NULL THEN 1 ELSE 0 END AS has_picture_xs_snake
    `,
    { type: QueryTypes.SELECT },
  );
  const out = {
    checks: rows[0],
    tablesReady: await vxLegacyImportParityTablesReady(),
    parityReady: await vxLegacyImportParityReady(),
  };
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  await s.close();
  await closePrismaControlPlane();
};

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
