import type { ApplicationScopeRef } from '../../api/contracts/appendoo/applicationScope.types';
import type {
  BuildContextPackInput,
  ContextPack,
  ContextPackTarget,
  ContextSelectionExplanation,
} from '../../api/contracts/appendoo/contextPack.types';
import {
  CONTEXT_PACK_BUILDER_VERSION,
  CONTEXT_RETRIEVAL_POLICY_VERSION,
  DEFAULT_CONTEXT_PACK_TOKEN_BUDGET,
} from '../../api/contracts/appendoo/contextPack.types';
import type { EngineeringKnowledgeRecord } from '../../api/contracts/appendoo/knowledgeRegistry.types';
import { findStandards, ingestProjectStandards } from './engineeringKnowledgeRegistry';
import { PROJECT_STANDARDS } from '../../../config/projectStandards';
import type { ApplicationIntelligenceEnrichmentInput } from './contextPackApplicationIntelligence';
import {
  extractPromptEngineeringTargets,
  hasPromptEngineeringTargets,
  resolvePromptEngineeringTargets,
} from './promptEngineeringTargets';

const buildContextPackId = (correlationId?: string, scopeKey?: string): string => {
  const seed = correlationId?.trim() || scopeKey?.trim() || 'anonymous';
  return `ctxpack:${seed}:${Date.now()}`;
};

const buildPrimaryTargets = (
  input: BuildContextPackInput,
  scope: ApplicationScopeRef | null,
): ContextPackTarget[] => {
  const targets: ContextPackTarget[] = [];
  const pageContext = input.pageContext;
  const promptTargets = resolvePromptEngineeringTargets(
    extractPromptEngineeringTargets(input.userPrompt ?? ''),
  );
  const promptDriven = hasPromptEngineeringTargets(promptTargets);

  if (promptTargets.functionId?.trim()) {
    targets.push({
      targetId: `function:${promptTargets.functionId.trim()}`,
      kind: 'function',
      label: promptTargets.functionName?.trim() || promptTargets.functionId.trim(),
      ref: promptTargets.functionId.trim(),
    });
  }

  if (promptTargets.layoutId?.trim()) {
    targets.push({
      targetId: `layout:${promptTargets.layoutId.trim()}`,
      kind: 'layout',
      label: `Designer layout ${promptTargets.layoutId.trim()}`,
      ref: promptTargets.layoutId.trim(),
    });
  }

  if (!promptDriven) {
    if (scope?.pageKey?.trim()) {
      targets.push({
        targetId: `page:${scope.pageKey}`,
        kind: 'page',
        label: pageContext?.pageLabel?.trim() || scope.pageKey,
        ref: scope.pageKey,
      });
    } else if (pageContext?.pageKey?.trim()) {
      targets.push({
        targetId: `page:${pageContext.pageKey.trim()}`,
        kind: 'page',
        label: pageContext.pageLabel?.trim() || pageContext.pageKey.trim(),
        ref: pageContext.pageKey.trim(),
      });
    }
  }

  if (pageContext?.functionId?.trim() && !targets.some((target) => target.kind === 'function')) {
    targets.push({
      targetId: `function:${pageContext.functionId.trim()}`,
      kind: 'function',
      label: pageContext.functionName?.trim() || pageContext.functionId.trim(),
      ref: pageContext.functionId.trim(),
    });
  }

  if (pageContext?.layoutId?.trim()) {
    targets.push({
      targetId: `layout:${pageContext.layoutId.trim()}`,
      kind: 'layout',
      label: `Designer layout ${pageContext.layoutId.trim()}`,
      ref: pageContext.layoutId.trim(),
    });
  }

  if (scope?.packageId?.trim()) {
    targets.push({
      targetId: `package:${scope.packageId}`,
      kind: 'package',
      label: scope.packageId,
      ref: scope.packageId,
    });
  }

  return targets;
};

const resolveApplicableStandards = (
  input: BuildContextPackInput,
  scope: ApplicationScopeRef | null,
): EngineeringKnowledgeRecord[] => {
  const records = ingestProjectStandards(PROJECT_STANDARDS);
  const queryParts = [
    input.pageContext?.pageKey,
    input.pageContext?.entityType,
    input.pageContext?.activeSectionId,
    scope?.pageKey,
  ].filter(Boolean) as string[];

  const query = queryParts.join(' ').trim();
  if (!query) {
    return findStandards(records, { maxResults: 8 });
  }

  const matched = findStandards(records, { query, maxResults: 12 });
  return matched.length > 0 ? matched : findStandards(records, { maxResults: 8 });
};

