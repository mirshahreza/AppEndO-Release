import { afterEach, describe, expect, it } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_AI_SETTINGS } from '../../../../../../shared/api/contracts/ai/constants';
import { aiManager } from '../../../../../../core/ai/AiManager';
import {
  buildInboundAgentBriefPromptText,
  buildInboundCapabilityPackSnapshot,
  INBOUND_MCP_PROMPT_NAMES,
  INBOUND_MCP_RESOURCE_URIS,
  wireInboundResourcesAndPrompts,
} from '../inboundResourcesPrompts';

describe('inboundResourcesPrompts', () => {
  afterEach(() => {
    aiManager.reloadFromSettings(DEFAULT_AI_SETTINGS);
  });

  it('buildInboundCapabilityPackSnapshot maps catalog metadata', () => {
    const snapshot = buildInboundCapabilityPackSnapshot(['appendo-standards', 'appendo-git']);
    expect(snapshot).toEqual([
      expect.objectContaining({
        id: 'appendo-standards',
        label: 'Project Standards',
        toolNames: ['get_project_standards', 'run_tests'],
      }),
      expect.objectContaining({
        id: 'appendo-git',
        hasWriteTools: true,
      }),
    ]);
  });

  it('buildInboundAgentBriefPromptText lists enabled packs and tools', () => {
    const text = buildInboundAgentBriefPromptText(['appendo-standards']);
    expect(text).toContain('AppEndO via inbound MCP');
    expect(text).toContain('appendo-standards');
    expect(text).toContain('get_project_standards');
    expect(text).toContain('Write and git-write tools are excluded');
  });

  it('wireInboundResourcesAndPrompts registers two resources and two prompts', () => {
    const server = new McpServer({ name: 'test', version: '1.0.0' }, {
      capabilities: {
        resources: {},
        prompts: {},
      },
    });

    const counts = wireInboundResourcesAndPrompts(server);
    expect(counts).toEqual({ resourceCount: 2, promptCount: 2 });
    expect(INBOUND_MCP_RESOURCE_URIS.projectStandards).toBe('appendo://project-standards');
    expect(INBOUND_MCP_PROMPT_NAMES.agentBrief).toBe('appendo_agent_brief');
  });
});
