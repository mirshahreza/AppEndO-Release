import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_AI_SETTINGS } from '../../../../../../shared/api/contracts/ai/constants';
import { aiManager } from '../../../../../../core/ai/AiManager';
import {
  createInboundPackToolRegistry,
  INBOUND_MCP_EXCLUDED_TOOL_NAMES,
  isInboundMcpToolExcluded,
  resolveInboundCapabilityPackIds,
  toolParametersToZodShape,
  wireInboundBuiltinPackTools,
} from '../inboundBuiltinPackBridge';

describe('inboundBuiltinPackBridge', () => {
  afterEach(() => {
    aiManager.reloadFromSettings(DEFAULT_AI_SETTINGS);
  });

  it('resolveInboundCapabilityPackIds falls back to session defaults', () => {
    aiManager.reloadFromSettings(DEFAULT_AI_SETTINGS);
    const packIds = resolveInboundCapabilityPackIds();
    expect(packIds).toContain('appendo-files');
    expect(packIds).toContain('appendo-standards');
    expect(packIds).not.toContain('appendo-git');
  });

  it('resolveInboundCapabilityPackIds uses ai.mcp.defaultCapabilityPackIds', () => {
    aiManager.reloadFromSettings({
      ...DEFAULT_AI_SETTINGS,
      mcp: {
        ...DEFAULT_AI_SETTINGS.mcp,
        defaultCapabilityPackIds: ['appendo-standards', 'appendo-openapi', 'invalid-pack'],
      },
    });

    expect(resolveInboundCapabilityPackIds()).toEqual(['appendo-standards', 'appendo-openapi']);
  });

  it('excludes confirm-gated draft and git-write tools', () => {
    [...INBOUND_MCP_EXCLUDED_TOOL_NAMES].forEach((toolName) => {
      expect(isInboundMcpToolExcluded(toolName)).toBe(true);
    });
    expect(isInboundMcpToolExcluded('read_file')).toBe(false);
    expect(isInboundMcpToolExcluded('git_status')).toBe(false);
  });

  it('toolParametersToZodShape maps optional and required fields', () => {
    const shape = toolParametersToZodShape({
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Filter keyword' },
        limit: { type: 'integer' },
      },
      required: ['query'],
    });

    expect(shape.query).toBeDefined();
    expect(shape.limit).toBeDefined();
    expect(shape.query.safeParse(undefined).success).toBe(false);
    expect(shape.limit.safeParse(undefined).success).toBe(true);
  });

  it('createInboundPackToolRegistry registers standards pack tools', () => {
    const registry = createInboundPackToolRegistry(['appendo-standards']);
    const names = registry.listDefinitions().map((tool) => tool.name);
    expect(names).toEqual(['get_project_standards', 'run_tests']);
  });

  it('wireInboundBuiltinPackTools registers MCP tools on server', () => {
    aiManager.reloadFromSettings({
      ...DEFAULT_AI_SETTINGS,
      mcp: {
        ...DEFAULT_AI_SETTINGS.mcp,
        defaultCapabilityPackIds: ['appendo-standards'],
      },
    });

    const server = new McpServer({ name: 'test', version: '1.0.0' }, { capabilities: {} });
    const count = wireInboundBuiltinPackTools(server, ['appendo-standards']);
    expect(count).toBe(2);
  });
});
