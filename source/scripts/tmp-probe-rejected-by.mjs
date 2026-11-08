import { QueryTypes } from 'sequelize';
import { SETTINGS_PATH } from '../src/server/config/settingsFile.ts';
import { ensureControlPlaneInitialized } from '../src/server/db/controlPlaneInit.ts';
import { getControlPlaneSequelize } from '../src/server/db/controlPlaneSequelize.ts';
import { attachHwyMemberRejectionListParityFields } from '../src/server/domain/hwy/hwyMemberRejectionListParity.service.ts';
import { controlPlaneHasLegacyHwyMembersTable } from '../src/server/domain/hwy/hwyGeoResponsibilityLegacyCenterStats.service.ts';

await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false, seedSampleData: false });
const seq = getControlPlaneSequelize();

console.log('HWY_Members on CP:', await controlPlaneHasLegacyHwyMembersTable());

try {
  const sample = await seq.query(
    `SELECT TOP 5 CAST(m.id AS VARCHAR(32)) AS id, m.membership_status_code,
      m.membership_status_updated_by,
      leg.MembershipStatus_UpdatedBy AS leg_updated_by
    FROM dbo.hwy_members m
    LEFT JOIN dbo.HWY_Members leg ON leg.Id = m.id
    WHERE m.membership_status_code = N'220.001.004'
    ORDER BY m.id DESC`,
    { type: QueryTypes.SELECT },
  );
  console.log('SAMPLE rejected_local rows:', JSON.stringify(sample, null, 2));
} catch (error) {
  console.log('SAMPLE query error:', error instanceof Error ? error.message : error);
}

let ids = [];
try {
  ids = await seq.query(
    `SELECT TOP 5 CAST(m.id AS VARCHAR(32)) AS id,
      leg.MembershipStatus_UpdatedBy AS leg_updated_by
    FROM dbo.hwy_members m
    INNER JOIN dbo.HWY_Members leg ON leg.Id = m.id
    WHERE NULLIF(LTRIM(RTRIM(CAST(leg.MembershipStatus_UpdatedBy AS NVARCHAR(200)))), N'') IS NOT NULL
      AND m.membership_status_code = N'220.001.004'
    ORDER BY m.id DESC`,
    { type: QueryTypes.SELECT },
  );
  console.log('With leg UpdatedBy:', JSON.stringify(ids, null, 2));
} catch (error) {
  console.log('ids query error:', error instanceof Error ? error.message : error);
}

for (const row of ids) {
  const r = { id: row.id };
  await attachHwyMemberRejectionListParityFields(seq, [r], 'HWY_Members_List_Waited_1_Rejected');
  console.log('ATTACH', row.id, 'leg_user', row.leg_updated_by, JSON.stringify({
    display: r.membershipStatusUpdatedByDisplayName,
    login: r.membershipStatusUpdatedByLogin,
    phone: r.membershipStatusUpdatedByPhone,
    staff: r.membershipStatusUpdatedByStaffMemberId,
  }));
}

try {
  const { connectLegacyReadPool } = await import('./hwy-etl/legacyHwyRoleAuth.ts');
  const pool = await connectLegacyReadPool();
  const leg = await pool.request().query(
    `SELECT TOP 3 Id, MembershipStatus_UpdatedBy, MembershipStatus_Note
     FROM dbo.HWY_Members WITH (NOLOCK)
     WHERE MembershipStatus = 10856 AND MembershipStatus_UpdatedBy IS NOT NULL`,
  );
  console.log('LEGACY MembersV2 sample:', JSON.stringify(leg.recordset, null, 2));
  await pool.close();
} catch (error) {
  console.log('Legacy pool error:', error instanceof Error ? error.message : error);
}
