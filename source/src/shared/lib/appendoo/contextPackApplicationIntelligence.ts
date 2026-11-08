import type { FeatureGraph } from '../aiIndexCodegen';
import type { ApplicationScopeRef } from '../../api/contracts/appendoo/applicationScope.types';
import {
  bootstrapApplicationIntelligenceFromFeatureGraph,
  getApplicationMap,
  getDependencies,
} from './applicationIntelligenceScaffold';
import { getSemanticGraphIndexVersion } from './semanticGraphStore';

export type ApplicationIntelligenceEnrichmentInput = {
  featureGraphVersion?: string;
  asgDependencyHints: string[];
  asgNeighborLabels: string[];
  similarFeatureHints: string[];
};

/** AE-3.2 — resolve ASG hints from feature graph for context pack enrichment. */
export const resolveApplicationIntelligenceEnrichment = (input: {
  graph?: FeatureGraph;
  applicationScope?: ApplicationScopeRef | null;
  pageKey?: string;
}): ApplicationIntelligenceEnrichmentInput => {
  const applicationScopeRef = input.applicationScope?.scopeKey ?? 'platform:unknown';
  const asgDependencyHints: string[] = [];
  const asgNeighborLabels: string[] = [];
  const similarFeatureHints: string[] = [];

  if (input.graph) {
    bootstrapApplicationIntelligenceFromFeatureGraph(input.graph, applicationScopeRef);
    const map = getApplicationMap(applicationScopeRef);
    for (const entry of map.entries.slice(0, 6)) {
      asgNeighborLabels.push(`${entry.kind}:${entry.label}`);
    }

    if (input.pageKey) {
      const pageNodeId = `page:${input.pageKey}`;
      const deps = getDependencies(pageNodeId);
      for (const dep of deps.slice(0, 4)) {
        asgDependencyHints.push(`${dep.kind}:${dep.label}`);
      }

      const related = map.entries
        .filter((entry) => entry.label.toLowerCase().includes(input.pageKey!.slice(0, 4).toLowerCase()))
        .slice(0, 3);
      for (const entry of related) {
        similarFeatureHints.push(`page:${entry.label}`);
      }
    }
  }

  return {
    featureGraphVersion: input.graph?.version ?? String(getSemanticGraphIndexVersion()),
    asgDependencyHints,
    asgNeighborLabels,
    similarFeatureHints,
  };
};
