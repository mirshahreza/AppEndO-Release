import { describe, expect, it } from 'vitest';
import type { ServerFunctionItem } from '../../../../shared/api/contracts/server-functions/types';
import {
  filterServerFunctionsForInternalApi,
  resolveServerFunctionSample,
  serverFunctionDocSummary,
} from '../internalApiCallFormUtils';

const fn = (overrides: Partial<ServerFunctionItem> & Pick<ServerFunctionItem, 'id'>): ServerFunctionItem => ({
  name: overrides.name ?? overrides.id,
  folder: 'math',
  method: 'POST',
  path: `/api/${overrides.id}`,
  code: '',
  testPayload: '{}',
  memoryLimit: 128,
  timeoutMs: 1500,
  runtimeVersion: 'v20.x',
  useGlobalConfig: true,
  enableLogs: false,
  accessControl: { allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
  ...overrides,
});

describe('internal API call form helpers', () => {
  it('searches id, path, tags, and documentation text', () => {
    const catalog = [
      fn({
        id: 'math.sum-two-numbers',
        metadataJson: {
          apiDoc: { summary: 'Add two numbers', description: 'Returns the sum.' },
          catalogTags: ['calculator'],
        },
      }),
      fn({ id: 'cms.content-list', path: '/api/cms/contents', method: 'GET' }),
    ];

    expect(filterServerFunctionsForInternalApi(catalog, 'sum').map((item) => item.id)).toEqual(['math.sum-two-numbers']);
    expect(filterServerFunctionsForInternalApi(catalog, 'returns the sum').map((item) => item.id)).toEqual(['math.sum-two-numbers']);
    expect(filterServerFunctionsForInternalApi(catalog, 'calculator').map((item) => item.id)).toEqual(['math.sum-two-numbers']);
    expect(filterServerFunctionsForInternalApi(catalog, 'GET /api/cms').map((item) => item.id)).toEqual(['cms.content-list']);
  });

  it('prefers the stored test payload sample, then the derived request example', () => {
    expect(resolveServerFunctionSample(fn({
      id: 'math.sum-two-numbers',
      testPayload: '{"a":1,"b":2}',
    }))).toEqual({ a: 1, b: 2 });

    expect(resolveServerFunctionSample(fn({
      id: 'users.get',
      testPayload: '',
      metadataJson: {
        derived: {
          codeFingerprint: 'x',
          generatedAt: '2026-01-01T00:00:00.000Z',
          requestExample: { params: { id: '7' }, query: {}, body: {} },
          docHints: { validationFields: [], outputFields: [], queryFields: [], paramFields: [] },
        },
      },
    }))).toEqual({ params: { id: '7' } });
  });

  it('reads the documentation summary for the selected function', () => {
    expect(serverFunctionDocSummary(fn({
      id: 'math.sum-two-numbers',
      metadataJson: { apiDoc: { summary: 'Add two numbers' } },
    }))).toBe('Add two numbers');
  });
});
