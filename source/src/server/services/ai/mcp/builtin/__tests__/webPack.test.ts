import { describe, expect, it, vi } from 'vitest';
import { createPhase1ToolRegistry } from '../../../../../../core/ai/tools/ToolRegistry';
import { getAiCapabilityPack } from '../../../../../../shared/api/contracts/ai/capabilityPacks';
import { DEFAULT_AI_WEB_SEARCH_SETTINGS } from '../../../../../../shared/api/contracts/ai/constants';
import { registerBuiltinCapabilityPacks } from '../index';
import {
  executeFetchUrl,
  executeWebSearch,
  FETCH_URL_TOOL_NAME,
  SCREENSHOT_URL_TOOL_NAME,
  WEB_SEARCH_TOOL_NAME,
} from '../webTools';
import { executeScreenshotUrl } from '../webScreenshot';

describe('appendo-web pack', () => {
  it('registers web pack tools when appendo-web is enabled', () => {
    const registry = createPhase1ToolRegistry('agent', ['read', 'search', 'git', 'draft']);
    registerBuiltinCapabilityPacks(registry, ['appendo-web']);

    const names = registry.listDefinitions().map((tool) => tool.name);
    getAiCapabilityPack('appendo-web').toolNames.forEach((name) => {
      expect(names).toContain(name);
    });
  });

  it('fetch_url blocks localhost URLs', async () => {
    const result = await executeFetchUrl(
      { url: 'http://localhost/secret' },
      { getWebSearchSettings: () => DEFAULT_AI_WEB_SEARCH_SETTINGS },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('url_blocked');
    }
  });

  it('fetch_url blocks loopback IP addresses', async () => {
    const result = await executeFetchUrl(
      { url: 'http://127.0.0.1/admin' },
      { getWebSearchSettings: () => DEFAULT_AI_WEB_SEARCH_SETTINGS },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('url_blocked');
    }
  });

  it('web_search fails when provider is disabled', async () => {
    const registry = createPhase1ToolRegistry('agent', ['read', 'search', 'git', 'draft']);
    registerBuiltinCapabilityPacks(registry, ['appendo-web']);

    const result = await registry.execute(WEB_SEARCH_TOOL_NAME, { query: 'vitest testing' }, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('web_search_disabled');
    }
  });

  it('web_search returns provider results with mocked Brave API', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        web: {
          results: [
            {
              title: 'Vitest',
              url: 'https://vitest.dev/',
              description: 'Next generation testing framework',
            },
          ],
        },
      }),
    });

    const result = await executeWebSearch(
      { query: 'vitest' },
      {
        getWebSearchSettings: () => ({
          provider: 'brave',
          apiKey: 'test-key',
          maxResults: 3,
        }),
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.results).toHaveLength(1);
      expect(result.data.results[0]?.url).toBe('https://vitest.dev/');
    }

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [calledUrl, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain('api.search.brave.com');
    expect((init.headers as Record<string, string>)['X-Subscription-Token']).toBe('test-key');
  });

  it('fetch_url fetches allowlisted public URLs with mocked fetch', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/plain' : null),
      },
      text: async () => 'Hello from example.com',
    });

    const result = await executeFetchUrl(
      { url: 'https://example.com/page' },
      {
        getWebSearchSettings: () => DEFAULT_AI_WEB_SEARCH_SETTINGS,
        validateUrl: async (urlString) => new URL(urlString),
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.body).toBe('Hello from example.com');
      expect(result.data.url).toBe('https://example.com/page');
      expect(result.data.format).toBe('markdown');
    }
  });

  it('fetch_url converts HTML to markdown by default', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null),
      },
      text: async () => '<html><body><h1>Hello</h1><p>World</p></body></html>',
    });

    const result = await executeFetchUrl(
      { url: 'https://example.com/page' },
      {
        getWebSearchSettings: () => DEFAULT_AI_WEB_SEARCH_SETTINGS,
        validateUrl: async (urlString) => new URL(urlString),
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.format).toBe('markdown');
      expect(String(result.data.body)).toContain('# Hello');
      expect(String(result.data.body)).toContain('World');
      expect(String(result.data.body)).not.toContain('<h1>');
    }
  });

  it('web_search type=news hits the Brave news endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        results: [{ title: 'News', url: 'https://example.com/n', description: 'Headline' }],
      }),
    });

    const result = await executeWebSearch(
      { query: 'vitest', type: 'news' },
      {
        getWebSearchSettings: () => ({
          provider: 'brave',
          apiKey: 'test-key',
          maxResults: 3,
        }),
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.type).toBe('news');
      expect(result.data.results[0]?.url).toBe('https://example.com/n');
    }
    const [calledUrl] = fetchImpl.mock.calls[0] as [string];
    expect(calledUrl).toContain('/news/search');
  });

  it('screenshot_url blocks localhost URLs', async () => {
    const result = await executeScreenshotUrl({ url: 'http://localhost/secret' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('url_blocked');
    }
  });

  it('screenshot_url returns JPEG metadata from an injected capturer', async () => {
    const result = await executeScreenshotUrl(
      { url: 'https://example.com/page', fullPage: true },
      {
        validateUrl: async (urlString) => new URL(urlString),
        captureImpl: async ({ url, fullPage }) => ({
          buffer: Buffer.from('fake-jpeg'),
          finalUrl: url,
          ...(fullPage ? {} : {}),
        }),
      },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.mimeType).toBe('image/jpeg');
      expect(result.data.fullPage).toBe(true);
      expect(result.data.imageBase64).toBe(Buffer.from('fake-jpeg').toString('base64'));
      expect(result.summary).toContain('example.com');
    }
  });

  it('registers screenshot_url on the appendo-web pack', () => {
    const registry = createPhase1ToolRegistry('agent', ['read', 'search', 'git', 'draft']);
    registerBuiltinCapabilityPacks(registry, ['appendo-web']);
    expect(registry.listDefinitions().map((tool) => tool.name)).toContain(SCREENSHOT_URL_TOOL_NAME);
  });

  it('executes fetch_url through registry', async () => {
    const registry = createPhase1ToolRegistry('agent', ['read', 'search', 'git', 'draft']);
    registerBuiltinCapabilityPacks(registry, ['appendo-web']);

    const result = await registry.execute(
      FETCH_URL_TOOL_NAME,
      { url: 'http://127.0.0.1/private' },
      {},
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('url_blocked');
    }
  });
});