const buildSelectionExplanations = (
  targets: ContextPackTarget[],
  standards: EngineeringKnowledgeRecord[],
): ContextSelectionExplanation[] => {
  const explanations: ContextSelectionExplanation[] = targets.map((target) => ({
    reasonCode: 'EXACT_TARGET',
    evidenceId: target.targetId,
    summary: target.targetId.startsWith('function:') || target.targetId.startsWith('layout:')
      ? `Primary target resolved from user prompt (${target.kind}).`
      : `Primary target resolved from current page context (${target.kind}).`,
  }));

  for (const standard of standards) {
    explanations.push({
      reasonCode: 'STANDARD',
      evidenceId: standard.recordId,
      summary: `Normative standard ${standard.sourceId} applies to this context.`,
    });
  }

  return explanations;
};

/** AE-6.1 scaffold — deterministic Context Pack from scope, page context, and knowledge registry. */
export const buildContextPackScaffold = (input: BuildContextPackInput): ContextPack => {
  const scopeKey = input.applicationScope?.scopeKey ?? 'platform:unknown';
  const primaryTargets = buildPrimaryTargets(input, input.applicationScope);
  const engineeringStandards = resolveApplicableStandards(input, input.applicationScope);
  const selectionExplanations = buildSelectionExplanations(primaryTargets, engineeringStandards);

  return {
    contextPackId: buildContextPackId(input.correlationId, scopeKey),
    revision: 1,
    applicationScopeRef: scopeKey,
    intentId: input.intentId,
    correlationId: input.correlationId,
    indexVersions: {
      featureGraph: input.featureGraphVersion,
      knowledgeRegistry: input.knowledgeRegistryVersion ?? PROJECT_STANDARDS.version,
      retrievalPolicy: CONTEXT_RETRIEVAL_POLICY_VERSION,
      codebaseIndex: undefined,
    },
    tokenBudget: input.tokenBudget ?? DEFAULT_CONTEXT_PACK_TOKEN_BUDGET,
    primaryTargets,
    dependencies: [],
    governance: [],
    businessRules: [],
    permissions: [],
    structuralEvidence: [],
    similarImplementations: [],
    trustedPatterns: [],
    engineeringStandards,
    capabilityEvidence: [],
    capabilityGaps: [],
    relevantChanges: [],
    excludedCandidates: [],
    unresolvedTerms: [],
    conflicts: [],
    selectionExplanations,
  };
};

export const summarizeContextPack = (pack: ContextPack): {
  contextPackId: string;
  applicationScopeRef: string;
  primaryTargetCount: number;
  standardsCount: number;
  builderVersion: string;
} => ({
  contextPackId: pack.contextPackId,
  applicationScopeRef: pack.applicationScopeRef,
  primaryTargetCount: pack.primaryTargets.length,
  standardsCount: pack.engineeringStandards.length,
  builderVersion: CONTEXT_PACK_BUILDER_VERSION,
});

export type CodebaseRetrievalEnrichmentInput = {
  structuralEvidence?: string[];
  similarImplementations?: string[];
  codebaseIndexVersion?: string;
};

/** AE-4.2 — merge structural + semantic retrieval evidence into context pack. */
export const enrichContextPackWithCodebaseRetrieval = (
  pack: ContextPack,
  input: CodebaseRetrievalEnrichmentInput,
): ContextPack => {
  const structuralEvidence = [
    ...pack.structuralEvidence,
    ...(input.structuralEvidence ?? []),
  ];
  const similarImplementations = [
    ...pack.similarImplementations,
    ...(input.similarImplementations ?? []),
  ];
  const explanations: ContextSelectionExplanation[] = [];
  for (const evidence of input.structuralEvidence ?? []) {
    explanations.push({
      reasonCode: 'DIRECT_CALLER',
      evidenceId: evidence,
      summary: `Structural retrieval matched ${evidence}.`,
    });
  }
  for (const similar of input.similarImplementations ?? []) {
    explanations.push({
      reasonCode: 'SIMILAR_FEATURE',
      evidenceId: similar,
      summary: `Similar implementation candidate ${similar}.`,
    });
  }

  return {
    ...pack,
    structuralEvidence,
    similarImplementations,
    indexVersions: {
      ...pack.indexVersions,
      codebaseIndex: input.codebaseIndexVersion ?? pack.indexVersions.codebaseIndex,
      retrievalPolicy: CONTEXT_RETRIEVAL_POLICY_VERSION,
    },
    selectionExplanations: [...pack.selectionExplanations, ...explanations],
  };
};

