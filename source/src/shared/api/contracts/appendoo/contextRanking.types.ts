import type { ContextSelectionReasonCode } from './contextPack.types';

export const CONTEXT_RANKING_POLICY_VERSION = '1.0.0';

export type ContextRankingCandidateKind =
  | 'target'
  | 'standard'
  | 'pattern'
  | 'structural'
  | 'governance'
  | 'capability';

export type ContextRankingScores = {
  exactMatch: number;
  lexical: number;
  semantic: number;
  governingDecision: number;
  freshness: number;
};

export type ContextRankingCandidate = {
  candidateId: string;
  kind: ContextRankingCandidateKind;
  evidenceId: string;
  label: string;
  reasonCode: ContextSelectionReasonCode;
  hardInclude: boolean;
  scores: ContextRankingScores;
  estimatedTokens: number;
};

export type ContextRankingWeights = {
  exactMatch: number;
  lexical: number;
  semantic: number;
  governingDecision: number;
  freshness: number;
  inferencePenalty: number;
};

export type ContextRankingResult = {
  policyVersion: string;
  candidates: ContextRankingCandidate[];
  selectedCandidateIds: string[];
  overflow: boolean;
  totalEstimatedTokens: number;
};

export const DEFAULT_CONTEXT_RANKING_WEIGHTS: ContextRankingWeights = {
  exactMatch: 1,
  lexical: 0.35,
  semantic: 0.25,
  governingDecision: 0.8,
  freshness: 0.1,
  inferencePenalty: 0.2,
};
