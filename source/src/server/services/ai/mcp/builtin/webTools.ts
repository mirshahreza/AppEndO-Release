import type { NativeToolDefinition } from '../../../../../core/ai/tools/ToolRegistry';
import type { AiWebSearchSettings } from '../../../../../shared/api/contracts/ai/types';
import { createSsrfGuardedFetch, validateMcpRemoteUrl } from '../mcpUrlGuard';
import { formatFetchedBody, resolveFetchUrlFormat } from './htmlToReadableMarkdown';
import { executeScreenshotUrl, SCREENSHOT_URL_TOOL_NAME } from './webScreenshot';

export const WEB_SEARCH_TOOL_NAME = 'web_search';
export const FETCH_URL_TOOL_NAME = 'fetch_url';
export { SCREENSHOT_URL_TOOL_NAME };

export const FETCH_URL_TIMEOUT_MS = 30_000;
export const FETCH_URL_MAX_BYTES = 256_000;

export type WebSearchType = 'web' | 'news' | 'images';

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export type WebToolsDeps = {
  getWebSearchSettings: () => AiWebSearchSettings;
  fetchImpl?: typeof fetch;
  validateUrl?: typeof validateMcpRemoteUrl;
  screenshotImpl?: typeof executeScreenshotUrl;
};

const WEB_SEARCH_TYPES: readonly WebSearchType[] = ['web', 'news', 'images'];

const resolveSearchType = (raw: unknown): WebSearchType => {
  if (typeof raw === 'string' && (WEB_SEARCH_TYPES as readonly string[]).includes(raw.trim().toLowerCase())) {
    return raw.trim().toLowerCase() as WebSearchType;
  }
  return 'web';
};

const truncateBody = (body: string): { text: string; truncated: boolean } => {
  if (Buffer.byteLength(body, 'utf8') <= FETCH_URL_MAX_BYTES) {
    return { text: body, truncated: false };
  }

  let truncated = body;
  while (truncated.length > 0 && Buffer.byteLength(truncated, 'utf8') > FETCH_URL_MAX_BYTES) {
    truncated = truncated.slice(0, Math.floor(truncated.length * 0.9));
  }

  return { text: `${truncated}\n… [content truncated]`, truncated: true };
};

const resolveMaxResults = (
  args: Record<string, unknown>,
  settings: AiWebSearchSettings,
): number => {
  const fromArgs = typeof args.maxResults === 'number' && args.maxResults > 0
    ? Math.floor(args.maxResults)
    : undefined;
  const configured = settings.maxResults ?? 5;
  return Math.min(fromArgs ?? configured, 20);
};

const mapSearchRecord = (record: Record<string, unknown>, urlKeys: string[], snippetKeys: string[]): WebSearchResult | null => {
  const title = typeof record.title === 'string' ? record.title.trim() : '';
  const url = urlKeys
    .map((key) => (typeof record[key] === 'string' ? String(record[key]).trim() : ''))
    .find((value) => value.length > 0) ?? '';
  const snippet = snippetKeys
    .map((key) => (typeof record[key] === 'string' ? String(record[key]).trim() : ''))
    .find((value) => value.length > 0) ?? '';
  if (!title || !url) return null;
  return { title, url, snippet };
};

const parseResultList = (items: unknown, urlKeys: string[], snippetKeys: string[]): WebSearchResult[] => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const nestedUrl = record.properties && typeof record.properties === 'object'
        ? (record.properties as Record<string, unknown>).url
        : undefined;
      return mapSearchRecord(
        { ...record, ...(typeof nestedUrl === 'string' ? { nestedUrl } : {}) },
        [...urlKeys, 'nestedUrl'],
        snippetKeys,
      );
    })
    .filter((item): item is WebSearchResult => item !== null);
};

const parseBraveResults = (payload: unknown, type: WebSearchType): WebSearchResult[] => {
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as { web?: { results?: unknown[] }; results?: unknown[] };
  if (type === 'web') return parseResultList(record.web?.results, ['url'], ['description']);
  return parseResultList(record.results, ['url'], ['description']);
};

