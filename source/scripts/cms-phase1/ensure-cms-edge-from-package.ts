/**
 * Restore CMS edge models/APIs from the latest shipped CMS package artifact
 * (after reinstall removed edge metadata but left tables/rows).
 *
 *   npx tsx --import ./scripts/tsx-css-register.mjs scripts/cms-phase1/ensure-cms-edge-from-package.ts
 *   npx tsx --import ./scripts/tsx-css-register.mjs scripts/cms-phase1/ensure-cms-edge-from-package.ts 1.3.2
 */
import fs from 'fs';
import path from 'path';
import { packageDirs, readPackageIndex } from '../../src/core/packages/PackageFileStore';
import { validateManifest } from '../../src/core/packages/PackageManifestValidator';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { closePrismaControlPlane, initPrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { installPackageEdgeData } from '../../src/server/services/package-runtime/packageEdgeDataRuntime.service';
import { bootstrapPlatformSettingsCaches } from '../../src/server/services/settings/bootstrapPlatformSettings';
import { flushPlatformBlobWrites } from '../../src/server/services/settings/platformSettingsCache';

const PACKAGE_ID = 'cms';

function resolveManifestPath(version: string): string {
  const index = readPackageIndex();
  const entry = index.packages.find((pkg) => pkg.packageId === PACKAGE_ID);
  const resolved =
    entry?.versions.find((item) => item.version === version)
    ?? entry?.versions.find((item) => item.version === entry.latestVersion);
  if (!resolved) {
    throw new Error(`No stored manifest for ${PACKAGE_ID}@${version}.`);
  }
  const manifestPath = path.join(packageDirs.root, resolved.manifestPath.replace(/\\/g, '/'));
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }
  return manifestPath;
}

async function main(): Promise<void> {
  const versionArg = process.argv[2]?.trim();
  const index = readPackageIndex();
  const cmsEntry = index.packages.find((pkg) => pkg.packageId === PACKAGE_ID);
  const fallbackVersion = cmsEntry?.versions.find((item) => item.version === '1.3.2')?.version
    ?? cmsEntry?.versions.find((item) => (item as { capabilities?: { edge_apis?: unknown[] } }).version)?.version;
  const version = versionArg || fallbackVersion || '1.3.2';

  const manifestPath = resolveManifestPath(version);
  const parsed = validateManifest(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
  if (!parsed.valid || !parsed.manifest) {
    throw new Error(`Invalid manifest: ${(parsed.errors ?? []).join(' ')}`);
  }
  const edgeCount = parsed.manifest.capabilities.edge_apis?.length ?? 0;
  if (edgeCount === 0) {
    throw new Error(`Manifest ${PACKAGE_ID}@${version} has no edge_apis to restore.`);
  }

  await initPrismaControlPlane(SETTINGS_PATH);
  await bootstrapPlatformSettingsCaches();

  const result = await installPackageEdgeData(PACKAGE_ID, version, parsed.manifest);
  if (!result.ok) {
    throw new Error(result.error + (result.details?.length ? `\n${result.details.join('\n')}` : ''));
  }

  console.log(
    `Restored edge data from ${PACKAGE_ID}@${version}: models=${result.created.models.length} apis=${result.created.apis.length} studioMeta=${result.created.studioMeta.length}`,
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
