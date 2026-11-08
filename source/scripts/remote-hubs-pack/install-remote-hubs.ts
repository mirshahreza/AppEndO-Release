import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { uploadPackageArtifact } from '../../src/core/packages/PackageArtifactService';
import { packageDirs, readPackageIndex } from '../../src/core/packages/PackageFileStore';
import {
  REMOTE_HUBS_LIBRARIES,
  REMOTE_HUBS_PACKAGE_ID,
  REMOTE_HUBS_PACKAGE_VERSION,
} from '../../src/core/packages/remoteHubsPackage';
import { DEFAULT_PACKAGE_INSTALL_OVERRIDE_POLICY } from '../../src/shared/api/contracts/package-manifest/types';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { closePrismaControlPlane, initPrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { isPluginRuntimeEnabled } from '../../src/server/domain/package-domain/installStateRepository';
import { getDeveloperLibrariesService } from '../../src/server/services/libraries/developerLibraries.service';
import { getDefaultPackageLifecycleCoordinator } from '../../src/server/services/package-runtime/packageLifecycle.service';
import { bootstrapPlatformSettingsCaches } from '../../src/server/services/settings/bootstrapPlatformSettings';
import { flushPlatformBlobWrites } from '../../src/server/services/settings/platformSettingsCache';
import { remoteHubsZipFileName, writeRemoteHubsPackageZip } from './build-remote-hubs-zip';

function overwriteInstalledArtifact(buffer: Buffer): void {
  const index = readPackageIndex();
  const entry = index.packages.find((pkg) => pkg.packageId === REMOTE_HUBS_PACKAGE_ID);
  const version = entry?.versions.find((item) => item.version === REMOTE_HUBS_PACKAGE_VERSION)
    ?? entry?.versions.find((item) => item.version === entry.latestVersion);
  if (!version) {
    throw new Error(`No stored ${REMOTE_HUBS_PACKAGE_ID} artifact to overwrite.`);
  }
  const artifactPath = path.join(packageDirs.root, version.artifactPath.replace(/\\/g, '/'));
  const manifestPath = path.join(packageDirs.root, version.manifestPath.replace(/\\/g, '/'));
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, buffer);
  const zip = new AdmZip(buffer);
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, zip.readAsText('package.json'));
}

async function main(): Promise<void> {
  await initPrismaControlPlane(SETTINGS_PATH);
  await bootstrapPlatformSettingsCaches();
  const zipPath = writeRemoteHubsPackageZip();
  const buffer = fs.readFileSync(zipPath);
  const lifecycle = getDefaultPackageLifecycleCoordinator();

  const upload = await uploadPackageArtifact(buffer, remoteHubsZipFileName(), 'admin');
  if (!upload.success && !/already exists/i.test(upload.error)) {
    throw new Error(upload.error);
  }
  if (!upload.success) {
    overwriteInstalledArtifact(buffer);
  }
  const version = upload.success ? upload.version : REMOTE_HUBS_PACKAGE_VERSION;
  const alreadyInstalled = isPluginRuntimeEnabled(REMOTE_HUBS_PACKAGE_ID);
  const result = alreadyInstalled
    ? await lifecycle.reinstall(REMOTE_HUBS_PACKAGE_ID, 'admin', {
      version,
      overridePolicy: DEFAULT_PACKAGE_INSTALL_OVERRIDE_POLICY,
      installOptionalRecords: false,
    })
    : await lifecycle.install(REMOTE_HUBS_PACKAGE_ID, 'admin', {
      version,
      overridePolicy: DEFAULT_PACKAGE_INSTALL_OVERRIDE_POLICY,
      installOptionalRecords: false,
    });
  if (!result.success) {
    const details = result.details?.length ? `\n${result.details.join('\n')}` : '';
    throw new Error(`${result.error ?? 'Remote Hubs lifecycle failed.'}${details}`);
  }
  const libraries = await getDeveloperLibrariesService().satisfy(REMOTE_HUBS_LIBRARIES);
  if (!libraries.ok) {
    throw new Error(libraries.error);
  }
  console.log(
    alreadyInstalled
      ? `Reinstalled ${REMOTE_HUBS_PACKAGE_ID}@${version}`
      : `Installed ${REMOTE_HUBS_PACKAGE_ID}@${version}`,
  );
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
