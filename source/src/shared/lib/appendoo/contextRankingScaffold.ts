import type { ContextPack } from '../../api/contracts/appendoo/contextPack.types';
import type {
  ContextRankingCandidate,
  ContextRankingResult,
  ContextRankingWeights,
} from '../../api/contracts/appendoo/contextRanking.types';
import {
  CONTEXT_RANKING_POLICY_VERSION,
  DEFAULT_CONTEXT_RANKING_WEIGHTS,
} from '../../api/contracts/appendoo/contextRanking.types';
import { findApplicablePatterns } from './engineeringPatternRegistry';

const estimateTokens = (text: string): number => Math.max(1, Math.ceil(text.length / 4));

export const scoreContextRankingCandidate = (
  candidate: ContextRankingCandidate,
  weights: ContextRankingWeights = DEFAULT_CONTEXT_RANKING_WEIGHTS,
): number => (
  candidate.scores.exactMatch * weights.exactMatch
  + candidate.scores.lexical * weights.lexical
  + candidate.scores.semantic * weights.semantic
  + candidate.scores.governingDecision * weights.governingDecision
  + candidate.scores.freshness * weights.freshness
);

export const buildContextRankingCandidates = (
  pack: ContextPack,
  userPrompt?: string,
): ContextRankingCandidate[] => {
  const prompt = userPrompt?.trim().toLowerCase() ?? '';
  const candidates: ContextRankingCandidate[] = [];

  for (const target of pack.primaryTargets) {
    candidates.push({
      candidateId: `candidate:${target.targetId}`,
      kind: 'target',
      evidenceId: target.targetId,
      label: target.label,
      reasonCode: 'EXACT_TARGET',
      hardInclude: true,
      scores: {
        exactMatch: 1,
        lexical: prompt.includes(target.label.toLowerCase()) ? 0.5 : 0.2,
        semantic: 0,
        governingDecision: 0,
        freshness: 1,
      },
      estimatedTokens: estimateTokens(`${target.label} ${target.ref ?? ''}`),
    });
  }

  for (const standard of pack.engineeringStandards) {
    const normative = standard.trust === 'PLATFORM_VERIFIED' || standard.trust === 'ARCHITECT_APPROVED';
    candidates.push({
      candidateId: `candidate:${standard.recordId}`,
      kind: 'standard',
      evidenceId: standard.recordId,
      label: standard.title,
      reasonCode: 'STANDARD',
      hardInclude: normative,
      scores: {
        exactMatch: prompt.includes(standard.sourceId.toLowerCase()) ? 1 : 0,
        lexical: prompt.includes(standard.title.toLowerCase()) ? 0.6 : 0.2,
        semantic: 0.1,
        governingDecision: normative ? 0.5 : 0,
        freshness: 1,
      },
      estimatedTokens: estimateTokens(`${standard.title} ${standard.statement}`),
    });
  }

  for (const evidence of pack.governance) {
    candidates.push({
      candidateId: `candidate:gov:${estimateTokens(evidence)}`,
      kind: 'governance',
      evidenceId: evidence.slice(0, 48),
      label: evidence.slice(0, 80),
      reasonCode: 'GOVERNING_DECISION',
      hardInclude: true,
      scores: {
        exactMatch: 0,
        lexical: 0.2,
        semantic: 0,
        governingDecision: 1,
        freshness: 1,
      },
      estimatedTokens: estimateTokens(evidence),
    });
  }

  for (const structural of pack.structuralEvidence) {
    candidates.push({
      candidateId: `candidate:struct:${structural}`,
      kind: 'structural',
      evidenceId: structural,
      label: structural,
      reasonCode: 'DIRECT_CALLEE',
      hardInclude: false,
      scores: {
        exactMatch: 0,
        lexical: 0.7,
        semantic: 0.2,
        governingDecision: 0,
        freshness: 0.8,
      },
      estimatedTokens: estimateTokens(structural),
    });
  }

  for (const capabilityId of pack.capabilityEvidence) {
    candidates.push({
      candidateId: `candidate:cap:${capabilityId}`,
      kind: 'capability',
      evidenceId: capabilityId,
      label: capabilityId,
      reasonCode: 'CAPABILITY',
      hardInclude: false,
      scores: {
        exactMatch: 0,
        lexical: 0.3,
        semantic: 0,
        governingDecision: 0,
        freshness: 1,
      },
      estimatedTokens: estimateTokens(capabilityId),
    });
  }

  const patterns = findApplicablePatterns(undefined, {
    query: userPrompt,
    appliesTo: pack.primaryTargets[0]?.ref,
    maxResults: 3,
  });
  for (const pattern of patterns) {
    candidates.push({
      candidateId: `candidate:${pattern.patternId}`,
      kind: 'pattern',
      evidenceId: pattern.patternId,
      label: pattern.title,
      reasonCode: 'TRUSTED_PATTERN',
      hardInclude: false,
      scores: {
        exactMatch: 0,
        lexical: 0.4,
        semantic: 0.3,
        governingDecision: 0.2,
        freshness: 1,
      },
      estimatedTokens: estimateTokens(`${pattern.title} ${pattern.solutionStructure}`),
    });
  }

  return candidates;
};

