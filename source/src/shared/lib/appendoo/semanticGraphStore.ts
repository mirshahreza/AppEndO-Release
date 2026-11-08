import type {
  SemanticGraphEdge,
  SemanticGraphEdgeKind,
  SemanticGraphImpactResult,
  SemanticGraphNode,
  SemanticGraphStoreHealth,
  SemanticGraphTraversalResult,
} from '../../api/contracts/appendoo/semanticGraph.types';
import { SEMANTIC_GRAPH_VERSION } from '../../api/contracts/appendoo/semanticGraph.types';

const nodes = new Map<string, SemanticGraphNode>();
const edges = new Map<string, SemanticGraphEdge>();
let indexVersion = 1;

export const resetSemanticGraphStoreForTests = (): void => {
  nodes.clear();
  edges.clear();
  indexVersion = 1;
};

export const getSemanticGraphIndexVersion = (): number => indexVersion;

export const bumpSemanticGraphIndexVersion = (): number => {
  indexVersion += 1;
  return indexVersion;
};

export const upsertSemanticGraphNodes = (incoming: SemanticGraphNode[]): number => {
  for (const node of incoming) {
    nodes.set(node.nodeId, node);
  }
  return incoming.length;
};

export const upsertSemanticGraphEdges = (incoming: SemanticGraphEdge[]): number => {
  for (const edge of incoming) {
    edges.set(edge.edgeId, edge);
  }
  return incoming.length;
};

export const replaceSemanticGraphFactsBySource = (
  sourceType: string,
  sourceReference: string,
  incomingNodes: SemanticGraphNode[],
  incomingEdges: SemanticGraphEdge[],
): { nodesReplaced: number; edgesReplaced: number; indexVersion: number } => {
  for (const [nodeId, node] of nodes.entries()) {
    if (node.provenance.sourceType === sourceType && node.provenance.sourceReference === sourceReference) {
      nodes.delete(nodeId);
    }
  }

  for (const [edgeId, edge] of edges.entries()) {
    if (edge.provenance.sourceType === sourceType && edge.provenance.sourceReference === sourceReference) {
      edges.delete(edgeId);
    }
  }

  upsertSemanticGraphNodes(incomingNodes);
  upsertSemanticGraphEdges(incomingEdges);
  const nextVersion = bumpSemanticGraphIndexVersion();

  return {
    nodesReplaced: incomingNodes.length,
    edgesReplaced: incomingEdges.length,
    indexVersion: nextVersion,
  };
};

export const getSemanticGraphNode = (nodeId: string): SemanticGraphNode | undefined => (
  nodes.get(nodeId)
);

export const listSemanticGraphNodes = (): SemanticGraphNode[] => [...nodes.values()];

export const listSemanticGraphEdges = (): SemanticGraphEdge[] => [...edges.values()];

export const getSemanticGraphNeighbors = (
  nodeId: string,
  direction: 'in' | 'out' | 'both' = 'both',
  edgeKinds?: SemanticGraphEdgeKind[],
): { nodes: SemanticGraphNode[]; edges: SemanticGraphEdge[] } => {
  const matchedEdges = [...edges.values()].filter((edge) => {
    if (edgeKinds && !edgeKinds.includes(edge.kind)) return false;
    if (direction === 'out') return edge.fromNodeId === nodeId;
    if (direction === 'in') return edge.toNodeId === nodeId;
    return edge.fromNodeId === nodeId || edge.toNodeId === nodeId;
  });

  const neighborIds = new Set<string>();
  for (const edge of matchedEdges) {
    if (edge.fromNodeId === nodeId) neighborIds.add(edge.toNodeId);
    if (edge.toNodeId === nodeId) neighborIds.add(edge.fromNodeId);
  }
  neighborIds.delete(nodeId);

  return {
    nodes: [...neighborIds].map((id) => nodes.get(id)).filter(Boolean) as SemanticGraphNode[],
    edges: matchedEdges,
  };
};

export const traverseSemanticGraph = (
  startNodeId: string,
  maxDepth = 2,
): SemanticGraphTraversalResult => {
  const visited = new Set<string>([startNodeId]);
  const traversedEdges: SemanticGraphEdge[] = [];
  let frontier = [startNodeId];

  for (let depth = 0; depth < maxDepth; depth += 1) {
    const nextFrontier: string[] = [];
    for (const currentId of frontier) {
      const { nodes: neighbors, edges: neighborEdges } = getSemanticGraphNeighbors(currentId, 'both');
      traversedEdges.push(...neighborEdges);
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.nodeId)) {
          visited.add(neighbor.nodeId);
          nextFrontier.push(neighbor.nodeId);
        }
      }
    }
    frontier = nextFrontier;
    if (frontier.length === 0) break;
  }

  return {
    startNodeId,
    visitedNodeIds: [...visited],
    edges: traversedEdges,
    maxDepth,
  };
};

const IMPACT_EDGE_KINDS: SemanticGraphEdgeKind[] = [
  'DEPENDS_ON',
  'CALLS',
  'REFERENCES',
  'IMPORTS',
  'CONTAINS',
];

export const computeSemanticGraphImpact = (
  originNodeId: string,
  maxDepth = 2,
): SemanticGraphImpactResult => {
  const impacted = new Set<string>();
  const boundaryCrossings = new Set<string>();
  let frontier = [originNodeId];

  for (let depth = 0; depth < maxDepth; depth += 1) {
    const nextFrontier: string[] = [];
    for (const currentId of frontier) {
      const { nodes: dependents, edges: dependentEdges } = getSemanticGraphNeighbors(
        currentId,
        'out',
        IMPACT_EDGE_KINDS,
      );
      for (const edge of dependentEdges) {
        if (edge.kind === 'CONTAINS') {
          boundaryCrossings.add(edge.toNodeId);
        }
      }
      for (const dependent of dependents) {
        if (!impacted.has(dependent.nodeId) && dependent.nodeId !== originNodeId) {
          impacted.add(dependent.nodeId);
          nextFrontier.push(dependent.nodeId);
        }
      }
    }
    frontier = nextFrontier;
    if (frontier.length === 0) break;
  }

  return {
    originNodeId,
    impactedNodeIds: [...impacted],
    boundaryCrossings: [...boundaryCrossings],
    maxDepth,
  };
};

export const getSemanticGraphStoreHealth = (): SemanticGraphStoreHealth => {
  const allNodes = listSemanticGraphNodes();
  const staleNodeCount = allNodes.filter((node) => node.provenance.verificationStatus === 'stale').length;
  const verifiedNodeCount = allNodes.filter((node) => node.provenance.verificationStatus === 'verified').length;

  return {
    graphVersion: SEMANTIC_GRAPH_VERSION,
    indexVersion,
    nodeCount: allNodes.length,
    edgeCount: edges.size,
    staleNodeCount,
    verifiedNodeCount,
  };
};
