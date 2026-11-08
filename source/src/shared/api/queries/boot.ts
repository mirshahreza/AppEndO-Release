import { useQuery, type QueryClient } from '@tanstack/react-query';
import { apiGet, isAbortError } from '../client';
import type { AppBootResponse } from '../contracts/boot/types';
import type { InstallStatusResponse } from '../contracts/install/types';
import type { PlatformCultureTranslationsBootMeta } from '../contracts/platform/cultureTranslations';
import { DEFAULT_PLATFORM_CULTURE_TRANSLATIONS_CONFIG } from '../contracts/platform/cultureTranslations';
import type { PlatformWebFont } from '../contracts/platform/webFonts';
import type { PwaSettings } from '../contracts/settings/pwa';
import type { FeedbackBootPolicy } from '../contracts/feedback/types';
import { DEFAULT_PLATFORM_FEEDBACK_POLICY } from '../contracts/feedback/constants';
import { DEFAULT_PLATFORM_ROUTE_LOADING_CONFIG } from '../contracts/routeLoading/constants';
import { normalizePlatformRouteLoadingConfig } from '../contracts/routeLoading/normalizers';
import type { PlatformRouteLoadingConfig } from '../contracts/routeLoading/schema';
import { installQueryKeys } from './install';
import { normalizePlatformRuntimeConfig, platformQueryKeys } from './platform';
import { platformWebFontsQueryKeys } from './platformWebFonts';
import { pwaQueryKeys } from './pwa';

export const bootQueryKeys = {
  all: ['boot'] as const,
};

type AppBootApiResponse = AppBootResponse & {
  error?: string;
};

function normalizeCultureTranslationsBootMeta(
  raw: PlatformCultureTranslationsBootMeta | undefined,
): PlatformCultureTranslationsBootMeta {
  if (!raw || typeof raw !== 'object') {
    return {
      revision: DEFAULT_PLATFORM_CULTURE_TRANSLATIONS_CONFIG.revision,
      cultureOverrides: {},
    };
  }

  const cultureOverrides: PlatformCultureTranslationsBootMeta['cultureOverrides'] = {};
  const source = raw.cultureOverrides;
  if (source && typeof source === 'object') {
    for (const [cultureId, entries] of Object.entries(source)) {
      if (!entries || typeof entries !== 'object') {
        continue;
      }
      const nextEntries: Record<string, string> = {};
      for (const [key, value] of Object.entries(entries)) {
        if (typeof value === 'string' && value.trim()) {
          nextEntries[key] = value.trim();
        }
      }
      if (Object.keys(nextEntries).length > 0) {
        cultureOverrides[cultureId] = nextEntries;
      }
    }
  }

  return {
    revision: typeof raw.revision === 'number' && Number.isFinite(raw.revision) && raw.revision >= 0
      ? Math.floor(raw.revision)
      : 0,
    cultureOverrides,
  };
}

