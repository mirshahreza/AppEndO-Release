import { apiFetch } from '../../../shared/api/authSession';
import type {
  AssignFeedbackRequest,
  FeedbackAttachmentDto,
  FeedbackInboxBucket,
  FeedbackListResponse,
  FeedbackMineListQuery,
  FeedbackTicketDetailDto,
  FeedbackTicketDto,
  PostFeedbackMessageRequest,
  SubmitFeedbackRequest,
  UpdateFeedbackStatusRequest,
} from '../../../shared/api/contracts/feedback/types';
import { getFeedbackSessionKey } from '../../../shared/lib/feedbackSessionKey';

export type ApiErrorBody = { success: false; code: string; error: string };

export { getFeedbackSessionKey };

export class FeedbackApiError extends Error {
  code: string;

  constructor(body: ApiErrorBody) {
    super(body.error);
    this.name = 'FeedbackApiError';
    this.code = body.code;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(`/api/feedback${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-feedback-session': getFeedbackSessionKey(),
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || body.success === false) {
    throw new FeedbackApiError(body as ApiErrorBody);
  }
  return body as T;
}

const postJson = <T>(path: string, payload: unknown): Promise<T> =>
  call<T>(path, { method: 'POST', body: JSON.stringify(payload) });

const patchJson = <T>(path: string, payload: unknown): Promise<T> =>
  call<T>(path, { method: 'PATCH', body: JSON.stringify(payload) });

export const feedbackApi = {
  submit: (payload: SubmitFeedbackRequest) =>
    postJson<{ ticket: FeedbackTicketDetailDto }>('/', payload),

  uploadAttachments: async (files: File[]): Promise<FeedbackAttachmentDto[]> => {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }
    const response = await apiFetch('/api/feedback/attachments', {
      method: 'POST',
      body: formData,
      headers: { 'x-feedback-session': getFeedbackSessionKey() },
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok || body.success === false) {
      throw new FeedbackApiError(body as ApiErrorBody);
    }
    return (body.attachments as FeedbackAttachmentDto[]) ?? [];
  },

  listMine: (query: FeedbackMineListQuery | number = {}) => {
    const normalized: FeedbackMineListQuery = typeof query === 'number'
      ? { page: 1, pageSize: query }
      : query;
    const params = new URLSearchParams();
    params.set('page', String(Math.max(normalized.page ?? 1, 1)));
    params.set('pageSize', String(normalized.pageSize ?? 20));
    if (normalized.search?.trim()) {
      params.set('search', normalized.search.trim());
    }
    if (normalized.status) {
      params.set('status', normalized.status);
    }
    if (normalized.subjectId?.trim()) {
      params.set('subjectId', normalized.subjectId.trim());
    }
    return call<FeedbackListResponse>(`/mine?${params.toString()}`);
  },

  getMine: (id: string) =>
    call<{ ticket: FeedbackTicketDetailDto }>(`/mine/${id}`),

  postMineMessage: (id: string, payload: PostFeedbackMessageRequest) =>
    postJson<{ ticket: FeedbackTicketDetailDto }>(`/mine/${id}/messages`, payload),

  markMineRead: (id: string) =>
    postJson<{ success: true }>(`/mine/${id}/mark-read`, {}),

  listInbox: (bucket: FeedbackInboxBucket, limit = 50) =>
    call<{ items: FeedbackTicketDto[]; total: number }>(`/inbox?bucket=${bucket}&limit=${limit}`),

  get: (id: string) =>
    call<{ ticket: FeedbackTicketDetailDto }>(`/${id}`),

  postMessage: (id: string, payload: PostFeedbackMessageRequest) =>
    postJson<{ ticket: FeedbackTicketDetailDto }>(`/${id}/messages`, payload),

  claim: (id: string) =>
    postJson<{ ticket: FeedbackTicketDto }>(`/${id}/claim`, {}),

  assign: (id: string, payload: AssignFeedbackRequest) =>
    patchJson<{ ticket: FeedbackTicketDto }>(`/${id}/assign`, payload),

  updateStatus: (id: string, payload: UpdateFeedbackStatusRequest) =>
    patchJson<{ ticket: FeedbackTicketDto }>(`/${id}/status`, payload),
};
