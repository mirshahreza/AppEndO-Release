import { describe, expect, it } from 'vitest';
import { parseLogParts } from '../utils/parseLogParts';

describe('parseLogParts', () => {
  it('extracts key from query param key', () => {
    const parts = parseLogParts('HTTP', 'GET /api/cache/items?key=user:42');
    expect(parts.folder).toBe('cache');
    expect(parts.functionName).toBe('items');
    expect(parts.key).toBe('user:42');
  });

  it('falls back to cacheKey and id when key is absent', () => {
    const cacheKeyParts = parseLogParts('HTTP', 'POST /api/cache/invalidate?cacheKey=session_7');
    expect(cacheKeyParts.key).toBe('session_7');

    const idParts = parseLogParts('HTTP', 'GET /api/users/profile?id=99');
    expect(idParts.key).toBe('99');
  });

  it('returns key dash when message has no key query', () => {
    const parts = parseLogParts('HTTP', 'GET /health');
    expect(parts.folder).toBe('-');
    expect(parts.functionName).toBe('-');
    expect(parts.key).toBe('-');
  });

  it('infers key from dynamic path segment when query key is absent', () => {
    const parts = parseLogParts('HTTP', 'GET /api/cache/get/8665');
    expect(parts.folder).toBe('cache');
    expect(parts.functionName).toBe('get');
    expect(parts.key).toBe('8665');
  });

  it('does not treat api namespace as folder', () => {
    const parts = parseLogParts('HTTP', 'GET /api/auth/me');
    expect(parts.folder).toBe('auth');
    expect(parts.functionName).toBe('me');
    expect(parts.key).toBe('-');
  });

  it('maps /api/folder/:id to key and derives function name from HTTP method', () => {
    const parts = parseLogParts('HTTP', 'GET /api/logs/77');
    expect(parts.folder).toBe('logs');
    expect(parts.functionName).toBe('get');
    expect(parts.key).toBe('77');
  });

  it('derives root function name from HTTP method', () => {
    expect(parseLogParts('HTTP', 'GET /api/users').functionName).toBe('list');
    expect(parseLogParts('HTTP', 'POST /api/users').functionName).toBe('create');
    expect(parseLogParts('HTTP', 'DELETE /api/logs').functionName).toBe('delete');
  });

  it('extracts leading id segment before nested function path', () => {
    const parts = parseLogParts('HTTP', 'POST /api/users/5/change-password');
    expect(parts.folder).toBe('users');
    expect(parts.functionName).toBe('change-password');
    expect(parts.key).toBe('5');
  });

  it('ignores context fallback mode when message is empty', () => {
    const parts = parseLogParts('Cache.Manager', '');
    expect(parts.folder).toBe('-');
    expect(parts.functionName).toBe('-');
    expect(parts.key).toBe('-');
  });
});
