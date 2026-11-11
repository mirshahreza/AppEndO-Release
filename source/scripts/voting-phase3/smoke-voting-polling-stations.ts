/**
 * Smoke: polling stations list scoped by votingId.
 *
 *   npx tsx scripts/voting-phase3/smoke-voting-polling-stations.ts [votingId]
 */
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { ensureControlPlaneInitialized, resetControlPlaneInitState } from '../../src/server/db/controlPlaneInit';
import { getDataSourcesFromSettings } from '../../src/server/db/dataSourcesStore';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { configureDataApiPublishedRuntime } from '../../src/server/services/data-api/dataApiPublishedRuntime';
import stationsList from '../../workspace/server-functions/custom/vote-polling-stations.vote-polling-stations-list';

const votingId = process.argv[2] ?? '4';

async function main() {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });
  configureDataApiPublishedRuntime(() => getDataSourcesFromSettings(SETTINGS_PATH));

  const chunks: unknown[] = [];
  const res = {
    json: (body: unknown) => {
      chunks.push(body);
      return body;
    },
    status: () => res,
  };

  await stationsList(
    { query: { page: '1', pageSize: '20', 'filter[votingId][eq]': votingId } },
    res,
  );
  const payload = chunks[0] as { success?: boolean; count?: number; data?: unknown[] };
  if (!payload?.success) {
    throw new Error(`Polling stations list failed: ${JSON.stringify(payload)}`);
  }
  console.log(`polling stations for voting ${votingId}: count=${payload.count ?? 0}`);
  console.log('[Voting polling-stations smoke] OK');
}

main()
  .catch((error) => {
    console.error('[Voting polling-stations smoke]', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane().catch(() => undefined);
  });
