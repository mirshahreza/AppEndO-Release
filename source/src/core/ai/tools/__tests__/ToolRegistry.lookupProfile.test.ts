import { describe, expect, it } from 'vitest';
import { ToolRegistry } from '../ToolRegistry';
import { getProjectStandardsTool } from '../native/getProjectStandards';

describe('ToolRegistry agent_lookup profile', () => {
  it('blocks draft tools in agent mode when profile is agent_lookup', () => {
    const registry = new ToolRegistry({
      mode: 'agent',
      allowedGroups: ['standards', 'search', 'read', 'draft'],
      executionProfile: 'agent_lookup',
    });
    registry.register(getProjectStandardsTool);
    registry.register({
      name: 'read_file',
      description: 'read',
      group: 'read',
      parameters: { type: 'object', properties: {} },
      execute: async () => ({ ok: true, summary: 'ok' }),
    });
    registry.register({
      name: 'draft_component_layout',
      description: 'draft',
      group: 'draft',
      parameters: { type: 'object', properties: {} },
      execute: async () => ({ ok: true, summary: 'ok' }),
    });

    const names = registry.listDefinitions().map((tool) => tool.name);
    expect(names).toContain('get_project_standards');
    expect(names).toContain('read_file');
    expect(names).not.toContain('draft_component_layout');
  });
});
