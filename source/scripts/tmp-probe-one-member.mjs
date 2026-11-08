import { SETTINGS_PATH } from '../src/server/config/settingsFile.ts';
import { ensureControlPlaneInitialized } from '../src/server/db/controlPlaneInit.ts';
import { getControlPlaneSequelize } from '../src/server/db/controlPlaneSequelize.ts';
import { attachHwyMemberRejectionListParityFields } from '../src/server/domain/hwy/hwyMemberRejectionListParity.service.ts';

const memberId = process.argv[2] ?? '1061590';
await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false, seedSampleData: false });
const seq = getControlPlaneSequelize();
const row = { id: memberId };
await attachHwyMemberRejectionListParityFields(seq, [row], 'HWY_Members_List_Waited_1_Rejected');
console.log({
  display: row.membershipStatusUpdatedByDisplayName,
  login: row.membershipStatusUpdatedByLogin,
  phone: row.membershipStatusUpdatedByPhone,
  staff: row.membershipStatusUpdatedByStaffMemberId,
});
