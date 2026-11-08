import { SETTINGS_PATH } from '../src/server/config/settingsFile';
import { ensureControlPlaneInitialized, resetControlPlaneInitState } from '../src/server/db/controlPlaneInit';
import { closePrismaControlPlane } from '../src/server/db/prismaControlPlane';
import {
  ensurePlatformFeedbackConfig,
} from '../src/server/db/feedbackSettingsStore';
import { syncMissingPlatformRegistryDefaults } from '../src/core/platform-registry/platformRegistryDefaults';
import { bootstrapPlatformSettingsCaches } from '../src/server/services/settings/bootstrapPlatformSettings';
import { writePlatformBlobAsync } from '../src/server/services/settings/platformSettingsStore';
import { normalizePlatformFeedbackConfig } from '../src/shared/api/contracts/feedback/normalizers';

const pushSchema = !process.argv.includes('--no-push');

const main = async () => {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema });

  const config = ensurePlatformFeedbackConfig(SETTINGS_PATH);
  const saved = normalizePlatformFeedbackConfig({
    ...config,
    policy: {
      ...config.policy,
      enabled: true,
      allowAuthenticated: true,
      allowAnonymous: false,
      showOnDashboard: true,
      allowAttachments: true,
      requireSubject: true,
      widgetPlacement: 'header-menu',
      pageKeyDenylist: (config.policy.pageKeyDenylist ?? []).filter((key) => key !== 'settings'),
    },
  });

  await bootstrapPlatformSettingsCaches(SETTINGS_PATH);
  await writePlatformBlobAsync(
    'platformFeedback',
    saved as unknown as Record<string, unknown>,
    1,
  );

  syncMissingPlatformRegistryDefaults();

  console.log('Feedback bootstrap complete.');
  console.log(JSON.stringify({
    enabled: saved.policy.enabled,
    showOnDashboard: saved.policy.showOnDashboard,
    routingRules: saved.routingRules.length,
  }, null, 2));
};

main()
  .catch((error) => {
    console.error('Feedback bootstrap failed:', error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane();
  });
