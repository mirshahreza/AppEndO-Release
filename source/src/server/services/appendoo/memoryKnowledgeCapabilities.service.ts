import type { AiCapabilityPackId } from '../../../shared/api/contracts/ai/capabilityPacks';
import type { EffectiveCapabilityResolutionInput } from '../../../shared/api/contracts/appendoo/capabilityRegistry.types';
import type { FindApplicablePatternsOptions } from '../../../shared/lib/appendoo/engineeringPatternRegistry';
import { knowledgeRegistryService } from './knowledgeRegistry.service';
import {
  canPerform,
  explainCapabilityDenial,
  getCapabilityRegistryHealth,
  resolveEffectiveCapabilities,
} from '../../../shared/lib/appendoo/capabilityRegistryScaffold';
import {
  getDecisionMemoryHealth,
  listDecisions,
  listProposedDecisions,
  promoteDecision,
  proposeDecision,
  resolveTerm,
} from '../../../shared/lib/appendoo/decisionMemoryScaffold';
import {
  findApplicablePatterns,
  getPattern,
  getPatternRegistryHealth,
} from '../../../shared/lib/appendoo/engineeringPatternRegistry';

export class MemoryKnowledgeCapabilitiesService {
  resolveTerm(phrase: string, applicationScopeRef: string) {
    return resolveTerm(phrase, applicationScopeRef);
  }

  listDecisions() {
    return listDecisions();
  }

  proposeDecision(
    input: Parameters<typeof proposeDecision>[0],
  ) {
    return proposeDecision(input);
  }

  /** AE-5.3 — promote PROPOSED decisions into context pack governance terms. */
  promoteGovernanceForScope(applicationScopeRef: string, userPrompt?: string): string[] {
    const proposed = listProposedDecisions(applicationScopeRef);
    const normalizedPrompt = userPrompt?.trim().toLowerCase() ?? '';
    const governance: string[] = [];

    for (const decision of proposed) {
      const termHit = normalizedPrompt.length > 0
        && decision.terms.some((term) => normalizedPrompt.includes(term.toLowerCase()));
      const titleHit = normalizedPrompt.length > 0
        && normalizedPrompt.includes(decision.title.toLowerCase());

      if (!normalizedPrompt || termHit || titleHit) {
        const promoted = promoteDecision(decision.decisionId);
        if (promoted) {
          governance.push(promoted.canonicalStatement);
        }
      }
    }

    return governance;
  }

  findStandards(options: Parameters<typeof knowledgeRegistryService.findStandards>[0] = {}) {
    return knowledgeRegistryService.findStandards(options);
  }

  findConstraints(appliesTo?: string) {
    return knowledgeRegistryService.findConstraints(appliesTo);
  }

  findApplicablePatterns(options: FindApplicablePatternsOptions = {}) {
    return findApplicablePatterns(undefined, options);
  }

  getPattern(patternId: string) {
    return getPattern(patternId);
  }

  resolveEffectiveCapabilities(input: EffectiveCapabilityResolutionInput) {
    return resolveEffectiveCapabilities(input);
  }

  canPerform(capabilityId: string, input: EffectiveCapabilityResolutionInput) {
    return canPerform(capabilityId, input);
  }

  explainCapabilityDenial(capabilityId: string, input: EffectiveCapabilityResolutionInput) {
    return explainCapabilityDenial(capabilityId, input);
  }

  buildCapabilityEvidence(input: {
    requestClass: EffectiveCapabilityResolutionInput['requestClass'];
    mode: EffectiveCapabilityResolutionInput['mode'];
    enabledPackIds?: readonly AiCapabilityPackId[];
  }): string[] {
    const resolution = resolveEffectiveCapabilities({
      requestClass: input.requestClass,
      mode: input.mode,
      enabledPackIds: input.enabledPackIds ?? [],
    });
    return resolution.allowed.map((entry) => entry.capabilityId);
  }

  getHealth() {
    return {
      decisionMemory: getDecisionMemoryHealth(),
      capabilityRegistry: getCapabilityRegistryHealth(),
      patternRegistry: getPatternRegistryHealth(),
      knowledgeRegistry: knowledgeRegistryService.getHealth(),
    };
  }
}

export const memoryKnowledgeCapabilitiesService = new MemoryKnowledgeCapabilitiesService();
