/**
 * Minimal client-side mirror of server Work-Item shapes rendered by this feature — same convention
 * as `src/features/workflows/types.ts` (never import server domain code into the browser bundle).
 */

export type WorkItemInboxBucket = 'MINE_ASSIGNED' | 'MINE_CLAIMED' | 'AVAILABLE_TO_CLAIM' | 'MINE_RECENT';

export type WorkItemSummary = {
  id: number;
  workflowInstanceId: number;
  nodeInstanceId: number;
  workItemType: string;
  status: string;
  titleText: string;
  summaryText: string | null;
  priority: number;
  assignmentEvidenceJson: string;
  claimedByUserId: number | null;
  createdAt: string | null;
  dueAt: string | null;
  followUpAt: string | null;
  approvalGroupKey: string | null;
  [k: string]: unknown;
};

export type WorkItemRecord = WorkItemSummary & {
  inputJson: string | null;
  outputJson: string | null;
  outputSchemaJson: string | null;
  allowedOutcomesJson: string;
};

export type WorkItemFormConfig = {
  formMode: 'DESIGNED_COMPONENT' | 'DYNAMIC_SCHEMA_FORM' | 'RAW_JSON';
  formComponentRef: string | null;
  outputUiSchema: unknown;
  requireReasonOutcomes: string[];
};

export type WorkItemAttachmentMeta = {
  id: number;
  workItemId: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByUserId: number;
  createdAt: string;
};

export type WorkItemComment = {
  id: number;
  workItemId: number;
  authorUserId: number;
  text: string;
  mentionedUserIds: number[];
  createdAt: string;
};

export type WorkItemTransition = {
  id: number;
  workItemId: number;
  fromStatus: string;
  toStatus: string;
  transitionType: string;
  actorType: string;
  actorId: number | null;
  reasonCode: string | null;
  evidenceJson: string | null;
  occurredAt: string | null;
  workItemStateVersionAfter: number;
};
