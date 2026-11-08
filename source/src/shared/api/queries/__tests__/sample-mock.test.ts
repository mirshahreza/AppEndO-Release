import { describe, expect, it } from 'vitest';
import { ApiError } from '../../client';
import { isSampleMockDemoFallback } from '../sample-mock';

describe('isSampleMockDemoFallback', () => {
  it('keeps 4xx on the live API so Confirm stays open', () => {
    expect(isSampleMockDemoFallback(new ApiError('A change reason is required.', {
      status: 400,
      statusText: 'Bad Request',
      bodySnippet: 'A change reason is required.',
      path: '/api/sample-mock/records/1',
    }))).toBe(false);
    expect(isSampleMockDemoFallback(new ApiError('Not found.', {
      status: 404,
      statusText: 'Not Found',
      bodySnippet: '',
      path: '/api/sample-mock/records/1',
    }))).toBe(false);
  });

  it('falls back to the in-memory demo on network and server failures', () => {
    expect(isSampleMockDemoFallback(new ApiError('Network error', {
      status: 0,
      statusText: 'Network error',
      bodySnippet: '',
      path: '/api/sample-mock/records/1',
    }))).toBe(true);
    expect(isSampleMockDemoFallback(new ApiError('Unavailable', {
      status: 503,
      statusText: 'Service Unavailable',
      bodySnippet: '',
      path: '/api/sample-mock/records/1',
    }))).toBe(true);
    expect(isSampleMockDemoFallback(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('does not treat abort as a demo fallback', () => {
    const abort = new Error('Aborted');
    abort.name = 'AbortError';
    expect(isSampleMockDemoFallback(abort)).toBe(false);
  });
});
