import { QueryTypes } from 'sequelize';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { ensureControlPlaneInitialized } from '../../src/server/db/controlPlaneInit';
import { getControlPlaneSequelize } from '../../src/server/db/controlPlaneSequelize';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';

const main = async (): Promise<void> => {
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });
  const s = getControlPlaneSequelize();
  const procs = await s.query<{ name: string }>(
    `SELECT name FROM sys.procedures WHERE name LIKE N'hwy_masoolin%' ORDER BY name`,
    { type: QueryTypes.SELECT },
  );
  const legacy = await s.query<Record<string, number>>(
    `
    SELECT
      CASE WHEN OBJECT_ID(N'dbo.HWY_Nashatat', N'U') IS NOT NULL THEN 1 ELSE 0 END AS has_hwy_nashatat,
      CASE WHEN OBJECT_ID(N'dbo.hwy_masoolin_set_payable_auto', N'P') IS NOT NULL THEN 1 ELSE 0 END AS has_payable_auto,
      CASE WHEN OBJECT_ID(N'dbo.hwy_masoolin_top_officials', N'P') IS NOT NULL THEN 1 ELSE 0 END AS has_top_officials
    `,
    { type: QueryTypes.SELECT },
  );
  process.stdout.write(
    `${JSON.stringify({ masoolinProcCount: procs.length, masoolinProcs: procs.map((p) => p.name), legacy: legacy[0] }, null, 2)}\n`,
  );
  await s.close();
  await closePrismaControlPlane();
};

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
