import http from 'node:http';
import express from 'express';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AI_SETTINGS } from '../../../../../../shared/api/contracts/ai/constants';
import type { AiSettings } from '../../../../../../shared/api/contracts/ai/types';
import { aiManager } from '../../../../../../core/ai/AiManager';
import {
  getInboundMcpSessionCountForTests,
  resetInboundMcpSessionsForTests,
} from '../mcpInboundHost.service';
import {
  extractInboundMcpApiKey,
  verifyInboundMcpApiKey,
} from '../mcpInboundAuth';
import { resolveInboundCapabilityPackIds } from '../inboundBuiltinPackBridge';

vi.mock('../../../mcpAccess.service', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../mcpAccess.service')>();
  return {
    ...original,
    resolveInboundMcpCapabilityPackIds: vi.fn(async () => resolveInboundCapabilityPackIds()),
  };
});

const TEST_API_KEY = 'appendo-inbound-test-key-01';

const buildInboundSettings = (
  overrides?: Partial<AiSettings['mcp']['inboundHost']>,
  mcpOverrides?: Partial<AiSettings['mcp']>,
): AiSettings => ({
  ...DEFAULT_AI_SETTINGS,
  mcp: {
    ...DEFAULT_AI_SETTINGS.mcp,
    ...mcpOverrides,
    inboundHost: {
      enabled: true,
      apiKey: TEST_API_KEY,
      ...overrides,
    },
  },
});

const parseMcpResponseBody = (bodyText: string): unknown[] => {
  const payloads: unknown[] = [];
  bodyText.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return;
    const jsonText = trimmed.slice(5).trim();
    if (!jsonText) return;
    payloads.push(JSON.parse(jsonText));
  });

  if (payloads.length === 0 && bodyText.trim()) {
    payloads.push(JSON.parse(bodyText));
  }

  return payloads;
};

const initializeInboundSession = async (origin: string): Promise<string> => {
  const response = await fetch(`${origin}/api/mcp`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TEST_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' },
      },
    }),
  });

  expect(response.status).toBe(200);
  const sessionId = response.headers.get('mcp-session-id');
  if (!sessionId) {
    throw new Error('Missing MCP session id');
  }
  await response.text();
  return sessionId;
};

describe('mcpInboundAuth', () => {
  afterEach(() => {
    aiManager.reloadFromSettings(DEFAULT_AI_SETTINGS);
  });

  it('extracts bearer and x-api-key headers', () => {
    expect(extractInboundMcpApiKey({
      header: (name: string) => (
        name.toLowerCase() === 'authorization' ? `Bearer ${TEST_API_KEY}` : undefined
      ),
    } as express.Request)).toBe(TEST_API_KEY);

    expect(extractInboundMcpApiKey({
      header: (name: string) => (
        name.toLowerCase() === 'x-api-key' ? TEST_API_KEY : undefined
      ),
    } as express.Request)).toBe(TEST_API_KEY);
  });

  it('verifies configured API key with timing-safe comparison', () => {
    aiManager.reloadFromSettings(buildInboundSettings());
    expect(verifyInboundMcpApiKey(TEST_API_KEY)).toBe(true);
    expect(verifyInboundMcpApiKey('wrong-key-value-12345')).toBe(false);
  });
});

