import type { AiPageContext } from '../../../shared/api/contracts/ai/pageContext';
import type { ApplicationScopeRef } from '../../../shared/api/contracts/appendoo/applicationScope.types';
import type { ContextPack } from '../../../shared/api/contracts/appendoo/contextPack.types';
import { HYBRID_RETRIEVAL_POLICY_VERSION } from '../../../shared/api/contracts/appendoo/semanticRetrieval.types';
import { DECISION_MEMORY_VERSION } from '../../../shared/api/contracts/appendoo/decisionMemory.types';
import { enrichContextPackWithRanking } from '../../../shared/lib/appendoo/contextRankingScaffold';
import {
  buildContextPackScaffold,
  enrichContextPackWithApplicationIntelligence,
  enrichContextPackWithCodebaseRetrieval,
  enrichContextPackWithMemoryKnowledge,
  summarizeContextPack,
} from '../../../shared/lib/appendoo/contextPackBuilder';
import { resolveApplicationIntelligenceEnrichment } from '../../../shared/lib/appendoo/contextPackApplicationIntelligence';
import { loadFeatureGraph } from '../../../shared/lib/featureGraphStore';
import { findApplicablePatterns } from '../../../shared/lib/appendoo/engineeringPatternRegistry';
import { applicationIntelligenceService } from './applicationIntelligence.service';
import { codebaseRetrievalService } from './codebaseRetrieval.service';
import { memoryKnowledgeCapabilitiesService } from './memoryKnowledgeCapabilities.service';
import {
  extractPromptEngineeringTargets,
  mergePromptTargetsIntoPageContext,
  resolvePromptDrivenSearchScopePaths,
  resolvePromptEngineeringTargets,
} from '../../../shared/lib/appendoo/promptEngineeringTargets';
import { logger } from '../../../core/logging/Logger';
import { runRetrievalStep, retrievalOutcomeOr } from '../../../shared/lib/appendoo/retrievalOutcome';

export type BuildRunContextPackInput = {
  applicationScope: ApplicationScopeRef | null;
  pageContext?: AiPageContext;
  userPrompt?: string;
  correlationId?: string;
  intentId?: string;
};

