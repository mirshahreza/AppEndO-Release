import { describe, expect, it } from 'vitest';
import {
  findFeatureGraphNode,
  loadFeatureGraph,
  summarizeFeatureGraph,
} from '../../../../../shared/lib/featureGraphStore';
import type { ToolExecutionContext } from '../../../agent/types';
import {
  GET_FEATURE_GRAPH_TOOL_NAME,
  getFeatureGraphTool,
} from '../getFeatureGraph';

const testToolContext: ToolExecutionContext = {
  mode: 'agent',
  allowedGroups: [],
};

const toolData = (result: { ok: boolean; data?: unknown }) =>
  result.data as Record<string, unknown> | undefined;

describe('featureGraphStore', () => {
  it('loads generated graph from docs/ai/feature-graph.json', () => {
    const graph = loadFeatureGraph();
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.version).toBeTruthy();
  });

  it('finds node by pageKey case-insensitively', () => {
    const graph = loadFeatureGraph();
    const node = findFeatureGraphNode(graph, 'PACKAGE-MANAGER');
    expect(node?.pageKey).toBe('package-manager');
    expect(node?.ui.feature).toContain('packages');
  });

  it('summarizeFeatureGraph returns compact index', () => {
    const graph = loadFeatureGraph();
    const summary = summarizeFeatureGraph(graph);
    expect(summary.pageKeys.length).toBe(graph.nodes.length);
    expect(summary.hint).toContain('pageKey');
  });
});

describe('getFeatureGraphTool', () => {
  it('returns compact index when pageKey is omitted', async () => {
    const result = await getFeatureGraphTool.execute({}, testToolContext);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = toolData(result);
      expect(data?.pageKeys).toBeDefined();
      expect(data?.node).toBeUndefined();
    }
  });

  it('includes searchContext aligned with search_codebase featureGraph merge', async () => {
    const result = await getFeatureGraphTool.execute({ pageKey: 'server-functions' }, testToolContext);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = toolData(result);
      expect(data?.searchContext).toMatchObject({
        pageKey: 'server-functions',
        codebaseIndexPointer: 'docs/ai/CODEBASE_INDEX.md',
      });
      expect((data?.searchContext as { searchRoots?: string[] })?.searchRoots).toContain('src/features/server-functions');
    }
  });

  it('returns one node when pageKey is provided', async () => {
    const result = await getFeatureGraphTool.execute({ pageKey: 'server-functions' }, testToolContext);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = toolData(result);
      expect((data?.node as { pageKey?: string })?.pageKey).toBe('server-functions');
      expect((data?.node as { ui?: { workspace?: string } })?.ui?.workspace).toBeTruthy();
    }
  });

  it('returns error for unknown pageKey', async () => {
    const result = await getFeatureGraphTool.execute({ pageKey: 'not-a-page' }, testToolContext);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('page_key_not_found');
    }
  });

  it('exports stable tool name', () => {
    expect(GET_FEATURE_GRAPH_TOOL_NAME).toBe('get_feature_graph');
  });
});

describe('getProjectStandards pointer mode', () => {
  it('returns pointer without dumping all rules when query is omitted', async () => {
    const { getProjectStandardsTool } = await import('../getProjectStandards');
    const result = await getProjectStandardsTool.execute({}, testToolContext);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = toolData(result);
      expect(data?.totalCount).toBeGreaterThan(0);
      expect(data?.standards).toBeUndefined();
      expect(data?.hint).toContain('query');
    }
  });
});
