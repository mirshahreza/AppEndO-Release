import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  DesignerBindingDefinition,
  DesignerBindingDefinitions,
  DesignerDiagnostic,
  DesignerDocument,
  DesignerPaletteCategory,
  DesignerPaletteSourceType,
  DesignerWorkspacePrefs,
} from '../contracts/component-designer/types';
import type { DesignerComponentUsageReport } from '../contracts/component-designer/usage';
import type { UnusedDesignerComponentEntry } from '../contracts/component-designer/unused';
import { apiDelete, apiGet, apiPost, apiPut, isAbortError, isApiError } from '../client';

const DESIGNER_CATALOG_QUERY_OPTIONS = {
  staleTime: 30_000,
  gcTime: 5 * 60_000,
  refetchOnMount: 'ifStale' as const,
};

export type CatalogKind = 'custom' | 'shell' | 'template';

export type DesignerVersionSummary = {
  id: string;
  name: string;
  folder: string;
  catalogKind?: CatalogKind;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  version?: number;
  isBuiltIn?: boolean;
  isPackageComponent?: boolean;
  packageId?: string;
  packageDisplayName?: string;
  componentKey?: string;
  packageVersion?: string;
};

export type DesignerLifecycleState = 'draft' | 'saved' | 'published';

export type DesignerPublishState = {
  lifecycle: DesignerLifecycleState;
  componentPath: string;
  publishedVersion: number | null;
  loaderRef: string | null;
  publishedAt: string | null;
  hasUnpublishedChanges: boolean;
  versionHistory: Array<{
    version: number;
    publishedAt: string;
    publishedBy?: string;
    name: string;
  }>;
};

export type DesignerPublishDiff = {
  componentPath: string;
  publishedVersion: number | null;
  nodesAdded: number;
  nodesRemoved: number;
  nodesChanged: number;
  propsChanged: number;
};

export type DesignerStagingPreviewLink = {
  token: string;
  expiresAt: string;
  previewPath: string;
};

export type DesignerVersionRecord = {
  id: string;
  name: string;
  folder?: string;
  catalogKind?: CatalogKind;
  tags?: string[];
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
  workspace?: DesignerWorkspacePrefs;
  metadata: {
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
    updatedBy?: string;
  };
  companionTsx?: string | null;
  hydratedFromTsx?: boolean;
  companionTsxPath?: string | null;
};

export type DesignerDraftSummary = DesignerVersionSummary;
export type DesignerDraftRecord = DesignerVersionRecord;

export type DesignerPreviewRuntimeResponse = {
  success: boolean;
  traceId?: string;
  results: Record<string, unknown>;
  diagnostics: DesignerDiagnostic[];
  logs: Array<{
    traceId?: string;
    sequence?: number;
    bindingKey: string;
    startedAt: string;
    finishedAt: string;
    endpoint: string;
    method: string;
    attempts: number;
    ok: boolean;
    status?: number;
    durationMs: number;
    errorCode?: string;
    errorMessage?: string;
    dependencies?: string[];
  }>;
};

export type DesignerValidateResponse = {
  success: boolean;
  diagnostics: DesignerDiagnostic[];
};

export type DesignerCodeToCanvasResponse =
  | {
      success: true;
      document: DesignerDocument;
      bindingDefinitions: DesignerBindingDefinitions;
    }
  | {
      success: false;
      diagnostics: DesignerDiagnostic[];
    };

export type DesignerCatalogItem = {
  id: string;
  label: string;
  category: DesignerPaletteCategory;
  icon: string;
  defaultProps: Record<string, unknown>;
  allowedParentTypes: string[];
  canHaveChildren: boolean;
  sourceType: DesignerPaletteSourceType;
  sourceRef?: string;
  nodeType: string;
};

export type CreateComponentDesignerVersionPayload = {
  id?: string;
  name: string;
  folder?: string;
  catalogKind?: CatalogKind;
  tags?: string[];
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
  workspace?: DesignerWorkspacePrefs;
  duplicateFromId?: string;
};

