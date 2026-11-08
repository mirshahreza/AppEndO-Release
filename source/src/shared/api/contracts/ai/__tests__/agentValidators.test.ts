import { describe, expect, it } from 'vitest';
import { DEFAULT_AI_AGENT_SETTINGS } from '../constants';
import {
  normalizeAgentCapabilityScope,
  normalizeAgentChatLatencyRequest,
  normalizeAgentProposalFeedbackRequest,
  normalizeAgentRunRequest,
  normalizeAgentStreamEvent,
  normalizeAiAgentSettings,
  normalizeAiMcpServerConfig,
  normalizeChangeSet,
  parseAgentCapabilityScopeJson,
  serializeAgentCapabilityScope,
} from '../agentValidators';
import { DEFAULT_AGENT_CAPABILITY_SCOPE } from '../capabilityPacks';
import { normalizeAiHttpSettings, normalizeAiMcpSettings, normalizeAiSettings, normalizeAiWebSearchSettings } from '../validators';
import { AiValidationError } from '../errors';

describe('normalizeAiAgentSettings', () => {
  it('applies defaults when input is empty', () => {
    expect(normalizeAiAgentSettings(undefined)).toEqual(DEFAULT_AI_AGENT_SETTINGS);
  });

  it('rejects invalid defaultMode', () => {
    expect(() => normalizeAiAgentSettings({ defaultMode: 'auto' })).toThrow(AiValidationError);
  });

  it('normalizes contextToolObservationMaxTurns', () => {
    expect(normalizeAiAgentSettings({ contextToolObservationMaxTurns: 6 })).toMatchObject({
      contextToolObservationMaxTurns: 6,
    });
    expect(normalizeAiAgentSettings({ contextSummarizeWithLlm: true })).toMatchObject({
      contextSummarizeWithLlm: true,
    });
    expect(() => normalizeAiAgentSettings({ contextToolObservationMaxTurns: 0 })).toThrow(AiValidationError);
  });
});

describe('normalizeAiMcpServerConfig', () => {
  it('requires command for stdio transport', () => {
    expect(() => normalizeAiMcpServerConfig({
      id: 'local-fs',
      label: 'Local FS',
      enabled: true,
      transport: 'stdio',
    })).toThrow(AiValidationError);
  });

  it('accepts valid stdio server', () => {
    expect(normalizeAiMcpServerConfig({
      id: 'local-fs',
      label: 'Local FS',
      enabled: true,
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
    })).toMatchObject({
      id: 'local-fs',
      transport: 'stdio',
      command: 'npx',
    });
  });
});

describe('normalizeAgentRunRequest', () => {
  it('requires at least one message', () => {
    expect(() => normalizeAgentRunRequest({ mode: 'agent', messages: [] })).toThrow(AiValidationError);
  });

  it('normalizes agent run payload', () => {
    const request = normalizeAgentRunRequest({
      mode: 'agent',
      modelId: 'gemini-2-5-flash',
      messages: [{ role: 'user', content: 'Hello' }],
      pageContext: {
        path: '/users',
        pageLabel: 'Users',
        pageKey: 'users',
      },
    });

    expect(request.mode).toBe('agent');
    expect(request.messages).toHaveLength(1);
    expect(request.pageContext?.path).toBe('/users');
    expect(request.pageContext?.pageKey).toBe('users');
  });

  it('rejects legacy vibe mode alias', () => {
    expect(() => normalizeAgentRunRequest({
      mode: 'vibe',
      messages: [{ role: 'user', content: 'Build CRUD form' }],
    })).toThrow(AiValidationError);
  });

  it('normalizes enabled capability pack ids', () => {
    const request = normalizeAgentRunRequest({
      mode: 'agent',
      messages: [{ role: 'user', content: 'Hello' }],
      enabledCapabilityPackIds: ['appendo-files', 'appendo-git', 'appendo-files'],
    });

    expect(request.enabledCapabilityPackIds).toEqual(['appendo-files', 'appendo-git']);
  });

  it('rejects invalid capability pack ids', () => {
    expect(() => normalizeAgentRunRequest({
      mode: 'agent',
      messages: [{ role: 'user', content: 'Hello' }],
      enabledCapabilityPackIds: ['not-a-pack'],
    })).toThrow(AiValidationError);
  });
});

