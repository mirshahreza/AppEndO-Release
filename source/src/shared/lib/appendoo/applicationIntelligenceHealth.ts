import type { FeatureGraph } from '../aiIndexCodegen';
import {
  bootstrapApplicationIntelligenceFromFeatureGraph,
  getApplicationIntelligenceHealth,
  getApplicationMap,
} from './applicationIntelligenceScaffold';
import { getSemanticGraphStoreHealth, resetSemanticGraphStoreForTests } from './semanticGraphStore';

export const APPENDOO_APPLICATION_INTELLIGENCE_HEALTH_VERSION = '1.1.0';

export type ApplicationIntelligenceHealthProbe = {
  ok: boolean;
  intelligenceVersion: string;
  indexVersion: number;
  nodeCount: number;
  failures: string[];
};

/** AE-3.1 — health probe for golden eval / ops. */
export const probeApplicationIntelligenceScaffold = (input?: {
  graph?: FeatureGraph;
  applicationScopeRef?: string;
}): ApplicationIntelligenceHealthProbe => {
  const failures: string[] = [];
  const applicationScopeRef = input?.applicationScopeRef ?? 'platform:studio';

  if (input?.graph) {
    resetSemanticGraphStoreForTests();
    const bootstrap = bootstrapApplicationIntelligenceFromFeatureGraph(input.graph, applicationScopeRef);
    if (bootstrap.nodesReplaced <= 0) {
      failures.push('Feature graph import produced zero nodes.');
    }

    const map = getApplicationMap(applicationScopeRef);
    if (map.entries.length === 0) {
      failures.push('Application map has no entries after bootstrap.');
    }
  }

  const health = getApplicationIntelligenceHealth({
    featureGraphSourceVersion: input?.graph?.version,
  });
  const storeHealth = getSemanticGraphStoreHealth();

  if (health.intelligenceVersion.trim().length === 0) {
    failures.push('Missing intelligence version.');
  }

  if (storeHealth.graphVersion.trim().length === 0) {
    failures.push('Missing semantic graph version.');
  }

  return {
    ok: failures.length === 0,
    intelligenceVersion: health.intelligenceVersion,
    indexVersion: health.indexVersion,
    nodeCount: health.nodeCount,
    failures,
  };
};