export type UpdateComponentDesignerVersionPayload = {
  name?: string;
  folder?: string;
  catalogKind?: CatalogKind;
  tags?: string[];
  document?: DesignerDocument;
  bindingDefinitions?: DesignerBindingDefinitions;
  workspace?: DesignerWorkspacePrefs;
};

export type RunComponentDesignerPreviewPayload = {
  bindingDefinitions: DesignerBindingDefinitions;
  context?: Record<string, unknown>;
};

export type SyncComponentDesignerCodePayload = {
  format: 'json' | 'tsx';
  code: string;
};

export type ComponentDesignerPaletteCatalog = {
  systemItems: DesignerCatalogItem[];
  reusableItems: DesignerCatalogItem[];
};

type ApiErrorPayload = {
  error?: string | { message?: string; code?: string };
  diagnostics?: DesignerDiagnostic[];
  traceId?: string;
};

const getApiErrorMessage = (data: unknown, fallback: string): string => {
  if (!data || typeof data !== 'object') {
    return fallback;
  }

  const payload = data as ApiErrorPayload;
  const diagnosticsMessage = payload.diagnostics?.map((item) => item.message).filter(Boolean).join(' | ');
  if (diagnosticsMessage) {
    return diagnosticsMessage;
  }

  if (typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error;
  }

  if (
    payload.error
    && typeof payload.error === 'object'
    && typeof payload.error.message === 'string'
    && payload.error.message.trim()
  ) {
    return payload.error.message;
  }

  if (typeof payload.traceId === 'string' && payload.traceId.trim()) {
    return `${fallback} (trace: ${payload.traceId})`;
  }

  return fallback;
};

const throwApiError = (
  data: unknown,
  fallback: string,
  diagnostics?: DesignerDiagnostic[],
): never => {
  const error = new Error(getApiErrorMessage(data, fallback));
  if (diagnostics?.length) {
    (error as Error & { diagnostics?: DesignerDiagnostic[] }).diagnostics = diagnostics;
  } else if (data && typeof data === 'object' && Array.isArray((data as ApiErrorPayload).diagnostics)) {
    (error as Error & { diagnostics?: DesignerDiagnostic[] }).diagnostics = (data as ApiErrorPayload).diagnostics;
  }
  throw error;
};

const postOrPutJson = async <T>(
  path: string,
  body: unknown,
  method: 'POST' | 'PUT' = 'POST',
): Promise<T> => {
  const result = method === 'PUT'
    ? await apiPut<T & ApiErrorPayload>(path, body)
    : await apiPost<T & ApiErrorPayload>(path, body);

  if (!result.response.ok) {
    throwApiError(result.data, `Request failed with status ${result.response.status}.`);
  }

  return result.data as T;
};

const fetchCatalogItems = async (
  path: string,
  fallbackError: string,
): Promise<DesignerCatalogItem[]> => {
  const { data, response } = await apiGet<{ success: boolean; items?: DesignerCatalogItem[]; error?: string }>(path);

  if (!response.ok) {
    throw new Error(data.error || `${fallbackError} (${response.status}).`);
  }

  if (!data.success) {
    throw new Error(data.error || fallbackError);
  }

  return data.items ?? [];
};

export const componentDesignerQueryKeys = {
  all: ['component-designer'] as const,
  drafts: () => [...componentDesignerQueryKeys.all, 'drafts'] as const,
  draftVersions: (draftId: string) => [...componentDesignerQueryKeys.all, 'draft-versions', draftId] as const,
  publishState: (draftId: string) => [...componentDesignerQueryKeys.all, 'publish-state', draftId] as const,
  usage: (draftId: string) => [...componentDesignerQueryKeys.all, 'usage', draftId] as const,
  unusedComponents: () => [...componentDesignerQueryKeys.all, 'unused-components'] as const,
  paletteCatalog: () => [...componentDesignerQueryKeys.all, 'palette-catalog'] as const,
  publishedShell: (shellKey: string, publishedVersion?: number | null) => [
    ...componentDesignerQueryKeys.all,
    'shell',
    shellKey,
    publishedVersion ?? 'current',
  ] as const,
  publishedPage: (slug: string) => [...componentDesignerQueryKeys.all, 'published', slug] as const,
  canvasComments: (draftId: string) => [...componentDesignerQueryKeys.all, 'comments', draftId] as const,
  auditLog: (draftId: string) => [...componentDesignerQueryKeys.all, 'audit-log', draftId] as const,
  folderPermissions: () => [...componentDesignerQueryKeys.all, 'folder-permissions'] as const,
};