const parseTavilyResults = (payload: unknown): WebSearchResult[] => {
  if (!payload || typeof payload !== 'object') return [];
  return parseResultList((payload as { results?: unknown[] }).results, ['url'], ['content']);
};

const parseSerperResults = (payload: unknown, type: WebSearchType): WebSearchResult[] => {
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as { organic?: unknown[]; news?: unknown[]; images?: unknown[] };
  if (type === 'news') return parseResultList(record.news, ['link'], ['snippet']);
  if (type === 'images') return parseResultList(record.images, ['imageUrl', 'link'], ['title']);
  return parseResultList(record.organic, ['link'], ['snippet']);
};

export const executeWebSearch = async (
  args: Record<string, unknown>,
  deps: WebToolsDeps,
): Promise<{ ok: true; summary: string; data: { type: WebSearchType; results: WebSearchResult[] } } | { ok: false; summary: string; error: string }> => {
  const query = typeof args.query === 'string' ? args.query.trim() : '';
  if (!query) {
    return { ok: false, summary: 'Search query is required.', error: 'missing_query' };
  }
  if (query.length > 500) {
    return { ok: false, summary: 'Search query is too long (max 500 characters).', error: 'query_too_long' };
  }

  const settings = deps.getWebSearchSettings();
  if (settings.provider === 'disabled') {
    return {
      ok: false,
      summary: 'Web search is disabled. Configure a provider in Settings → MCP Servers.',
      error: 'web_search_disabled',
    };
  }

  const apiKey = settings.apiKey?.trim();
  if (!apiKey) {
    return {
      ok: false,
      summary: 'Web search API key is not configured.',
      error: 'missing_api_key',
    };
  }

  const searchType = resolveSearchType(args.type);
  if (settings.provider === 'tavily' && searchType === 'images') {
    return {
      ok: false,
      summary: 'Tavily does not support image search. Use type "web" or "news", or switch provider.',
      error: 'type_not_supported',
    };
  }

  const maxResults = resolveMaxResults(args, settings);
  const fetchImpl = deps.fetchImpl ?? fetch;

  try {
    let results: WebSearchResult[] = [];

    if (settings.provider === 'brave') {
      const path = searchType === 'news'
        ? 'https://api.search.brave.com/res/v1/news/search'
        : searchType === 'images'
          ? 'https://api.search.brave.com/res/v1/images/search'
          : 'https://api.search.brave.com/res/v1/web/search';
      const url = new URL(path);
      url.searchParams.set('q', query);
      url.searchParams.set('count', String(maxResults));

      const response = await fetchImpl(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': apiKey,
        },
        signal: AbortSignal.timeout(FETCH_URL_TIMEOUT_MS),
      });

      if (!response.ok) {
        return {
          ok: false,
          summary: `Brave search failed (HTTP ${response.status}).`,
          error: 'provider_error',
        };
      }

      results = parseBraveResults(await response.json(), searchType);
    } else if (settings.provider === 'tavily') {
      const response = await fetchImpl('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          max_results: maxResults,
          topic: searchType === 'news' ? 'news' : 'general',
        }),
        signal: AbortSignal.timeout(FETCH_URL_TIMEOUT_MS),
      });

      if (!response.ok) {
        return {
          ok: false,
          summary: `Tavily search failed (HTTP ${response.status}).`,
          error: 'provider_error',
        };
      }

      results = parseTavilyResults(await response.json());
    } else if (settings.provider === 'serper') {
      const endpoint = searchType === 'news'
        ? 'https://google.serper.dev/news'
        : searchType === 'images'
          ? 'https://google.serper.dev/images'
          : 'https://google.serper.dev/search';
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey,
        },
        body: JSON.stringify({
          q: query,
          num: maxResults,
        }),
        signal: AbortSignal.timeout(FETCH_URL_TIMEOUT_MS),
      });

      if (!response.ok) {
        return {
          ok: false,
          summary: `Serper search failed (HTTP ${response.status}).`,
          error: 'provider_error',
        };
      }

      results = parseSerperResults(await response.json(), searchType);
    }

    const limited = results.slice(0, maxResults);
    return {
      ok: true,
      summary: `Found ${limited.length} ${searchType} result(s) for "${query}".`,
      data: { type: searchType, results: limited },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      summary: `Web search failed: ${message}`,
      error: 'provider_error',
    };
  }
};

