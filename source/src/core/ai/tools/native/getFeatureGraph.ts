import {
  buildFeatureGraphSearchContext,
  findFeatureGraphNode,
  loadFeatureGraph,
  summarizeFeatureGraph,
} from '../../../../shared/lib/featureGraphStore';
import type { NativeToolDefinition } from '../ToolRegistry';

export const GET_FEATURE_GRAPH_TOOL_NAME = 'get_feature_graph';

export const getFeatureGraphTool: NativeToolDefinition = {
  name: GET_FEATURE_GRAPH_TOOL_NAME,
  description: 'Loads the generated feature graph — full index without pageKey, or one Studio page node with searchContext when pageKey is set. Use to find where a feature lives before search_codebase. Returns node metadata, related paths, and codebase index pointer. Example: get_feature_graph({ pageKey: "users" }).',
  group: 'search',
  parameters: {
    type: 'object',
    properties: {
      pageKey: {
        type: 'string',
        description: 'Studio pageKey (e.g. package-manager, edge, client-components). Returns one graph node.',
      },
    },
  },
  execute: async (args) => {
    const pageKey = typeof args.pageKey === 'string' ? args.pageKey.trim() : '';

    let graph;
    try {
      graph = loadFeatureGraph();
    } catch {
      return {
        ok: false,
        summary: 'Feature graph not found. Run npm run codegen:ai-index after registry changes.',
        error: 'feature_graph_missing',
      };
    }

    if (pageKey) {
      const node = findFeatureGraphNode(graph, pageKey);
      if (!node) {
        const knownKeys = graph.nodes.map((entry) => entry.pageKey).join(', ');
        return {
          ok: false,
          summary: `No graph node for pageKey "${pageKey}". Known keys: ${knownKeys}`,
          error: 'page_key_not_found',
        };
      }

      return {
        ok: true,
        summary: `Loaded feature graph node for ${node.label} (${node.pageKey}).`,
        data: {
          version: graph.version,
          generatedAt: graph.generatedAt,
          node,
          searchContext: buildFeatureGraphSearchContext(node, graph),
          codebaseIndexPointer: 'docs/ai/CODEBASE_INDEX.md',
        },
      };
    }

    const summary = summarizeFeatureGraph(graph);
    return {
      ok: true,
      summary: `Feature graph index (${summary.nodeCount} nodes, version ${summary.version}).`,
      data: summary,
    };
  },
};