export async function listComponentDesignerVersions(): Promise<DesignerVersionSummary[]> {
  const { data, response } = await apiGet<{ success: boolean; items?: DesignerVersionSummary[]; error?: string }>(
    `/api/component-designer/drafts?_=${Date.now()}`,
  );
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to load versions.');
  }
  return data.items ?? [];
}

export async function listComponentDesignerVersionHistory(versionId: string): Promise<DesignerVersionSummary[]> {
  const { data, response } = await apiGet<{ success: boolean; items?: DesignerVersionSummary[]; error?: string }>(
    `/api/component-designer/drafts/${encodeURIComponent(versionId)}/versions`,
  );
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to load versions.');
  }
  return data.items ?? [];
}

export type LoadComponentDesignerVersionOptions = {
  bypassCache?: boolean;
  signal?: AbortSignal;
};

export const designerPublishedPageQueryRetry = (
  failureCount: number,
  error: unknown,
): boolean => {
  if (isAbortError(error)) {
    return false;
  }
  if (isApiError(error)) {
    const status = error.status;
    if (status === 401 || status === 403 || status === 404) {
      return false;
    }
  }
  return failureCount < 3;
};

export const designerPublishedPageQueryRetryDelay = (attemptIndex: number): number => (
  Math.min(400 * 2 ** attemptIndex, 3_000)
);

export async function loadComponentDesignerVersion(
  versionId: string,
  version?: number,
  options?: LoadComponentDesignerVersionOptions,
): Promise<DesignerVersionRecord> {
  const params = new URLSearchParams();
  if (typeof version === 'number') {
    params.set('version', String(version));
  }
  if (options?.bypassCache) {
    params.set('_', String(Date.now()));
  }
  const query = params.toString();
  const trimmedVersionId = versionId.trim();
  const requestPath = trimmedVersionId.includes('/')
    ? (() => {
      const pathParams = new URLSearchParams(params);
      pathParams.set('path', trimmedVersionId);
      return `/api/component-designer/drafts/by-path?${pathParams.toString()}`;
    })()
    : `/api/component-designer/drafts/${encodeURIComponent(trimmedVersionId)}${query ? `?${query}` : ''}`;
  const { data, response } = await apiGet<{ success: boolean; draft?: DesignerVersionRecord; error?: string }>(
    requestPath,
    options?.signal ? { signal: options.signal } : undefined,
  );
  if (!response.ok || !data.success || !data.draft) {
    throw new Error(data.error || 'Failed to load version.');
  }
  return data.draft;
}

export async function createComponentDesignerVersion(
  payload: CreateComponentDesignerVersionPayload,
): Promise<DesignerVersionRecord> {
  const data = await postOrPutJson<{ success: boolean; draft?: DesignerVersionRecord }>(
    '/api/component-designer/drafts',
    payload,
  );
  if (!data.success || !data.draft?.document) {
    throwApiError(data, 'Failed to save component.');
  }
  return data.draft;
}

export async function updateComponentDesignerVersion(
  versionId: string,
  payload: UpdateComponentDesignerVersionPayload,
): Promise<DesignerVersionRecord> {
  const data = await postOrPutJson<{ success: boolean; draft: DesignerVersionRecord }>(
    `/api/component-designer/drafts/${encodeURIComponent(versionId)}`,
    payload,
    'PUT',
  );
  return data.draft;
}

export async function deleteComponentDesignerVersion(versionId: string): Promise<void> {
  const { data, response } = await apiDelete<{ success?: boolean; error?: string }>(
    `/api/component-designer/drafts/${encodeURIComponent(versionId)}`,
  );
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to delete version.');
  }
}

