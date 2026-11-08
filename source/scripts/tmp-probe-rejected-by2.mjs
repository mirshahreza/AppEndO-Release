import { QueryTypes } from 'sequelize';
import { SETTINGS_PATH } from '../src/server/config/settingsFile.ts';
import { ensureControlPlaneInitialized } from '../src/server/db/controlPlaneInit.ts';
import { getControlPlaneSequelize } from '../src/server/db/controlPlaneSequelize.ts';
import { connectLegacyReadPool } from './hwy-etl/legacyHwyRoleAuth.ts';

await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false, seedSampleData: false });
const seq = getControlPlaneSequelize();

const cols = await seq.query(
  `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='HWY_Members'
     AND (COLUMN_NAME LIKE '%Updated%' OR COLUMN_NAME LIKE '%MembershipStatus%')
   ORDER BY COLUMN_NAME`,
  { type: QueryTypes.SELECT },
);
console.log('CP HWY_Members cols:', cols.map((c) => c.COLUMN_NAME).join(', '));

const pool = await connectLegacyReadPool();
const r = await pool.request().query(`
  SELECT TOP 3
    m.Id,
    m.MembershipStatus_UpdatedBy,
    m.UserName AS member_username,
    staff_by_username.Id AS staff_by_username_id,
    staff_by_username.UserName AS staff_by_username_un,
    staff_by_id.Id AS staff_by_id,
    staff_by_id.UserName AS staff_by_id_un,
    staff_u.Id AS app_user_id,
    staff_u.UserName AS app_user_un
  FROM dbo.HWY_Members m WITH (NOLOCK)
  LEFT JOIN dbo.HWY_VW_Members_NoAdmin staff_by_username WITH (NOLOCK)
    ON staff_by_username.UserName = m.MembershipStatus_UpdatedBy
  LEFT JOIN dbo.HWY_Members staff_by_id WITH (NOLOCK)
    ON CAST(staff_by_id.Id AS VARCHAR(32)) = CAST(m.MembershipStatus_UpdatedBy AS VARCHAR(32))
  LEFT JOIN dbo.AppEnd_Users staff_u WITH (NOLOCK)
    ON CAST(staff_u.Id AS VARCHAR(32)) = CAST(m.MembershipStatus_UpdatedBy AS VARCHAR(32))
  WHERE m.MembershipStatus = 10856
    AND m.MembershipStatus_UpdatedBy IS NOT NULL
`);
console.log('LEGACY join probe:', JSON.stringify(r.recordset, null, 2));
await pool.close();
