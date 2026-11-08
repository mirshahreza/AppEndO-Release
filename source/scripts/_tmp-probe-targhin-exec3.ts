import { QueryTypes } from 'sequelize';

import { SETTINGS_PATH } from '../src/server/config/settingsFile';
import { ensureControlPlaneInitialized, resetControlPlaneInitState } from '../src/server/db/controlPlaneInit';
import { closePrismaControlPlane } from '../src/server/db/prismaControlPlane';
import { getControlPlaneSequelize } from '../src/server/db/controlPlaneSequelize';

async function main(): Promise<void> {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false, seedSampleData: false });
  const sequelize = getControlPlaneSequelize();

  const sample = await sequelize.query<Record<string, unknown>>(
    `SELECT TOP 5
      t.id,
      t.member_id,
      t.created_by,
      t.final_by,
      t.request_by_legacy,
      nn.created_by_legacy AS last_nego_legacy,
      nn.created_by_user_id AS last_nego_user_id
    FROM dbo.hwy_member_targhin_requests t WITH (NOLOCK)
    OUTER APPLY (
      SELECT TOP 1 created_by_legacy, created_by_user_id
      FROM dbo.hwy_member_targhin_nego_notes nn WITH (NOLOCK)
      WHERE nn.member_id = t.member_id
      ORDER BY nn.created_at DESC, nn.id DESC
    ) nn
    WHERE t.status_code = N'approved'
    ORDER BY t.final_at DESC`,
    { type: QueryTypes.SELECT },
  );
  console.log('sample', sample);

  const legacyConn = await import('./hwy-etl/legacyConn');
  const cfg = legacyConn.readLegacyConn();
  const sql = await import('mssql');
  const pool = await sql.default.connect({
    user: cfg.user,
    password: cfg.password,
    server: cfg.server,
    database: cfg.database,
    options: cfg.options,
    pool: cfg.pool,
  });
  const legacy = await pool.request().query(`
    SELECT TOP 5 MemberId, FinalBy, FinalOn, RequestBy
    FROM dbo.HWY_Members_TarghinHistory WITH (NOLOCK)
    WHERE FinalResult = 1
    ORDER BY FinalOn DESC
  `);
  console.log('legacy FinalBy sample', legacy.recordset);
  await pool.close();
  await closePrismaControlPlane();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
