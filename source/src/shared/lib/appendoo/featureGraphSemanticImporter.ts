import type { FeatureGraph, FeatureGraphNode } from '../aiIndexCodegen';
import { buildArtifactRef } from '../../api/contracts/appendoo/artifactRef.types';
import type {
  SemanticGraphEdge,
  SemanticGraphNode,
  SemanticGraphProvenance,
} from '../../api/contracts/appendoo/semanticGraph.types';
import { replaceSemanticGraphFactsBySource } from './semanticGraphStore';

const buildProvenance = (
  sourceReference: string,
  indexVersion: number,
): SemanticGraphProvenance => ({
  sourceType: 'feature_graph',
  sourceReference,
  confidence: 1,
  verificationStatus: 'verified',
  observedAt: new Date().toISOString(),
  lastVerifiedAt: new Date().toISOString(),
  indexVersion,
});

const buildApplicationNode = (
  applicationScopeRef: string,
  graph: FeatureGraph,
): SemanticGraphNode => ({
  nodeId: `application:${applicationScopeRef}`,
  kind: 'Application',
  label: applicationScopeRef,
  artifactRef: buildArtifactRef({
    applicationScopeRef,
    artifactType: 'application',
    canonicalName: applicationScopeRef,
    sourceUri: 'docs/ai/feature-graph.json',
  }),
  provenance: buildProvenance(graph.version, 1),
});

const buildPageNode = (
  node: FeatureGraphNode,
  applicationScopeRef: string,
  graph: FeatureGraph,
): SemanticGraphNode => ({
  nodeId: `page:${node.pageKey}`,
  kind: 'Page',
  label: node.label,
  artifactRef: buildArtifactRef({
    applicationScopeRef,
    artifactType: 'page',
    canonicalName: node.pageKey,
    sourceUri: node.ui.page ?? node.ui.feature ?? undefined,
  }),
  provenance: buildProvenance(`${graph.version}:${node.pageKey}`, 1),
  properties: {
    routePattern: node.routePattern,
    inStudioMenu: node.inStudioMenu,
  },
});

const buildServiceNode = (
  servicePath: string,
  pageKey: string,
  applicationScopeRef: string,
  graph: FeatureGraph,
): SemanticGraphNode => ({
  nodeId: `service:${pageKey}:${servicePath}`,
  kind: 'Service',
  label: servicePath.split('/').pop() ?? servicePath,
  artifactRef: buildArtifactRef({
    applicationScopeRef,
    artifactType: 'service',
    canonicalName: servicePath,
    sourceUri: servicePath,
  }),
  provenance: buildProvenance(`${graph.version}:${pageKey}:${servicePath}`, 1),
});

/** AE-3.1 — bootstrap ASG facts from existing Feature Graph (single source import). */
export const importFeatureGraphIntoSemanticGraph = (
  graph: FeatureGraph,
  applicationScopeRef: string,
): { nodesReplaced: number; edgesReplaced: number; indexVersion: number } => {
  const nodes: SemanticGraphNode[] = [buildApplicationNode(applicationScopeRef, graph)];
  const semanticEdges: SemanticGraphEdge[] = [];

  for (const pageNode of graph.nodes) {
    nodes.push(buildPageNode(pageNode, applicationScopeRef, graph));

    semanticEdges.push({
      edgeId: `contains:${applicationScopeRef}:${pageNode.pageKey}`,
      kind: 'CONTAINS',
      fromNodeId: `application:${applicationScopeRef}`,
      toNodeId: `page:${pageNode.pageKey}`,
      provenance: buildProvenance(`${graph.version}:${pageNode.pageKey}:contains`, 1),
    });

    for (const servicePath of pageNode.api.services) {
      nodes.push(buildServiceNode(servicePath, pageNode.pageKey, applicationScopeRef, graph));
      semanticEdges.push({
        edgeId: `references:${pageNode.pageKey}:${servicePath}`,
        kind: 'REFERENCES',
        fromNodeId: `page:${pageNode.pageKey}`,
        toNodeId: `service:${pageNode.pageKey}:${servicePath}`,
        provenance: buildProvenance(`${graph.version}:${pageNode.pageKey}:${servicePath}:ref`, 1),
      });
    }

    for (const route of pageNode.api.routes) {
      semanticEdges.push({
        edgeId: `exposed:${pageNode.pageKey}:${route}`,
        kind: 'EXPOSED_IN',
        fromNodeId: `route:${route}`,
        toNodeId: `page:${pageNode.pageKey}`,
        provenance: buildProvenance(`${graph.version}:${pageNode.pageKey}:${route}:route`, 1),
      });
      if (!nodes.some((candidate) => candidate.nodeId === `route:${route}`)) {
        nodes.push({
          nodeId: `route:${route}`,
          kind: 'Route',
          label: route,
          artifactRef: buildArtifactRef({
            applicationScopeRef,
            artifactType: 'route',
            canonicalName: route,
            sourceUri: route,
          }),
          provenance: buildProvenance(`${graph.version}:${route}`, 1),
        });
      }
    }
  }

  return replaceSemanticGraphFactsBySource('feature_graph', graph.version, nodes, semanticEdges);
};
