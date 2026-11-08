import { describe, expect, it } from 'vitest';
import type { PackageManifest } from '../../../../core/packages/PackageManifestValidator';
import { buildRegistryFromManifest } from '../registryBuilder';

const manifestWithMcp = (): PackageManifest => ({
  $schemaVersion: '1.0',
  id: 'demo-package',
  name: 'Demo Package',
  version: '1.0.0',
  requiredAppVersion: '>=1.0.0',
  capabilities: {
    apis: [],
    ui_components: [],
    db_objects: [],
    mcp_servers: [{
      id: 'fs',
      label: 'Filesystem',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
    }],
    edge_models: [],
    edge_apis: [],
    edge_model_studio_meta: [],
    install_hooks: [],
  },
  overridePolicy: {
    apis: 'deny',
    ui_components: 'deny',
    db_objects: 'deny',
    mcp_servers: 'deny',
  },
  integrity: {
    algorithm: 'sha256',
    artifactHash: 'a'.repeat(64),
  },
});

describe('buildRegistryFromManifest mcp_servers', () => {
  it('registers package MCP servers in object registry', () => {
    const registry = buildRegistryFromManifest('demo-package', manifestWithMcp(), '1.0.0', 'default');
    expect(registry.records.mcpServers).toHaveLength(1);
    expect(registry.records.mcpServers[0]).toMatchObject({
      conflictKey: 'mcp-demo-package-fs',
      localId: 'fs',
      label: 'Filesystem',
      enabled: true,
      transport: 'stdio',
      command: 'npx',
    });
  });
});
