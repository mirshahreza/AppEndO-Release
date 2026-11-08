import { QueryTypes } from 'sequelize';
import { SETTINGS_PATH } from '../src/server/config/settingsFile.ts';
import { ensureControlPlaneInitialized } from '../src/server/db/controlPlaneInit.ts';
import { getControlPlaneSequelize } from '../src/server/db/controlPlaneSequelize.ts';
import { attachHwyMemberRejectionListParityFields } from '../src/server/domain/hwy/hwyMemberRejectionListParity.service.ts';

await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false, seedSampleData: false });
const seq = getControlPlaneSequelize();

for (const id of ['1058554', '1887111', '1098371']) {
  const cp = await seq.query(
    `SELECT CAST(leg.Id AS VARCHAR(32)) AS id,
      leg.membership_status_updated_by,
      leg.membership_status_updated_on,
      leg.MembershipStatus,
      hm.username AS cp_member_username
    FROM dbo.HWY_Members leg
    LEFT JOIN dbo.hwy_members hm ON hm.id = leg.Id
    WHERE leg.Id = :id`,
    { replacements: { id }, type: QueryTypes.SELECT },
  );
  console.log('CP leg row', id, JSON.stringify(cp[0], null, 2));

  const row = { id };
  await attachHwyMemberRejectionListParityFields(seq, [row], 'HWY_Members_List_Waited_1_Rejected');
  console.log('PARITY rejected-by', id, JSON.stringify({
    display: row.membershipStatusUpdatedByDisplayName,
    login: row.membershipStatusUpdatedByLogin,
    phone: row.membershipStatusUpdatedByPhone,
    staff: row.membershipStatusUpdatedByStaffMemberId,
  }, null, 2));
}