export async function fetchAppBoot(signal?: AbortSignal): Promise<AppBootResponse> {
  const timeout = AbortSignal.timeout(30_000);
  const mergedSignal = typeof AbortSignal.any === 'function' && signal
    ? AbortSignal.any([signal, timeout])
    : (signal ?? timeout);

  let data: AppBootApiResponse;
  let response: Response;
  try {
    ({ data, response } = await apiGet<AppBootApiResponse>('/api/boot', { signal: mergedSignal }));
  } catch (error) {
    if (signal?.aborted) {
      throw isAbortError(error)
        ? error
        : (signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
    }
    if (timeout.aborted) {
      throw new Error('Boot request timed out.');
    }
    throw error;
  }

  if (!response.ok || data?.success !== true) {
    throw new Error(
      typeof data?.error === 'string' && data.error.trim()
        ? data.error
        : 'Failed to load application boot payload.',
    );
  }

  return {
    success: true,
    runtimeConfig: normalizePlatformRuntimeConfig(data.runtimeConfig),
    cultures: {
      success: true,
      enabledCulturePackIds: Array.isArray(data.cultures?.enabledCulturePackIds)
        ? data.cultures.enabledCulturePackIds
        : [],
      defaultCultureId: typeof data.cultures?.defaultCultureId === 'string'
        ? data.cultures.defaultCultureId
        : 'us',
      packs: Array.isArray(data.cultures?.packs) ? data.cultures.packs : [],
      availablePacks: Array.isArray(data.cultures?.availablePacks) ? data.cultures.availablePacks : [],
    },
    cultureTranslations: normalizeCultureTranslationsBootMeta(data.cultureTranslations),
    install: data.install as InstallStatusResponse,
    enabledPackages: Array.isArray(data.enabledPackages) ? data.enabledPackages : [],
    pwa: data.pwa as PwaSettings,
    webFonts: Array.isArray(data.webFonts) ? data.webFonts as PlatformWebFont[] : [],
    feedbackPolicy: normalizeFeedbackBootPolicy(data.feedbackPolicy),
    routeLoading: normalizePlatformRouteLoadingConfig(data.routeLoading),
  };
}

function normalizeFeedbackBootPolicy(raw: FeedbackBootPolicy | undefined): FeedbackBootPolicy {
  if (!raw || typeof raw !== 'object') {
    return {
      enabled: DEFAULT_PLATFORM_FEEDBACK_POLICY.enabled,
      allowAuthenticated: DEFAULT_PLATFORM_FEEDBACK_POLICY.allowAuthenticated,
      allowAnonymous: DEFAULT_PLATFORM_FEEDBACK_POLICY.allowAnonymous,
      showContactFieldsForAnonymous: DEFAULT_PLATFORM_FEEDBACK_POLICY.showContactFieldsForAnonymous,
      requireSubject: DEFAULT_PLATFORM_FEEDBACK_POLICY.requireSubject,
      allowAttachments: DEFAULT_PLATFORM_FEEDBACK_POLICY.allowAttachments,
      widgetPlacement: DEFAULT_PLATFORM_FEEDBACK_POLICY.widgetPlacement,
      showOnDashboard: DEFAULT_PLATFORM_FEEDBACK_POLICY.showOnDashboard,
      pageKeyDenylist: [...DEFAULT_PLATFORM_FEEDBACK_POLICY.pageKeyDenylist],
      subjects: [],
    };
  }
  return {
    enabled: Boolean(raw.enabled),
    allowAuthenticated: Boolean(raw.allowAuthenticated),
    allowAnonymous: Boolean(raw.allowAnonymous),
    showContactFieldsForAnonymous: Boolean(raw.showContactFieldsForAnonymous),
    requireSubject: Boolean(raw.requireSubject),
    allowAttachments: Boolean(raw.allowAttachments),
    widgetPlacement: raw.widgetPlacement ?? 'header-menu',
    showOnDashboard: Boolean(raw.showOnDashboard),
    pageKeyDenylist: Array.isArray(raw.pageKeyDenylist) ? raw.pageKeyDenylist : [],
    subjects: Array.isArray(raw.subjects) ? raw.subjects : [],
  };
}

export function seedAppBootQueryCaches(queryClient: QueryClient, boot: AppBootResponse): void {
  queryClient.setQueryData(platformQueryKeys.runtimeConfig(), boot.runtimeConfig);
  queryClient.setQueryData(platformQueryKeys.cultures(), boot.cultures);
  queryClient.setQueryData(installQueryKeys.status(), boot.install);
  queryClient.setQueryData(pwaQueryKeys.config(), boot.pwa);
  queryClient.setQueryData(platformWebFontsQueryKeys.list(), boot.webFonts);
}

export function useAppBootQuery(enabled = true) {
  return useQuery({
    queryKey: bootQueryKeys.all,
    queryFn: ({ signal }) => fetchAppBoot(signal),
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
    // Global QueryClient retry is off. Boot is the one request the SPA cannot render without,
    // and the first fetch often races HMR / a restarting API process.
    retry: 4,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000),
    refetchInterval: (query) => (query.state.status === 'error' ? 3_000 : false),
  });
}