describe('normalizeAgentStreamEvent', () => {
  it('parses tool_result events', () => {
    const event = normalizeAgentStreamEvent({
      type: 'tool_result',
      toolCallId: 'call-1',
      result: {
        ok: true,
        summary: 'Found standards',
      },
    });

    expect(event.type).toBe('tool_result');
    if (event.type === 'tool_result') {
      expect(event.result.ok).toBe(true);
    }
  });

  it('parses proposal events with change sets', () => {
    const event = normalizeAgentStreamEvent({
      type: 'proposal',
      proposalId: 'prop-1',
      changeSets: [{
        id: 'cs-1',
        kind: 'file_patch',
        title: 'Update grid rule',
        path: 'AGENTS.md',
        content: '# rules',
      }],
    });

    expect(event.type).toBe('proposal');
    if (event.type === 'proposal') {
      expect(event.proposalId).toBe('prop-1');
      expect(event.changeSets[0]?.kind).toBe('file_patch');
    }
  });

  it('normalizes change_plan events and legacy plan alias', () => {
    const changePlan = normalizeAgentStreamEvent({
      type: 'change_plan',
      plan: { steps: ['a'], targetFiles: ['b'], intent: 'Do it' },
    });
    expect(changePlan.type).toBe('change_plan');

    const legacyPlan = normalizeAgentStreamEvent({
      type: 'plan',
      plan: { steps: ['a'], targetFiles: ['b'], intent: 'Do it' },
    });
    expect(legacyPlan.type).toBe('change_plan');
  });

  it('parses plan_doc_updated events', () => {
    const event = normalizeAgentStreamEvent({
      type: 'plan_doc_updated',
      path: 'plans/core/todo/p-00-todo-index.md',
      revision: '2',
    });
    expect(event.type).toBe('plan_doc_updated');
    if (event.type === 'plan_doc_updated') {
      expect(event.path).toBe('plans/core/todo/p-00-todo-index.md');
      expect(event.revision).toBe('2');
    }
  });

  it('parses mcp_warning events', () => {
    const event = normalizeAgentStreamEvent({
      type: 'mcp_warning',
      serverId: 'broken',
      serverLabel: 'Broken MCP',
      message: 'Connection refused',
    });
    expect(event).toEqual({
      type: 'mcp_warning',
      serverId: 'broken',
      serverLabel: 'Broken MCP',
      message: 'Connection refused',
    });
  });
});

describe('normalizeChangeSet', () => {
  it('validates component layout patch shape', () => {
    const changeSet = normalizeChangeSet({
      id: 'cs-layout',
      kind: 'component_layout_patch',
      title: 'Add form field',
      layoutId: 'layout-1',
      patch: { op: 'add', node: {} },
    });

    expect(changeSet.kind).toBe('component_layout_patch');
  });
});

describe('normalizeAgentCapabilityScope', () => {
  it('applies default scope when input is missing', () => {
    expect(normalizeAgentCapabilityScope(undefined, { applyDefaultWhenMissing: true }))
      .toEqual(DEFAULT_AGENT_CAPABILITY_SCOPE);
  });

  it('normalizes explicit pack and mcp server ids', () => {
    expect(normalizeAgentCapabilityScope({
      packIds: ['appendo-git', 'appendo-files', 'appendo-git'],
      mcpServerIds: ['local-fs', 'local-fs'],
    })).toEqual({
      packIds: ['appendo-git', 'appendo-files'],
      mcpServerIds: ['local-fs'],
    });
  });

  it('rejects unknown pack ids', () => {
    expect(() => normalizeAgentCapabilityScope({
      packIds: ['appendo-unknown'],
      mcpServerIds: [],
    })).toThrow(AiValidationError);
  });

  it('round-trips through JSON storage helpers', () => {
    const scope = {
      packIds: ['appendo-codebase', 'appendo-files'] as const,
      mcpServerIds: ['my-mcp'],
    };
    const raw = serializeAgentCapabilityScope({
      packIds: [...scope.packIds],
      mcpServerIds: [...scope.mcpServerIds],
    });
    expect(parseAgentCapabilityScopeJson(raw)).toEqual({
      packIds: ['appendo-codebase', 'appendo-files'],
      mcpServerIds: ['my-mcp'],
    });
  });

  it('falls back to default scope for null or invalid stored JSON', () => {
    expect(parseAgentCapabilityScopeJson(null)).toEqual(DEFAULT_AGENT_CAPABILITY_SCOPE);
    expect(parseAgentCapabilityScopeJson('not-json')).toEqual(DEFAULT_AGENT_CAPABILITY_SCOPE);
    expect(parseAgentCapabilityScopeJson('{"packIds":["bad"],"mcpServerIds":[]}')).toEqual(
      DEFAULT_AGENT_CAPABILITY_SCOPE,
    );
  });
});