export const rankContextCandidates = (
  candidates: ContextRankingCandidate[],
  weights: ContextRankingWeights = DEFAULT_CONTEXT_RANKING_WEIGHTS,
): ContextRankingCandidate[] => (
  [...candidates].sort((left, right) => {
    const leftHard = Number(left.hardInclude);
    const rightHard = Number(right.hardInclude);
    if (leftHard !== rightHard) return rightHard - leftHard;
    return scoreContextRankingCandidate(right, weights) - scoreContextRankingCandidate(left, weights);
  })
);

export const applyContextTokenBudget = (
  candidates: ContextRankingCandidate[],
  tokenBudget: number,
): ContextRankingResult => {
  const ranked = rankContextCandidates(candidates);
  const hardIncludes = ranked.filter((candidate) => candidate.hardInclude);
  const hardTokenTotal = hardIncludes.reduce((total, candidate) => total + candidate.estimatedTokens, 0);

  if (hardTokenTotal > tokenBudget) {
    return {
      policyVersion: CONTEXT_RANKING_POLICY_VERSION,
      candidates: ranked,
      selectedCandidateIds: hardIncludes.map((candidate) => candidate.candidateId),
      overflow: true,
      totalEstimatedTokens: hardTokenTotal,
    };
  }

  const selected: ContextRankingCandidate[] = [...hardIncludes];
  let runningTokens = hardTokenTotal;

  for (const candidate of ranked) {
    if (candidate.hardInclude) continue;
    if (runningTokens + candidate.estimatedTokens > tokenBudget) continue;
    selected.push(candidate);
    runningTokens += candidate.estimatedTokens;
  }

  return {
    policyVersion: CONTEXT_RANKING_POLICY_VERSION,
    candidates: ranked,
    selectedCandidateIds: selected.map((entry) => entry.candidateId),
    overflow: false,
    totalEstimatedTokens: runningTokens,
  };
};

export const enrichContextPackWithRanking = (
  pack: ContextPack,
  userPrompt?: string,
): ContextPack => {
  const candidates = buildContextRankingCandidates(pack, userPrompt);
  const ranking = applyContextTokenBudget(candidates, pack.tokenBudget);
  const selected = new Set(ranking.selectedCandidateIds);

  const trustedPatterns = candidates
    .filter((candidate) => candidate.kind === 'pattern' && selected.has(candidate.candidateId))
    .map((candidate) => candidate.evidenceId);

  const selectionExplanations = candidates
    .filter((candidate) => selected.has(candidate.candidateId))
    .map((candidate) => ({
      reasonCode: candidate.reasonCode,
      evidenceId: candidate.evidenceId,
      summary: `Selected via ranking policy ${ranking.policyVersion} (${candidate.kind}).`,
    }));

  return {
    ...pack,
    trustedPatterns,
    selectionExplanations,
    indexVersions: {
      ...pack.indexVersions,
      retrievalPolicy: ranking.policyVersion,
    },
    overflow: ranking.overflow ? 'CONTEXT_OVERFLOW' : pack.overflow,
  };
};
