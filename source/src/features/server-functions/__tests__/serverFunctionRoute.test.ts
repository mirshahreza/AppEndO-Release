import { describe, expect, it } from 'vitest';
import type { ServerFunctionItem } from '../types';
import {
  buildServerFunctionEditRelativePath,
  buildServerFunctionEditSlug,
  buildServerFunctionListRelativePath,
  buildServerFunctionNewRelativePath,
  findServerFunctionByEditSlug,
  isHiddenServerFunctionEditSlug,
  parseServerFunctionEditSlug,
  resolveServerFunctionRouteSuffix,
  resolveServerFunctionItemLabelFromEditSlug,
  SERVER_FUNCTION_NEW_SLUG,
} from '../serverFunctionRoute';

const sampleFunctions: ServerFunctionItem[] = [
  {
    id: 'fn-auth-login',
    name: 'login',
    folder: 'auth',
    method: 'POST',
    path: '/api/auth/login',
    code: '',
    testPayload: '{}',
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    accessControl: { allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
  },
  {
    id: 'fn-hello',
    name: 'hello-world',
    folder: '',
    method: 'GET',
    path: '/api/hello-world',
    code: '',
    testPayload: '{}',
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    accessControl: { allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
  },
];

describe('serverFunctionRoute', () => {
  it('builds folder/name edit slugs with general fallback', () => {
    expect(buildServerFunctionEditSlug({ folder: 'auth', name: 'login' })).toBe('auth/login');
    expect(buildServerFunctionEditSlug({ folder: '', name: 'hello-world' })).toBe('general/hello-world');
  });

  it('strips application and server-functions route prefixes from splat suffixes', () => {
    expect(resolveServerFunctionRouteSuffix('studio/server-functions')).toBeUndefined();
    expect(resolveServerFunctionRouteSuffix('studio/server-functions/edit/auth/login')).toBe('auth/login');
    expect(resolveServerFunctionRouteSuffix('us/studio/server-functions/edit/auth/login')).toBe('auth/login');
    expect(resolveServerFunctionRouteSuffix('server-functions/edit/new')).toBe(SERVER_FUNCTION_NEW_SLUG);
    expect(resolveServerFunctionRouteSuffix('edit/auth/login')).toBe('auth/login');
    expect(resolveServerFunctionRouteSuffix('studio/server-functions/auth/login')).toBeUndefined();
  });

  it('parses edit slugs from nested path suffixes', () => {
    expect(parseServerFunctionEditSlug('studio/server-functions/edit/auth/login')).toBe('auth/login');
    expect(parseServerFunctionEditSlug(undefined)).toBeNull();
  });

  it('resolves functions by folder/name or id slug', () => {
    expect(findServerFunctionByEditSlug(sampleFunctions, 'auth/login')?.id).toBe('fn-auth-login');
    expect(findServerFunctionByEditSlug(sampleFunctions, 'fn-auth-login')?.id).toBe('fn-auth-login');
    expect(findServerFunctionByEditSlug(sampleFunctions, 'general/hello-world')?.id).toBe('fn-hello');
    expect(findServerFunctionByEditSlug(sampleFunctions, SERVER_FUNCTION_NEW_SLUG)).toBeNull();
    expect(findServerFunctionByEditSlug(sampleFunctions, 'missing/route')).toBeNull();
  });

  it('builds bookmarkable relative paths', () => {
    expect(buildServerFunctionListRelativePath()).toBe('server-functions');
    expect(buildServerFunctionEditRelativePath({ folder: 'auth', name: 'login' })).toBe('server-functions/edit/auth/login');
    expect(buildServerFunctionNewRelativePath()).toBe('server-functions/edit/new');
  });

  it('derives a display label from an edit slug before the catalog loads', () => {
    expect(resolveServerFunctionItemLabelFromEditSlug('auth/login')).toBe('login');
    expect(resolveServerFunctionItemLabelFromEditSlug(SERVER_FUNCTION_NEW_SLUG)).toBe('Untitled function');
  });

  it('flags reserved internal workflow entry points as hidden edit slugs', () => {
    expect(isHiddenServerFunctionEditSlug('workflow-engine/scheduled-start')).toBe(true);
    expect(isHiddenServerFunctionEditSlug('auth/login')).toBe(false);
  });

  it('includes the studio portal segment for culture mounts', () => {
    expect(buildServerFunctionListRelativePath('us')).toBe('studio/server-functions');
    expect(buildServerFunctionEditRelativePath({ folder: 'auth', name: 'login' }, 'us')).toBe('studio/server-functions/edit/auth/login');
    expect(buildServerFunctionNewRelativePath('ir')).toBe('studio/server-functions/edit/new');
  });
});
