import type { ArtifactRef } from './artifactRef.types';

export const SEMANTIC_GRAPH_VERSION = '1.0.0';

export type SemanticVerificationStatus = 'verified' | 'stale' | 'failed' | 'candidate';

export type SemanticGraphProvenance = {
  sourceType: string;
  sourceReference: string;
  confidence: number;
  verificationStatus: SemanticVerificationStatus;
  observedAt: string;
  lastVerifiedAt?: string;
  indexVersion: number;
};

export type SemanticGraphNodeKind =
  | 'Application'
  | 'Package'
  | 'Page'
  | 'ServerFunction'
  | 'Route'
  | 'Service'
  | 'Component';

export type SemanticGraphEdgeKind =
  | 'BELONGS_TO'
  | 'CONTAINS'
  | 'REFERENCES'
  | 'DEPENDS_ON'
  | 'CALLS'
  | 'IMPORTS'
  | 'EXPOSED_IN';

export type SemanticGraphNode = {
  nodeId: string;
  kind: SemanticGraphNodeKind;
  label: string;
  artifactRef?: ArtifactRef;
  provenance: SemanticGraphProvenance;
  properties?: Record<string, string | number | boolean>;
};

export type SemanticGraphEdge = {
  edgeId: string;
  kind: SemanticGraphEdgeKind;
  fromNodeId: string;
  toNodeId: string;
  provenance: SemanticGraphProvenance;
};

export type SemanticGraphTraversalResult = {
  startNodeId: string;
  visitedNodeIds: string[];
  edges: SemanticGraphEdge[];
  maxDepth: number;
};

export type SemanticGraphImpactResult = {
  originNodeId: string;
  impactedNodeIds: string[];
  boundaryCrossings: string[];
  maxDepth: number;
};

export type SemanticGraphStoreHealth = {
  graphVersion: string;
  indexVersion: number;
  nodeCount: number;
  edgeCount: number;
  staleNodeCount: number;
  verifiedNodeCount: number;
};
