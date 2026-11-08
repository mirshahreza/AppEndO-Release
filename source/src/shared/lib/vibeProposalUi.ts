import type { ChangeSet } from '../api/contracts/ai/agentTypes';

const PROPOSAL_CONFIRM_PATTERNS: RegExp[] = [
  /^(yes|yep|ok|okay|confirm|apply|approve|go ahead|do it|create it|ship it)\.?$/i,
  /^(confirm|apply)(\s+(it|now|changes?))?\.?$/i,
];

/** User is confirming a pending vibe proposal — not starting a new task. */
export const detectProposalConfirmIntent = (text: string): boolean => {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 80) return false;
  return PROPOSAL_CONFIRM_PATTERNS.some((pattern) => pattern.test(trimmed));
};

export type PendingVibeProposal = {
  messageIndex: number;
  proposal: { proposalId: string; changeSets: ChangeSet[] };
};

export const findPendingVibeProposal = (
  messages: Array<{ role: string; vibeProposal?: { proposalId: string; changeSets: ChangeSet[] }; vibeApplied?: boolean }>,
): PendingVibeProposal | null => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== 'assistant' || !message.vibeProposal || message.vibeApplied) {
      continue;
    }
    return { messageIndex: index, proposal: message.vibeProposal };
  }
  return null;
};

export const proposalHasValidationErrors = (
  validation?: { violations: Array<{ severity: string }> },
): boolean => validation?.violations.some((violation) => violation.severity === 'error') ?? false;

export const getProposalConfirmLabel = (
  changeSets: ChangeSet[],
  options?: { applied?: boolean; busy?: boolean },
): string => {
  if (options?.busy) {
    return changeSets.length === 1 && changeSets[0]?.kind === 'function_source_patch'
      ? 'Creating…'
      : 'Applying…';
  }
  if (options?.applied) {
    if (changeSets.length === 1 && changeSets[0]?.kind === 'function_source_patch') {
      return 'Created';
    }
    if (changeSets.length === 1 && changeSets[0]?.kind === 'component_layout_patch') {
      return 'Created';
    }
    return 'Applied';
  }

  if (changeSets.length === 1) {
    switch (changeSets[0]?.kind) {
      case 'function_source_patch':
        return 'Create function';
      case 'component_layout_patch':
        return 'Create layout';
      case 'file_patch':
        return 'Apply changes';
      case 'git_operation':
        return 'Run git command';
      default:
        return 'Confirm';
    }
  }

  return `Apply ${changeSets.length} changes`;
};

export const getProposalPanelTitle = (changeSets: ChangeSet[]): string => {
  if (changeSets.length === 1 && changeSets[0]?.kind === 'function_source_patch') {
    return 'New server function';
  }
  if (changeSets.length === 1 && changeSets[0]?.kind === 'component_layout_patch') {
    return 'New component layout';
  }
  return `Proposed changes (${changeSets.length})`;
};