describe('mcp.routes inbound host', () => {
  let server: http.Server;
  let baseUrl = '';

  beforeAll(async () => {
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    const { mountMcpRoutes } = await import('../../../../../routes/mcp.routes');
    mountMcpRoutes(app);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  afterEach(() => {
    aiManager.reloadFromSettings(DEFAULT_AI_SETTINGS);
    resetInboundMcpSessionsForTests();
  });

  it('returns 503 when inbound host is disabled', async () => {
    aiManager.reloadFromSettings(buildInboundSettings({ enabled: false }));

    const response = await fetch(`${baseUrl}/api/mcp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TEST_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      }),
    });

    expect(response.status).toBe(503);
  });

  it('returns 401 for missing or invalid API key', async () => {
    aiManager.reloadFromSettings(buildInboundSettings());

    const missing = await fetch(`${baseUrl}/api/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(missing.status).toBe(401);

    const invalid = await fetch(`${baseUrl}/api/mcp`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer wrong-key-value-12345',
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    expect(invalid.status).toBe(401);
  });

  it('accepts initialize over POST and returns MCP session id', async () => {
    aiManager.reloadFromSettings(buildInboundSettings());

    const response = await fetch(`${baseUrl}/api/mcp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TEST_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      }),
    });

    expect(response.status).toBe(200);
    const sessionId = response.headers.get('mcp-session-id');
    expect(sessionId).toBeTruthy();
    expect(getInboundMcpSessionCountForTests()).toBe(1);

    const payloadText = await response.text();
    expect(payloadText).toContain('appendo');
  });

  it('rejects POST without session id after initialize', async () => {
    aiManager.reloadFromSettings(buildInboundSettings());

    const response = await fetch(`${baseUrl}/api/mcp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TEST_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      }),
    });

    expect(response.status).toBe(400);
  });

  it('lists builtin pack tools for configured defaultCapabilityPackIds', async () => {
    aiManager.reloadFromSettings(buildInboundSettings(undefined, {
      defaultCapabilityPackIds: ['appendo-standards', 'appendo-git'],
    }));

    const sessionId = await initializeInboundSession(baseUrl);

    const response = await fetch(`${baseUrl}/api/mcp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TEST_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/list',
        params: {},
      }),
    });

    expect(response.status).toBe(200);
    const payloads = parseMcpResponseBody(await response.text());
    const listResult = payloads.find((entry) => (
      typeof entry === 'object'
      && entry !== null
      && 'result' in entry
      && typeof (entry as { result?: { tools?: Array<{ name: string }> } }).result?.tools !== 'undefined'
    )) as { result: { tools: Array<{ name: string }> } } | undefined;

    const toolNames = (listResult?.result.tools ?? []).map((tool) => tool.name);
    expect(toolNames).toContain('get_project_standards');
    expect(toolNames).toContain('git_status');
    expect(toolNames).not.toContain('git_commit');
    expect(toolNames).not.toContain('draft_file_patch');
  });

  it('clamps inbound tools when service role grants exclude configured packs', async () => {
    const mcpAccess = await import('../../../mcpAccess.service');
    vi.mocked(mcpAccess.resolveInboundMcpCapabilityPackIds).mockResolvedValueOnce(['appendo-standards']);

    aiManager.reloadFromSettings(buildInboundSettings({ serviceRoleName: 'DEVELOPER' }, {
      defaultCapabilityPackIds: ['appendo-standards', 'appendo-git'],
    }));

    const sessionId = await initializeInboundSession(baseUrl);

    const response = await fetch(`${baseUrl}/api/mcp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TEST_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/list',
        params: {},
      }),
    });

    expect(response.status).toBe(200);
    const payloads = parseMcpResponseBody(await response.text());
    const listResult = payloads.find((entry) => (
      typeof entry === 'object'
      && entry !== null
      && 'result' in entry
      && typeof (entry as { result?: { tools?: Array<{ name: string }> } }).result?.tools !== 'undefined'
    )) as { result: { tools: Array<{ name: string }> } } | undefined;

    const toolNames = (listResult?.result.tools ?? []).map((tool) => tool.name);
    expect(toolNames).toContain('get_project_standards');
    expect(toolNames).not.toContain('git_status');
  });

  it('lists inbound MCP resources and prompts', async () => {
    aiManager.reloadFromSettings(buildInboundSettings(undefined, {
      defaultCapabilityPackIds: ['appendo-standards'],
    }));

    const sessionId = await initializeInboundSession(baseUrl);

    const resourcesResponse = await fetch(`${baseUrl}/api/mcp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TEST_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 4,
        method: 'resources/list',
        params: {},
      }),
    });

    expect(resourcesResponse.status).toBe(200);
    const resourcePayloads = parseMcpResponseBody(await resourcesResponse.text());
    const resourceList = resourcePayloads.find((entry) => (
      typeof entry === 'object'
      && entry !== null
      && 'result' in entry
      && typeof (entry as { result?: { resources?: Array<{ uri: string }> } }).result?.resources !== 'undefined'
    )) as { result: { resources: Array<{ uri: string }> } } | undefined;

    const resourceUris = (resourceList?.result.resources ?? []).map((resource) => resource.uri);
    expect(resourceUris).toContain('appendo://project-standards');
    expect(resourceUris).toContain('appendo://capability-packs');

    const promptsResponse = await fetch(`${baseUrl}/api/mcp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TEST_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 5,
        method: 'prompts/list',
        params: {},
      }),
    });

    expect(promptsResponse.status).toBe(200);
    const promptPayloads = parseMcpResponseBody(await promptsResponse.text());
    const promptList = promptPayloads.find((entry) => (
      typeof entry === 'object'
      && entry !== null
      && 'result' in entry
      && typeof (entry as { result?: { prompts?: Array<{ name: string }> } }).result?.prompts !== 'undefined'
    )) as { result: { prompts: Array<{ name: string }> } } | undefined;

    const promptNames = (promptList?.result.prompts ?? []).map((prompt) => prompt.name);
    expect(promptNames).toContain('project_standards');
    expect(promptNames).toContain('appendo_agent_brief');
  });
});
