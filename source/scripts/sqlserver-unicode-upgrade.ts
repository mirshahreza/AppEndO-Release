import { SETTINGS_PATH } from '../src/server/config/settingsFile';
import { readControlPlaneDatabaseSettings } from '../src/server/db/controlPlaneDatabase';
import { ensureSqlServerUnicodeTextColumnsFromUrl } from '../src/server/db/controlPlaneSqlServerUnicode';
import { parseSqlServerConnectionUrl } from '../src/server/db/sqlServerControlPlaneUrl';

const main = async () => {
  const settingsPath = process.env.APPENDO_SETTINGS_PATH?.trim() || SETTINGS_PATH;
  const settings = readControlPlaneDatabaseSettings(settingsPath);
  if (settings.provider !== 'sqlserver') {
    console.log(`Skipping SQL Server Unicode upgrade for provider: ${settings.provider}`);
    return;
  }

  const envUrl = process.env.CONTROL_PLANE_DATABASE_URL?.trim();
  let url = settings.url;
  if (envUrl) {
    try {
      const parsed = parseSqlServerConnectionUrl(envUrl);
      if (parsed.password.trim()) {
        url = envUrl;
      }
    } catch {
      // Use hydrated settings.url.
    }
  }
  await ensureSqlServerUnicodeTextColumnsFromUrl(url);
  console.log('SQL Server Unicode text columns upgraded.');
};

main().catch((error) => {
  console.error('sqlserver-unicode-upgrade failed:', error?.message || error);
  process.exit(1);
});