export async function fetchDesignerPublishState(
  draftId: string,
  options?: { hasUnsavedChanges?: boolean },
): Promise<DesignerPublishState> {
  const params = new URLSearchParams();
  if (options?.hasUnsavedChanges) {
    params.set('unsaved', '1');
  }
  const query = params.toString();
  const { data, response } = await apiGet<{ success: boolean; state?: DesignerPublishState; error?: string }>(
    `/api/component-designer/drafts/${encodeURIComponent(draftId)}/publish-state${query ? `?${query}` : ''}`,
  );
  if (!response.ok || !data.success || !data.state) {
    throw new Error(data.error || 'Failed to load publish state.');
  }
  return data.state;
}

export async function fetchDesignerPublishDiff(draftId: string): Promise<DesignerPublishDiff> {
  const { data, response } = await apiGet<{ success: boolean; diff?: DesignerPublishDiff; error?: string }>(
    `/api/component-designer/drafts/${encodeURIComponent(draftId)}/publish-diff`,
  );
  if (!response.ok || !data.success || !data.diff) {
    throw new Error(data.error || 'Failed to load publish diff.');
  }
  return data.diff;
}

export async function fetchDesignerComponentUsage(draftId: string): Promise<DesignerComponentUsageReport> {
  const { data, response } = await apiGet<{ success: boolean; usage?: DesignerComponentUsageReport; error?: string }>(
    `/api/component-designer/drafts/${encodeURIComponent(draftId)}/usage`,
  );
  if (!response.ok || !data.success || !data.usage) {
    throw new Error(data.error || 'Failed to load component usage.');
  }
  return data.usage;
}

export async function fetchUnusedDesignerComponents(): Promise<UnusedDesignerComponentEntry[]> {
  const { data, response } = await apiGet<{
    success: boolean;
    components?: UnusedDesignerComponentEntry[];
    error?: string;
  }>('/api/component-designer/catalog/unused-components');
  if (!response.ok || !data.success || !data.components) {
    throw new Error(data.error || 'Failed to load unused components.');
  }
  return data.components;
}

export type DesignerCanvasCommentDto = {
  id: string;
  draftId: string;
  nodeId: string | null;
  body: string;
  author: string;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
};

export async function listDesignerCanvasComments(draftId: string): Promise<DesignerCanvasCommentDto[]> {
  const { data, response } = await apiGet<{ success: boolean; comments?: DesignerCanvasCommentDto[]; error?: string }>(
    `/api/component-designer/drafts/${encodeURIComponent(draftId)}/comments`,
  );
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to load canvas comments.');
  }
  return data.comments ?? [];
}

export async function addDesignerCanvasComment(
  draftId: string,
  payload: { body: string; nodeId?: string | null },
): Promise<DesignerCanvasCommentDto> {
  const data = await postOrPutJson<{ success: boolean; comment?: DesignerCanvasCommentDto }>(
    `/api/component-designer/drafts/${encodeURIComponent(draftId)}/comments`,
    payload,
    'POST',
  );
  if (!data.comment) {
    throw new Error('Failed to add canvas comment.');
  }
  return data.comment;
}

export async function resolveDesignerCanvasComment(
  draftId: string,
  commentId: string,
): Promise<DesignerCanvasCommentDto> {
  const data = await postOrPutJson<{ success: boolean; comment?: DesignerCanvasCommentDto }>(
    `/api/component-designer/drafts/${encodeURIComponent(draftId)}/comments/${encodeURIComponent(commentId)}/resolve`,
    {},
    'POST',
  );
  if (!data.comment) {
    throw new Error('Failed to resolve canvas comment.');
  }
  return data.comment;
}

export type DesignerDraftAuditLogEntryDto = {
  id: string;
  draftId: string;
  actor: string;
  at: string;
  versionHint?: number;
  changes: Array<Record<string, unknown>>;
};

export async function listDesignerDraftAuditLog(draftId: string): Promise<DesignerDraftAuditLogEntryDto[]> {
  const { data, response } = await apiGet<{ success: boolean; entries?: DesignerDraftAuditLogEntryDto[]; error?: string }>(
    `/api/component-designer/drafts/${encodeURIComponent(draftId)}/audit-log`,
  );
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to load draft audit log.');
  }
  return data.entries ?? [];
}

