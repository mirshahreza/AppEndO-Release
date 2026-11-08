import { SETTINGS_PATH } from '../src/server/config/settingsFile';
import { readControlPlaneDatabaseSettings } from '../src/server/db/controlPlaneDatabase';
import { ensureSqlServerUnicodeTextColumnsFromUrl } from '../src/server/db/controlPlaneSqlServerUnicode';

const main = async () => {
  const settings = readControlPlaneDatabaseSettings(SETTINGS_PATH);
  if (settings.provider !== 'sqlserver') {
    console.log(`Skipping SQL Server Unicode upgrade for provider: ${settings.provider}`);
    return;
  }

  const url = process.env.CONTROL_PLANE_DATABASE_URL?.trim() || settings.url;
  await ensureSqlServerUnicodeTextColumnsFromUrl(url);
  console.log('SQL Server Unicode text columns upgraded.');
};

main().catch((error) => {
  console.error('sqlserver-unicode-upgrade failed:', error?.message || error);
  process.exit(1);
});
