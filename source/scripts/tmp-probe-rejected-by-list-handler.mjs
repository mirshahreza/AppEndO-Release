import { SETTINGS_PATH } from '../src/server/config/settingsFile.ts';
import { ensureControlPlaneInitialized } from '../src/server/db/controlPlaneInit.ts';
import { getDataSourcesFromSettings } from '../src/server/db/dataSourcesStore.ts';
import { configureDataApiPublishedRuntime } from '../src/server/services/data-api/dataApiPublishedRuntime.ts';
import handler from '../workspace/server-functions/custom/vw-hwy-members.hwy-member-directory-list.ts';

await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false, seedSampleData: false });
configureDataApiPublishedRuntime(() => getDataSourcesFromSettings(SETTINGS_PATH));

const payload = await new Promise((resolve, reject) => {
  const res = {
    status() {
      return this;
    },
    json(body) {
      resolve(body);
      return this;
    },
  };
  handler(
    {
      query: {
        page: '1',
        pageSize: '1',
        listScope: 'HWY_Members_List_Waited_1_Rejected',
        sortBy: 'displayFullName',
        sortDir: 'asc',
        lang: 'ar',
      },
    },
    res,
  ).catch(reject);
});

const rows = payload.data ?? [];
console.log('meta', payload.meta);
for (const row of rows) {
  console.log('ROW', row.id, {
    rejectedByDisplay: row.membershipStatusUpdatedByDisplayName,
    rejectedByLogin: row.membershipStatusUpdatedByLogin,
    rejectedByPhone: row.membershipStatusUpdatedByPhone,
    staff: row.membershipStatusUpdatedByStaffMemberId,
    statusNote: String(row.membershipStatusDecisionNote ?? '').slice(0, 50),
  });
}