export type DesignerFolderPermissionsDto = {
  defaultRoles: string[];
  folderPermissions: Record<string, string[]>;
  updatedAt: string;
};

export async function fetchDesignerFolderPermissions(): Promise<DesignerFolderPermissionsDto> {
  const { data, response } = await apiGet<{
    success: boolean;
    defaultRoles?: string[];
    folderPermissions?: Record<string, string[]>;
    updatedAt?: string;
    error?: string;
  }>('/api/component-designer/folder-permissions');
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to load folder permissions.');
  }
  return {
    defaultRoles: data.defaultRoles ?? ['ADMIN'],
    folderPermissions: data.folderPermissions ?? {},
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  };
}

export async function updateDesignerFolderPermissions(payload: {
  defaultRoles?: string[];
  folderPermissions?: Record<string, string[]>;
}): Promise<DesignerFolderPermissionsDto> {
  const data = await postOrPutJson<{
    success: boolean;
    defaultRoles?: string[];
    folderPermissions?: Record<string, string[]>;
    updatedAt?: string;
  }>('/api/component-designer/folder-permissions', payload, 'PUT');
  return {
    defaultRoles: data.defaultRoles ?? ['ADMIN'],
    folderPermissions: data.folderPermissions ?? {},
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  };
}

export async function publishComponentDesignerDraft(draftId: string): Promise<DesignerPublishState> {
  const data = await postOrPutJson<{ success: boolean; state?: DesignerPublishState }>(
    `/api/component-designer/drafts/${encodeURIComponent(draftId)}/publish`,
    {},
  );
  if (!data.success || !data.state) {
    throwApiError(data, 'Failed to publish component.');
  }
  return data.state;
}

export async function rollbackComponentDesignerDraft(
  draftId: string,
  version: number,
): Promise<DesignerPublishState> {
  const data = await postOrPutJson<{ success: boolean; state?: DesignerPublishState }>(
    `/api/component-designer/drafts/${encodeURIComponent(draftId)}/rollback`,
    { version },
  );
  if (!data.success || !data.state) {
    throwApiError(data, 'Failed to rollback component.');
  }
  return data.state;
}

export async function createDesignerStagingPreviewLink(draftId: string): Promise<DesignerStagingPreviewLink> {
  const data = await postOrPutJson<{
    success: boolean;
    token?: string;
    expiresAt?: string;
    previewPath?: string;
  }>(
    `/api/component-designer/drafts/${encodeURIComponent(draftId)}/staging-preview`,
    {},
  );
  if (!data.success || !data.token || !data.expiresAt || !data.previewPath) {
    throwApiError(data, 'Failed to create staging preview link.');
  }
  return {
    token: data.token,
    expiresAt: data.expiresAt,
    previewPath: data.previewPath,
  };
}

export async function loadDesignerStagingPreview(token: string): Promise<{
  componentPath: string;
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
  expiresAt: string;
}> {
  const { data, response } = await apiGet<{
    success: boolean;
    preview?: {
      componentPath: string;
      document: DesignerDocument;
      bindingDefinitions: DesignerBindingDefinitions;
      expiresAt: string;
    };
    error?: string;
  }>(`/api/component-designer/preview/staging/${encodeURIComponent(token)}`);
  if (!response.ok || !data.success || !data.preview) {
    throw new Error(data.error || 'Staging preview is unavailable.');
  }
  return data.preview;
}

export const listComponentDesignerDrafts = listComponentDesignerVersions;
export const listComponentDesignerDraftVersions = listComponentDesignerVersionHistory;
export const loadComponentDesignerDraft = loadComponentDesignerVersion;
export const createComponentDesignerDraft = createComponentDesignerVersion;
export const updateComponentDesignerDraft = updateComponentDesignerVersion;
export const deleteComponentDesignerDraft = deleteComponentDesignerVersion;
import { SHELL_DRAFT_FOLDER, isSystemManagedShellLayoutKey, resolveShellDesignerDraftSummary } from '../../lib/designerShellEntry';
import { getBuiltInComponentRecordByName } from '../../../domain/component-designer/layout-presets/builtInComponents';
import { getComponentAloneShellLayoutRecord } from '../../../domain/component-designer/systemManagedShellLayout';

