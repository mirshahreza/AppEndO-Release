import { aiManager } from '../../../../../core/ai/AiManager';
import { DEFAULT_AI_WEB_SEARCH_SETTINGS } from '../../../../../shared/api/contracts/ai/constants';
import {
  executeFetchUrl,
  executeWebSearch,
  type WebToolsDeps,
} from '../../../../services/ai/mcp/builtin/webTools';
import { executeScreenshotUrl } from '../../../../services/ai/mcp/builtin/webScreenshot';
import type { JsonValue } from '../../awm/types';
import type { ActionDefinition, ActionExecutionResult, ActionExecutor } from '../types';

export const WEB_SEARCH_ACTION_KEY = 'web.search';
export const WEB_FETCH_URL_ACTION_KEY = 'web.fetch-url';
export const WEB_SCREENSHOT_URL_ACTION_KEY = 'web.screenshot-url';

const inlineSchema = (schema: JsonValue = {}) => ({ type: 'INLINE' as const, schema });

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const VALIDATION_ERRORS = new Set([
  'missing_query',
  'missing_url',
  'query_too_long',
  'web_search_disabled',
  'missing_api_key',
  'type_not_supported',
]);

const defaultWebDeps = (): WebToolsDeps => ({
  getWebSearchSettings: () => aiManager.getSettings()?.webSearch ?? DEFAULT_AI_WEB_SEARCH_SETTINGS,
});

const toActionResult = (
  result: { ok: true; data: unknown } | { ok: false; summary: string; error: string },
): ActionExecutionResult => {
  if (result.ok) {
    return { status: 'SUCCEEDED', output: result.data as JsonValue };
  }
  const errorClass = VALIDATION_ERRORS.has(result.error)
    ? 'VALIDATION'
    : result.error === 'url_blocked'
      ? 'SSRF_BLOCKED'
      : 'EXTERNAL_ERROR';
  return {
    status: 'FAILED',
    errorCode: result.error.replace(/-/g, '_').toUpperCase(),
    errorClass,
    safeMessage: result.summary,
  };
};

export const webSearchDefinition: ActionDefinition = {
  key: WEB_SEARCH_ACTION_KEY,
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      query: { type: 'string', title: 'Query', description: 'Search query. Use site:example.com to restrict to one host.' },
      type: { type: 'string', title: 'Type', enum: ['web', 'news', 'images'], default: 'web', description: 'Result kind.' },
      maxResults: { type: 'number', title: 'Max results', description: 'Maximum number of results (1–20, default from settings).' },
    },
    required: ['query'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      type: { type: 'string' },
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            url: { type: 'string' },
            snippet: { type: 'string' },
          },
        },
      },
    },
  }),
  executionTimeoutMs: 30000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'READ_EXTERNAL',
  riskClass: 'MEDIUM',
  requiredCapabilities: ['web.search'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['web', 'search'],
};

export const webFetchUrlDefinition: ActionDefinition = {
  key: WEB_FETCH_URL_ACTION_KEY,
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      url: { type: 'string', format: 'uri', title: 'URL', description: 'Absolute http or https URL to fetch.' },
      format: {
        type: 'string',
        title: 'Format',
        enum: ['markdown', 'text', 'html'],
        default: 'markdown',
        description: 'Response shaping. Markdown is the readable default.',
      },
    },
    required: ['url'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      url: { type: 'string' },
      status: { type: 'number' },
      contentType: { type: 'string' },
      format: { type: 'string' },
      truncated: { type: 'boolean' },
      body: { type: 'string', title: 'Page body' },
    },
  }),
  executionTimeoutMs: 30000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'READ_EXTERNAL',
  riskClass: 'MEDIUM',
  requiredCapabilities: ['integration.http'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['web', 'fetch'],
};

export const webScreenshotUrlDefinition: ActionDefinition = {
  key: WEB_SCREENSHOT_URL_ACTION_KEY,
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      url: { type: 'string', format: 'uri', title: 'URL', description: 'Absolute http or https URL to capture.' },
      fullPage: { type: 'boolean', title: 'Full page', default: false, description: 'When true, capture the full scrollable page.' },
      waitUntil: {
        type: 'string',
        title: 'Wait until',
        enum: ['load', 'domcontentloaded', 'networkidle'],
        default: 'load',
      },
      width: { type: 'number', title: 'Width', description: 'Viewport width in pixels (320–1920, default 1280).' },
      height: { type: 'number', title: 'Height', description: 'Viewport height in pixels (320–1200, default 720).' },
    },
    required: ['url'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      url: { type: 'string' },
      finalUrl: { type: 'string' },
      mimeType: { type: 'string' },
      byteLength: { type: 'number' },
      fullPage: { type: 'boolean' },
      width: { type: 'number' },
      height: { type: 'number' },
      waitUntil: { type: 'string' },
      imageBase64: { type: 'string', title: 'JPEG (base64)' },
    },
  }),
  executionTimeoutMs: 30000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'READ_EXTERNAL',
  riskClass: 'MEDIUM',
  requiredCapabilities: ['web.screenshot'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['web', 'screenshot'],
};

export const webSearchExecutor: ActionExecutor = {
  async execute(context, _config, input) {
    const result = await executeWebSearch(asRecord(input), defaultWebDeps());
    if (result.ok) {
      context.writeTraceMetadata({ type: 'WEB_SEARCH_RESULT', payload: { type: result.data.type, count: result.data.results.length } });
    }
    return toActionResult(result);
  },
};

export const webFetchUrlExecutor: ActionExecutor = {
  async execute(context, _config, input) {
    const result = await executeFetchUrl(asRecord(input), defaultWebDeps());
    if (result.ok) {
      context.writeTraceMetadata({
        type: 'WEB_FETCH_URL_RESULT',
        payload: {
          status: typeof result.data.status === 'number' ? result.data.status : 0,
          format: typeof result.data.format === 'string' ? result.data.format : 'markdown',
        },
      });
    }
    return toActionResult(result);
  },
};

export const webScreenshotUrlExecutor: ActionExecutor = {
  async execute(context, _config, input) {
    const result = await executeScreenshotUrl(asRecord(input));
    if (result.ok) {
      context.writeTraceMetadata({
        type: 'WEB_SCREENSHOT_URL_RESULT',
        payload: {
          byteLength: typeof result.data.byteLength === 'number' ? result.data.byteLength : 0,
          fullPage: result.data.fullPage === true,
        },
      });
    }
    return toActionResult(result);
  },
};