export const executeFetchUrl = async (
  args: Record<string, unknown>,
  deps: WebToolsDeps,
): Promise<{ ok: true; summary: string; data: Record<string, unknown> } | { ok: false; summary: string; error: string }> => {
  const urlInput = typeof args.url === 'string' ? args.url.trim() : '';
  if (!urlInput) {
    return { ok: false, summary: 'URL is required.', error: 'missing_url' };
  }

  const format = resolveFetchUrlFormat(args.format);
  const validateUrl = deps.validateUrl ?? validateMcpRemoteUrl;
  const fetchImpl = deps.fetchImpl ?? createSsrfGuardedFetch();

  let validatedUrl: URL;
  try {
    validatedUrl = await validateUrl(urlInput);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, summary: message, error: 'url_blocked' };
  }

  try {
    const response = await fetchImpl(validatedUrl.toString(), {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml,text/plain,application/json;q=0.9,*/*;q=0.8',
        'User-Agent': 'AppEndO-Agent/1.0',
      },
      signal: AbortSignal.timeout(FETCH_URL_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        ok: false,
        summary: `Fetch failed (HTTP ${response.status}).`,
        error: 'fetch_failed',
      };
    }

    const contentType = response.headers.get('content-type') ?? 'unknown';
    const rawBody = await response.text();
    const formatted = formatFetchedBody(rawBody, contentType, format);
    const { text, truncated } = truncateBody(formatted);

    return {
      ok: true,
      summary: truncated
        ? `Fetched ${validatedUrl.hostname} as ${format} (truncated).`
        : `Fetched ${validatedUrl.hostname} as ${format}.`,
      data: {
        url: validatedUrl.toString(),
        status: response.status,
        contentType,
        format,
        truncated,
        body: text,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      summary: `Fetch failed: ${message}`,
      error: 'fetch_failed',
    };
  }
};

export const createWebTools = (deps: WebToolsDeps): NativeToolDefinition[] => [
  {
    name: WEB_SEARCH_TOOL_NAME,
    description: 'Search the public web using the configured provider (Brave, Tavily, or Serper). Returns titles, URLs, and snippets. Optional type: web (default), news, or images.',
    group: 'search',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query. Use site:example.com to restrict to one host.',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results (1–20, default from settings).',
        },
        type: {
          type: 'string',
          description: 'Result kind: web (default), news, or images.',
        },
      },
      required: ['query'],
    },
    execute: async (args) => executeWebSearch(args, deps),
  },
  {
    name: FETCH_URL_TOOL_NAME,
    description: 'Fetch a public HTTP/HTTPS URL and return readable page text. Default format is markdown (HTML stripped). SSRF-protected — loopback and private addresses are blocked.',
    group: 'search',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Absolute http or https URL to fetch.',
        },
        format: {
          type: 'string',
          description: 'Response shaping: markdown (default), text, or html.',
        },
      },
      required: ['url'],
    },
    execute: async (args) => executeFetchUrl(args, deps),
  },
  {
    name: SCREENSHOT_URL_TOOL_NAME,
    description: 'Take a screenshot of a public HTTP/HTTPS URL in a headless browser. SSRF-protected. Returns JPEG metadata plus base64 (omitted from the LLM preview).',
    group: 'search',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Absolute http or https URL to capture.',
        },
        fullPage: {
          type: 'boolean',
          description: 'When true, capture the full scrollable page. Default false (viewport only).',
        },
        waitUntil: {
          type: 'string',
          description: 'Playwright waitUntil: load (default), domcontentloaded, or networkidle.',
        },
        width: {
          type: 'number',
          description: 'Viewport width in pixels (320–1920, default 1280).',
        },
        height: {
          type: 'number',
          description: 'Viewport height in pixels (320–1200, default 720).',
        },
      },
      required: ['url'],
    },
    execute: async (args) => {
      const screenshot = deps.screenshotImpl ?? executeScreenshotUrl;
      return screenshot(args, deps);
    },
  },
];
