/**
 * Patch an already-installed CMS package so public site pages/chrome load as package UI.
 *
 *   npx tsx scripts/cms-phase1/apply-cms-public-site-ui.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import {
  buildCmsPublicSiteUiFiles,
  buildCmsPublicSiteUiRoutes,
  mergeCmsPublicSiteCapabilities,
} from '../../src/core/packages/cmsPublicSitePack';
import { PUBLIC_SITE_PACKAGE_ID } from '../../src/shared/api/contracts/platform/mountConstants';
import { packageDirs, readPackageIndex } from '../../src/core/packages/PackageFileStore';
import { validateManifest, type PackageManifest } from '../../src/core/packages/PackageManifestValidator';
import { buildRegistryFromManifest } from '../../src/server/domain/package-domain/registryBuilder';
import { writeObjectRegistry } from '../../src/server/domain/package-domain/objectRegistryRepository';
import { isPluginRuntimeEnabled, readInstallStateV1 } from '../../src/server/domain/package-domain/installStateRepository';
import { extractPackageUiRuntime } from '../../src/server/services/package-runtime/packageUiRuntime.service';
import { finalizeExtensionUiRoutes } from '../../src/server/services/package-runtime/extensionUiRoutesInstall.service';
import { computePackageArtifactHashFromZip } from '../../src/core/packages/packageArtifactHash';

async function main(): Promise<void> {
  if (!isPluginRuntimeEnabled(PUBLIC_SITE_PACKAGE_ID)) {
    console.log('CMS is not installed; nothing to apply.');
    return;
  }

  const state = readInstallStateV1(PUBLIC_SITE_PACKAGE_ID);
  const version = state?.activeVersion?.trim();
  if (!version) {
    throw new Error('CMS is enabled but has no active version.');
  }

  const index = readPackageIndex();
  const entry = index.packages.find((pkg) => pkg.packageId === PUBLIC_SITE_PACKAGE_ID);
  const stored = entry?.versions.find((item) => item.version === version);
  if (!stored) {
    throw new Error(`No stored CMS artifact for ${version}.`);
  }

  const artifactPath = path.join(packageDirs.root, stored.artifactPath.replace(/\\/g, '/'));
  const manifestPath = path.join(packageDirs.root, stored.manifestPath.replace(/\\/g, '/'));
  const zip = new AdmZip(artifactPath);
  const manifest = JSON.parse(zip.readAsText('package.json')) as {
    capabilities: { ui_routes?: Array<Record<string, unknown>>; ui_components?: Array<Record<string, unknown>> };
    integrity?: { algorithm: string; artifactHash: string };
  };
  const merged = mergeCmsPublicSiteCapabilities({
    ui_routes: manifest.capabilities.ui_routes,
    ui_components: manifest.capabilities.ui_components,
  });
  manifest.capabilities.ui_routes = merged.ui_routes;
  manifest.capabilities.ui_components = merged.ui_components;

  for (const file of buildCmsPublicSiteUiFiles()) {
    if (zip.getEntry(file.entry)) {
      zip.deleteFile(file.entry);
    }
    zip.addFile(file.entry, Buffer.from(file.source, 'utf8'));
  }
  if (zip.getEntry('package.json')) {
    zip.deleteFile('package.json');
  }
  if (manifest.integrity) {
    manifest.integrity.artifactHash = computePackageArtifactHashFromZip(zip);
  }
  zip.addFile('package.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'));
  zip.writeZip(artifactPath);
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const validated = validateManifest(manifest);
  if (!validated.valid || !validated.manifest) {
    throw new Error(`CMS manifest invalid after public-site merge: ${validated.errors.join(' ')}`);
  }

  writeObjectRegistry(buildRegistryFromManifest(
    PUBLIC_SITE_PACKAGE_ID,
    validated.manifest,
    version,
    'default',
  ));

  const extracted = extractPackageUiRuntime(PUBLIC_SITE_PACKAGE_ID, version, validated.manifest);
  if (!extracted.ok) {
    throw new Error(extracted.error);
  }

  const siteOnlyManifest: PackageManifest = {
    ...validated.manifest,
    capabilities: {
      ...validated.manifest.capabilities,
      ui_routes: buildCmsPublicSiteUiRoutes(),
    },
  };
  const routes = await finalizeExtensionUiRoutes(PUBLIC_SITE_PACKAGE_ID, version, siteOnlyManifest, null);
  if (!routes.ok) {
    throw new Error(routes.error);
  }

  console.log(`Applied CMS public site UI to ${PUBLIC_SITE_PACKAGE_ID}@${version} (${extracted.extractedCount} runtime files).`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
