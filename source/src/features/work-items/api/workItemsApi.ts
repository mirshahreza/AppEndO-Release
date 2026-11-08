import { apiFetch } from '../../../shared/api/authSession';
import type { WorkItemInboxBucket, WorkItemRecord, WorkItemSummary, WorkItemTransition, WorkItemFormConfig, WorkItemComment, WorkItemAttachmentMeta } from '../types';

export type ApiErrorBody = { success: false; code: string; error: string; details: unknown };

export class WorkItemsApiError extends Error {
  code: string;

  details: unknown;

  constructor(body: ApiErrorBody) {
    super(body.error);
    this.name = 'WorkItemsApiError';
    this.code = body.code;
    this.details = body.details;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(`/api/workflow-work-items${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || body.success === false) {
    throw new WorkItemsApiError(body as ApiErrorBody);
  }
  return body as T;
}

const postJson = <T>(path: string, payload: unknown): Promise<T> => call<T>(path, { method: 'POST', body: JSON.stringify(payload) });

/** Multipart upload — deliberately bypasses `call()`'s forced `Content-Type: application/json` so the browser sets its own multipart boundary. */
async function postFormData<T>(path: string, formData: FormData): Promise<T> {
  const response = await apiFetch(`/api/workflow-work-items${path}`, { method: 'POST', body: formData });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || body.success === false) {
    throw new WorkItemsApiError(body as ApiErrorBody);
  }
  return body as T;
}

export type WorkItemInboxFilters = { workItemType?: string; priorityMin?: number; priorityMax?: number; overdueOnly?: boolean };

export const workItemsApi = {
  listInbox: (bucket: WorkItemInboxBucket, options?: { cursor?: string; filters?: WorkItemInboxFilters }) => {
    const params = new URLSearchParams({ bucket });
    if (options?.cursor) params.set('cursor', options.cursor);
    if (options?.filters?.workItemType) params.set('workItemType', options.filters.workItemType);
    if (options?.filters?.priorityMin !== undefined) params.set('priorityMin', String(options.filters.priorityMin));
    if (options?.filters?.priorityMax !== undefined) params.set('priorityMax', String(options.filters.priorityMax));
    if (options?.filters?.overdueOnly) params.set('overdueOnly', 'true');
    return call<{ items: WorkItemSummary[]; nextCursor: string | null; total: number }>(`/inbox?${params.toString()}`);
  },
  get: (workItemId: number) => call<{ workItem: WorkItemRecord; formConfig: WorkItemFormConfig }>(`/${workItemId}`),
  transitions: (workItemId: number) => call<{ transitions: WorkItemTransition[] }>(`/${workItemId}/transitions`),
  claim: (workItemId: number) => postJson<{ workItem: WorkItemRecord }>(`/${workItemId}/claim`, {}),
  complete: (workItemId: number, outcome: string, output: unknown) => postJson<{ workItem: WorkItemRecord }>(`/${workItemId}/complete`, { outcome, output }),
  forward: (workItemId: number, newAssignment: { strategy: 'USER'; userId: number } | { strategy: 'ROLE'; roleId: string }, reasonCode?: string) =>
    postJson<{ workItem: WorkItemRecord }>(`/${workItemId}/forward`, { newAssignment, reasonCode }),
  comments: (workItemId: number) => call<{ comments: WorkItemComment[] }>(`/${workItemId}/comments`),
  addComment: (workItemId: number, text: string, mentionedUserIds?: number[]) =>
    postJson<{ comment: WorkItemComment }>(`/${workItemId}/comments`, { text, mentionedUserIds }),
  attachments: (workItemId: number) => call<{ attachments: WorkItemAttachmentMeta[] }>(`/${workItemId}/attachments`),
  uploadAttachment: (workItemId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return postFormData<{ attachment: WorkItemAttachmentMeta }>(`/${workItemId}/attachments`, formData);
  },
  attachmentDownloadUrl: (workItemId: number, attachmentId: number) => `/api/workflow-work-items/${workItemId}/attachments/${attachmentId}`,
  deleteAttachment: (workItemId: number, attachmentId: number) => call<{ success: true; deleted: boolean }>(`/${workItemId}/attachments/${attachmentId}`, { method: 'DELETE' }),
  /** HWF-3.2 — attach a brand-new ad-hoc Work Item to an already-running instance, outside its published graph. `attachAdHocWorkItem` itself enforces "ADMIN or existing participant on this instance", not this client. */
  attachAdHoc: (
    workflowInstanceId: number,
    payload: {
      workItemType: string;
      titleText: string;
      summaryText?: string;
      assignment: { strategy: 'USER'; userId: number } | { strategy: 'ROLE'; roleId: string };
      allowedOutcomes: string[];
    },
  ) => postJson<{ workItem: WorkItemRecord }>(`/instance/${workflowInstanceId}`, payload),
};
