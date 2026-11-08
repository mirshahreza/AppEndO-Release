import { apiFetch } from '../../../shared/api/authSession';

export type WorkItemSavedFilter = {
  id: number;
  userId: number;
  name: string;
  filterJson: string;
  createdAt: string;
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(`/api/work-item-saved-filters${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || body.success === false) {
    throw new Error(typeof body.error === 'string' ? body.error : 'Saved filter request failed.');
  }
  return body as T;
}

export const savedFiltersApi = {
  list: () => call<{ filters: WorkItemSavedFilter[] }>('/'),
  create: (name: string, filter: unknown) => call<{ filter: WorkItemSavedFilter }>('/', { method: 'POST', body: JSON.stringify({ name, filter }) }),
  remove: (filterId: number) => call<{ success: true; deleted: boolean }>(`/${filterId}`, { method: 'DELETE' }),
};
