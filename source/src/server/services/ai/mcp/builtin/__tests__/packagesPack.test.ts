import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createPhase1ToolRegistry } from '../../../../../../core/ai/tools/ToolRegistry';
import { getAiCapabilityPack } from '../../../../../../shared/api/contracts/ai/capabilityPacks';
import { registerBuiltinCapabilityPacks } from '../index';
import {
  executeGetPackageManifest,
  executeListPlugins,
  GET_PLUGIN_MANIFEST_TOOL_NAME,
  LIST_PLUGINS_TOOL_NAME,
} from '../packagesTools';

const mockPlugins = [
  {
    packageId: 'ecommerce-core',
    displayName: 'E-Commerce Core',
    version: '1.0.0',
    installStatus: 'not_installed',
    activeInstalledVersion: null,
    createdAt: null,
    createdBy: null,
  },
];

vi.mock('../../../../../../core/packages/PackageArtifactService', () => ({
  listPackages: vi.fn(() => mockPlugins),
  getPackageDetail: vi.fn((packageId: string) => (
    packageId === 'ecommerce-core'
      ? {
        packageId,
        displayName: 'E-Commerce Core',
        version: '1.0.0',
        installStatus: 'not_installed',
        activeInstalledVersion: null,
        bundleManifest: { id: packageId, name: 'E-Commerce Core', version: '1.0.0' },
        catalogVersions: ['1.0.0'],
      }
      : null
  )),
}));

describe('appendo-packages pack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers plugins pack tools', () => {
    const registry = createPhase1ToolRegistry('agent', ['plugins']);
    registerBuiltinCapabilityPacks(registry, ['appendo-packages']);

    const names = registry.listDefinitions().map((tool) => tool.name);
    getAiCapabilityPack('appendo-packages').toolNames.forEach((name) => {
      expect(names).toContain(name);
    });
  });

  it('lists package artifacts', async () => {
    const result = await executeListPlugins();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.totalCount).toBe(1);
    }
  });

  it('loads a package manifest', async () => {
    const result = await executeGetPackageManifest({ packageId: 'ecommerce-core' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.packageId).toBe('ecommerce-core');
    }
  });

  it('exposes catalog tool names', () => {
    expect(LIST_PLUGINS_TOOL_NAME).toBe('list_packages');
    expect(GET_PLUGIN_MANIFEST_TOOL_NAME).toBe('get_package_manifest');
  });
});
