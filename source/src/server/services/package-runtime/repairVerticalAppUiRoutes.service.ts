import { isVerticalAppManifest } from '../../../core/packages/PackageManifestValidator';
import { buildRegistryFromManifest } from '../../domain/package-domain/registryBuilder';
import { parseManifestFile, resolveVersionForInstall } from '../../domain/package-domain/manifestRepository';
import { readInstallStateV1 } from '../../domain/package-domain/installStateRepository';
import { readObjectRegistry, writeObjectRegistry } from '../../domain/package-domain/objectRegistryRepository';

/**
 * Idempotent fix when a vertical-app install left uiRoutes empty (legacy registry builder).
 * Returns the uiRoutes count after repair (unchanged if already populated).
 */
export function repairInstalledVerticalAppUiRoutes(packageId: string, targetDataSource = 'default'): number {
  const state = readInstallStateV1(packageId);
  if (!state || state.status !== 'installed' || !state.activeVersion) {
    return 0;
  }

  const selection = resolveVersionForInstall(packageId, state.activeVersion);
  if (!selection) {
    return 0;
  }

  const manifest = parseManifestFile(selection.manifestPath);
  if (!manifest || !isVerticalAppManifest(manifest)) {
    return 0;
  }

  const existing = readObjectRegistry(packageId);
  if (!existing) {
    return 0;
  }

  const candidate = buildRegistryFromManifest(
    packageId,
    manifest,
    state.activeVersion,
    targetDataSource,
  );
  if (candidate.records.uiRoutes.length === 0) {
    return existing.records.uiRoutes.length;
  }
  if (
    existing.records.uiRoutes.length >= candidate.records.uiRoutes.length
    && existing.records.uiRoutes.every((route, index) => route.pageKey === candidate.records.uiRoutes[index]?.pageKey)
  ) {
    return existing.records.uiRoutes.length;
  }

  writeObjectRegistry({
    ...existing,
    records: {
      ...existing.records,
      uiRoutes: candidate.records.uiRoutes,
    },
    updatedAt: candidate.updatedAt,
  });

  return candidate.records.uiRoutes.length;
}
