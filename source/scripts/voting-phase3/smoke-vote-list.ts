import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { ensureControlPlaneInitialized, resetControlPlaneInitState } from '../../src/server/db/controlPlaneInit';
import { getDataSourcesFromSettings } from '../../src/server/db/dataSourcesStore';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { configureDataApiPublishedRuntime } from '../../src/server/services/data-api/dataApiPublishedRuntime';
import handler from '../../workspace/server-functions/custom/vote-votings.vote-votings-list';

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
  try {
    await handler({ query: { page: '1', pageSize: '5' } }, res);
    console.log('OK', JSON.stringify(chunks[0], null, 2).slice(0, 3000));
  } catch (error) {
    console.error('ERR', error);
    process.exitCode = 1;
  }
}

main().finally(() => closePrismaControlPlane().catch(() => undefined));