describe('normalizeAiSettings agent blocks', () => {
  it('merges agent defaults for legacy ai blocks without agent key', () => {
    const settings = normalizeAiSettings({
      enabled: true,
      defaultModelId: 'gemini-2-5-flash',
      chatRateLimitPerMinute: 20,
      providers: [],
      models: [{
        id: 'gemini-2-5-flash',
        name: 'Gemini 2.5 Flash',
        provider: 'google-gemini',
        modelId: 'gemini-2.5-flash',
        enabled: true,
        capabilities: {
          chat: true,
          streaming: true,
          vision: false,
          tools: true,
          embeddings: false,
          imageGeneration: false,
          speechToText: false,
          textToSpeech: false,
        },
      }],
    });

    expect(settings.agent.defaultMode).toBe('ask');
    expect(settings.mcp.stdioAllowlist).toEqual([]);
    expect(settings.mcpServers).toEqual([]);
    expect(settings.webSearch.provider).toBe('disabled');
    expect(settings.webSearch.maxResults).toBe(5);
    expect(settings.http.allowedHostnames).toEqual([]);
  });

  it('does not auto-insert catalog preset models', () => {
    const settings = normalizeAiSettings({
      enabled: true,
      defaultModelId: 'gemini-2-5-flash',
      chatRateLimitPerMinute: 20,
      providers: [{ provider: 'google-gemini' }],
      models: [{
        id: 'gemini-2-5-flash',
        name: 'Gemini 2.5 Flash',
        provider: 'google-gemini',
        modelId: 'gemini-2.5-flash',
        enabled: true,
        capabilities: {
          chat: true,
          streaming: true,
          vision: false,
          tools: true,
          embeddings: false,
          imageGeneration: false,
          speechToText: false,
          textToSpeech: false,
        },
      }],
    });

    expect(settings.models).toHaveLength(1);
    expect(settings.models[0]?.id).toBe('gemini-2-5-flash');
    expect(settings.providers).toHaveLength(1);
  });
});

describe('normalizeAiHttpSettings', () => {
  it('normalizes and deduplicates hostnames', () => {
    const settings = normalizeAiHttpSettings({
      allowedHostnames: ['API.Example.COM', 'api.example.com', 'hooks.example.com'],
    });

    expect(settings).toEqual({
      allowedHostnames: ['api.example.com', 'hooks.example.com'],
    });
  });

  it('rejects invalid hostname entries', () => {
    expect(() => normalizeAiHttpSettings({ allowedHostnames: ['https://bad.com'] })).toThrow(/invalid/i);
    expect(() => normalizeAiHttpSettings({ allowedHostnames: ['bad_host!'] })).toThrow(/valid hostname/i);
  });
});

describe('normalizeAiMcpSettings', () => {
  it('normalizes stdio allowlist entries', () => {
    expect(normalizeAiMcpSettings({
      stdioAllowlist: ['npx', 'node', 'npx'],
    })).toMatchObject({
      stdioAllowlist: ['npx', 'node'],
      inboundHost: { enabled: false, hasApiKey: false, serviceRoleName: 'DEVELOPER' },
    });
  });

  it('normalizes inbound host settings', () => {
    expect(normalizeAiMcpSettings({
      inboundHost: {
        enabled: true,
        apiKey: 'appendo-inbound-key-01',
      },
    }).inboundHost).toEqual({
      enabled: true,
      apiKey: 'appendo-inbound-key-01',
      hasApiKey: true,
      serviceRoleName: 'DEVELOPER',
    });
  });

  it('rejects short inbound host API keys', () => {
    expect(() => normalizeAiMcpSettings({
      inboundHost: { enabled: true, apiKey: 'short' },
    })).toThrow(/at least 16 characters/i);
  });
});

describe('normalizeAiWebSearchSettings', () => {
  it('normalizes provider and maxResults', () => {
    const settings = normalizeAiWebSearchSettings({
      provider: 'brave',
      apiKey: 'secret',
      maxResults: 8,
    });

    expect(settings).toEqual({
      provider: 'brave',
      apiKey: 'secret',
      hasApiKey: true,
      maxResults: 8,
    });
  });

  it('rejects unknown providers and out-of-range maxResults', () => {
    expect(() => normalizeAiWebSearchSettings({ provider: 'google' })).toThrow(/not supported/i);
    expect(() => normalizeAiWebSearchSettings({ provider: 'brave', maxResults: 0 })).toThrow(/maxResults/i);
    expect(() => normalizeAiWebSearchSettings({ provider: 'brave', maxResults: 25 })).toThrow(/maxResults/i);
  });
});

describe('normalizeAgentProposalFeedbackRequest', () => {
  it('normalizes dismissed pre-apply feedback', () => {
    expect(normalizeAgentProposalFeedbackRequest({
      sessionId: 42,
      proposalId: 'prop-1',
      changeSetCount: 2,
    })).toEqual({
      sessionId: 42,
      proposalId: 'prop-1',
      changeSetCount: 2,
    });
  });

  it('rejects missing proposalId', () => {
    expect(() => normalizeAgentProposalFeedbackRequest({ changeSetCount: 1 })).toThrow(AiValidationError);
  });
});

describe('normalizeAgentChatLatencyRequest', () => {
  it('normalizes perceived latency samples', () => {
    expect(normalizeAgentChatLatencyRequest({
      sessionId: 7,
      latencyMs: 42,
      activityKind: 'user_echo',
    })).toEqual({
      sessionId: 7,
      latencyMs: 42,
      activityKind: 'user_echo',
    });
  });

  it('rejects invalid activity kind', () => {
    expect(() => normalizeAgentChatLatencyRequest({
      latencyMs: 10,
      activityKind: 'invalid',
    })).toThrow(AiValidationError);
  });
});
