import type {
  DecisionMemoryHealth,
  EngineeringDecisionRecord,
  TermResolutionResult,
} from '../../api/contracts/appendoo/decisionMemory.types';
import { DECISION_MEMORY_VERSION } from '../../api/contracts/appendoo/decisionMemory.types';

const decisions = new Map<string, EngineeringDecisionRecord>();

const seedDecisions = (): void => {
  if (decisions.size > 0) return;

  const seeds: EngineeringDecisionRecord[] = [
    {
      decisionId: 'sem.app-endoo-brand',
      applicationScopeRef: 'platform:studio',
      type: 'SEMANTIC_DECISION',
      title: 'AppEndoo assistant brand',
      status: 'ACTIVE',
      canonicalStatement: 'AppEndoo is the AI assistant brand; AppEndO remains the platform brand.',
      terms: ['appendoo', 'app endoo'],
      multilingualAliases: {
        en: ['AppEndoo assistant', 'AppEndoo chat', 'App Endoo'],
      },
      excludedMeanings: ['rename appendo-* MCP pack ids', 'rename repository AppEndO'],
      rationale: 'AE-1 rebrand decision',
      sourceRefs: ['specs/appendoo/spec.md'],
      version: '1.0.0',
    },
    {
      decisionId: 'adr.engineering-pipeline-only',
      applicationScopeRef: 'platform:studio',
      type: 'ADR',
      title: 'Engineering changes require V3 pipeline',
      status: 'ACTIVE',
      canonicalStatement: 'ENGINEERING_CHANGE requests must use the V3 engineering pipeline after cutover.',
      terms: ['engineering change', 'vibe write', 'changeset apply'],
      multilingualAliases: {
        en: ['engineering pipeline', 'V3 engineering pipeline'],
      },
      excludedMeanings: ['direct v1 ChangeSet apply in production'],
      sourceRefs: ['docs/appendoo/reality-audit.md'],
      version: '1.0.0',
    },
  ];

  for (const decision of seeds) {
    decisions.set(decision.decisionId, decision);
  }
};

export const resetDecisionMemoryForTests = (): void => {
  decisions.clear();
};

export const listDecisions = (): EngineeringDecisionRecord[] => {
  seedDecisions();
  return [...decisions.values()];
};

export const upsertDecision = (record: EngineeringDecisionRecord): EngineeringDecisionRecord => {
  seedDecisions();
  decisions.set(record.decisionId, record);
  return record;
};

export const promoteDecision = (decisionId: string): EngineeringDecisionRecord | undefined => {
  seedDecisions();
  const existing = decisions.get(decisionId);
  if (!existing || existing.status !== 'PROPOSED') {
    return undefined;
  }
  const promoted: EngineeringDecisionRecord = { ...existing, status: 'ACTIVE' };
  decisions.set(decisionId, promoted);
  return promoted;
};

export const listProposedDecisions = (
  applicationScopeRef: string,
): EngineeringDecisionRecord[] => {
  seedDecisions();
  return listDecisions().filter((decision) => (
    decision.status === 'PROPOSED'
    && (decision.applicationScopeRef === applicationScopeRef
      || decision.applicationScopeRef.startsWith('platform:'))
  ));
};

export const proposeDecision = (
  input: Omit<EngineeringDecisionRecord, 'decisionId' | 'status' | 'version'> & { decisionId?: string },
): EngineeringDecisionRecord => {
  const record: EngineeringDecisionRecord = {
    ...input,
    decisionId: input.decisionId ?? `dec.proposed:${Date.now()}`,
    status: 'PROPOSED',
    version: '1.0.0',
  };
  return upsertDecision(record);
};

const normalizePhrase = (phrase: string): string => phrase.trim().toLowerCase();

export const resolveTerm = (
  phrase: string,
  applicationScopeRef: string,
): TermResolutionResult => {
  seedDecisions();
  const normalized = normalizePhrase(phrase);
  const matched = listDecisions().filter((decision) => (
    decision.status === 'ACTIVE'
    && (decision.applicationScopeRef === applicationScopeRef || decision.applicationScopeRef.startsWith('platform:'))
  ));

  const canonicalConcepts = new Set<string>();
  const aliases = new Set<string>();
  const excludedConcepts = new Set<string>();
  const matchedDecisionIds: string[] = [];
  const evidence: string[] = [];

  for (const decision of matched) {
    const termHit = decision.terms.some((term) => normalized.includes(term.toLowerCase()));
    const aliasHit = Object.values(decision.multilingualAliases)
      .flat()
      .some((alias) => normalized.includes(alias.toLowerCase()));

    if (!termHit && !aliasHit) continue;

    matchedDecisionIds.push(decision.decisionId);
    canonicalConcepts.add(decision.title);
    evidence.push(decision.canonicalStatement);
    decision.terms.forEach((term) => aliases.add(term));
    Object.values(decision.multilingualAliases).flat().forEach((alias) => aliases.add(alias));
    decision.excludedMeanings.forEach((meaning) => excludedConcepts.add(meaning));
  }

  return {
    phrase,
    applicationScopeRef,
    canonicalConcepts: [...canonicalConcepts],
    aliases: [...aliases],
    excludedConcepts: [...excludedConcepts],
    matchedDecisionIds,
    confidence: matchedDecisionIds.length > 0 ? 0.9 : 0,
    evidence,
  };
};

export const getDecisionMemoryHealth = (): DecisionMemoryHealth => {
  seedDecisions();
  const all = listDecisions();
  const termCount = all.reduce((total, decision) => (
    total + decision.terms.length + Object.values(decision.multilingualAliases).flat().length
  ), 0);

  return {
    memoryVersion: DECISION_MEMORY_VERSION,
    activeDecisionCount: all.filter((decision) => decision.status === 'ACTIVE').length,
    proposedDecisionCount: all.filter((decision) => decision.status === 'PROPOSED').length,
    termCount,
  };
};
