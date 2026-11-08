import { randomUUID } from 'crypto';

/**
 * V5 Phase P02 § 11 — `Hypothesis`/`HypothesisLedger`.
 *
 * Rule (doc, verbatim): "REJECTED hypothesis cannot become active again without NEW evidence."
 * Enforced in `propose()` below — not merely documented.
 */
export type HypothesisType = 'LOCALIZATION' | 'ROOT_CAUSE' | 'SOLUTION' | 'ENVIRONMENT';
export type HypothesisStatus = 'PROPOSED' | 'SUPPORTED' | 'CONFIRMED' | 'CONTRADICTED' | 'REJECTED' | 'STALE';

export type Hypothesis = {
  hypothesisId: string;
  taskId: string;
  claim: string;
  type: HypothesisType;
  status: HypothesisStatus;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  /** Evidence count present at the moment this hypothesis was last REJECTED — see `propose()`. */
  rejectedAtEvidenceCount?: number;
  createdAt: string;
  updatedAt: string;
};

const normalizeClaim = (claim: string): string => claim.trim().toLowerCase();

export class HypothesisLedger {
  private readonly hypotheses = new Map<string, Hypothesis>();

  constructor(private readonly taskId: string) {}

  list(): Hypothesis[] {
    return [...this.hypotheses.values()];
  }

  findByClaim(claim: string): Hypothesis | undefined {
    const normalized = normalizeClaim(claim);
    return [...this.hypotheses.values()].find((h) => normalizeClaim(h.claim) === normalized);
  }

  /**
   * `currentEvidenceCount` is the caller's live evidence tally (from `EvidenceStore.list().length`
   * at proposal time) — comparing it against `rejectedAtEvidenceCount` is how "new evidence since
   * rejection" is checked without this module depending on `EvidenceStore` directly.
   */
  propose(params: {
    claim: string;
    type: HypothesisType;
    currentEvidenceCount: number;
  }): { ok: true; hypothesis: Hypothesis } | { ok: false; reason: string; hypothesis: Hypothesis } {
    const existing = this.findByClaim(params.claim);

    if (existing?.status === 'REJECTED') {
      const hasNewEvidence = params.currentEvidenceCount > (existing.rejectedAtEvidenceCount ?? 0);
      if (!hasNewEvidence) {
        return { ok: false, reason: 'rejected_without_new_evidence', hypothesis: existing };
      }
      const reactivated: Hypothesis = {
        ...existing,
        status: 'PROPOSED',
        updatedAt: new Date().toISOString(),
      };
      this.hypotheses.set(reactivated.hypothesisId, reactivated);
      return { ok: true, hypothesis: reactivated };
    }

    if (existing?.status === 'CONTRADICTED') {
      // A single contradiction is not terminal (only REJECTED is) — re-proposing reactivates it.
      const reactivated: Hypothesis = { ...existing, status: 'PROPOSED', updatedAt: new Date().toISOString() };
      this.hypotheses.set(reactivated.hypothesisId, reactivated);
      return { ok: true, hypothesis: reactivated };
    }

    if (existing) {
      return { ok: true, hypothesis: existing };
    }

    const now = new Date().toISOString();
    const hypothesis: Hypothesis = {
      hypothesisId: randomUUID(),
      taskId: this.taskId,
      claim: params.claim,
      type: params.type,
      status: 'PROPOSED',
      supportingEvidenceIds: [],
      contradictingEvidenceIds: [],
      createdAt: now,
      updatedAt: now,
    };
    this.hypotheses.set(hypothesis.hypothesisId, hypothesis);
    return { ok: true, hypothesis };
  }

  /** The most recently created hypothesis still in an "active" (non-terminal) status. */
  mostRecentActive(): Hypothesis | undefined {
    return [...this.hypotheses.values()]
      .filter((h) => h.status === 'PROPOSED' || h.status === 'SUPPORTED')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  }

  support(hypothesisId: string, evidenceId: string): void {
    const h = this.hypotheses.get(hypothesisId);
    if (!h) return;
    this.hypotheses.set(hypothesisId, {
      ...h,
      status: h.status === 'PROPOSED' ? 'SUPPORTED' : h.status,
      supportingEvidenceIds: [...h.supportingEvidenceIds, evidenceId],
      updatedAt: new Date().toISOString(),
    });
  }

  confirm(hypothesisId: string, evidenceId: string): void {
    const h = this.hypotheses.get(hypothesisId);
    if (!h) return;
    this.hypotheses.set(hypothesisId, {
      ...h,
      status: 'CONFIRMED',
      supportingEvidenceIds: [...h.supportingEvidenceIds, evidenceId],
      updatedAt: new Date().toISOString(),
    });
  }

  contradict(hypothesisId: string, evidenceId: string, currentEvidenceCount: number): void {
    const h = this.hypotheses.get(hypothesisId);
    if (!h) return;
    this.hypotheses.set(hypothesisId, {
      ...h,
      status: 'CONTRADICTED',
      contradictingEvidenceIds: [...h.contradictingEvidenceIds, evidenceId],
      rejectedAtEvidenceCount: currentEvidenceCount,
      updatedAt: new Date().toISOString(),
    });
  }

  reject(hypothesisId: string, currentEvidenceCount: number): void {
    const h = this.hypotheses.get(hypothesisId);
    if (!h) return;
    this.hypotheses.set(hypothesisId, {
      ...h,
      status: 'REJECTED',
      rejectedAtEvidenceCount: currentEvidenceCount,
      updatedAt: new Date().toISOString(),
    });
  }
}
