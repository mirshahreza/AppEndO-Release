/**
 * Apply a CMS package version on this node without re-running install SQL
 * (runtime refresh after pack upload or failed reinstall).
 *
 *   npx tsx --import ./scripts/tsx-css-register.mjs scripts/cms-phase1/apply-cms-package-version.ts
 *   npx tsx --import ./scripts/tsx-css-register.mjs scripts/cms-phase1/apply-cms-package-version.ts 1.3.3
 */
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { closePrismaControlPlane, initPrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import {
  isPluginRuntimeEnabled,
  readInstallStateV1,
} from '../../src/server/domain/package-domain/installStateRepository';
import { getDefaultPackageLifecycleCoordinator } from '../../src/server/services/package-runtime/packageLifecycle.service';
import { bootstrapPlatformSettingsCaches } from '../../src/server/services/settings/bootstrapPlatformSettings';
import { flushPlatformBlobWrites } from '../../src/server/services/settings/platformSettingsCache';
import { DEFAULT_PACKAGE_INSTALL_OVERRIDE_POLICY } from '../../src/shared/api/contracts/package-manifest/types';

const PACKAGE_ID = 'cms';
const DEFAULT_VERSION = '1.3.9';

async function main(): Promise<void> {
  const version = process.argv[2]?.trim() || DEFAULT_VERSION;
  await initPrismaControlPlane(SETTINGS_PATH);
  await bootstrapPlatformSettingsCaches();

  const lifecycle = getDefaultPackageLifecycleCoordinator();
  const installOptions = {
    version,
    overridePolicy: DEFAULT_PACKAGE_INSTALL_OVERRIDE_POLICY,
    installOptionalRecords: true,
  };

  const alreadyInstalled = isPluginRuntimeEnabled(PACKAGE_ID);
  const installState = readInstallStateV1(PACKAGE_ID);
  const hadSuccessfulInstall = (installState?.history ?? []).some(
    (entry) => entry.operation === 'install' && entry.result === 'success',
  );

  const result = alreadyInstalled
    ? await lifecycle.reinstall(PACKAGE_ID, 'apply-cms-package-version', installOptions)
    : await lifecycle.install(PACKAGE_ID, 'apply-cms-package-version', {
      ...installOptions,
      skipInstallDbScripts: installState?.status === 'failed' || hadSuccessfulInstall,
    });

  if (!result.success) {
    throw new Error(
      `${result.error ?? 'CMS package apply failed.'}${result.details?.length ? `\n${result.details.join('\n')}` : ''}`,
    );
  }

  console.log(`Applied ${PACKAGE_ID}@${version} (${result.operation ?? 'install'})`);
}

void main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack || error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await flushPlatformBlobWrites();
    await closePrismaControlPlane();
  });
