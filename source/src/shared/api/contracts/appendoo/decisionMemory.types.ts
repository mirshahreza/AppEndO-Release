export const DECISION_MEMORY_VERSION = '1.0.0';

export type DecisionStatus = 'PROPOSED' | 'ACTIVE' | 'SUPERSEDED' | 'RETIRED';

export type DecisionType = 'ADR' | 'SEMANTIC_DECISION';

export type EngineeringDecisionRecord = {
  decisionId: string;
  applicationScopeRef: string;
  packageScope?: string;
  type: DecisionType;
  title: string;
  status: DecisionStatus;
  canonicalStatement: string;
  terms: string[];
  multilingualAliases: Record<string, string[]>;
  excludedMeanings: string[];
  rationale?: string;
  sourceRefs: string[];
  version: string;
  supersedes?: string;
};

export type TermResolutionResult = {
  phrase: string;
  applicationScopeRef: string;
  canonicalConcepts: string[];
  aliases: string[];
  excludedConcepts: string[];
  matchedDecisionIds: string[];
  confidence: number;
  evidence: string[];
};

export type DecisionMemoryHealth = {
  memoryVersion: string;
  activeDecisionCount: number;
  proposedDecisionCount: number;
  termCount: number;
};
