/**
 * Debug install wizard "Initialize schema" outside the UI.
 *
 * Usage:
 *   npx tsx scripts/debug-install-init-schema.ts
 *   npx tsx scripts/debug-install-init-schema.ts --settings path/to/settings.json
 */
import path from 'path';
import { InstallService } from '../src/server/services/install/install.service';

const settingsPath = (() => {
  const idx = process.argv.indexOf('--settings');
  if (idx >= 0 && process.argv[idx + 1]) {
    return path.resolve(process.argv[idx + 1]);
  }
  return path.join(process.cwd(), 'settings.json');
})();

const main = async (): Promise<void> => {
  console.log(`[debug:init-schema] settings=${settingsPath}`);
  const service = new InstallService({ settingsPath });

  console.log('[debug:init-schema] status...');
  const status = await service.getStatus();
  console.log(JSON.stringify(status.body, null, 2));

  console.log('[debug:init-schema] initDatabase...');
  const result = await service.initDatabase();
  console.log(JSON.stringify(result.body, null, 2));
  console.log('[debug:init-schema] OK');
};

main().catch((error) => {
  console.error('[debug:init-schema] FAILED');
  if (error instanceof Error) {
    console.error(error.stack || error.message);
  } else {
    console.error(error);
  }
  process.exit(1);
});