export async function loadDesignerShellDraft(
  shellKey: string,
  publishedVersion?: number | null,
): Promise<DesignerVersionRecord> {
  const normalizedShellKey = shellKey.trim();
  if (!normalizedShellKey) {
    throw new Error('Shell key is required.');
  }

  if (isSystemManagedShellLayoutKey(normalizedShellKey)) {
    return getComponentAloneShellLayoutRecord();
  }

  let items: DesignerVersionSummary[] = [];
  try {
    items = await listComponentDesignerVersions();
  } catch {
    items = [];
  }
  const exact = items
    .filter((draft) => draft.name.trim() === normalizedShellKey)
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0];
  if (exact) {
    try {
      return await loadComponentDesignerVersion(exact.id, publishedVersion ?? undefined);
    } catch {
      // Anonymous public shells still need the built-in preset when draft APIs require auth.
    }
  }

  const builtIn = getBuiltInComponentRecordByName(normalizedShellKey);
  if (builtIn) {
    return builtIn;
  }

  const match = resolveShellDesignerDraftSummary(items, normalizedShellKey);
  if (!match) {
    throw new Error(`Shell component ${SHELL_DRAFT_FOLDER}/${normalizedShellKey} not found.`);
  }

  return loadComponentDesignerVersion(match.id, publishedVersion ?? undefined);
}

export async function duplicateShellLayoutDraft(
  sourceShellKey: string,
  targetShellKey: string,
): Promise<DesignerVersionRecord> {
  const { data, response } = await apiPost<{ success?: boolean; draft?: DesignerVersionRecord; error?: string }>(
    '/api/component-designer/shells/duplicate',
    { sourceShellKey, targetShellKey },
  );

  if (!response.ok || !data?.draft) {
    throw new Error(data?.error || 'Failed to duplicate shell layout.');
  }

  return data.draft;
}

export async function runComponentDesignerRuntimePreview(
  payload: RunComponentDesignerPreviewPayload,
): Promise<DesignerPreviewRuntimeResponse> {
  return postOrPutJson<DesignerPreviewRuntimeResponse>('/api/component-designer/preview/runtime', payload);
}

export async function validateComponentDesignerDocument(
  document: DesignerDocument,
): Promise<DesignerValidateResponse> {
  const { data, response } = await apiPost<DesignerValidateResponse & { error?: string }>(
    '/api/component-designer/validate',
    { document },
  );
  if (!response.ok) {
    throw new Error(data.error || `Validation request failed with status ${response.status}.`);
  }
  return data;
}

export async function syncComponentDesignerCodeToCanvas(
  payload: SyncComponentDesignerCodePayload,
): Promise<DesignerCodeToCanvasResponse> {
  const data = await postOrPutJson<DesignerCodeToCanvasResponse & { diagnostics?: DesignerDiagnostic[] }>(
    '/api/component-designer/sync/code-to-canvas',
    payload,
  );
  if ('diagnostics' in data && data.success === false) {
    return {
      success: false,
      diagnostics: data.diagnostics ?? [],
    };
  }

  return {
    success: true,
    document: data.document,
    bindingDefinitions: data.bindingDefinitions,
  };
}

export async function fetchSystemComponentCatalog(): Promise<DesignerCatalogItem[]> {
  return fetchCatalogItems(
    '/api/component-designer/catalog/system-components',
    'Failed to load system component catalog',
  );
}

export async function fetchReusableComponentCatalog(): Promise<DesignerCatalogItem[]> {
  return fetchCatalogItems(
    '/api/component-designer/catalog/reusable-components',
    'Failed to load reusable component catalog',
  );
}

export async function fetchComponentDesignerPaletteCatalog(): Promise<ComponentDesignerPaletteCatalog> {
  const [systemItems, reusableItems] = await Promise.all([
    fetchSystemComponentCatalog(),
    fetchReusableComponentCatalog(),
  ]);
  return { systemItems, reusableItems };
}

