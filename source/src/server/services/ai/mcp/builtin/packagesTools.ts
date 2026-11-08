import type { NativeToolDefinition } from '../../../../../core/ai/tools/ToolRegistry';
import { getPackageDetail, listPackages } from '../../../../../core/packages/PackageArtifactService';

export const LIST_PLUGINS_TOOL_NAME = 'list_packages';
export const GET_PLUGIN_MANIFEST_TOOL_NAME = 'get_package_manifest';

export const executeListPlugins = async () => {
  const items = listPackages();
  return {
    ok: true as const,
    summary: `Listed ${items.length} package artifact(s).`,
    data: { items, totalCount: items.length },
  };
};

export const executeGetPackageManifest = async (args: Record<string, unknown>) => {
  const packageId = typeof args.packageId === 'string' ? args.packageId.trim() : '';
  if (!packageId) {
    return {
      ok: false as const,
      summary: 'packageId is required.',
      error: 'missing_plugin_id',
    };
  }

  const detail = getPackageDetail(packageId);
  if (!detail) {
    return {
      ok: false as const,
      summary: `Package "${packageId}" was not found.`,
      error: 'plugin_not_found',
    };
  }

  return {
    ok: true as const,
    summary: `Loaded manifest for package "${packageId}" (${detail.installStatus}).`,
    data: {
      packageId: detail.packageId,
      displayName: detail.displayName,
      version: detail.version,
      installStatus: detail.installStatus,
      activeInstalledVersion: detail.activeInstalledVersion,
      manifest: detail.bundleManifest,
      catalogVersions: detail.catalogVersions ?? [],
    },
  };
};

export const createPackagesTools = (): NativeToolDefinition[] => [
  {
    name: LIST_PLUGINS_TOOL_NAME,
    description: 'List uploaded package artifacts with install status.',
    group: 'plugins',
    parameters: { type: 'object', properties: {} },
    execute: async () => executeListPlugins(),
  },
  {
    name: GET_PLUGIN_MANIFEST_TOOL_NAME,
    description: 'Load the active bundle manifest for a package artifact.',
    group: 'plugins',
    parameters: {
      type: 'object',
      properties: {
        packageId: { type: 'string', description: 'Package id from list_packages.' },
      },
      required: ['packageId'],
    },
    execute: async (args) => executeGetPackageManifest(args),
  },
];
