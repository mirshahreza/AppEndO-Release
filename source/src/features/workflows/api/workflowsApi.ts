import { apiFetch } from '../../../shared/api/authSession';
import type { DynamicOption, WorkflowDefinitionDossier, WorkflowInstanceMigrationImpact, WorkflowRecordFieldDescriptor, WorkflowSecretReference } from '../types';

const BASE = '/api/workflows';

export type WorkflowDeleteImpact = {
  canDelete: boolean;
  isPublished: boolean;
  hasExecutionHistory: boolean;
  instanceCount: number;
  revisionCount: number;
  nonTerminalInstanceCount: number;
  subflowReferencerCount: number;
  subflowReferencers: Array<{ id: number; key: string }>;
  stateVersion: number;
  blockerCode?: string;
  blockerMessage?: string;
};

export type ApiErrorBody = { success: false; code: string; error: string; details: unknown };

export class WorkflowsApiError extends Error {
  code: string;

  details: unknown;

  constructor(body: ApiErrorBody) {
    super(body.error);
    this.name = 'WorkflowsApiError';
    this.code = body.code;
    this.details = body.details;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || body.success === false) {
    throw new WorkflowsApiError({
      success: false,
      code: typeof body.code === 'string' ? body.code : `HTTP_${response.status}`,
      error: typeof body.error === 'string' ? body.error : `Request failed (${response.status})`,
      details: body.details ?? null,
    });
  }
  return body as T;
}

const postJson = <T>(path: string, payload: unknown): Promise<T> => call<T>(path, { method: 'POST', body: JSON.stringify(payload) });
const putJson = <T>(path: string, payload: unknown): Promise<T> => call<T>(path, { method: 'PUT', body: JSON.stringify(payload) });

export const workflowsApi = {
  listDefinitions: (scopeKey?: string) => call<{ definitions: unknown[] }>(`/definitions${scopeKey ? `?scopeKey=${encodeURIComponent(scopeKey)}` : ''}`),
  createDefinition: (input: { scopeKey?: string; key: string; name?: string }) => postJson<{ record: unknown }>('/definitions', input),
  getProjection: (definitionId: number) => call<{ projection: unknown }>(`/definitions/${definitionId}/projection`),
  getDossier: (definitionId: number) => call<{ dossier: WorkflowDefinitionDossier }>(`/definitions/${definitionId}/dossier`),
  applyDraftOperations: (definitionId: number, expectedDraftVersion: number, operations: unknown[]) =>
    postJson<{ record: unknown; affectedNodeKeys: string[]; affectedEdgeKeys: string[]; workflowLevelChanged: boolean }>(`/definitions/${definitionId}/draft-operations`, { expectedDraftVersion, operations }),
  saveDesignerView: (definitionId: number, draftVersion: number, viewJson: string) => putJson<{ view: unknown }>(`/definitions/${definitionId}/designer-view`, { draftVersion, viewJson }),
  validateDraft: (definitionId: number, expectedDraftVersion: number) => postJson<{ report: unknown }>(`/definitions/${definitionId}/validate`, { expectedDraftVersion }),
  getPublishDiff: (definitionId: number) => call<{ diff: unknown }>(`/definitions/${definitionId}/publish-diff`),
  getRevision: (revisionId: number) => call<{ revision: { id: number; workflowDefinitionId: number; revisionNumber: number; definitionJson: string; publicationStatus: string; bindingStatus: string } }>(`/revisions/${revisionId}`),
  publish: (definitionId: number, expectedDraftVersion: number) => postJson<{ revision: unknown; bindingActivation: unknown }>(`/definitions/${definitionId}/publish`, { expectedDraftVersion }),
  getUnpublishImpact: (definitionId: number) => call<{ impact: { isPublished: boolean; incompleteInstanceCount: number } }>(`/definitions/${definitionId}/unpublish-impact`),
  unpublish: (definitionId: number, expectedDefinitionStateVersion: number) =>
    postJson<{ record: unknown }>(`/definitions/${definitionId}/unpublish`, { expectedDefinitionStateVersion }),
  getDeleteImpact: (definitionId: number) =>
    call<{ impact: WorkflowDeleteImpact }>(`/definitions/${definitionId}/delete-impact`),
  deleteDefinition: (definitionId: number, expectedDefinitionStateVersion: number) =>
    postJson<{ success: true }>(`/definitions/${definitionId}/delete`, { expectedDefinitionStateVersion }),
  duplicate: (source: unknown, target: unknown) => postJson<{ record: unknown }>('/duplicate', { source, target }),
  getReferenceCatalog: (definitionId: number, context: unknown, query?: string) =>
    postJson<{ descriptors: unknown[] }>(`/definitions/${definitionId}/reference-catalog${query ? `?q=${encodeURIComponent(query)}` : ''}`, context),
  getDynamicOptions: (source: string) => call<{ options: DynamicOption[] }>(`/dynamic-options/${encodeURIComponent(source)}`),
  getRecordFieldsForEdgeApiKey: (apiKey: string) => call<{ fields: WorkflowRecordFieldDescriptor[] }>(`/edge-apis/${encodeURIComponent(apiKey)}/record-fields`),
  listSecretReferences: () => call<{ references: WorkflowSecretReference[] }>('/secret-references'),
  createSecretReference: (input: { name: string; label: string; description?: string | null; value?: string }) =>
    postJson<{ record: WorkflowSecretReference }>('/secret-references', input),
  /** `value: undefined` omits the key entirely (leaves any stored value untouched); `value: null` clears it. */
  updateSecretReference: (id: number, input: { label: string; description?: string | null; value?: string | null }) =>
    call<{ record: WorkflowSecretReference }>(`/secret-references/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteSecretReference: (id: number) => postJson<{ success: true }>(`/secret-references/${id}/delete`, {}),
  compileReference: (descriptor: unknown, segments: Array<string | number>) => postJson<{ path: unknown }>('/reference-catalog/compile', { descriptor, segments }),
  getInstanceMigrationImpact: (fromRevisionId: number, toRevisionId: number) =>
    postJson<{ impact: WorkflowInstanceMigrationImpact }>('/revisions/migrate-instances/impact', { fromRevisionId, toRevisionId }),
  migrateInstances: (fromRevisionId: number, toRevisionId: number) =>
    postJson<{ impact: WorkflowInstanceMigrationImpact & { migratedCount: number } }>('/revisions/migrate-instances', { fromRevisionId, toRevisionId }),
  runWorkflowExecute: (input: unknown) => postJson<{ run: unknown; outcome: unknown; evidence: unknown[]; missingFixturePaths: unknown[] }>('/execute/run', input),
};
