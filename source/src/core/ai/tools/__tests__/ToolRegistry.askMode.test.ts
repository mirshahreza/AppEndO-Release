import { describe, expect, it } from 'vitest';
import { ToolRegistry } from '../ToolRegistry';
import { getProjectStandardsTool } from '../native/getProjectStandards';

describe('ToolRegistry ask mode', () => {
  it('allows read-only tools and blocks draft tools', () => {
    const registry = new ToolRegistry({
      mode: 'ask',
      allowedGroups: ['standards', 'search', 'read', 'draft'],
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
      name: 'draft_file_patch',
      description: 'draft',
      group: 'draft',
      parameters: { type: 'object', properties: {} },
      execute: async () => ({ ok: true, summary: 'ok' }),
    });

    const names = registry.listDefinitions().map((tool) => tool.name);
    expect(names).toContain('get_project_standards');
    expect(names).toContain('read_file');
    expect(names).not.toContain('draft_file_patch');
  });
});
