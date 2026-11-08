import { describe, expect, it } from 'vitest';
import {
  buildFeatureGraph,
  renderCodebaseIndexMarkdown,
} from '../aiIndexCodegen';

describe('aiIndexCodegen', () => {
  it('builds feature graph with known studio menu items', () => {
    const rootDir = process.cwd();
    const graph = buildFeatureGraph(rootDir);
    const pageKeys = graph.nodes.map((node) => node.pageKey);

    expect(pageKeys).toContain('server-functions');
    expect(pageKeys).toContain('dashboard');
    expect(pageKeys).toContain('platform-portals');
    expect(pageKeys).toContain('users');

    const edge = graph.nodes.find((node) => node.pageKey === 'server-functions');
    expect(edge?.ui.feature).toBe('src/features/server-functions/');
    expect(edge?.ui.workspace).toBe('ServerFunctionsWorkspace');
    expect(edge?.api.apiPrefixes).toContain('/api/functions');
    expect(edge?.inStudioMenu).toBe(true);

    const cache = graph.nodes.find((node) => node.pageKey === 'cache');
    expect(cache?.ui.page).toBe('src/features/cache/CachePage.tsx');

    const dashboard = graph.nodes.find((node) => node.pageKey === 'dashboard');
    expect(dashboard?.ui.page).toBe('src/features/dashboard/DashboardPage.tsx');

    const myApis = graph.nodes.find((node) => node.pageKey === 'my-apis');
    expect(myApis?.inStudioMenu).toBe(false);
    expect(myApis?.notes).toMatch(/Profile/i);
  });

  it('renders markdown index with menu table', () => {
    const graph = buildFeatureGraph(process.cwd());
    const markdown = renderCodebaseIndexMarkdown(graph);
    expect(markdown).toContain('## Menu map');
    expect(markdown).toContain('`server-functions`');
    expect(markdown).toContain('npm run codegen:ai-index');
  });
});
