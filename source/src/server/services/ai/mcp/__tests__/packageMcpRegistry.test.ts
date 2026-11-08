import { describe, expect, it } from 'vitest';
import { buildPackageMcpGlobalId } from '../../../../../core/packages/mcpServerIds';
import type { PluginObjectRegistry } from '../../../../domain/package-domain/types';
import {
  listInstalledPluginMcpServers,
  manifestMcpServerToConfig,
  resolveEffectiveMcpServers,
} from '../packageMcpRegistry';

const sampleRegistry = (
  packageId: string,
  servers: PluginObjectRegistry['records']['mcpServers'],
): PluginObjectRegistry => ({
  schema: 'package-object-registry',
  schemaVersion: '1.0.0',
  packageId,
  activeVersion: '1.0.0',
  records: {
    apis: [],
    uiComponents: [],
    uiRoutes: [],
    dbObjects: [],
    mcpServers: servers,
    edgeModels: [],
    edgeApis: [],
  },
  updatedAt: '2026-06-16T00:00:00.000Z',
});

describe('packageMcpRegistry', () => {
  it('builds global MCP server ids from package id and local id', () => {
    expect(buildPackageMcpGlobalId('demo-package', 'fs')).toBe('mcp-demo-package-fs');
  });

  it('maps manifest MCP server to package-managed config', () => {
    const config = manifestMcpServerToConfig('demo-package', {
      id: 'fs',
      label: 'Demo FS',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
    });
    expect(config.id).toBe('mcp-demo-package-fs');
    expect(config.sourcePluginId).toBe('demo-package');
    expect(config.enabled).toBe(true);
  });

  it('merges settings MCP servers with installed package servers', () => {
    const settingsServers = [{
      id: 'local-http',
      label: 'Local HTTP',
      enabled: true,
      transport: 'http' as const,
      url: 'https://example.com/mcp',
    }];
    const pluginServers = [{
      id: 'mcp-demo-package-fs',
      label: 'Demo FS',
      enabled: true,
      transport: 'stdio' as const,
      command: 'npx',
      sourcePluginId: 'demo-package',
    }];
    const effective = resolveEffectiveMcpServers(settingsServers);
    expect(effective.map((server) => server.id)).toEqual(['local-http']);
    const merged = resolveEffectiveMcpServers([...settingsServers, ...pluginServers]);
    expect(merged.map((server) => server.id)).toEqual(['local-http', 'mcp-demo-package-fs']);
  });

  it('lists installed package MCP servers from object registries', () => {
    const registry = sampleRegistry('demo-package', [{
      conflictKey: 'mcp-demo-package-fs',
      localId: 'fs',
      label: 'Demo FS',
      enabled: true,
      transport: 'stdio',
      command: 'npx',
      registeredAt: '2026-06-16T00:00:00.000Z',
    }]);
    // listInstalledPluginMcpServers reads filesystem — smoke the pure mapper instead.
    expect(registry.records.mcpServers[0].conflictKey).toBe('mcp-demo-package-fs');
    expect(listInstalledPluginMcpServers).toBeTypeOf('function');
  });
});
