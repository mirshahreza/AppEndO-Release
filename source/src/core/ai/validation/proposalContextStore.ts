import type { AiPageContext } from '../../../shared/api/contracts/ai/pageContext';

/**
 * p-98 — validation parity between propose-time and apply-time. AgentOrchestrator's propose-time
 * validation (buildProposalValidationOptions) includes pageContext/userIntentPaths, enforcing the
 * openFunctionId and file-path scope checks in proposalValidator.ts. changeSet.service.ts's
 * apply-time validation previously omitted both, silently disabling those checks. This store lets
 * apply() recover the same context propose() used, keyed by proposalId.
 */
export type ProposalContext = {
  pageContext?: AiPageContext;
  userIntentPaths?: string[];
};

const proposalContexts = new Map<string, ProposalContext>();

export const putProposalContext = (proposalId: string, context: ProposalContext): void => {
  proposalContexts.set(proposalId, context);
};

export const getProposalContext = (proposalId: string): ProposalContext | undefined => (
  proposalContexts.get(proposalId)
);

export const clearProposalContexts = (): void => {
  proposalContexts.clear();
};
