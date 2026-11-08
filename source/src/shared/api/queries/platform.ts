import { useQuery, type QueryClient } from '@tanstack/react-query';
import { apiDelete, apiFetch, apiGet, apiPost, apiPut } from '../client';
import type { PlatformCulturesResponse } from '../contracts/platform/cultures';
import type { ExperienceManifest, ExperienceManifestPortal } from '../contracts/platform/experienceManifest';
import type { PlatformRuntimeConfig } from '../contracts/platform/types';
import type {
  NavigationManifest,
  NavigationManifestSummary,
} from '../contracts/platform/navigation';
import { bootQueryKeys } from './boot';

export const platformQueryKeys = {
  all: ['platform'] as const,
  runtimeConfig: () => [...platformQueryKeys.all, 'runtime-config'] as const,
  cultures: () => [...platformQueryKeys.all, 'cultures'] as const,
  cultureTranslations: () => [...platformQueryKeys.all, 'culture-translations'] as const,
  experienceManifest: (id?: string) => [...platformQueryKeys.all, 'experience-manifest', id ?? 'admin'] as const,
  navigations: () => [...platformQueryKeys.all, 'navigations'] as const,
  navigation: (id: string) => [...platformQueryKeys.all, 'navigation', id] as const,
};

type PlatformRuntimeConfigResponse = PlatformRuntimeConfig & {
  success?: boolean;
  error?: string;
};

export function normalizePlatformRuntimeConfig(
  payload: Partial<PlatformRuntimeConfigResponse> | null | undefined,
): PlatformRuntimeConfig {
  return {
    mounts: Array.isArray(payload?.mounts) ? payload.mounts : [],
    shells: Array.isArray(payload?.shells) ? payload.shells : [],
    shellRules: Array.isArray(payload?.shellRules) ? payload.shellRules : [],
    pageModules: Array.isArray(payload?.pageModules) ? payload.pageModules : [],
    bindings: Array.isArray(payload?.bindings) ? payload.bindings : [],
    navigations: Array.isArray(payload?.navigations) ? payload.navigations : [],
    version: typeof payload?.version === 'string' ? payload.version : '',
  };
}

export async function fetchPlatformRuntimeConfig(
  signal?: AbortSignal,
): Promise<PlatformRuntimeConfig> {
  const { data, response } = await apiGet<PlatformRuntimeConfigResponse>(
    '/api/platform/runtime-config',
    { signal },
  );

  if (!response.ok) {
    throw new Error(
      typeof data?.error === 'string' && data.error.trim()
        ? data.error
        : 'Failed to load platform runtime config.',
    );
  }

  if (data?.success === false) {
    throw new Error(
      typeof data.error === 'string' && data.error.trim()
        ? data.error
        : 'Failed to load platform runtime config.',
    );
  }

  return normalizePlatformRuntimeConfig(data);
}

