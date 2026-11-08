import { listCandidateSlaWorkItems } from '../workItemRepository';

/**
 * HWF-4.5 — SLA Violations dashboard (doc-benchmark follow-up, same "operator inbox for a gap the
 * data already supports" shape as `WorkflowDeadLettersPanel.tsx`/WFV2-12). Reports on `dueAt`
 * (HWF-2.1) — pure metadata with no automatic behavior of its own — so this is purely a read-side
 * report, not a new engine capability.
 */
export type WorkItemSlaViolation = {
  id: number;
  workflowInstanceId: number;
  workItemType: string;
  titleText: string;
  status: 'OPEN' | 'CLAIMED' | 'COMPLETED';
  priority: number;
  dueAt: string;
  completedAt: string | null;
  breachKind: 'STILL_OPEN' | 'COMPLETED_LATE';
  overdueMs: number;
};

export async function listWorkItemSlaViolations(recentCompletedWindowMs?: number): Promise<WorkItemSlaViolation[]> {
  const candidates = await listCandidateSlaWorkItems(recentCompletedWindowMs);
  const now = Date.now();
  const violations: WorkItemSlaViolation[] = [];
  for (const w of candidates) {
    if (!w.dueAt) continue;
    const dueMs = new Date(w.dueAt).getTime();
    if (w.status === 'OPEN' || w.status === 'CLAIMED') {
      if (dueMs >= now) continue;
      violations.push({
        id: w.id,
        workflowInstanceId: w.workflowInstanceId,
        workItemType: w.workItemType,
        titleText: w.titleText,
        status: w.status,
        priority: w.priority,
        dueAt: w.dueAt,
        completedAt: null,
        breachKind: 'STILL_OPEN',
        overdueMs: now - dueMs,
      });
    } else if (w.status === 'COMPLETED' && w.completedAt) {
      const completedMs = new Date(w.completedAt).getTime();
      if (completedMs <= dueMs) continue;
      violations.push({
        id: w.id,
        workflowInstanceId: w.workflowInstanceId,
        workItemType: w.workItemType,
        titleText: w.titleText,
        status: 'COMPLETED',
        priority: w.priority,
        dueAt: w.dueAt,
        completedAt: w.completedAt,
        breachKind: 'COMPLETED_LATE',
        overdueMs: completedMs - dueMs,
      });
    }
  }
  return violations.sort((a, b) => b.overdueMs - a.overdueMs);
}
