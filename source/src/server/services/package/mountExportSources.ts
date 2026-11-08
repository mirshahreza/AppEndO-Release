import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import type {
  CapabilityDbObject,
  CapabilityMcpServer,
  PackageManifest,
} from '../../../core/packages/PackageManifestValidator';
import { isVerticalAppManifest } from '../../../core/packages/PackageManifestValidator';
import { packageDirs, readPackageIndex } from '../../../core/packages/PackageFileStore';
import type {
  VerticalAppManifest,
  VerticalAppStaticAssetCapability,
} from '../../../shared/api/contracts/package-manifest/verticalApp';
import { parseManifestFile } from '../../domain/package-domain/manifestRepository';
import { getInstalledVersionsMap } from '../../domain/package-domain/installStateRepository';
import { isSafeRelativeEntry } from '../package-runtime/packageUiRuntime.service';

export type MountExportZipEntry = {
  path: string;
  content: Buffer;
};

export type MountExportOwnerPluginSources = {
  packageId: string;
  version: string;
  dbObjects: CapabilityDbObject[];
  mcpServers: CapabilityMcpServer[];
  staticAssets: VerticalAppStaticAssetCapability[];
  branding?: VerticalAppManifest['branding'];
  zipEntries: MountExportZipEntry[];
};

function normalizeZipEntryName(entryName: string): string {
  return entryName.replace(/\\/g, '/').replace(/^\.\//, '');
}

function resolveInstalledPluginVersion(packageId: string): string | null {
  const trimmed = packageId.trim();
  if (!trimmed) return null;
  return getInstalledVersionsMap().get(trimmed) ?? null;
}

function resolvePluginArtifactPath(packageId: string, version: string): string | null {
  const index = readPackageIndex();
  const entry = index.packages.find((pkg) => pkg.packageId === packageId);
  const versionEntry = entry?.versions.find((item) => item.version === version);
  if (!versionEntry?.artifactPath) return null;
  const artifactPath = path.join(packageDirs.root, versionEntry.artifactPath.replace(/\\/g, '/'));
  return fs.existsSync(artifactPath) ? artifactPath : null;
}

function readArtifactEntryMap(artifactPath: string): Map<string, Buffer> | null {
  const zip = new AdmZip(artifactPath);
  const entries = new Map<string, Buffer>();
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    entries.set(normalizeZipEntryName(entry.entryName), entry.getData());
  }
  return entries;
}

function readRuntimeEntry(packageId: string, version: string, entry: string): Buffer | null {
  if (!isSafeRelativeEntry(entry)) return null;
  const runtimePath = path.join(packageDirs.runtimes, packageId, version, normalizeZipEntryName(entry));
  if (!fs.existsSync(runtimePath)) return null;
  return fs.readFileSync(runtimePath);
}

function readPackagedFile(
  packageId: string,
  version: string,
  artifactPath: string | null,
  entry: string,
): Buffer | null {
  const fromRuntime = readRuntimeEntry(packageId, version, entry);
  if (fromRuntime) return fromRuntime;

  if (!artifactPath) return null;
  const artifactEntries = readArtifactEntryMap(artifactPath);
  if (!artifactEntries) return null;
  return artifactEntries.get(normalizeZipEntryName(entry)) ?? null;
}

function collectDbObjectZipEntries(
  packageId: string,
  version: string,
  artifactPath: string | null,
  dbObjects: CapabilityDbObject[],
): MountExportZipEntry[] {
  const zipEntries: MountExportZipEntry[] = [];
  const seen = new Set<string>();

  for (const dbObject of dbObjects) {
    for (const scriptPath of [dbObject.installScript, dbObject.uninstallScript, dbObject.seedScript]) {
      if (!scriptPath?.trim() || seen.has(scriptPath)) continue;
      seen.add(scriptPath);
      const content = readPackagedFile(packageId, version, artifactPath, scriptPath);
      if (!content) continue;
      zipEntries.push({ path: normalizeZipEntryName(scriptPath), content });
    }
  }

  return zipEntries;
}

function collectStaticAssetZipEntries(
  packageId: string,
  version: string,
  artifactPath: string | null,
  staticAssets: VerticalAppStaticAssetCapability[],
): MountExportZipEntry[] {
  const zipEntries: MountExportZipEntry[] = [];

  for (const asset of staticAssets) {
    const content = readPackagedFile(packageId, version, artifactPath, asset.path);
    if (!content) continue;
    zipEntries.push({ path: normalizeZipEntryName(asset.path), content });
  }

  return zipEntries;
}

