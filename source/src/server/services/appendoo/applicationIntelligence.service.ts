import type { ArtifactRef } from '../../../shared/api/contracts/appendoo/artifactRef.types';
import type {
  ApplicationIntelligenceHealth,
  ApplicationMapView,
  ArtifactContextView,
  EnqueueIntelligenceIndexInput,
  IntelligenceIndexJob,
} from '../../../shared/api/contracts/appendoo/applicationIntelligence.types';
import type { FeatureGraph } from '../../../shared/lib/aiIndexCodegen';
import { loadFeatureGraph } from '../../../shared/lib/featureGraphStore';
import {
  bootstrapApplicationIntelligenceFromFeatureGraph,
  explainApplicationIntelligenceReach,
  findUsages,
  getApplicationIntelligenceHealth,
  getApplicationMap,
  getArtifact,
  getArtifactContext,
  getDependencies,
  getImpactAnalysis,
} from '../../../shared/lib/appendoo/applicationIntelligenceScaffold';
import {
  enqueueIntelligenceIndexJob,
  getIntelligenceIndexJob,
  rebuildApplication,
  reindexArtifact,
  reindexPackage,
  resetIntelligenceIndexCoordinatorForTests,
} from '../../../shared/lib/appendoo/intelligenceIndexCoordinator';
import { resetSemanticGraphStoreForTests } from '../../../shared/lib/appendoo/semanticGraphStore';

export class ApplicationIntelligenceService {
  private bootstrappedScopeKey: string | null = null;

  private bootstrappedGraphVersion: string | null = null;

  private lastIndexedPageContextKey: string | null = null;

  ensureBootstrapped(applicationScopeRef: string, graph?: FeatureGraph): void {
    const resolvedGraph = graph ?? loadFeatureGraph();
    if (
      this.bootstrappedScopeKey === applicationScopeRef
      && this.bootstrappedGraphVersion === resolvedGraph.version
    ) {
      return;
    }

    bootstrapApplicationIntelligenceFromFeatureGraph(resolvedGraph, applicationScopeRef);
    this.bootstrappedScopeKey = applicationScopeRef;
    this.bootstrappedGraphVersion = resolvedGraph.version;
  }

  getApplicationMap(applicationScopeRef: string, graph?: FeatureGraph): ApplicationMapView {
    this.ensureBootstrapped(applicationScopeRef, graph);
    return getApplicationMap(applicationScopeRef);
  }

  getArtifact(ref: ArtifactRef, applicationScopeRef: string, graph?: FeatureGraph) {
    this.ensureBootstrapped(applicationScopeRef, graph);
    return getArtifact(ref);
  }

  getArtifactContext(ref: ArtifactRef, applicationScopeRef: string, graph?: FeatureGraph): ArtifactContextView {
    this.ensureBootstrapped(applicationScopeRef, graph);
    return getArtifactContext(ref);
  }

  getImpactAnalysis(nodeId: string, applicationScopeRef: string, maxDepth = 2, graph?: FeatureGraph) {
    this.ensureBootstrapped(applicationScopeRef, graph);
    return getImpactAnalysis(nodeId, maxDepth);
  }

  findUsages(nodeId: string, applicationScopeRef: string, graph?: FeatureGraph) {
    this.ensureBootstrapped(applicationScopeRef, graph);
    return findUsages(nodeId);
  }

  getDependencies(nodeId: string, applicationScopeRef: string, graph?: FeatureGraph) {
    this.ensureBootstrapped(applicationScopeRef, graph);
    return getDependencies(nodeId);
  }

  getIndexHealth(applicationScopeRef: string, graph?: FeatureGraph): ApplicationIntelligenceHealth {
    this.ensureBootstrapped(applicationScopeRef, graph);
    const resolvedGraph = graph ?? loadFeatureGraph();
    return getApplicationIntelligenceHealth({
      featureGraphSourceVersion: resolvedGraph.version,
    });
  }

  explainReach(startNodeId: string, applicationScopeRef: string, maxDepth = 2, graph?: FeatureGraph) {
    this.ensureBootstrapped(applicationScopeRef, graph);
    return explainApplicationIntelligenceReach(startNodeId, maxDepth);
  }

  enqueue(input: EnqueueIntelligenceIndexInput): IntelligenceIndexJob {
    return enqueueIntelligenceIndexJob(input);
  }

  reindexArtifact(input: Parameters<typeof reindexArtifact>[0]): IntelligenceIndexJob {
    return reindexArtifact(input);
  }

  reindexPackage(input: Parameters<typeof reindexPackage>[0]): IntelligenceIndexJob {
    return reindexPackage(input);
  }

  rebuildApplication(input: Parameters<typeof rebuildApplication>[0]): IntelligenceIndexJob {
    return rebuildApplication(input);
  }

  getJob(jobId: string): IntelligenceIndexJob | undefined {
    return getIntelligenceIndexJob(jobId);
  }

  /** AE-3.3 — incremental ASG reindex when pageContext pageKey changes (not bootstrap-only). */
  reindexOnPageContextChange(input: {
    applicationScopeRef: string;
    pageKey?: string;
    graph?: FeatureGraph;
  }): IntelligenceIndexJob | undefined {
    const pageKey = input.pageKey?.trim();
    if (!pageKey) return undefined;

    const cacheKey = `${input.applicationScopeRef}:${pageKey}`;
    if (this.lastIndexedPageContextKey === cacheKey) {
      return undefined;
    }

    this.lastIndexedPageContextKey = cacheKey;
    this.ensureBootstrapped(input.applicationScopeRef, input.graph);

    return this.reindexArtifact({
      applicationScopeRef: input.applicationScopeRef,
      artifactRef: {
        applicationScopeRef: input.applicationScopeRef,
        artifactType: 'page',
        canonicalName: pageKey,
        artifactId: `page:${pageKey}`,
      },
      idempotencyKey: `page-context:${cacheKey}`,
    });
  }

  resetForTests(): void {
    this.bootstrappedScopeKey = null;
    this.bootstrappedGraphVersion = null;
    this.lastIndexedPageContextKey = null;
    resetSemanticGraphStoreForTests();
    resetIntelligenceIndexCoordinatorForTests();
  }
}

export const applicationIntelligenceService = new ApplicationIntelligenceService();