export function invalidateComponentDesignerDrafts(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: componentDesignerQueryKeys.drafts() });
}

export function invalidateDesignerPublishedViews(
  queryClient: ReturnType<typeof useQueryClient>,
  target?: { shellKey?: string; pageSlug?: string },
) {
  if (target?.shellKey?.trim()) {
    void queryClient.invalidateQueries({
      queryKey: componentDesignerQueryKeys.publishedShell(target.shellKey.trim()),
    });
  } else {
    void queryClient.invalidateQueries({ queryKey: [...componentDesignerQueryKeys.all, 'shell'] });
  }

  if (target?.pageSlug?.trim()) {
    void queryClient.invalidateQueries({
      queryKey: componentDesignerQueryKeys.publishedPage(target.pageSlug.trim()),
    });
  } else {
    void queryClient.invalidateQueries({ queryKey: [...componentDesignerQueryKeys.all, 'published'] });
  }
}

export function useComponentDesignerDraftsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: componentDesignerQueryKeys.drafts(),
    queryFn: listComponentDesignerVersions,
    enabled: options?.enabled ?? true,
    ...DESIGNER_CATALOG_QUERY_OPTIONS,
  });
}

export function useDesignerComponentUsageQuery(draftId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: componentDesignerQueryKeys.usage(draftId ?? ''),
    queryFn: () => fetchDesignerComponentUsage(draftId as string),
    enabled: Boolean(draftId) && (options?.enabled ?? true),
    ...DESIGNER_CATALOG_QUERY_OPTIONS,
  });
}

export function useUnusedDesignerComponentsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: componentDesignerQueryKeys.unusedComponents(),
    queryFn: fetchUnusedDesignerComponents,
    enabled: options?.enabled ?? true,
    ...DESIGNER_CATALOG_QUERY_OPTIONS,
  });
}

export function useComponentDesignerVersionHistoryQuery(draftId: string | null) {
  return useQuery({
    queryKey: componentDesignerQueryKeys.draftVersions(draftId ?? ''),
    queryFn: () => listComponentDesignerVersionHistory(draftId as string),
    enabled: Boolean(draftId),
    ...DESIGNER_CATALOG_QUERY_OPTIONS,
  });
}

export function useComponentDesignerPaletteCatalogQuery() {
  return useQuery({
    queryKey: componentDesignerQueryKeys.paletteCatalog(),
    queryFn: fetchComponentDesignerPaletteCatalog,
    ...DESIGNER_CATALOG_QUERY_OPTIONS,
  });
}

export function useCreateComponentDesignerVersionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateComponentDesignerVersionPayload) => createComponentDesignerVersion(payload),
    onSuccess: () => {
      invalidateComponentDesignerDrafts(queryClient);
    },
  });
}

export function useUpdateComponentDesignerVersionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ versionId, payload }: { versionId: string; payload: UpdateComponentDesignerVersionPayload }) =>
      updateComponentDesignerVersion(versionId, payload),
    onSuccess: () => {
      invalidateComponentDesignerDrafts(queryClient);
    },
  });
}

export function useDeleteComponentDesignerVersionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) => deleteComponentDesignerVersion(versionId),
    onSuccess: () => {
      invalidateComponentDesignerDrafts(queryClient);
    },
  });
}

export function useLoadComponentDesignerVersionMutation() {
  return useMutation({
    mutationFn: ({ versionId, version }: { versionId: string; version?: number }) =>
      loadComponentDesignerVersion(versionId, version),
  });
}

export function useRunComponentDesignerPreviewMutation() {
  return useMutation({
    mutationFn: (payload: RunComponentDesignerPreviewPayload) => runComponentDesignerRuntimePreview(payload),
  });
}

export function useSyncComponentDesignerCodeToCanvasMutation() {
  return useMutation({
    mutationFn: (payload: SyncComponentDesignerCodePayload) => syncComponentDesignerCodeToCanvas(payload),
  });
}

export function useValidateComponentDesignerDocumentMutation() {
  return useMutation({
    mutationFn: (document: DesignerDocument) => validateComponentDesignerDocument(document),
  });
}
