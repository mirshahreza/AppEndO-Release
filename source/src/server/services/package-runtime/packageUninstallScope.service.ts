import type { PackageManifest } from '../../../core/packages/PackageManifestValidator';
import { readManifestCapabilityArray } from '../../../core/packages/manifestCapabilityArrays';
import { isVerticalAppManifest, type AnyPackageManifest } from '../../../core/packages/PackageManifestValidator';
import type { VerticalAppManifest } from '../../../shared/api/contracts/package-manifest/verticalApp';
import type { ResolvedPackageUninstallRemoveScope } from '../../../shared/api/contracts/package/uninstall';
import { readObjectRegistry } from '../../domain/package-domain/objectRegistryRepository';
import type { RetainedPackageArtifactsV1 } from '../../domain/package-domain/types';

function normalizeZipEntryName(entryName: string): string {
  return entryName.replace(/\\/g, '/').replace(/^\.\//, '');
}

function collectApiRuntimeEntries(manifest: PackageManifest): string[] {
  return manifest.capabilities.apis.map((api) => normalizeZipEntryName(api.entry));
}

function collectUiComponentRuntimeEntries(manifest: PackageManifest): string[] {
  return readManifestCapabilityArray(manifest.capabilities.ui_components)
    .map((ui) => normalizeZipEntryName(ui.entry));
}

function collectUiRouteRuntimeEntries(manifest: PackageManifest): string[] {
  return (manifest.capabilities.ui_routes ?? []).map((route) => normalizeZipEntryName(route.entry));
}

function collectVerticalRuntimeEntries(manifest: VerticalAppManifest): string[] {
  const entries = new Set<string>();
  entries.add(normalizeZipEntryName(manifest.capabilities.shell.entry));

  for (const page of manifest.capabilities.pages ?? []) {
    entries.add(normalizeZipEntryName(page.entry));
  }
  for (const layout of manifest.capabilities.designer_layouts ?? []) {
    entries.add(normalizeZipEntryName(layout.entry));
  }
  for (const asset of manifest.capabilities.static_assets ?? []) {
    entries.add(normalizeZipEntryName(asset.path));
  }
  for (const shell of manifest.capabilities.designer_shells ?? []) {
    entries.add(normalizeZipEntryName(shell.entry));
  }

  const navigationEntry = manifest.capabilities.shell.navigationEntry;
  if (navigationEntry) {
    entries.add(normalizeZipEntryName(navigationEntry));
  }
  if (manifest.experience) {
    entries.add('experience/experience.json');
  }

  return [...entries];
}

export function collectProtectedRuntimeEntries(
  manifest: AnyPackageManifest,
  scope: ResolvedPackageUninstallRemoveScope,
): Set<string> {
  const protectedEntries = new Set<string>();

  if (!scope.apis) {
    if (isVerticalAppManifest(manifest)) {
      for (const api of manifest.capabilities.apis) {
        protectedEntries.add(normalizeZipEntryName(api.entry));
      }
    } else {
      for (const entry of collectApiRuntimeEntries(manifest as PackageManifest)) {
        protectedEntries.add(entry);
      }
    }
  }

  if (!scope.ui_components && !isVerticalAppManifest(manifest)) {
    for (const entry of collectUiComponentRuntimeEntries(manifest as PackageManifest)) {
      protectedEntries.add(entry);
    }
  }

  if (!scope.files) {
    if (isVerticalAppManifest(manifest)) {
      for (const entry of collectVerticalRuntimeEntries(manifest)) {
        protectedEntries.add(entry);
      }
    } else {
      for (const entry of collectUiRouteRuntimeEntries(manifest as PackageManifest)) {
        protectedEntries.add(entry);
      }
    }
  }

  return protectedEntries;
}

export function collectRuntimeEntriesToRemove(
  manifest: AnyPackageManifest,
  scope: ResolvedPackageUninstallRemoveScope,
): string[] {
  const entries = new Set<string>();

  if (scope.apis) {
    if (isVerticalAppManifest(manifest)) {
      for (const api of manifest.capabilities.apis) {
        entries.add(normalizeZipEntryName(api.entry));
      }
    } else {
      for (const entry of collectApiRuntimeEntries(manifest as PackageManifest)) {
        entries.add(entry);
      }
    }
  }

  if (scope.ui_components && !isVerticalAppManifest(manifest)) {
    for (const entry of collectUiComponentRuntimeEntries(manifest as PackageManifest)) {
      entries.add(entry);
    }
  }

  if (scope.files) {
    if (isVerticalAppManifest(manifest)) {
      for (const entry of collectVerticalRuntimeEntries(manifest)) {
        entries.add(entry);
      }
    } else {
      for (const entry of collectUiRouteRuntimeEntries(manifest as PackageManifest)) {
        entries.add(entry);
      }
    }
  }

  return [...entries];
}

export function shouldRemoveEntirePluginRegistry(
  packageId: string,
  scope: ResolvedPackageUninstallRemoveScope,
): boolean {
  const registry = readObjectRegistry(packageId);
  if (!registry) return true;

  const retain = resolveRegistryRecordsToRetain(scope);
  const hasRetainedRecords = (retain.apis && registry.records.apis.length > 0)
    || (retain.uiComponents && registry.records.uiComponents.length > 0)
    || (retain.uiRoutes && registry.records.uiRoutes.length > 0)
    || (retain.mcpServers && registry.records.mcpServers.length > 0)
    || (retain.edgeModels && registry.records.edgeModels.length > 0)
    || (retain.edgeApis && registry.records.edgeApis.length > 0);

  return !hasRetainedRecords;
}

export type RegistryRecordsToRetain = {
  apis: boolean;
  uiComponents: boolean;
  uiRoutes: boolean;
  dbObjects: boolean;
  mcpServers: boolean;
  edgeModels: boolean;
  edgeApis: boolean;
};

export function resolveRegistryRecordsToRetain(
  scope: ResolvedPackageUninstallRemoveScope,
): RegistryRecordsToRetain {
  return {
    apis: !scope.apis,
    uiComponents: !scope.ui_components,
    uiRoutes: !scope.files,
    dbObjects: !scope.runDbUninstallScripts,
    mcpServers: false,
    // Edge data (models/APIs) follows the same "files" gate as ui_routes — no dedicated scope toggle.
    edgeModels: !scope.files,
    edgeApis: !scope.files,
  };
}

export function resolveUninstallRetainedArtifacts(
  manifest: AnyPackageManifest | null,
  scope: ResolvedPackageUninstallRemoveScope,
  activeVersion: string,
): RetainedPackageArtifactsV1 | null {
  if (!manifest || isVerticalAppManifest(manifest)) {
    return null;
  }

  const extensionManifest = manifest as PackageManifest;
  if (!scope.ui_components && readManifestCapabilityArray(extensionManifest.capabilities.ui_components).length > 0) {
    return { version: activeVersion, uiComponents: true };
  }

  return null;
}

export function shouldInvalidatePlatformRuntimeConfig(
  scope: ResolvedPackageUninstallRemoveScope,
): boolean {
  return scope.portal_nav || scope.files;
}
