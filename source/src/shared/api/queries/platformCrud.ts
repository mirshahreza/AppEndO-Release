import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  CreatePlatformMountPayload,
  CreatePlatformPageModulePayload,
  CreatePlatformRouteBindingPayload,
  CreatePlatformShellPayload,
  CreatePlatformShellRulePayload,
  PlatformMount,
  PlatformPageModule,
  PlatformRouteBinding,
  PlatformShell,
  PlatformShellRule,
  UpdatePlatformMountPayload,
  UpdatePlatformPageModulePayload,
  UpdatePlatformRouteBindingPayload,
  UpdatePlatformShellPayload,
  UpdatePlatformShellRulePayload,
} from '../contracts/platform/types';
import type {
  UpdatePlatformCulturesPayload,
} from '../contracts/platform/cultures';
import type {
  PlatformCultureTranslationsResponse,
  UpdatePlatformCultureTranslationsPayload,
} from '../contracts/platform/cultureTranslations';
import type {
  StudioMountExportDiscover,
  StudioMountExportPreview,
  StudioMountExportRequest,
} from '../contracts/platform/studioMountExport';
import { apiDelete, apiGet, apiPost, apiPut, type ApiListResponse } from '../client';
import { bootQueryKeys } from './boot';
import { platformQueryKeys } from './platform';

export const platformCrudQueryKeys = {
  all: ['platform-crud'] as const,
  mounts: () => [...platformCrudQueryKeys.all, 'mounts'] as const,
  shells: () => [...platformCrudQueryKeys.all, 'shells'] as const,
  pageModules: () => [...platformCrudQueryKeys.all, 'page-modules'] as const,
  shellRules: () => [...platformCrudQueryKeys.all, 'shell-rules'] as const,
  routeBindings: () => [...platformCrudQueryKeys.all, 'route-bindings'] as const,
};

const getLoadErrorMessage = (data: unknown, fallback: string): string => {
  if (!data || typeof data !== 'object') {
    return fallback;
  }
  const payload = data as { error?: string };
  return typeof payload.error === 'string' && payload.error.trim() ? payload.error : fallback;
};

export const invalidatePlatformQueries = (queryClient: QueryClient) => {
  void queryClient.invalidateQueries({ queryKey: platformCrudQueryKeys.all });
  void queryClient.invalidateQueries({ queryKey: platformQueryKeys.runtimeConfig() });
  void queryClient.invalidateQueries({ queryKey: platformQueryKeys.cultures() });
  void queryClient.invalidateQueries({ queryKey: platformQueryKeys.cultureTranslations() });
  void queryClient.invalidateQueries({ queryKey: bootQueryKeys.all });
};

async function fetchList<T>(path: string, label: string): Promise<T[]> {
  const { data, response } = await apiGet<ApiListResponse<T>>(path);
  if (!response.ok) {
    throw new Error(getLoadErrorMessage(data, `Failed to load ${label} (HTTP ${response.status}).`));
  }
  if (!data.success) {
    throw new Error(getLoadErrorMessage(data, `Failed to load ${label}.`));
  }
  return (data.items ?? []) as T[];
}

function usePlatformMountsQuery() {
  return useQuery({
    queryKey: platformCrudQueryKeys.mounts(),
    queryFn: () => fetchList<PlatformMount>('/api/platform/mounts', 'mounts'),
  });
}

function usePlatformShellsQuery() {
  return useQuery({
    queryKey: platformCrudQueryKeys.shells(),
    queryFn: () => fetchList<PlatformShell>('/api/platform/shells', 'shells'),
  });
}

function usePlatformPageModulesQuery() {
  return useQuery({
    queryKey: platformCrudQueryKeys.pageModules(),
    queryFn: () => fetchList<PlatformPageModule>('/api/platform/page-modules', 'page modules'),
  });
}

function usePlatformShellRulesQuery() {
  return useQuery({
    queryKey: platformCrudQueryKeys.shellRules(),
    queryFn: () => fetchList<PlatformShellRule>('/api/platform/shell-rules', 'shell rules'),
  });
}

function usePlatformRouteBindingsQuery() {
  return useQuery({
    queryKey: platformCrudQueryKeys.routeBindings(),
    queryFn: () => fetchList<PlatformRouteBinding>('/api/platform/route-bindings', 'route bindings'),
  });
}

function useCreatePlatformMountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePlatformMountPayload) => apiPost('/api/platform/mounts', payload),
    onSuccess: ({ data }) => {
      if (data.success) invalidatePlatformQueries(queryClient);
    },
  });
}

function useUpdatePlatformMountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePlatformMountPayload }) =>
      apiPut(`/api/platform/mounts/${encodeURIComponent(id)}`, payload),
    onSuccess: ({ data }) => {
      if (data.success) invalidatePlatformQueries(queryClient);
    },
  });
}

function useDeletePlatformMountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/platform/mounts/${encodeURIComponent(id)}`),
    onSuccess: ({ data }) => {
      if (data.success) invalidatePlatformQueries(queryClient);
    },
  });
}

function useCreatePlatformShellMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePlatformShellPayload) => apiPost('/api/platform/shells', payload),
    onSuccess: ({ data }) => {
      if (data.success) invalidatePlatformQueries(queryClient);
    },
  });
}

function useUpdatePlatformShellMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shellKey, payload }: { shellKey: string; payload: UpdatePlatformShellPayload }) =>
      apiPut(`/api/platform/shells/${encodeURIComponent(shellKey)}`, payload),
    onSuccess: ({ data }) => {
      if (data.success) invalidatePlatformQueries(queryClient);
    },
  });
}

function useDeletePlatformShellMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (shellKey: string) => apiDelete(`/api/platform/shells/${encodeURIComponent(shellKey)}`),
    onSuccess: ({ data }) => {
      if (data.success) invalidatePlatformQueries(queryClient);
    },
  });
}

function useCreatePlatformPageModuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePlatformPageModulePayload) => apiPost('/api/platform/page-modules', payload),
    onSuccess: ({ data }) => {
      if (data.success) invalidatePlatformQueries(queryClient);
    },
  });
}

function useUpdatePlatformPageModuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageKey, payload }: { pageKey: string; payload: UpdatePlatformPageModulePayload }) =>
      apiPut(`/api/platform/page-modules/${encodeURIComponent(pageKey)}`, payload),
    onSuccess: ({ data }) => {
      if (data.success) invalidatePlatformQueries(queryClient);
    },
  });
}

function useDeletePlatformPageModuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pageKey: string) => apiDelete(`/api/platform/page-modules/${encodeURIComponent(pageKey)}`),
    onSuccess: ({ data }) => {
      if (data.success) invalidatePlatformQueries(queryClient);
    },
  });
}

function useCreatePlatformShellRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePlatformShellRulePayload) => apiPost('/api/platform/shell-rules', payload),
    onSuccess: ({ data }) => {
      if (data.success) invalidatePlatformQueries(queryClient);
    },
  });
}

function useUpdatePlatformShellRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdatePlatformShellRulePayload }) =>
      apiPut(`/api/platform/shell-rules/${id}`, payload),
    onSuccess: ({ data }) => {
      if (data.success) invalidatePlatformQueries(queryClient);
    },
  });
}

function useDeletePlatformShellRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/platform/shell-rules/${id}`),
    onSuccess: ({ data }) => {
      if (data.success) invalidatePlatformQueries(queryClient);
    },
  });
}

function useCreatePlatformRouteBindingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePlatformRouteBindingPayload) => apiPost('/api/platform/route-bindings', payload),
    onSuccess: ({ data }) => {
      if (data.success) invalidatePlatformQueries(queryClient);
    },
  });
}

function useUpdatePlatformRouteBindingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdatePlatformRouteBindingPayload }) =>
      apiPut(`/api/platform/route-bindings/${id}`, payload),
    onSuccess: ({ data }) => {
      if (data.success) invalidatePlatformQueries(queryClient);
    },
  });
}

function useDeletePlatformRouteBindingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/platform/route-bindings/${id}`),
    onSuccess: ({ data }) => {
      if (data.success) invalidatePlatformQueries(queryClient);
    },
  });
}

type StudioMountExportDiscoverResponse = {
  success: boolean;
  discover?: StudioMountExportDiscover;
  error?: string;
  details?: string[];
};

export async function discoverStudioMountExport(mountId: string): Promise<StudioMountExportDiscover> {
  const { data, response } = await apiPost<StudioMountExportDiscoverResponse>(
    `/api/platform/mounts/${encodeURIComponent(mountId)}/export/discover`,
    {},
  );
  if (!response.ok || !data.success || !data.discover) {
    const details = Array.isArray(data.details) ? data.details : [];
    throw new Error([data.error || `Export discover failed (HTTP ${response.status}).`, ...details].filter(Boolean).join(' '));
  }
  return data.discover;
}

type StudioMountExportPreviewResponse = {
  success: boolean;
  preview?: StudioMountExportPreview;
  error?: string;
  details?: string[];
};

export async function previewStudioMountExport(
  mountId: string,
  payload: StudioMountExportRequest,
): Promise<StudioMountExportPreview> {
  const { data, response } = await apiPost<StudioMountExportPreviewResponse>(
    `/api/platform/mounts/${encodeURIComponent(mountId)}/export/preview`,
    payload,
  );
  if (!response.ok || !data.success || !data.preview) {
    const details = Array.isArray(data.details) ? data.details : [];
    throw new Error([data.error || `Export preview failed (HTTP ${response.status}).`, ...details].filter(Boolean).join(' '));
  }
  return data.preview;
}

export async function downloadStudioMountExport(
  mountId: string,
  payload: StudioMountExportRequest,
): Promise<{ blob: Blob; fileName: string }> {
  const response = await fetch(`/api/platform/mounts/${encodeURIComponent(mountId)}/export/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = `Export download failed (HTTP ${response.status}).`;
    try {
      const data = await response.json() as { error?: string; details?: string[] };
      const details = Array.isArray(data.details) ? data.details : [];
      message = [data.error || message, ...details].filter(Boolean).join(' ');
    } catch {
      // binary or empty body
    }
    throw new Error(message);
  }

  const disposition = response.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const fileName = match?.[1] || `${payload.packageId}-${payload.version || '0.1.0'}.zip`;
  const blob = await response.blob();
  return { blob, fileName };
}

export async function updatePlatformCultures(
  payload: UpdatePlatformCulturesPayload,
): Promise<void> {
  const { data, response } = await apiPut<{ success?: boolean; error?: string }>(
    '/api/platform/cultures',
    payload,
  );

  if (!response.ok || data.success === false) {
    throw new Error(getLoadErrorMessage(data, 'Failed to update platform cultures.'));
  }
}

export function useUpdatePlatformCulturesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updatePlatformCultures,
    onSuccess: () => {
      invalidatePlatformQueries(queryClient);
    },
  });
}

type PlatformCultureTranslationsQueryResponse = PlatformCultureTranslationsResponse & {
  error?: string;
};

export async function fetchPlatformCultureTranslations(
  signal?: AbortSignal,
): Promise<PlatformCultureTranslationsResponse> {
  const { data, response } = await apiGet<PlatformCultureTranslationsQueryResponse>(
    '/api/platform/culture-translations',
    { signal },
  );

  if (!response.ok || data?.success !== true) {
    throw new Error(getLoadErrorMessage(data, 'Failed to load culture translations.'));
  }

  return {
    success: true,
    revision: typeof data.revision === 'number' ? data.revision : 0,
    keys: Array.isArray(data.keys) ? data.keys : [],
    masterBundle: data.masterBundle ?? {},
    defaultBundles: data.defaultBundles ?? {},
    cultureOverrides: data.cultureOverrides ?? {},
    cultures: Array.isArray(data.cultures) ? data.cultures : [],
  };
}

export async function updatePlatformCultureTranslations(
  payload: UpdatePlatformCultureTranslationsPayload,
): Promise<void> {
  const { data, response } = await apiPut<{ success?: boolean; error?: string }>(
    '/api/platform/culture-translations',
    payload,
  );

  if (!response.ok || data.success === false) {
    throw new Error(getLoadErrorMessage(data, 'Failed to update culture translations.'));
  }
}

export function usePlatformCultureTranslationsQuery(enabled = true) {
  return useQuery({
    queryKey: platformQueryKeys.cultureTranslations(),
    queryFn: ({ signal }) => fetchPlatformCultureTranslations(signal),
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useUpdatePlatformCultureTranslationsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updatePlatformCultureTranslations,
    onSuccess: () => {
      invalidatePlatformQueries(queryClient);
    },
  });
}
