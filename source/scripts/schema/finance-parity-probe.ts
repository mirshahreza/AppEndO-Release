/**
 * Finance + control-plane spot checks (SQL Server).
 *
 *   npm run schema:finance-parity-probe
 */
import { QueryTypes } from 'sequelize';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { ensureControlPlaneInitialized } from '../../src/server/db/controlPlaneInit';
import { getControlPlaneSequelize } from '../../src/server/db/controlPlaneSequelize';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import {
  hwyFinanceEdgeCompatReady,
  hwyFinancePaymentTablesReady,
} from '../../src/server/domain/hwy/hwyFinanceParityState.service';
import {
  hwyLegacyImportParityReady,
  hwyLegacyImportParityTablesReady,
} from '../../src/server/domain/hwy/hwyLegacyImportParityState.service';

const main = async (): Promise<void> => {
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });
  const s = getControlPlaneSequelize();

  const checks = await s.query<Record<string, number>>(
    `
SELECT
  CASE WHEN OBJECT_ID(N'dbo.HWY_Members', N'U') IS NOT NULL THEN 1 ELSE 0 END AS has_hwy_members_legacy,
  CASE WHEN COL_LENGTH(N'dbo.hwy_members', N'gender_code') IS NOT NULL THEN 1 ELSE 0 END AS has_gender_code,
  CASE WHEN COL_LENGTH(N'dbo.hwy_members', N'gender_id') IS NOT NULL THEN 1 ELSE 0 END AS has_gender_id,
  CASE WHEN COL_LENGTH(N'dbo.hwy_members', N'masooliat_level_id') IS NOT NULL THEN 1 ELSE 0 END AS has_masooliat_level_id,
  CASE WHEN OBJECT_ID(N'dbo.hwy_payment_documents', N'U') IS NOT NULL THEN 1 ELSE 0 END AS has_payment_docs,
  CASE WHEN OBJECT_ID(N'dbo.vw_hwy_platform_user_roles', N'V') IS NOT NULL THEN 1 ELSE 0 END AS has_plat_roles_view
`,
    { type: QueryTypes.SELECT },
  );

  const cp2 = await s.query<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM dbo.base_users WHERE locked NOT IN (0, 1)`,
    { type: QueryTypes.SELECT },
  );

  const wiBlob = await s.query<{ total_mb: number }>(
    `
  SELECT CAST(ISNULL(SUM(DATALENGTH(data)), 0) / 1048576.0 AS DECIMAL(12,2)) AS total_mb
  FROM dbo.base_work_item_attachments
  `,
    { type: QueryTypes.SELECT },
  );

  const memberCols = await s.query<{ name: string }>(
    `
  SELECT c.name
  FROM sys.columns c
  JOIN sys.tables t ON c.object_id = t.object_id
  WHERE t.name = N'hwy_members'
    AND (
      c.name LIKE N'%area%'
      OR c.name LIKE N'%gender%'
      OR c.name LIKE N'%masooliat%'
      OR c.name LIKE N'%payable%'
    )
  ORDER BY c.name
  `,
    { type: QueryTypes.SELECT },
  );

  const paymentProcs = await s.query<{ name: string }>(
    `SELECT name FROM sys.procedures WHERE name LIKE N'hwy_payment%' ORDER BY name`,
    { type: QueryTypes.SELECT },
  );
  const financeInstall = await s.query<Record<string, number>>(
    `
    SELECT
      CASE WHEN COL_LENGTH(N'dbo.hwy_ref_base_information', N'ViewOrder') IS NOT NULL THEN 1 ELSE 0 END AS ref_view_order_alias,
      CASE WHEN OBJECT_ID(N'dbo.hwy_payment_documents_read_states', N'P') IS NOT NULL THEN 1 ELSE 0 END AS payment_read_states,
      CASE WHEN OBJECT_ID(N'dbo.hwy_masoolin_stars_recalc_member', N'P') IS NOT NULL THEN 1 ELSE 0 END AS masoolin_stars_recalc,
      CASE WHEN OBJECT_ID(N'dbo.hwy_masoolin_below_officials', N'P') IS NOT NULL THEN 1 ELSE 0 END AS masoolin_deferred_below
    `,
    { type: QueryTypes.SELECT },
  );

  console.log(
    JSON.stringify(
      {
        columns: checks[0],
        hwyMemberFinanceColumns: memberCols.map((r) => r.name),
        base_users_locked_not_bool: cp2[0]?.cnt,
        work_item_attachment_blob_mb: wiBlob[0]?.total_mb,
        financeInstall: financeInstall[0],
        paymentProcCount: paymentProcs.length,
        gates: {
          legacyImportParityTables: await hwyLegacyImportParityTablesReady(),
          legacyImportParityViews: await hwyLegacyImportParityReady(),
          financePaymentTables: await hwyFinancePaymentTablesReady(),
          financeEdgeCompat: await hwyFinanceEdgeCompatReady(),
        },
      },
      null,
      2,
    ),
  );

  await s.close();
  await closePrismaControlPlane();
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