export type MemoryKnowledgeEnrichmentInput = {
  governance?: string[];
  capabilityEvidence?: string[];
  capabilityGaps?: string[];
  trustedPatterns?: string[];
  decisionMemoryVersion?: string;
  capabilitySnapshotVersion?: string;
};

/** AE-5.2 — merge decision memory + capability registry evidence into context pack. */
export const enrichContextPackWithMemoryKnowledge = (
  pack: ContextPack,
  input: MemoryKnowledgeEnrichmentInput,
): ContextPack => {
  const explanations: ContextSelectionExplanation[] = [];
  for (const term of input.governance ?? []) {
    explanations.push({
      reasonCode: 'GOVERNING_DECISION',
      evidenceId: term,
      summary: `Governing decision term resolved: ${term}.`,
    });
  }
  for (const capability of input.capabilityEvidence ?? []) {
    explanations.push({
      reasonCode: 'CAPABILITY',
      evidenceId: capability,
      summary: `Capability evidence ${capability} applies to this request.`,
    });
  }
  for (const pattern of input.trustedPatterns ?? []) {
    explanations.push({
      reasonCode: 'TRUSTED_PATTERN',
      evidenceId: pattern,
      summary: `Trusted engineering pattern ${pattern}.`,
    });
  }

  return {
    ...pack,
    governance: [...pack.governance, ...(input.governance ?? [])],
    capabilityEvidence: [...pack.capabilityEvidence, ...(input.capabilityEvidence ?? [])],
    capabilityGaps: [...pack.capabilityGaps, ...(input.capabilityGaps ?? [])],
    trustedPatterns: [...pack.trustedPatterns, ...(input.trustedPatterns ?? [])],
    indexVersions: {
      ...pack.indexVersions,
      decisionMemory: input.decisionMemoryVersion ?? pack.indexVersions.decisionMemory,
      capabilitySnapshot: input.capabilitySnapshotVersion ?? pack.indexVersions.capabilitySnapshot,
    },
    selectionExplanations: [...pack.selectionExplanations, ...explanations],
  };
};

/** AE-3.2 — merge feature graph + ASG dependency hints into context pack. */
export const enrichContextPackWithApplicationIntelligence = (
  pack: ContextPack,
  input: ApplicationIntelligenceEnrichmentInput,
): ContextPack => {
  const dependencyTargets: ContextPackTarget[] = input.asgDependencyHints.map((hint, index) => ({
    targetId: `asg-dep:${index}:${hint}`,
    kind: 'artifact',
    label: hint,
    ref: hint,
  }));

  const explanations: ContextSelectionExplanation[] = [];
  for (const hint of input.asgDependencyHints) {
    explanations.push({
      reasonCode: 'GRAPH_DEPENDENCY',
      evidenceId: hint,
      summary: `ASG dependency ${hint} linked to primary target.`,
    });
  }
  for (const neighbor of input.asgNeighborLabels) {
    explanations.push({
      reasonCode: 'GRAPH_DEPENDENCY',
      evidenceId: neighbor,
      summary: `Application map neighbor ${neighbor}.`,
    });
  }
  for (const similar of input.similarFeatureHints) {
    explanations.push({
      reasonCode: 'SIMILAR_FEATURE',
      evidenceId: similar,
      summary: `ASG similar feature hint ${similar}.`,
    });
  }

  return {
    ...pack,
    dependencies: [...pack.dependencies, ...dependencyTargets],
    similarImplementations: [...pack.similarImplementations, ...input.similarFeatureHints],
    indexVersions: {
      ...pack.indexVersions,
      featureGraph: input.featureGraphVersion ?? pack.indexVersions.featureGraph,
    },
    selectionExplanations: [...pack.selectionExplanations, ...explanations],
  };
};
