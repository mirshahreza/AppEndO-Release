import { getDefaultPlatformCultureSettingsService } from '../src/server/services/platform/platformCultureSettings.service.js';
import { getDefaultExperienceManifestService } from '../src/server/services/platform/experienceManifest.service.js';

type MigrationSummary = {
  compiled: boolean;
  routeCount: number;
  navigationId: string;
  skipped: boolean;
  reason?: string;
};

const main = async () => {
  const summary: MigrationSummary = {
    compiled: false,
    routeCount: 0,
    navigationId: 'admin',
    skipped: false,
  };

  const cultureService = getDefaultPlatformCultureSettingsService();
  const cultures = await cultureService.getCultures();
  const manifestService = getDefaultExperienceManifestService();
  const loaded = await manifestService.getManifest('admin');

  if (!loaded.manifest) {
    summary.skipped = true;
    summary.reason = 'No admin experience manifest could be decompiled from registry.';
    console.log('[experience:migrate-manifest]', JSON.stringify(summary, null, 2));
    return;
  }

  if (loaded.manifest.portals.every((application) => portal.pages.length === 0)) {
    summary.skipped = true;
    summary.reason = 'Registry has no studio routes to compile.';
    console.log('[experience:migrate-manifest]', JSON.stringify(summary, null, 2));
    return;
  }

  const compileResult = await manifestService.compileManifest(
    { userId: null, username: null },
    {
      ...loaded.manifest,
      cultureId: cultures.body.defaultCultureId ?? loaded.manifest.cultureId,
    },
  );

  if (!compileResult.ok) {
    console.error('[experience:migrate-manifest] Compile failed:', compileResult.errors);
    process.exitCode = 1;
    return;
  }

  summary.compiled = true;
  summary.routeCount = compileResult.manifest.portals.reduce(
    (total, application) => total + portal.pages.length,
    0,
  );
  summary.navigationId = compileResult.result.navigationIds[0] ?? 'admin';
  console.log('[experience:migrate-manifest]', JSON.stringify(summary, null, 2));
};

void main().catch((error: unknown) => {
  console.error('[experience:migrate-manifest] Unexpected error:', error);
  process.exitCode = 1;
});
