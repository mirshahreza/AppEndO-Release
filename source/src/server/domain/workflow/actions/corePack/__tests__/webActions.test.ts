import { describe, expect, it, beforeEach } from 'vitest';
import { registerCoreActionPack } from '../index';
import { __resetActionRegistryForTests, getActionDefinition, resolveExactProvider } from '../../registry';
import {
  WEB_FETCH_URL_ACTION_KEY,
  WEB_SCREENSHOT_URL_ACTION_KEY,
  WEB_SEARCH_ACTION_KEY,
  webFetchUrlExecutor,
  webScreenshotUrlExecutor,
  webSearchExecutor,
} from '../webActions';

const fakeContext = {
  workflowInstanceId: 'i1',
  nodeInstanceId: 'n1',
  logicalInvocationId: 'l1',
  idempotencyKey: 'k1',
  effectiveIdentity: { type: 'SYSTEM' as const, id: null },
  cancellationSignal: new AbortController().signal,
  resolveSecret: async () => 'secret',
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  writeTraceMetadata: () => {},
};

describe('web workflow actions', () => {
  beforeEach(() => {
    __resetActionRegistryForTests();
    registerCoreActionPack();
  });

  it('registers search, fetch, and screenshot as AVAILABLE core providers', () => {
    for (const key of [WEB_SEARCH_ACTION_KEY, WEB_FETCH_URL_ACTION_KEY, WEB_SCREENSHOT_URL_ACTION_KEY]) {
      expect(getActionDefinition(key, '1')?.definition.availability).toBe('AVAILABLE');
      expect(() => resolveExactProvider(key, '1', 'core', '1')).not.toThrow();
    }
  });

  it('web.search fails validation when query is missing', async () => {
    const result = await webSearchExecutor.execute(fakeContext, {}, {});
    expect(result).toMatchObject({ status: 'FAILED', errorCode: 'MISSING_QUERY', errorClass: 'VALIDATION' });
  });

  it('web.fetch-url blocks localhost URLs', async () => {
    const result = await webFetchUrlExecutor.execute(fakeContext, {}, { url: 'http://localhost/secret' });
    expect(result).toMatchObject({ status: 'FAILED', errorCode: 'URL_BLOCKED', errorClass: 'SSRF_BLOCKED' });
  });

  it('web.screenshot-url blocks localhost URLs', async () => {
    const result = await webScreenshotUrlExecutor.execute(fakeContext, {}, { url: 'http://127.0.0.1/secret' });
    expect(result).toMatchObject({ status: 'FAILED', errorCode: 'URL_BLOCKED', errorClass: 'SSRF_BLOCKED' });
  });
});
