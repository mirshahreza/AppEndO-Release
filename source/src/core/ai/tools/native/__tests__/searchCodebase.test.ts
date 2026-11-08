import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { executeSearchCodebase } from '../searchCodebase';

describe('searchCodebase pageKey scope', () => {
  let tempRoot: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-search-scope-'));
    process.chdir(tempRoot);

    fs.mkdirSync(path.join(tempRoot, 'docs/ai'), { recursive: true });
    fs.mkdirSync(path.join(tempRoot, 'src/features/cache'), { recursive: true });
    fs.mkdirSync(path.join(tempRoot, 'src/features/server-functions'), { recursive: true });
    fs.mkdirSync(path.join(tempRoot, 'src/shared/ui'), { recursive: true });

    fs.writeFileSync(
      path.join(tempRoot, 'src/features/cache/CacheMarker.ts'),
      'export const CACHE_ONLY_SYMBOL = "cache-scope-test";\n',
    );
    fs.writeFileSync(
      path.join(tempRoot, 'src/features/server-functions/EdgeMarker.ts'),
      'export const CACHE_ONLY_SYMBOL = "edge-other";\n',
    );
    fs.writeFileSync(
      path.join(tempRoot, 'src/shared/ui/SharedMarker.ts'),
      'export const CACHE_ONLY_SYMBOL = "shared-hit";\n',
    );

    fs.writeFileSync(
      path.join(tempRoot, 'docs/ai/feature-graph.json'),
      JSON.stringify({
        version: '1',
        generatedAt: '2026-01-01T00:00:00.000Z',
        source: { navigation: 'studio.json', pageModulesDir: 'page-modules' },
        nodes: [
          {
            pageKey: 'cache',
            label: 'Cache',
            menuGroup: null,
            routePattern: 'cache',
            inStudioMenu: true,
            ui: {
              pageModule: null,
              loaderRef: 'core:Cache',
              page: null,
              feature: 'src/features/cache/',
              domain: null,
              workspace: null,
            },
            api: { routes: [], apiPrefixes: [], contracts: null, services: [] },
            tests: null,
            notes: null,
          },
        ],
      }),
    );
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('scopes search to feature folder when pageKey is provided', async () => {
    const result = await executeSearchCodebase({ query: 'CACHE_ONLY_SYMBOL', pageKey: 'cache' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const paths = result.data?.matches?.map((match) => match.path) ?? [];
    expect(paths.some((entry) => entry.includes('cache/CacheMarker'))).toBe(true);
    expect(paths.some((entry) => entry.includes('server-functions/EdgeMarker'))).toBe(false);
    expect(paths.some((entry) => entry.includes('shared/ui/SharedMarker'))).toBe(false);
    expect(result.data?.scopePaths).toEqual(['src/features/cache']);
  });

  it('can include shared when includeShared is true', async () => {
    const result = await executeSearchCodebase({
      query: 'CACHE_ONLY_SYMBOL',
      pageKey: 'cache',
      includeShared: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const paths = result.data?.matches?.map((match) => match.path) ?? [];
    expect(paths.some((entry) => entry.includes('shared/ui/SharedMarker'))).toBe(true);
    expect(paths.some((entry) => entry.includes('server-functions/EdgeMarker'))).toBe(false);
  });
});

describe('searchCodebase includeText', () => {
  let tempRoot: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-search-text-'));
    process.chdir(tempRoot);

    fs.mkdirSync(path.join(tempRoot, 'src/features/demo'), { recursive: true });
    fs.writeFileSync(
      path.join(tempRoot, 'src/features/demo/DemoMarker.ts'),
      'export const DEMO_SEARCH_TOKEN = "hello-from-demo";\n',
    );
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('omits match text by default', async () => {
    const result = await executeSearchCodebase({ query: 'DEMO_SEARCH_TOKEN', path: 'src/features/demo' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data?.includeText).toBe(false);
    expect(result.data?.matches?.length).toBeGreaterThan(0);
    for (const match of result.data?.matches ?? []) {
      expect(match.path).toBeTruthy();
      expect(match.line).toBeGreaterThan(0);
      expect(match.text).toBeUndefined();
    }
  });

  it('includes match text when includeText is true', async () => {
    const result = await executeSearchCodebase({
      query: 'DEMO_SEARCH_TOKEN',
      path: 'src/features/demo',
      includeText: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data?.includeText).toBe(true);
    const hit = result.data?.matches?.find((match) => match.path.includes('DemoMarker'));
    expect(hit?.text).toContain('DEMO_SEARCH_TOKEN');
  });
});

describe('searchCodebase feature graph merge (VC-3.3)', () => {
  let tempRoot: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-search-graph-merge-'));
    process.chdir(tempRoot);

    fs.mkdirSync(path.join(tempRoot, 'docs/ai'), { recursive: true });
    fs.mkdirSync(path.join(tempRoot, 'src/features/cache'), { recursive: true });
    fs.mkdirSync(path.join(tempRoot, 'src/features/server-functions'), { recursive: true });

    fs.writeFileSync(
      path.join(tempRoot, 'src/features/cache/CacheMarker.ts'),
      'export const GRAPH_MERGE_TOKEN = "cache-node";\n',
    );
    fs.writeFileSync(
      path.join(tempRoot, 'src/features/server-functions/EdgeMarker.ts'),
      'export const GRAPH_MERGE_TOKEN = "edge-node";\n',
    );

    fs.writeFileSync(
      path.join(tempRoot, 'docs/ai/feature-graph.json'),
      JSON.stringify({
        version: '1',
        generatedAt: '2026-01-01T00:00:00.000Z',
        source: { navigation: 'studio.json', pageModulesDir: 'page-modules' },
        nodes: [
          {
            pageKey: 'cache',
            label: 'Cache',
            menuGroup: null,
            routePattern: 'cache',
            inStudioMenu: true,
            ui: {
              pageModule: null,
              loaderRef: 'core:Cache',
              page: null,
              feature: 'src/features/cache/',
              domain: null,
              workspace: null,
            },
            api: { routes: [], apiPrefixes: [], contracts: null, services: [] },
            tests: null,
            notes: null,
          },
          {
            pageKey: 'server-functions',
            label: 'Server Functions',
            menuGroup: null,
            routePattern: 'server-functions',
            inStudioMenu: true,
            ui: {
              pageModule: null,
              loaderRef: 'core:ServerFunctions',
              page: null,
              feature: 'src/features/server-functions/',
              domain: null,
              workspace: null,
            },
            api: { routes: [], apiPrefixes: [], contracts: null, services: [] },
            tests: null,
            notes: null,
          },
        ],
      }),
    );
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('annotates unscoped matches with pageKey from feature graph', async () => {
    const result = await executeSearchCodebase({ query: 'GRAPH_MERGE_TOKEN', path: 'src/features' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const cacheHit = result.data?.matches?.find((match) => match.path.includes('cache/CacheMarker'));
    const edgeHit = result.data?.matches?.find((match) => match.path.includes('server-functions/EdgeMarker'));
    expect(cacheHit?.pageKey).toBe('cache');
    expect(cacheHit?.label).toBe('Cache');
    expect(edgeHit?.pageKey).toBe('server-functions');
    expect(result.data?.graphPageKeys).toEqual(expect.arrayContaining(['cache', 'server-functions']));
  });

  it('includes featureGraph context when pageKey scopes search', async () => {
    const result = await executeSearchCodebase({ query: 'GRAPH_MERGE_TOKEN', pageKey: 'cache' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data?.featureGraph).toMatchObject({
      pageKey: 'cache',
      label: 'Cache',
      searchRoots: ['src/features/cache'],
      codebaseIndexPointer: 'docs/ai/CODEBASE_INDEX.md',
    });
    expect(result.data?.matches?.every((match) => match.pageKey === 'cache')).toBe(true);
  });
});
describe('searchCodebase pageContext auto-scope', () => {
  let tempRoot: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-search-pagectx-'));
    process.chdir(tempRoot);

    fs.mkdirSync(path.join(tempRoot, 'docs/ai'), { recursive: true });
    fs.mkdirSync(path.join(tempRoot, 'src/features/users'), { recursive: true });
    fs.mkdirSync(path.join(tempRoot, 'src/features/server-functions'), { recursive: true });

    fs.writeFileSync(
      path.join(tempRoot, 'src/features/users/UsersMarker.ts'),
      'export const USERS_SCOPE_TOKEN = "users-only-hit";\n',
    );
    fs.writeFileSync(
      path.join(tempRoot, 'src/features/server-functions/EdgeMarker.ts'),
      'export const USERS_SCOPE_TOKEN = "edge-other";\n',
    );

    fs.writeFileSync(
      path.join(tempRoot, 'docs/ai/feature-graph.json'),
      JSON.stringify({
        version: '1',
        generatedAt: '2026-01-01T00:00:00.000Z',
        source: { navigation: 'studio.json', pageModulesDir: 'page-modules' },
        nodes: [
          {
            pageKey: 'users',
            label: 'Users',
            menuGroup: null,
            routePattern: 'users',
            inStudioMenu: true,
            ui: {
              pageModule: null,
              loaderRef: 'core:Users',
              page: null,
              feature: 'src/features/users/',
              domain: null,
              workspace: null,
            },
            api: { routes: [], apiPrefixes: [], contracts: null, services: [] },
            tests: null,
            notes: null,
          },
        ],
      }),
    );
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('auto-scopes from pageContext.pageKey when args omit scope', async () => {
    const result = await executeSearchCodebase(
      { query: 'USERS_SCOPE_TOKEN' },
      { mode: 'agent', allowedGroups: ['search'], pageContext: { path: '/studio/users', pageLabel: 'Users', pageKey: 'users' } },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data?.pageKey).toBe('users');
    const paths = result.data?.matches?.map((match) => match.path) ?? [];
    expect(paths.some((entry) => entry.includes('users/UsersMarker'))).toBe(true);
    expect(paths.some((entry) => entry.includes('server-functions/EdgeMarker'))).toBe(false);
  });

  it('resolves pageKey from pageContext.path when pageKey is omitted', async () => {
    const result = await executeSearchCodebase(
      { query: 'USERS_SCOPE_TOKEN' },
      { mode: 'agent', allowedGroups: ['search'], pageContext: { path: '/ir/studio/users', pageLabel: 'Users' } },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data?.pageKey).toBe('users');
    expect(result.data?.scopePaths).toEqual(['src/features/users']);
  });
});

describe('searchCodebase default mode', () => {
  let tempRoot: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-search-default-mode-'));
    process.chdir(tempRoot);
    fs.mkdirSync(path.join(tempRoot, 'src/features/demo'), { recursive: true });
    fs.writeFileSync(
      path.join(tempRoot, 'src/features/demo/DefaultMode.ts'),
      'export const DEFAULT_MODE_TOKEN = "hybrid-default";\n',
    );
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('defaults to hybrid when mode is omitted', async () => {
    const result = await executeSearchCodebase({ query: 'DEFAULT_MODE_TOKEN', path: 'src/features/demo' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data?.mode).toBe('hybrid');
  });
});