export class ContextIntelligenceService {
  buildRunContextPack(input: BuildRunContextPackInput): ContextPack {
    const featureGraphOutcome = runRetrievalStep(() => loadFeatureGraph());
    let featureGraph: ReturnType<typeof loadFeatureGraph> | undefined;
    let featureGraphVersion: string | undefined;
    if (featureGraphOutcome.status === 'SUCCESS') {
      featureGraph = featureGraphOutcome.data;
      featureGraphVersion = featureGraph.version;
    } else {
      logger.warn('ContextIntelligenceService', 'Feature graph load failed', { errorCode: featureGraphOutcome.errorCode });
    }

    const promptTargets = resolvePromptEngineeringTargets(
      extractPromptEngineeringTargets(input.userPrompt ?? ''),
    );
    const effectivePageContext = mergePromptTargetsIntoPageContext(
      input.pageContext,
      promptTargets,
    );

    const pack = buildContextPackScaffold({
      applicationScope: input.applicationScope,
      pageContext: effectivePageContext,
      userPrompt: input.userPrompt,
      correlationId: input.correlationId,
      intentId: input.intentId,
      featureGraphVersion,
    });

    const scopeKey = input.applicationScope?.scopeKey ?? 'platform:unknown';

    applicationIntelligenceService.reindexOnPageContextChange({
      applicationScopeRef: scopeKey,
      pageKey: effectivePageContext?.pageKey ?? input.pageContext?.pageKey,
      graph: featureGraph,
    });

    const intelligenceEnrichment = resolveApplicationIntelligenceEnrichment({
      graph: featureGraph,
      applicationScope: input.applicationScope,
      pageKey: effectivePageContext?.pageKey ?? input.pageContext?.pageKey,
    });
    let enriched = enrichContextPackWithApplicationIntelligence(pack, intelligenceEnrichment);

    let scopePaths: string[] | undefined = resolvePromptDrivenSearchScopePaths(promptTargets);
    let scopePathsOutcomeStatus: 'SUCCESS' | 'FAILED' = 'SUCCESS';
    if (!scopePaths && effectivePageContext?.pageKey && featureGraph) {
      const scopePathsOutcome = runRetrievalStep(() => {
        const node = featureGraph.nodes.find((entry) => entry.pageKey === effectivePageContext.pageKey);
        return node ? codebaseRetrievalService.resolveScopePathsFromFeatureNode(node) : undefined;
      });
      scopePathsOutcomeStatus = scopePathsOutcome.status;
      if (scopePathsOutcome.status === 'SUCCESS') {
        scopePaths = scopePathsOutcome.data;
      } else {
        logger.warn('ContextIntelligenceService', 'Scope-path resolution failed', { errorCode: scopePathsOutcome.errorCode });
      }
    }

    const structuralEvidenceOutcome = runRetrievalStep(() => {
      const structural = codebaseRetrievalService.enrichStructuralEvidence({
        query: input.userPrompt,
        applicationScopeRef: scopeKey,
        scopePaths,
        maxResults: 5,
      });
      const similar = input.userPrompt?.trim()
        ? codebaseRetrievalService.hybridRetrieve({
          query: input.userPrompt,
          applicationScopeRef: scopeKey,
          scopePaths,
          maxResults: 3,
        }).hits.map((hit) => hit.path)
        : [];
      return { structural, similar };
    });
    let structuralEvidence: string[] = [];
    let similarImplementations: string[] = [];
    if (structuralEvidenceOutcome.status === 'SUCCESS') {
      structuralEvidence = structuralEvidenceOutcome.data.structural;
      similarImplementations = structuralEvidenceOutcome.data.similar;
    } else {
      logger.warn('ContextIntelligenceService', 'Structural/hybrid retrieval failed', { errorCode: structuralEvidenceOutcome.errorCode });
    }

    enriched = enrichContextPackWithCodebaseRetrieval(enriched, {
      structuralEvidence,
      similarImplementations,
      codebaseIndexVersion: featureGraphVersion,
    });

    const termResolution = memoryKnowledgeCapabilitiesService.resolveTerm(
      input.userPrompt ?? '',
      scopeKey,
    );
    const promotedGovernance = memoryKnowledgeCapabilitiesService.promoteGovernanceForScope(
      scopeKey,
      input.userPrompt,
    );
    const patterns = findApplicablePatterns(undefined, {
      appliesTo: effectivePageContext?.pageKey ?? input.pageContext?.pageKey,
    });
    const capabilityHealth = memoryKnowledgeCapabilitiesService.getHealth();

    enriched = enrichContextPackWithMemoryKnowledge(enriched, {
      governance: [...termResolution.evidence, ...promotedGovernance],
      capabilityEvidence: memoryKnowledgeCapabilitiesService.buildCapabilityEvidence({
        requestClass: 'CONTEXT_QUERY',
        mode: 'ask',
      }),
      trustedPatterns: patterns.map((pattern) => pattern.patternId),
      decisionMemoryVersion: DECISION_MEMORY_VERSION,
      capabilitySnapshotVersion: capabilityHealth.capabilityRegistry.registryVersion,
    });

    return enrichContextPackWithRanking({
      ...enriched,
      indexVersions: {
        ...enriched.indexVersions,
        codebaseIndex: featureGraphVersion ?? enriched.indexVersions.codebaseIndex,
        retrievalPolicy: HYBRID_RETRIEVAL_POLICY_VERSION,
        decisionMemory: DECISION_MEMORY_VERSION,
        capabilitySnapshot: capabilityHealth.capabilityRegistry.registryVersion,
      },
      retrievalHealth: {
        featureGraph: featureGraphOutcome.status,
        scopePaths: scopePathsOutcomeStatus,
        structuralEvidence: structuralEvidenceOutcome.status,
      },
    }, input.userPrompt);
  }

  summarizeRunContextPack(pack: ContextPack) {
    return summarizeContextPack(pack);
  }
}

export const contextIntelligenceService = new ContextIntelligenceService();
