import { getCapabilityRegistryHealth, resolveEffectiveCapabilities } from './capabilityRegistryScaffold';
import { getDecisionMemoryHealth, promoteDecision, proposeDecision, resolveTerm } from './decisionMemoryScaffold';
import { getPatternRegistryHealth } from './engineeringPatternRegistry';
import { getRegistryHealth, ingestProjectStandards } from './engineeringKnowledgeRegistry';
import { PROJECT_STANDARDS } from '../../../config/projectStandards';

export const APPENDOO_MEMORY_KNOWLEDGE_HEALTH_VERSION = '1.1.0';

export type MemoryKnowledgeCapabilitiesHealthProbe = {
  ok: boolean;
  decisionMemoryVersion: string;
  capabilityRegistryVersion: string;
  patternCount: number;
  failures: string[];
};

/** AE-5.1 — health probe for golden eval / ops. */
export const probeMemoryKnowledgeCapabilitiesScaffold = (): MemoryKnowledgeCapabilitiesHealthProbe => {
  const failures: string[] = [];

  const decisionHealth = getDecisionMemoryHealth();
  const capabilityHealth = getCapabilityRegistryHealth();
  const patternHealth = getPatternRegistryHealth();
  const knowledgeHealth = getRegistryHealth(PROJECT_STANDARDS, ingestProjectStandards(PROJECT_STANDARDS));

  if (decisionHealth.activeDecisionCount < 1) {
    failures.push('Expected at least one active decision record.');
  }

  const aliasResolution = resolveTerm('AppEndoo assistant', 'platform:studio');
  if (aliasResolution.confidence <= 0) {
    failures.push('English alias term resolution failed.');
  }

  if (capabilityHealth.capabilityCount < 10) {
    failures.push('Capability registry bootstrap count too low.');
  }

  const resolution = resolveEffectiveCapabilities({
    requestClass: 'TOOL_QUERY',
    mode: 'ask',
    enabledPackIds: [],
  });
  if (resolution.allowed.length === 0) {
    failures.push('Ask-mode TOOL_QUERY should allow read capabilities.');
  }

  if (patternHealth.activeCount < 1) {
    failures.push('Expected at least one active engineering pattern.');
  }

  if (knowledgeHealth.normativeCount < 1) {
    failures.push('Knowledge registry has no normative records.');
  }

  const proposed = proposeDecision({
    applicationScopeRef: 'platform:studio',
    type: 'ADR',
    title: 'Health probe promotion',
    canonicalStatement: 'Promotion flow promotes PROPOSED decisions to ACTIVE.',
    terms: ['health-probe-promotion'],
    multilingualAliases: { en: ['health-probe-promotion'] },
    excludedMeanings: [],
    sourceRefs: ['appendoo/memoryKnowledgeCapabilitiesHealth.ts'],
  });
  const promoted = promoteDecision(proposed.decisionId);
  if (!promoted || promoted.status !== 'ACTIVE') {
    failures.push('Decision promotion flow failed in health probe.');
  }

  return {
    ok: failures.length === 0,
    decisionMemoryVersion: decisionHealth.memoryVersion,
    capabilityRegistryVersion: capabilityHealth.registryVersion,
    patternCount: patternHealth.patternCount,
    failures,
  };
};
