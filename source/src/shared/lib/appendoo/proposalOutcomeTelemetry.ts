export type ProposalOutcomeKind =
  | 'accepted'
  | 'rejected_full'
  | 'rejected_zone'
  | 'dismissed_pre_apply';

export type ProposalOutcomeRecord = {
  proposalId?: string;
  applyId?: number;
  outcome: ProposalOutcomeKind;
  changeSetCount: number;
  recordedAt: string;
};

const MAX_BUFFER = 500;
const buffer: ProposalOutcomeRecord[] = [];

export const recordProposalOutcome = (input: {
  proposalId?: string;
  applyId?: number;
  outcome: ProposalOutcomeKind;
  changeSetCount: number;
}): ProposalOutcomeRecord => {
  const record: ProposalOutcomeRecord = {
    proposalId: input.proposalId?.trim() || undefined,
    applyId: input.applyId,
    outcome: input.outcome,
    changeSetCount: Math.max(0, Math.floor(input.changeSetCount)),
    recordedAt: new Date().toISOString(),
  };
  buffer.push(record);
  if (buffer.length > MAX_BUFFER) {
    buffer.shift();
  }
  return record;
};

export const getProposalOutcomeRecords = (): ProposalOutcomeRecord[] => [...buffer];

export const clearProposalOutcomeRecords = (): void => {
  buffer.length = 0;
};

export const summarizeProposalOutcomes = (): {
  total: number;
  accepted: number;
  rejected: number;
  dismissedPreApply: number;
  acceptanceRate: number | null;
} => {
  const total = buffer.length;
  const accepted = buffer.filter((item) => item.outcome === 'accepted').length;
  const rejected = buffer.filter((item) => (
    item.outcome === 'rejected_full' || item.outcome === 'rejected_zone'
  )).length;
  const dismissedPreApply = buffer.filter((item) => item.outcome === 'dismissed_pre_apply').length;
  const decided = accepted + rejected;
  return {
    total,
    accepted,
    rejected,
    dismissedPreApply,
    acceptanceRate: decided > 0 ? accepted / decided : null,
  };
};

export const probeProposalOutcomeTelemetryHealth = (): { ok: boolean; failures: string[] } => {
  const failures: string[] = [];
  const summary = summarizeProposalOutcomes();
  if (summary.total > MAX_BUFFER) {
    failures.push('Proposal outcome buffer exceeded max size.');
  }
  if (summary.acceptanceRate !== null && (summary.acceptanceRate < 0 || summary.acceptanceRate > 1)) {
    failures.push('Invalid acceptance rate computed.');
  }
  return { ok: failures.length === 0, failures };
};
