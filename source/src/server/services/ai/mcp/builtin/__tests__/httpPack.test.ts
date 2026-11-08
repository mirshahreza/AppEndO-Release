import { describe, expect, it, vi } from 'vitest';
import { aiManager } from '../../../../../../core/ai/AiManager';
import { createPhase1ToolRegistry } from '../../../../../../core/ai/tools/ToolRegistry';
import { redactHttpRequestArgsForTrace } from '../../../../../../core/ai/tools/httpRequestTool';
import { getAiCapabilityPack } from '../../../../../../shared/api/contracts/ai/capabilityPacks';
import { DEFAULT_AI_HTTP_SETTINGS, DEFAULT_AI_SETTINGS } from '../../../../../../shared/api/contracts/ai/constants';
import { registerBuiltinCapabilityPacks } from '../index';
import {
  executeHttpRequest,
  HTTP_REQUEST_TOOL_NAME,
  isHostnameAllowlisted,
} from '../httpTools';

describe('appendo-http pack', () => {
  it('registers http pack tools when appendo-http is enabled', () => {
    const registry = createPhase1ToolRegistry('agent', ['read', 'search', 'git', 'draft']);
    registerBuiltinCapabilityPacks(registry, ['appendo-http']);

    const names = registry.listDefinitions().map((tool) => tool.name);
    getAiCapabilityPack('appendo-http').toolNames.forEach((name) => {
      expect(names).toContain(name);
    });
  });

  it('isHostnameAllowlisted matches exact hostnames only', () => {
    expect(isHostnameAllowlisted('api.example.com', ['api.example.com'])).toBe(true);
    expect(isHostnameAllowlisted('API.EXAMPLE.COM', ['api.example.com'])).toBe(true);
    expect(isHostnameAllowlisted('evil.example.com', ['api.example.com'])).toBe(false);
  });

  it('http_request blocks localhost URLs', async () => {
    const result = await executeHttpRequest(
      { url: 'http://localhost/secret' },
      {
        getHttpSettings: () => ({
          allowedHostnames: ['localhost'],
        }),
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('url_blocked');
    }
  });

  it('http_request blocks loopback IP addresses', async () => {
    const result = await executeHttpRequest(
      { url: 'http://127.0.0.1/admin' },
      {
        getHttpSettings: () => ({
          allowedHostnames: ['127.0.0.1'],
        }),
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('url_blocked');
    }
  });

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
    if (!result.ok) {
      expect(result.error).toBe('hostname_not_allowlisted');
    }
  });

  it('http_request fails when allowlist is empty', async () => {
    const registry = createPhase1ToolRegistry('agent', ['read', 'search', 'git', 'draft']);
    registerBuiltinCapabilityPacks(registry, ['appendo-http']);

    const result = await registry.execute(
      HTTP_REQUEST_TOOL_NAME,
      { url: 'https://api.example.com/v1' },
      {},
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('http_allowlist_empty');
    }
  });

  it('http_request calls allowlisted hosts with mocked fetch', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
        forEach: (callback: (value: string, key: string) => void) => {
          callback('application/json', 'content-type');
          callback('Bearer secret', 'authorization');
        },
      },
      text: async () => '{"ok":true}',
    });

    const result = await executeHttpRequest(
      {
        method: 'POST',
        url: 'https://api.example.com/v1/items',
        headers: { Authorization: 'Bearer agent-token' },
        body: '{"name":"test"}',
      },
      {
        getHttpSettings: () => ({
          allowedHostnames: ['api.example.com'],
        }),
        validateUrl: async (urlString) => new URL(urlString),
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe(200);
      expect(result.data.body).toBe('{"ok":true}');
      expect(result.data.headers).toEqual({
        'content-type': 'application/json',
        authorization: '[REDACTED]',
      });
    }

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer agent-token');
  });

  it('redacts Authorization headers in trace args', () => {
    const redacted = redactHttpRequestArgsForTrace({
      url: 'https://api.example.com',
      headers: {
        Authorization: 'Bearer secret',
        Accept: 'application/json',
      },
    });

    expect(redacted.headers).toEqual({
      Authorization: '[REDACTED]',
      Accept: 'application/json',
    });
  });

  it('executes http_request through registry with SSRF block', async () => {
    aiManager.reloadFromSettings({
      ...DEFAULT_AI_SETTINGS,
      http: { allowedHostnames: ['127.0.0.1'] },
    });

    const registry = createPhase1ToolRegistry('agent', ['read', 'search', 'git', 'draft']);
    registerBuiltinCapabilityPacks(registry, ['appendo-http']);

    const result = await registry.execute(
      HTTP_REQUEST_TOOL_NAME,
      {
        url: 'http://127.0.0.1/private',
        headers: { Authorization: 'Bearer x' },
      },
      {},
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('url_blocked');
    }
  });

  it('uses default empty allowlist settings', async () => {
    const result = await executeHttpRequest(
      { url: 'https://api.example.com' },
      { getHttpSettings: () => DEFAULT_AI_HTTP_SETTINGS },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('http_allowlist_empty');
    }
  });
});
