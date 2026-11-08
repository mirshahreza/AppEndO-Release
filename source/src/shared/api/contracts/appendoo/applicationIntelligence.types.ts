import type { ArtifactRef } from './artifactRef.types';
import type { SemanticGraphNodeKind } from './semanticGraph.types';

export const APPLICATION_INTELLIGENCE_VERSION = '1.0.0';

export type ApplicationMapEntry = {
  nodeId: string;
  kind: SemanticGraphNodeKind;
  label: string;
  artifactRef?: ArtifactRef;
};

export type ApplicationMapView = {
  applicationScopeRef: string;
  indexVersion: number;
  entries: ApplicationMapEntry[];
};

export type ArtifactContextView = {
  artifactRef: ArtifactRef;
  nodeId?: string;
  neighbors: ApplicationMapEntry[];
  dependencies: ApplicationMapEntry[];
};

export type ApplicationIntelligenceHealth = {
  intelligenceVersion: string;
  indexVersion: number;
  featureGraphSourceVersion?: string;
  codebaseIndexSourceVersion?: string;
  staleCount: number;
  queueDepth: number;
  failureCount: number;
  nodeCount: number;
  edgeCount: number;
  packageFreshness: Record<string, 'fresh' | 'stale' | 'unknown'>;
};

export type IntelligenceIndexJobKind =
  | 'reindex_artifact'
  | 'reindex_package'
  | 'rebuild_application';

export type IntelligenceIndexJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export type IntelligenceIndexJob = {
  jobId: string;
  kind: IntelligenceIndexJobKind;
  status: IntelligenceIndexJobStatus;
  idempotencyKey: string;
  applicationScopeRef?: string;
  artifactRef?: ArtifactRef;
  packageId?: string;
  createdAt: string;
  completedAt?: string;
  failureReason?: string;
};

export type EnqueueIntelligenceIndexInput = {
  kind: IntelligenceIndexJobKind;
  applicationScopeRef?: string;
  artifactRef?: ArtifactRef;
  packageId?: string;
  idempotencyKey?: string;
};
