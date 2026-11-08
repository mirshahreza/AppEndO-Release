import fs from 'node:fs';
import path from 'node:path';
import type { FeatureGraph, FeatureGraphNode } from './aiIndexCodegen';
import { validateFeatureGraph } from './featureGraphValidation';

export const FEATURE_GRAPH_REL_PATH = 'docs/ai/feature-graph.json';

export function loadFeatureGraph(rootDir = process.cwd()): FeatureGraph {
  const filePath = path.join(rootDir, FEATURE_GRAPH_REL_PATH);
  const raw = fs.readFileSync(filePath, 'utf8');
  return validateFeatureGraph(JSON.parse(raw));
}

export function findFeatureGraphNode(graph: FeatureGraph, pageKey: string): FeatureGraphNode | undefined {
  const normalized = pageKey.trim().toLowerCase();
  return graph.nodes.find((node) => node.pageKey.toLowerCase() === normalized);
}

export function summarizeFeatureGraph(graph: FeatureGraph) {
  return {
    version: graph.version,
    generatedAt: graph.generatedAt,
    nodeCount: graph.nodes.length,
    pageKeys: graph.nodes.map((node) => ({
      pageKey: node.pageKey,
      label: node.label,
      feature: node.ui.feature,
    })),
    codebaseIndexPointer: 'docs/ai/CODEBASE_INDEX.md',
    hint: 'Pass pageKey to load a single node instead of reading feature-graph.json.',
  };
}

/** Map a repo-relative file path to the most specific feature graph pageKey, if any. */
export function resolvePageKeyFromFilePath(filePath: string, graph: FeatureGraph): string | undefined {
  const normalized = filePath.replace(/\\/g, '/').replace(/^\.\//, '');

  let best: { pageKey: string; rootLength: number } | undefined;

  for (const node of graph.nodes) {
    for (const root of resolveFeatureSearchRoots(node)) {
      const normalizedRoot = root.replace(/\/$/, '');
      if (normalized === normalizedRoot || normalized.startsWith(`${normalizedRoot}/`)) {
        if (!best || normalizedRoot.length > best.rootLength) {
          best = { pageKey: node.pageKey, rootLength: normalizedRoot.length };
        }
      }
    }
  }

  return best?.pageKey;
}

export type FeatureGraphSearchContext = {
  pageKey: string;
  label: string;
  routePattern: string;
  searchRoots: string[];
  codebaseIndexPointer: 'docs/ai/CODEBASE_INDEX.md';
  version: string;
};

/** Compact graph node payload shared by search_codebase and get_feature_graph. */
export function buildFeatureGraphSearchContext(
  node: FeatureGraphNode,
  graph: FeatureGraph,
): FeatureGraphSearchContext {
  return {
    pageKey: node.pageKey,
    label: node.label,
    routePattern: node.routePattern,
    searchRoots: resolveFeatureSearchRoots(node),
    codebaseIndexPointer: 'docs/ai/CODEBASE_INDEX.md',
    version: graph.version,
  };
}

/** Search roots for a feature node — feature UI, domain, routes, contracts, services. */
export function resolveFeatureSearchRoots(node: FeatureGraphNode): string[] {
  const roots: string[] = [];
  const add = (entry: string | null | undefined) => {
    if (!entry) return;
    const normalized = entry.replace(/\/$/, '');
    if (normalized) roots.push(normalized);
  };

  add(node.ui.feature);
  add(node.ui.domain);
  for (const route of node.api.routes) {
    const slash = route.lastIndexOf('/');
    if (slash > 0) add(route.slice(0, slash));
  }
  add(node.api.contracts);
  for (const service of node.api.services) add(service);

  return [...new Set(roots)];
}
