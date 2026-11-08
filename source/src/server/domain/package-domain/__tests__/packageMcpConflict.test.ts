import { describe, expect, it } from 'vitest';
import { buildPackageMcpGlobalId } from '../../../../core/packages/mcpServerIds';
import { collectConflicts, buildConflictOwnerIndex } from '../conflictDetection';
import type { PluginObjectRegistry } from '../types';

const emptyRegistry = (packageId: string, mcpServers: PluginObjectRegistry['records']['mcpServers'] = []): PluginObjectRegistry => ({
  schema: 'package-object-registry',
  schemaVersion: '1.0.0',
  packageId,
  activeVersion: '1.0.0',
  records: {
    apis: [],
    uiComponents: [],
    uiRoutes: [],
    dbObjects: [],
    mcpServers,
    edgeModels: [],
    edgeApis: [],
  },
  updatedAt: '2026-06-16T00:00:00.000Z',
});

describe('conflictDetection mcp_servers', () => {
  it('detects duplicate MCP server ids across plugins', () => {
    const conflictKey = buildPackageMcpGlobalId('owner-package', 'fs');
    const existing = buildConflictOwnerIndex([{
      ownerPackageId: 'owner-package',
      registry: emptyRegistry('owner-package', [{
        conflictKey,
        localId: 'fs',
        label: 'Owner FS',
        enabled: true,
        transport: 'stdio',
        command: 'npx',
        registeredAt: '2026-06-16T00:00:00.000Z',
      }]),
    }]);
    const candidate = emptyRegistry('new-pack', [{
      conflictKey,
      localId: 'fs',
      label: 'New FS',
      enabled: true,
      transport: 'stdio',
      command: 'npx',
      registeredAt: '2026-06-16T00:00:00.000Z',
    }]);
    const conflicts = collectConflicts('new-pack', candidate, existing);
    expect(conflicts).toEqual([{
      objectType: 'mcp_servers',
      conflictKey,
      ownerPackageId: 'owner-package',
    }]);
  });
});
