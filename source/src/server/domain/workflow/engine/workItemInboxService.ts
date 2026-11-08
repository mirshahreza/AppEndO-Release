import { listWorkItemsByStatuses } from '../workItemRepository';
import { WorkflowDomainError } from '../errors';
import type { WorkItemRecord } from '../types';
import type { WorkItemStatus } from '../transitions';

/**
 * Work Item Inbox (doc 07 section 10) — the four canonical buckets, default ordering (`priority
 * DESC, createdAt ASC, id ASC`, already applied by `listWorkItemsByStatuses`'s `orderBy`), and the
 * "claimed item disappears from AVAILABLE_TO_CLAIM" behavior (a plain consequence of querying
 * live `OPEN` status, not a second visibility flag).
 *
 * Repository Reality Audit / documented scope boundary: `assignmentEvidenceJson` is stored as
 * portable `TEXT` (not a native/indexable JSON column — this schema targets Postgres/MSSQL/soon
 * MySQL/SQLite portably), so bucket membership by assignee/role is filtered in application code
 * after a status-scoped DB read, not a SQL `WHERE` predicate. This is the same "broad read, filter
 * in memory" shape `dueTimerScannerService.ts`/`recoveryService.ts` already use for business logic
 * that isn't a plain indexable column. The doc 09 section 4 authorized-scope filter (excluding
 * items outside the actor's authorized scope regardless of assignment match) is NOT implemented —
 * no authorization/scope primitive exists yet in this repository (same documented gap as every
 * operational command since Slice 5); callers must apply that filter themselves once doc09
 * infrastructure exists. `titleText`/`summaryText`/`inputJson`/`outputJson` exposure already
 * matches doc 07 section 10's bounded projection (raw `inputJson`/`outputJson` are never included).
 */

export type WorkItemInboxBucket = 'MINE_ASSIGNED' | 'MINE_CLAIMED' | 'AVAILABLE_TO_CLAIM' | 'MINE_RECENT';

export type WorkItemInboxActor = { userId: number; roles: string[] };

export type WorkItemInboxFilters = { workItemType?: string; priorityMin?: number; priorityMax?: number; overdueOnly?: boolean };

export type WorkItemInboxItem = {
  id: number;
  workItemType: string;
  titleText: string;
  summaryText: string | null;
  priority: number;
  status: WorkItemStatus;
  createdAt: string | null;
  dueAt: string | null;
  followUpAt: string | null;
  approvalGroupKey: string | null;
  allowedOutcomes: string[];
};

type AssignmentEvidence = { resolvedType: 'USER' | 'ROLE'; resolvedUserId?: number; resolvedRoleId?: string };

function parseEvidence(workItem: WorkItemRecord): AssignmentEvidence | undefined {
  return workItem.assignmentEvidenceJson ? (JSON.parse(workItem.assignmentEvidenceJson) as AssignmentEvidence) : undefined;
}

const DEFAULT_RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function toInboxItem(workItem: WorkItemRecord): WorkItemInboxItem {
  return {
    id: workItem.id,
    workItemType: workItem.workItemType,
    titleText: workItem.titleText,
    summaryText: workItem.summaryText,
    priority: workItem.priority,
    status: workItem.status,
    createdAt: workItem.createdAt,
    dueAt: workItem.dueAt,
    followUpAt: workItem.followUpAt,
    approvalGroupKey: workItem.approvalGroupKey,
    allowedOutcomes: JSON.parse(workItem.allowedOutcomesJson) as string[],
  };
}

function applyFilters(items: WorkItemRecord[], filters?: WorkItemInboxFilters): WorkItemRecord[] {
  if (!filters) return items;
  return items.filter((w) => {
    if (filters.workItemType !== undefined && w.workItemType !== filters.workItemType) return false;
    if (filters.priorityMin !== undefined && w.priority < filters.priorityMin) return false;
    if (filters.priorityMax !== undefined && w.priority > filters.priorityMax) return false;
    if (filters.overdueOnly && (!w.dueAt || new Date(w.dueAt).getTime() >= Date.now())) return false;
    return true;
  });
}

export async function listWorkItemInbox(bucket: WorkItemInboxBucket, actor: WorkItemInboxActor, filters?: WorkItemInboxFilters, recentWindowMs = DEFAULT_RECENT_WINDOW_MS): Promise<WorkItemInboxItem[]> {
  let candidates: WorkItemRecord[];

  switch (bucket) {
    case 'MINE_ASSIGNED': {
      const open = await listWorkItemsByStatuses(['OPEN']);
      candidates = open.filter((w) => {
        const evidence = parseEvidence(w);
        return evidence?.resolvedType === 'USER' && evidence.resolvedUserId === actor.userId;
      });
      break;
    }
    case 'MINE_CLAIMED': {
      const claimed = await listWorkItemsByStatuses(['CLAIMED']);
      candidates = claimed.filter((w) => w.claimedByUserId === actor.userId);
      break;
    }
    case 'AVAILABLE_TO_CLAIM': {
      const open = await listWorkItemsByStatuses(['OPEN']);
      candidates = open.filter((w) => {
        const evidence = parseEvidence(w);
        return evidence?.resolvedType === 'ROLE' && evidence.resolvedRoleId !== undefined && actor.roles.includes(evidence.resolvedRoleId);
      });
      break;
    }
    case 'MINE_RECENT': {
      const cutoffMs = Date.now() - recentWindowMs;
      const recent = await listWorkItemsByStatuses(['COMPLETED', 'CANCELLED'], {
        completedAtGte: new Date(cutoffMs),
        take: 500,
      });
      candidates = recent.filter((w) => {
        const involved = w.claimedByUserId === actor.userId || (() => {
          const evidence = parseEvidence(w);
          return evidence?.resolvedType === 'USER' && evidence.resolvedUserId === actor.userId;
        })();
        return involved;
      });
      break;
    }
    default: {
      const exhaustive: never = bucket;
      throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `Unknown Work Item Inbox bucket: ${JSON.stringify(exhaustive)}`, {});
    }
  }

  return applyFilters(candidates, filters).map(toInboxItem);
}
