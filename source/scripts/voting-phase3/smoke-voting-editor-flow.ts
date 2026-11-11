/**
 * Smoke: voting scope editor data APIs (ballots + candidates scoped by voting).
 *
 *   npx tsx scripts/voting-phase3/smoke-voting-editor-flow.ts
 */
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { ensureControlPlaneInitialized, resetControlPlaneInitState } from '../../src/server/db/controlPlaneInit';
import { getDataSourcesFromSettings } from '../../src/server/db/dataSourcesStore';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { configureDataApiPublishedRuntime } from '../../src/server/services/data-api/dataApiPublishedRuntime';
import ballotsList from '../../workspace/server-functions/custom/vote-ballots.vote-ballots-list';
import candidatesList from '../../workspace/server-functions/custom/vote-candidates.vote-candidates-list';

const votingId = process.argv[2] ?? '4';

async function main() {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });
  configureDataApiPublishedRuntime(() => getDataSourcesFromSettings(SETTINGS_PATH));

  const capture = async (handler: typeof ballotsList, query: Record<string, string>) => {
    const chunks: unknown[] = [];
    const res = {
      json: (body: unknown) => {
        chunks.push(body);
        return body;
      },
      status: () => res,
    };
    await handler({ query }, res);
    return chunks[0] as { success?: boolean; data?: unknown[]; count?: number };
  };

  const ballots = await capture(ballotsList, {
    page: '1',
    pageSize: '20',
    'filter[votingId][eq]': votingId,
  });
  if (!ballots?.success) {
    throw new Error('Ballots list failed');
  }
  const ballotId = String((ballots.data?.[0] as { id?: string })?.id ?? '');
  console.log(`ballots for voting ${votingId}: count=${ballots.count ?? 0} first=${ballotId || '(none)'}`);

  const allChoices = await capture(candidatesList, {
    page: '1',
    pageSize: '20',
    'filter[votingId][eq]': votingId,
  });
  if (!allChoices?.success) {
    throw new Error('Candidates list (voting scope) failed');
  }
  console.log(`choices for voting ${votingId}: count=${allChoices.count ?? 0}`);

  if (ballotId) {
    const scoped = await capture(candidatesList, {
      page: '1',
      pageSize: '20',
      'filter[votingId][eq]': votingId,
      'filter[ballotId][eq]': ballotId,
    });
    if (!scoped?.success) {
      throw new Error('Candidates list (ballot scope) failed');
    }
    console.log(`choices for ballot ${ballotId}: count=${scoped.count ?? 0}`);
  }

  console.log('[Voting editor smoke] OK');
}

main()
  .catch((error) => {
    console.error('[Voting editor smoke]', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane().catch(() => undefined);
  });
