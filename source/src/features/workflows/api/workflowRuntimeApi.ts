import { apiFetch } from '../../../shared/api/authSession';
import type { WorkflowDeadLetterRecord, WorkflowDeadLetterStatus, WorkflowExecutionInstanceStatus, WorkflowInstanceInspection, WorkflowInstanceRecord, WorkflowProofEntry, WorkItemSlaViolation } from '../types';

export type ApiErrorBody = { success: false; code: string; error: string; details: unknown };

export class WorkflowRuntimeApiError extends Error {
  code: string;

  details: unknown;

  constructor(body: ApiErrorBody) {
    super(body.error);
    this.name = 'WorkflowRuntimeApiError';
    this.code = body.code;
    this.details = body.details;
  }
}

async function call<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(`${base}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || body.success === false) {
    throw new WorkflowRuntimeApiError(body as ApiErrorBody);
  }
  return body as T;
}

const RUNTIME_BASE = '/api/workflow-runtime';
const PROOF_BASE = '/api/workflow-proof';

const postJson = <T>(base: string, path: string, payload: unknown): Promise<T> => call<T>(base, path, { method: 'POST', body: JSON.stringify(payload) });

export type ListWorkflowInstancesFilters = { workflowDefinitionId?: number; status?: WorkflowExecutionInstanceStatus };

export const workflowRuntimeApi = {
  listInstances: (filters: ListWorkflowInstancesFilters = {}, cursor?: string) => {
    const params = new URLSearchParams();
    if (filters.workflowDefinitionId !== undefined) params.set('workflowDefinitionId', String(filters.workflowDefinitionId));
    if (filters.status) params.set('status', filters.status);
    if (cursor) params.set('cursor', cursor);
    const qs = params.toString();
    return call<{ instances: unknown[]; nextCursor: string | null }>(RUNTIME_BASE, `/instances${qs ? `?${qs}` : ''}`);
  },
  inspect: (instanceId: number) => call<{ success: true } & WorkflowInstanceInspection>(RUNTIME_BASE, `/instances/${instanceId}/inspect`),
  start: (definitionId: number, input: unknown) => postJson<{ instance: WorkflowInstanceRecord }>(RUNTIME_BASE, `/definitions/${definitionId}/start`, { input }),
  suspend: (instanceId: number, expectedStateVersion: number) => postJson<{ instance: WorkflowInstanceRecord }>(RUNTIME_BASE, `/instances/${instanceId}/suspend`, { expectedStateVersion }),
  resume: (instanceId: number, expectedStateVersion: number) => postJson<{ instance: WorkflowInstanceRecord }>(RUNTIME_BASE, `/instances/${instanceId}/resume`, { expectedStateVersion }),
  cancel: (instanceId: number, expectedStateVersion: number) => postJson<{ success: true }>(RUNTIME_BASE, `/instances/${instanceId}/cancel`, { expectedStateVersion }),
  retryNode: (nodeInstanceId: number, expectedStateVersion: number) => postJson<{ node: unknown }>(RUNTIME_BASE, `/nodes/${nodeInstanceId}/retry`, { expectedStateVersion }),
  forceNewInvocation: (nodeInstanceId: number, leaseOwnerId: string) =>
    postJson<{ result: unknown }>(RUNTIME_BASE, `/nodes/${nodeInstanceId}/force-new-invocation`, { leaseOwnerId, acknowledgeDuplicateEffectRisk: true }),
  rotateWebhookSecret: (definitionId: number) => postJson<{ token: string }>(RUNTIME_BASE, `/definitions/${definitionId}/webhook-secret/rotate`, {}),
  getWebhookSecretStatus: (definitionId: number) =>
    call<{ configured: boolean; enabled: boolean; rotatedAt: string | null }>(RUNTIME_BASE, `/definitions/${definitionId}/webhook-secret/status`),
  listDeadLetters: (status?: WorkflowDeadLetterStatus, cursor?: string) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (cursor) params.set('cursor', cursor);
    const qs = params.toString();
    return call<{ items: WorkflowDeadLetterRecord[]; nextCursor: string | null; total: number }>(RUNTIME_BASE, `/dead-letters${qs ? `?${qs}` : ''}`);
  },
  getDeadLetter: (deadLetterId: number) => call<{ item: WorkflowDeadLetterRecord }>(RUNTIME_BASE, `/dead-letters/${deadLetterId}`),
  resolveDeadLetter: (deadLetterId: number, input: { expectedStateVersion: number; resolution: 'RESOLVED' | 'DISCARDED'; resolutionNote?: string | null }) =>
    postJson<{ item: WorkflowDeadLetterRecord }>(RUNTIME_BASE, `/dead-letters/${deadLetterId}/resolve`, input),
  listSlaViolations: () => call<{ items: WorkItemSlaViolation[] }>(RUNTIME_BASE, '/sla-violations'),
};

export const workflowProofApi = {
  getProof: (instanceId: number) => call<{ entries: WorkflowProofEntry[] }>(PROOF_BASE, `/instances/${instanceId}`),
};