export function usePlatformRuntimeConfigQuery(enabled = true) {
  return useQuery({
    queryKey: platformQueryKeys.runtimeConfig(),
    queryFn: ({ signal }) => fetchPlatformRuntimeConfig(signal),
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/** Reload platform boot config after install promotion or registry changes. */
export async function refetchPlatformBootQueries(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: bootQueryKeys.all });
  await queryClient.invalidateQueries({ queryKey: platformQueryKeys.all });
  await Promise.all([
    queryClient.refetchQueries({ queryKey: bootQueryKeys.all }),
    queryClient.refetchQueries({ queryKey: platformQueryKeys.runtimeConfig() }),
    queryClient.refetchQueries({ queryKey: platformQueryKeys.cultures() }),
  ]);
}

type PlatformCulturesQueryResponse = PlatformCulturesResponse & {
  error?: string;
};

export async function fetchPlatformCultures(
  signal?: AbortSignal,
): Promise<PlatformCulturesResponse> {
  const { data, response } = await apiGet<PlatformCulturesQueryResponse>(
    '/api/platform/cultures',
    { signal },
  );

  if (!response.ok) {
    throw new Error(
      typeof data?.error === 'string' && data.error.trim()
        ? data.error
        : 'Failed to load platform cultures.',
    );
  }

  if (data?.success === false) {
    throw new Error(
      typeof data.error === 'string' && data.error.trim()
        ? data.error
        : 'Failed to load platform cultures.',
    );
  }

  return {
    success: true,
    enabledCulturePackIds: Array.isArray(data?.enabledCulturePackIds)
      ? data.enabledCulturePackIds
      : [],
    defaultCultureId: typeof data?.defaultCultureId === 'string'
      ? data.defaultCultureId
      : 'us',
    packs: Array.isArray(data?.packs) ? data.packs : [],
    availablePacks: Array.isArray(data?.availablePacks) ? data.availablePacks : [],
  };
}

export function usePlatformCulturesQuery(enabled = true) {
  return useQuery({
    queryKey: platformQueryKeys.cultures(),
    queryFn: ({ signal }) => fetchPlatformCultures(signal),
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

type ExperienceManifestResponse = {
  success?: boolean;
  manifest?: ExperienceManifest;
  error?: string;
  errors?: string[];
};

export async function fetchExperienceManifest(
  manifestId = 'admin',
  signal?: AbortSignal,
): Promise<ExperienceManifest> {
  const { data, response } = await apiGet<ExperienceManifestResponse>(
    `/api/platform/experience/manifest?id=${encodeURIComponent(manifestId)}`,
    { signal },
  );

  if (!response.ok || !data?.manifest) {
    throw new Error(
      typeof data?.error === 'string' && data.error.trim()
        ? data.error
        : 'Failed to load experience manifest.',
    );
  }

  return data.manifest;
}

export async function compileExperienceManifest(
  manifest: ExperienceManifest,
): Promise<ExperienceManifest> {
  const { data, response } = await apiPut<ExperienceManifestResponse>(
    '/api/platform/experience/manifest',
    manifest,
  );

  if (!response.ok || !data?.manifest) {
    const details = Array.isArray(data?.errors) ? data.errors.join(' ') : data?.error;
    throw new Error(details || 'Failed to compile experience manifest.');
  }

  return data.manifest;
}

type PortalMutationResponse = {
  success?: boolean;
  portal?: ExperienceManifestPortal;
  error?: string;
  errors?: string[];
};

export async function createPortalRecord(
  application: ExperienceManifestPortal,
): Promise<ExperienceManifestPortal> {
  const { data, response } = await apiPost<PortalMutationResponse>(
    '/api/platform/portals',
    application,
  );

  if (!response.ok || !data?.portal) {
    const details = Array.isArray(data?.errors) ? data.errors.join(' ') : data?.error;
    throw new Error(details || 'Failed to create portal.');
  }

  return data.portal;
}

export async function updatePortalRecord(
  segment: string,
  application: ExperienceManifestPortal,
): Promise<ExperienceManifestPortal> {
  const { data, response } = await apiPut<PortalMutationResponse>(
    `/api/platform/portals/${encodeURIComponent(segment)}`,
    application,
  );

  if (!response.ok || !data?.portal) {
    const details = Array.isArray(data?.errors) ? data.errors.join(' ') : data?.error;
    throw new Error(details || 'Failed to update portal.');
  }

  return data.portal;
}

export async function uploadPortalLogo(segment: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiFetch(
    `/api/platform/portals/${encodeURIComponent(segment)}/logo`,
    {
      method: 'POST',
      body: formData,
    },
  );

  const data = await response.json() as {
    success?: boolean;
    error?: string;
    url?: string;
  };

  if (!response.ok || !data?.success || !data.url) {
    throw new Error(data?.error || 'Failed to upload portal logo.');
  }

  return data.url;
}

export async function deletePortalRecord(segment: string): Promise<void> {
  const { data, response } = await apiDelete<{ success?: boolean; error?: string }>(
    `/api/platform/portals/${encodeURIComponent(segment)}`,
  );

  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || 'Failed to delete portal.');
  }
}

export async function duplicatePortalRecord(
  segment: string,
  target: { segment: string; name: string },
): Promise<ExperienceManifestPortal> {
  const { data, response } = await apiPost<PortalMutationResponse>(
    `/api/platform/portals/${encodeURIComponent(segment)}/duplicate`,
    {
      segment: target.segment,
      name: target.name,
    },
  );

  if (!response.ok || !data?.portal) {
    const details = Array.isArray(data?.errors) ? data.errors.join(' ') : data?.error;
    throw new Error(details || 'Failed to duplicate portal.');
  }

  return data.portal;
}

export async function appendPortalPageMenu(
  portalSegment: string,
  input: { pageKey: string; path?: string; navLabel: string; loaderRef?: string },
): Promise<ExperienceManifestPortal> {
  const { data, response } = await apiPost<PortalMutationResponse>(
    `/api/platform/portals/${encodeURIComponent(portalSegment)}/pages/menu`,
    input,
  );

  if (!response.ok || !data?.portal) {
    const details = Array.isArray(data?.errors) ? data.errors.join(' ') : data?.error;
    throw new Error(details || 'Failed to add page to portal menu.');
  }

  return data.portal;
}

type NavigationListResponse = {
  success?: boolean;
  navigations?: NavigationManifestSummary[];
  error?: string;
};

type NavigationMutationResponse = {
  success?: boolean;
  manifest?: NavigationManifestSummary;
  error?: string;
  errors?: string[];
};

export async function fetchNavigationManifests(
  options?: { signal?: AbortSignal; portalSegment?: string },
): Promise<NavigationManifestSummary[]> {
  const portalSegment = options?.portalSegment?.trim();
  const path = portalSegment
    ? `/api/platform/navigations?portalSegment=${encodeURIComponent(portalSegment)}`
    : '/api/platform/navigations';
  const { data, response } = await apiGet<NavigationListResponse>(
    path,
    { signal: options?.signal },
  );

  if (!response.ok || !Array.isArray(data?.navigations)) {
    throw new Error(data?.error || 'Failed to load navigation manifests.');
  }

  return data.navigations;
}

export async function fetchNavigationManifest(
  id: string,
  signal?: AbortSignal,
): Promise<NavigationManifestSummary> {
  const { data, response } = await apiGet<NavigationMutationResponse>(
    `/api/platform/navigations/${encodeURIComponent(id)}`,
    { signal },
  );

  if (!response.ok || !data?.manifest) {
    throw new Error(data?.error || 'Failed to load navigation manifest.');
  }

  return data.manifest;
}

export async function createNavigationManifestRecord(
  manifest: NavigationManifest,
): Promise<NavigationManifestSummary> {
  const { data, response } = await apiPost<NavigationMutationResponse>(
    '/api/platform/navigations',
    manifest,
  );

  if (!response.ok || !data?.manifest) {
    const details = Array.isArray(data?.errors) ? data.errors.join(' ') : data?.error;
    throw new Error(details || 'Failed to create navigation manifest.');
  }

  return data.manifest;
}

export async function renameNavigationManifestRecord(
  oldId: string,
  newId: string,
): Promise<NavigationManifestSummary> {
  const { data, response } = await apiPost<NavigationMutationResponse>(
    `/api/platform/navigations/${encodeURIComponent(oldId)}/rename`,
    { id: newId },
  );

  if (!response.ok || !data?.manifest) {
    const details = Array.isArray(data?.errors) ? data.errors.join(' ') : data?.error;
    throw new Error(details || 'Failed to rename navigation manifest.');
  }

  return data.manifest;
}

export async function updateNavigationManifestRecord(
  id: string,
  manifest: NavigationManifest,
): Promise<NavigationManifestSummary> {
  const { data, response } = await apiPut<NavigationMutationResponse>(
    `/api/platform/navigations/${encodeURIComponent(id)}`,
    manifest,
  );

  if (!response.ok || !data?.manifest) {
    const details = Array.isArray(data?.errors) ? data.errors.join(' ') : data?.error;
    throw new Error(details || 'Failed to update navigation manifest.');
  }

  return data.manifest;
}

export async function deleteNavigationManifestRecord(
  id: string,
  options?: { replacementNavigationRef?: string | null },
): Promise<void> {
  const body = options?.replacementNavigationRef !== undefined
    ? { replacementNavigationRef: options.replacementNavigationRef }
    : undefined;
  const { data, response } = await apiDelete<{ success?: boolean; error?: string }>(
    `/api/platform/navigations/${encodeURIComponent(id)}`,
    body,
  );

  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || 'Failed to delete navigation manifest.');
  }
}

export function useNavigationManifestsQuery(
  options?: { enabled?: boolean; portalSegment?: string },
) {
  const portalSegment = options?.portalSegment?.trim();
  const enabled = options?.enabled ?? true;
  return useQuery({
    queryKey: portalSegment
      ? [...platformQueryKeys.navigations(), portalSegment]
      : platformQueryKeys.navigations(),
    queryFn: ({ signal }) => fetchNavigationManifests({ signal, portalSegment }),
    enabled,
    staleTime: 30_000,
  });
}

export function useNavigationManifestQuery(id: string | null, enabled = true) {
  return useQuery({
    queryKey: platformQueryKeys.navigation(id ?? ''),
    queryFn: ({ signal }) => fetchNavigationManifest(id!, signal),
    enabled: enabled && Boolean(id?.trim()),
    staleTime: 30_000,
  });
}

export function useExperienceManifestQuery(manifestId = 'admin', enabled = true) {
  return useQuery({
    queryKey: platformQueryKeys.experienceManifest(manifestId),
    queryFn: ({ signal }) => fetchExperienceManifest(manifestId, signal),
    enabled,
    staleTime: 30_000,
  });
}
