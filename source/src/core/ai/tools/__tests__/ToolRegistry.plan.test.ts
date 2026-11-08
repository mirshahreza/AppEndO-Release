import { describe, expect, it } from 'vitest';
import { ToolRegistry } from '../ToolRegistry';
import type { RegisteredMcpTool } from '../ToolRegistry';

const mcpTool: RegisteredMcpTool = {
  source: 'mcp',
  name: 'mcp_demo_write',
  description: 'MCP write tool',
  serverId: 'demo',
  originalName: 'write_file',
  parameters: { type: 'object', properties: {} },
  execute: async () => ({ ok: true, summary: 'ok' }),
};

describe('ToolRegistry plan mode gates', () => {
  it('blocks MCP tools in plan mode', () => {
    const registry = new ToolRegistry({ mode: 'plan', allowedGroups: ['standards', 'search', 'read', 'draft'] });
    registry.registerMcp(mcpTool);
    const definitions = registry.listDefinitions();
    expect(definitions.some((tool) => tool.name === 'mcp_demo_write')).toBe(false);
  });

  it('allows draft_file_patch in plan mode', () => {
    const registry = new ToolRegistry({ mode: 'plan', allowedGroups: ['standards', 'search', 'read', 'draft'] });
    registry.register({
      name: 'draft_file_patch',
      description: 'Draft file patch',
      group: 'draft',
      parameters: { type: 'object', properties: {} },
      execute: async () => ({ ok: true, summary: 'ok' }),
    });
    expect(registry.listDefinitions().some((tool) => tool.name === 'draft_file_patch')).toBe(true);
  });
});
