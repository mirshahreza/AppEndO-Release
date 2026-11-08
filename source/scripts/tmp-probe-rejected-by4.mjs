import { SETTINGS_PATH } from '../src/server/config/settingsFile.ts';
import { ensureControlPlaneInitialized } from '../src/server/db/controlPlaneInit.ts';
import { executeHwyMemberDirectoryList } from '../src/server/domain/hwy/executeHwyMemberDirectoryList.ts';
import { getEdgeApiDefinitionById } from '../src/server/services/data-api/edgeApiStore.ts';
import { resolvePublishedEdgeModel } from '../src/server/services/data-api/dataApiPublishedRuntime.ts';

await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false, seedSampleData: false });

const definition = getEdgeApiDefinitionById('ea_a140003600ded4e4');
const operation = definition?.operations.find((item) => item.id === 'op_list_pur3ks');
const { Model: ModelCtor, model, source } = await resolvePublishedEdgeModel('em_5f3a30c99bb3420e');

const payload = await executeHwyMemberDirectoryList({
  operation,
  model,
  source,
  ModelCtor,
  query: {
    page: 1,
    pageSize: 3,
    listScope: 'HWY_Members_List_Waited_1_Rejected',
  },
  edgeModelId: 'em_5f3a30c99bb3420e',
  session: { isAdmin: true },
});

const rows = payload.data ?? [];
console.log('list fetch path meta:', payload.meta?.listFetchPath, 'count', rows.length);
for (const row of rows) {
  console.log('ROW', row.id, JSON.stringify({
    statusNote: row.membershipStatusDecisionNote?.slice?.(0, 40),
    rejectedByDisplay: row.membershipStatusUpdatedByDisplayName,
    rejectedByLogin: row.membershipStatusUpdatedByLogin,
    rejectedByPhone: row.membershipStatusUpdatedByPhone,
    staff: row.membershipStatusUpdatedByStaffMemberId,
  }));
}
