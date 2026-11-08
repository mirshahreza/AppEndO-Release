import type { ArtifactRef } from '../../api/contracts/appendoo/artifactRef.types';
import { artifactRefKey } from '../../api/contracts/appendoo/artifactRef.types';
import type {
  ApplicationIntelligenceHealth,
  ApplicationMapEntry,
  ApplicationMapView,
  ArtifactContextView,
} from '../../api/contracts/appendoo/applicationIntelligence.types';
import { APPLICATION_INTELLIGENCE_VERSION } from '../../api/contracts/appendoo/applicationIntelligence.types';
import type { FeatureGraph } from '../aiIndexCodegen';
import { importFeatureGraphIntoSemanticGraph } from './featureGraphSemanticImporter';
import {
  getIntelligenceIndexFailureCount,
  getIntelligenceIndexQueueDepth,
} from './intelligenceIndexCoordinator';
import {
  computeSemanticGraphImpact,
  getSemanticGraphIndexVersion,
  getSemanticGraphNeighbors,
  getSemanticGraphNode,
  getSemanticGraphStoreHealth,
  listSemanticGraphNodes,
  traverseSemanticGraph,
} from './semanticGraphStore';

const toMapEntry = (node: NonNullable<ReturnType<typeof getSemanticGraphNode>>): ApplicationMapEntry => ({
  nodeId: node.nodeId,
  kind: node.kind,
  label: node.label,
  artifactRef: node.artifactRef,
});

const findNodeByArtifactRef = (ref: ArtifactRef) => (
  listSemanticGraphNodes().find((node) => (
    node.artifactRef
    && artifactRefKey(node.artifactRef) === artifactRefKey(ref)
  ))
);

/** AE-3.1 — Application Intelligence scaffold over normalized semantic graph. */
export const bootstrapApplicationIntelligenceFromFeatureGraph = (
  graph: FeatureGraph,
  applicationScopeRef: string,
): { indexVersion: number; nodesReplaced: number; edgesReplaced: number } => (
  importFeatureGraphIntoSemanticGraph(graph, applicationScopeRef)
);

export const getApplicationMap = (applicationScopeRef: string): ApplicationMapView => {
  const applicationNodeId = `application:${applicationScopeRef}`;
  const { nodes } = getSemanticGraphNeighbors(applicationNodeId, 'out', ['CONTAINS']);

  return {
    applicationScopeRef,
    indexVersion: getSemanticGraphIndexVersion(),
    entries: nodes.map(toMapEntry),
  };
};

export const getArtifact = (ref: ArtifactRef): ApplicationMapEntry | null => {
  const node = findNodeByArtifactRef(ref);
  return node ? toMapEntry(node) : null;
};

export const getArtifactContext = (ref: ArtifactRef): ArtifactContextView => {
  const node = findNodeByArtifactRef(ref);
  if (!node) {
    return {
      artifactRef: ref,
      neighbors: [],
      dependencies: [],
    };
  }

  const { nodes: neighbors } = getSemanticGraphNeighbors(node.nodeId, 'both');
  const { nodes: dependencies } = getSemanticGraphNeighbors(node.nodeId, 'out', ['DEPENDS_ON', 'REFERENCES', 'CALLS']);

  return {
    artifactRef: ref,
    nodeId: node.nodeId,
    neighbors: neighbors.map(toMapEntry),
    dependencies: dependencies.map(toMapEntry),
  };
};

export const getImpactAnalysis = (nodeId: string, maxDepth = 2) => (
  computeSemanticGraphImpact(nodeId, maxDepth)
);

export const findUsages = (nodeId: string): ApplicationMapEntry[] => {
  const { nodes } = getSemanticGraphNeighbors(nodeId, 'in', ['REFERENCES', 'CALLS', 'IMPORTS', 'DEPENDS_ON']);
  return nodes.map(toMapEntry);
};

export const getDependencies = (nodeId: string): ApplicationMapEntry[] => {
  const { nodes } = getSemanticGraphNeighbors(nodeId, 'out', ['REFERENCES', 'CALLS', 'IMPORTS', 'DEPENDS_ON']);
  return nodes.map(toMapEntry);
};

export const getApplicationIntelligenceHealth = (input?: {
  featureGraphSourceVersion?: string;
  codebaseIndexSourceVersion?: string;
}): ApplicationIntelligenceHealth => {
  const storeHealth = getSemanticGraphStoreHealth();

  return {
    intelligenceVersion: APPLICATION_INTELLIGENCE_VERSION,
    indexVersion: storeHealth.indexVersion,
    featureGraphSourceVersion: input?.featureGraphSourceVersion,
    codebaseIndexSourceVersion: input?.codebaseIndexSourceVersion ?? 'docs/ai/CODEBASE_INDEX.md',
    staleCount: storeHealth.staleNodeCount,
    queueDepth: getIntelligenceIndexQueueDepth(),
    failureCount: getIntelligenceIndexFailureCount(),
    nodeCount: storeHealth.nodeCount,
    edgeCount: storeHealth.edgeCount,
    packageFreshness: {},
  };
};

export const explainApplicationIntelligenceReach = (startNodeId: string, maxDepth = 2) => (
  traverseSemanticGraph(startNodeId, maxDepth)
);
