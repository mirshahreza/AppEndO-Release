import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchReusableComponentCatalog,
  fetchSystemComponentCatalog,
  runComponentDesignerRuntimePreview,
  syncComponentDesignerCodeToCanvas,
} from '../../../shared/api/queries/component-designer';
import { createInitialDesignerState } from '../../../domain/component-designer/state';
import type { DesignerDiagnostic } from '../../../domain/component-designer/types';

const createJsonResponse = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });

describe('component designer API integration wrappers', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('syncComponentDesignerCodeToCanvas returns parsed document when server responds success', async () => {
    const state = createInitialDesignerState();

    fetchMock.mockResolvedValue(
      createJsonResponse(200, {
        success: true,
        document: state.document,
        bindingDefinitions: state.bindingDefinitions,
      }),
    );

    const response = await syncComponentDesignerCodeToCanvas({
      format: 'json',
      code: JSON.stringify({ document: state.document, bindingDefinitions: state.bindingDefinitions }),
    });

    expect(response.success).toBe(true);
    if (response.success) {
      expect(response.document.rootNodeId).toBe(state.document.rootNodeId);
      expect(response.bindingDefinitions.definitions.defaultVisibility?.sourceType).toBe('static');
    }
  });

  it('syncComponentDesignerCodeToCanvas returns diagnostics on multi-status response', async () => {
    const diagnostics: DesignerDiagnostic[] = [
      {
        id: 'parse-json:1',
        code: 'parse-json',
        level: 'error',
        message: 'Invalid JSON payload.',
      },
    ];

    fetchMock.mockResolvedValue(
      createJsonResponse(207, {
        success: false,
        diagnostics,
      }),
    );

    const response = await syncComponentDesignerCodeToCanvas({
      format: 'json',
      code: '{broken json',
    });

    expect(response.success).toBe(false);
    if ('diagnostics' in response) {
      expect(response.diagnostics).toHaveLength(1);
      expect(response.diagnostics[0].code).toBe('parse-json');
    }
  });

  it('syncComponentDesignerCodeToCanvas throws on non-ok server response', async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse(500, {
        success: false,
        error: 'Failed to sync code to canvas.',
      }),
    );

    await expect(
      syncComponentDesignerCodeToCanvas({
        format: 'tsx',
        code: 'export const X = () => <div />;',
      }),
    ).rejects.toThrow('Failed to sync code to canvas.');
  });

  it('runComponentDesignerRuntimePreview returns runtime diagnostics and logs on success', async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse(200, {
        success: true,
        traceId: 'trace-1',
        results: {
          userName: 'alice',
        },
        diagnostics: [],
        logs: [
          {
            traceId: 'trace-1',
            sequence: 1,
            bindingKey: 'userName',
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            endpoint: '/api/users/me',
            method: 'GET',
            attempts: 1,
            ok: true,
            durationMs: 12,
          },
        ],
      }),
    );

    const response = await runComponentDesignerRuntimePreview({
      bindingDefinitions: {
        userName: {
          sourceType: 'apiRef',
          endpointRef: '/api/users/me',
        },
      },
    });

    expect(response.success).toBe(true);
    expect(response.traceId).toBe('trace-1');
    expect(response.logs).toHaveLength(1);
    expect(response.results.userName).toBe('alice');
  });

  it('runComponentDesignerRuntimePreview throws detailed error for failed response', async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse(500, {
        success: false,
        error: {
          code: 'preview-runtime-failed',
          message: 'Runtime execution failed.',
        },
      }),
    );

    await expect(
      runComponentDesignerRuntimePreview({
        bindingDefinitions: {},
      }),
    ).rejects.toThrow('Runtime execution failed.');
  });

  it('catalog fetch rejects non-JSON payloads with ApiError instead of masking as empty data', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<!doctype html><html></html>', { status: 502, statusText: 'Bad Gateway' }));
    fetchMock.mockResolvedValueOnce(new Response('<!doctype html><html></html>', { status: 502, statusText: 'Bad Gateway' }));

    await expect(fetchSystemComponentCatalog()).rejects.toMatchObject({
      name: 'ApiError',
      status: 502,
      isParseError: true,
    });
    await expect(fetchReusableComponentCatalog()).rejects.toMatchObject({
      name: 'ApiError',
      status: 502,
      isParseError: true,
    });
  });
});
