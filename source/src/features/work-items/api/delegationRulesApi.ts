import { apiFetch } from '../../../shared/api/authSession';

export type WorkItemDelegationRule = {
  id: number;
  userId: number;
  delegateUserId: number;
  startAt: string;
  endAt: string;
  createdAt: string;
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(`/api/work-item-delegation-rules${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || body.success === false) {
    throw new Error(typeof body.error === 'string' ? body.error : 'Delegation rule request failed.');
  }
  return body as T;
}

export const delegationRulesApi = {
  list: () => call<{ rules: WorkItemDelegationRule[] }>('/'),
  create: (delegateUserId: number, startAt: string, endAt: string) =>
    call<{ rule: WorkItemDelegationRule }>('/', { method: 'POST', body: JSON.stringify({ delegateUserId, startAt, endAt }) }),
  remove: (ruleId: number) => call<{ success: true; deleted: boolean }>(`/${ruleId}`, { method: 'DELETE' }),
};
