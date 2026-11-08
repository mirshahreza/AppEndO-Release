/**
 * M2g Manual QA — automated smoke coverage for the seven operator scenarios
 * documented in the historical p-18 MCP access control plan (M2g).
 */
import { describe, expect, it, vi } from 'vitest';
import { ToolRegistry, createPhase1ToolRegistry } from '../../../../../core/ai/tools/ToolRegistry';
import type { RegisteredMcpTool } from '../../../../../core/ai/tools/ToolRegistry';
import {
  normalizeAgentCapabilityScope,
  parseAgentCapabilityScopeJson,
  serializeAgentCapabilityScope,
} from '../../../../../shared/api/contracts/ai/agentValidators';
import { getAiCapabilityPack } from '../../../../../shared/api/contracts/ai/capabilityPacks';
import { registerBuiltinCapabilityPacks } from '../builtin';
import {
  createAgentPackRegistry,
  listRegistryToolNames,
  registerPacks,
} from '../builtin/testSupport/packTestHarness';
import { GIT_STATUS_TOOL_NAME } from '../../../../../core/ai/tools/native/git/gitTools';
import { executeFetchUrl } from '../builtin/webTools';
import { executeHttpRequest } from '../builtin/httpTools';
import { DEFAULT_AI_HTTP_SETTINGS, DEFAULT_AI_WEB_SEARCH_SETTINGS } from '../../../../../shared/api/contracts/ai/constants';
import { registerMcpTools } from '../mcpToolAdapter';
import { listMcpToolDescriptors } from '../McpBridge';

vi.mock('../McpBridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../McpBridge')>();
  return {
    ...actual,
    listMcpToolDescriptors: vi.fn(),
  };
});

const mcpDemoTool: RegisteredMcpTool = {
  source: 'mcp',
  name: 'mcp__demo-server__echo',
  description: 'Echo tool from external MCP',
  serverId: 'demo-server',
  originalName: 'echo',
  parameters: { type: 'object', properties: {} },
  execute: async () => ({ ok: true, summary: 'echo ok' }),
};

describe('M2g Manual QA smoke', () => {
  describe('MQ-1 — scope: files+codebase only → read/search tools', () => {
    it('registers only scoped pack tools', () => {
      const registry = createAgentPackRegistry();
      registerPacks(registry, ['appendo-files', 'appendo-codebase']);

      const names = listRegistryToolNames(registry);
      expect(names).toEqual(expect.arrayContaining(['read_file', 'list_dir', 'glob_files', 'search_codebase']));
      expect(names).not.toContain('git_status');
      expect(names).not.toContain('web_search');
      expect(names).not.toContain('http_request');
      expect(names).not.toContain('get_project_standards');
    });
  });

  describe('MQ-2 — git pack enabled → status/diff callable', () => {
    it('exposes git read tools when appendo-git is scoped', () => {
      const registry = createPhase1ToolRegistry('agent', ['read', 'search', 'git', 'draft']);
      registerBuiltinCapabilityPacks(registry, ['appendo-git']);

      const names = registry.listDefinitions().map((tool) => tool.name);
      getAiCapabilityPack('appendo-git').toolNames.forEach((toolName) => {
        expect(names).toContain(toolName);
      });
      expect(names).toContain(GIT_STATUS_TOOL_NAME);
    });
  });

  describe('MQ-3 — web pack → SSRF blocks localhost', () => {
    it('fetch_url rejects localhost and loopback', async () => {
      const localhost = await executeFetchUrl(
        { url: 'http://localhost/secret' },
        { getWebSearchSettings: () => DEFAULT_AI_WEB_SEARCH_SETTINGS },
      );
      expect(localhost.ok).toBe(false);
      if (!localhost.ok) expect(localhost.error).toBe('url_blocked');

      const loopback = await executeFetchUrl(
        { url: 'http://127.0.0.1/admin' },
        { getWebSearchSettings: () => DEFAULT_AI_WEB_SEARCH_SETTINGS },
      );
      expect(loopback.ok).toBe(false);
      if (!loopback.ok) expect(loopback.error).toBe('url_blocked');
    });
  });

  describe('MQ-4 — http pack → allowlisted host only', () => {
    it('http_request rejects hostnames outside the allowlist', async () => {
      const result = await executeHttpRequest(
        { url: 'https://api.other.com/v1' },
        {
          getHttpSettings: () => ({
            allowedHostnames: ['api.example.com'],
          }),
          validateUrl: async (urlString) => new URL(urlString),
        },
      );

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('hostname_not_allowlisted');
    });

    it('http_request fails when allowlist is empty', async () => {
      const result = await executeHttpRequest(
        { url: 'https://api.example.com/v1' },
        {
          getHttpSettings: () => DEFAULT_AI_HTTP_SETTINGS,
          validateUrl: async (urlString) => new URL(urlString),
        },
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('http_allowlist_empty');
    });
  });

  describe('MQ-5 — external MCP enabled in scope → tools register', () => {
    it('registerMcpTools wires enabled external server tools into registry', async () => {
      const mockedList = vi.mocked(listMcpToolDescriptors);
      mockedList.mockResolvedValueOnce([{
        registryName: 'mcp__demo-server__echo',
        serverId: 'demo-server',
        toolName: 'echo',
        description: 'Echo',
        inputSchema: { type: 'object', properties: {} },
      }]);

      const registry = new ToolRegistry({ mode: 'agent', allowedGroups: ['read', 'search', 'standards'] });
      const result = await registerMcpTools(
        registry,
        [{
          id: 'demo-server',
          label: 'Demo MCP',
          enabled: true,
          transport: 'sse',
          url: 'https://example.com/mcp',
        }],
        ['demo-server'],
      );

      expect(result.warnings).toEqual([]);
      expect(result.registeredToolCount).toBe(1);
      expect(registry.listDefinitions().some((tool) => tool.name === 'mcp__demo-server__echo')).toBe(true);
    });
  });

  describe('MQ-6 — session scope persist round-trip', () => {
    it('serialize/parse preserves custom pack and MCP server scope', () => {
      const scope = normalizeAgentCapabilityScope({
        packIds: ['appendo-files', 'appendo-git'],
        mcpServerIds: ['demo-server'],
      })!;

      const raw = serializeAgentCapabilityScope(scope);
      expect(parseAgentCapabilityScopeJson(raw)).toEqual(scope);
    });

    it('deduplicates pack ids on normalize', () => {
      const scope = normalizeAgentCapabilityScope({
        packIds: ['appendo-files', 'appendo-codebase', 'appendo-files'],
        mcpServerIds: [],
      })!;

      expect(scope.packIds).toEqual(['appendo-files', 'appendo-codebase']);
    });
  });

  describe('MQ-7 — Plan mode → MCP/builtin agent tools unavailable', () => {
    it('plan mode registry excludes MCP tools', () => {
      const registry = new ToolRegistry({
        mode: 'plan',
        allowedGroups: ['standards', 'search', 'read', 'draft'],
      });
      registry.registerMcp(mcpDemoTool);

      expect(registry.listDefinitions().some((tool) => tool.name === 'mcp__demo-server__echo')).toBe(false);
    });

    it('plan mode blocks P0 agent tools such as read_file', () => {
      const registry = createPhase1ToolRegistry('plan', ['standards', 'search', 'read', 'draft']);
      registerBuiltinCapabilityPacks(registry, ['appendo-files', 'appendo-codebase']);

      const names = registry.listDefinitions().map((tool) => tool.name);
      expect(names).not.toContain('read_file');
      expect(names).not.toContain('search_codebase');
    });
  });
});