export function resolveOwnerPluginSources(ownerPackageId: string | null | undefined): MountExportOwnerPluginSources | null {
  const packageId = ownerPackageId?.trim();
  if (!packageId) return null;

  const version = resolveInstalledPluginVersion(packageId);
  if (!version) return null;

  const index = readPackageIndex();
  const pluginEntry = index.packages.find((item) => item.packageId === packageId);
  const versionEntry = pluginEntry?.versions.find((item) => item.version === version);
  if (!versionEntry?.manifestPath) return null;

  const manifest = parseManifestFile(versionEntry.manifestPath);
  if (!manifest) return null;
  const artifactPath = resolvePluginArtifactPath(packageId, version);
  const dbObjects = [...manifest.capabilities.db_objects];
  const mcpServers = [...manifest.capabilities.mcp_servers];
  const staticAssets = isVerticalAppManifest(manifest)
    ? [...(manifest.capabilities.static_assets ?? [])]
    : [];
  const branding = isVerticalAppManifest(manifest) ? manifest.branding : undefined;

  const zipEntries = [
    ...collectDbObjectZipEntries(packageId, version, artifactPath, dbObjects),
    ...collectStaticAssetZipEntries(packageId, version, artifactPath, staticAssets),
  ];

  return {
    packageId,
    version,
    dbObjects,
    mcpServers,
    staticAssets,
    branding,
    zipEntries,
  };
}

export function parsePluginShellRef(entry: string): { packageId: string } | null {
  const match = /^package:([a-z][a-z0-9-]{2,63}):shell$/i.exec(entry.trim());
  if (!match?.[1]) return null;
  return { packageId: match[1] };
}

export function resolveShellExportContent(
  shellEntryRef: string,
  targetPluginId: string,
  ownerPackageId?: string | null,
): { entry: string; content: Buffer; source: 'package' | 'core-bridge' } | null {
  const shellEntry = 'ui/shell/AppShell.js';
  const pluginShell = parsePluginShellRef(shellEntryRef);
  const sourcePluginId = pluginShell?.packageId ?? ownerPackageId?.trim() ?? null;

  if (sourcePluginId) {
    const version = resolveInstalledPluginVersion(sourcePluginId);
    if (!version) return null;
    const artifactPath = resolvePluginArtifactPath(sourcePluginId, version);
    const content = readPackagedFile(sourcePluginId, version, artifactPath, shellEntry);
    if (content) {
      return { entry: shellEntry, content, source: 'package' };
    }
  }

  const coreRef = shellEntryRef.trim() || 'core:AdminLayout';
  const bridgeSource = `export default function ${targetPluginId.replace(/-/g, '_')}Shell() {
  return {
    type: 'div',
    props: {
      'data-package-shell': '${targetPluginId}',
      'data-core-shell-ref': '${coreRef}',
    },
    children: 'Shell for ${targetPluginId}',
  };
}
`;
  return {
    entry: shellEntry,
    content: Buffer.from(bridgeSource, 'utf8'),
    source: 'core-bridge',
  };
}

export function filterOwnerDbObjects(
  dbObjects: CapabilityDbObject[],
  selectedNames?: string[],
): CapabilityDbObject[] {
  if (!selectedNames?.length) return dbObjects;
  const allowed = new Set(selectedNames.map((name) => name.trim()).filter(Boolean));
  return dbObjects.filter((item) => allowed.has(item.objectName));
}

export function filterOwnerMcpServers(
  mcpServers: CapabilityMcpServer[],
  selectedIds?: string[],
): CapabilityMcpServer[] {
  if (!selectedIds?.length) return mcpServers;
  const allowed = new Set(selectedIds.map((id) => id.trim()).filter(Boolean));
  return mcpServers.filter((item) => allowed.has(item.id));
}

export function filterOwnerStaticAssets(
  staticAssets: VerticalAppStaticAssetCapability[],
  selectedKeys?: string[],
): VerticalAppStaticAssetCapability[] {
  if (!selectedKeys?.length) return staticAssets;
  const allowed = new Set(selectedKeys.map((key) => key.trim()).filter(Boolean));
  return staticAssets.filter((item) => allowed.has(item.assetKey));
}

export function resolveSuggestedExportKind(input: {
  routeCount: number;
  apiCount: number;
  dbObjectCount: number;
  mcpServerCount: number;
  explicitKind?: 'extension' | 'vertical-app';
}): 'extension' | 'vertical-app' {
  if (input.explicitKind) return input.explicitKind;
  if (input.routeCount > 0) return 'vertical-app';
  return 'extension';
}

export function buildExtensionManifestDraft(
  packageId: string,
  name: string,
  version: string,
  capabilities: PackageManifest['capabilities'],
  options?: {
    description?: string;
    createdBy?: string;
    requiredAppVersion?: string;
  },
): Omit<PackageManifest, 'integrity'> & { integrity: { algorithm: 'sha256'; artifactHash: string } } {
  return {
    $schemaVersion: '1.0',
    id: packageId,
    name,
    version,
    description: options?.description,
    createdBy: options?.createdBy,
    requiredAppVersion: options?.requiredAppVersion?.trim() || '>=1.0.0',
    dependencies: [],
    capabilities,
    overridePolicy: {
      apis: 'deny',
      ui_components: 'deny',
      db_objects: 'deny',
      mcp_servers: 'deny',
    },
    integrity: {
      algorithm: 'sha256',
      artifactHash: '0'.repeat(64),
    },
  };
}
