import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DesignerDocumentPreview } from '../../domain/component-designer/designerRuntimePreview';
import { createDefaultBindingDefinitions } from '../../domain/component-designer/bindingRegistry';
import { parsePinnedDesignerLoaderRef } from '../../domain/component-designer/publishLoaderRef';
import {
  loadComponentDesignerDraft,
  componentDesignerQueryKeys,
  designerPublishedPageQueryRetry,
  designerPublishedPageQueryRetryDelay,
} from '../../shared/api/queries/component-designer';
import { formatQueryError, isAbortError } from '../../shared/api/client';
import { AppRouteLoading } from '../../components/AppRouteLoading';
import { useAuth } from '../../contexts/AuthContext';
import {
  CMS_SETTINGS_PUBLISHED_COMPONENT_PATHS,
  isCmsSettingsPublishedComponentPath,
} from './cmsSettingsSoftNav';
import { useDesignerPublishedShellHeader } from './useDesignerPublishedShellHeader';
import { useComponentUsageHitOnce } from '../../shared/lib/useComponentUsageHitOnce';

export type DesignerPublishedPageProps = {
  slug: string;
};

const EMPTY_BINDING_DEFINITIONS = createDefaultBindingDefinitions();

export const shouldShowDesignerPublishedDraftLoading = (input: {
  authLoading: boolean;
  hasDraftData: boolean;
  isPending: boolean;
  isFetching: boolean;
}): boolean => {
  if (input.hasDraftData) {
    return false;
  }
  return input.authLoading || input.isPending || input.isFetching;
};

export const buildRouteParamsFromRouter = (
  params: Record<string, string | undefined>,
  searchParams?: URLSearchParams,
): Record<string, string> => {
  const routeParams: Record<string, string> = {};
  if (searchParams) {
    for (const [key, value] of searchParams.entries()) {
      if (value.trim().length > 0) {
        routeParams[key] = value.trim();
      }
    }
  }
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.trim().length > 0 && key !== '*') {
      routeParams[key] = value.trim();
    }
  }

  const splat = typeof params['*'] === 'string' ? params['*'].trim() : '';
  if (splat.length > 0) {
    const segments = splat.split('/').map((part) => part.trim()).filter(Boolean);
    const editIndex = segments.lastIndexOf('edit');
    const isNestedEditorPath = editIndex >= 0 && editIndex < segments.length - 1;
    const isDirectRecordPath = segments.length === 1;
    const recordId = isNestedEditorPath || isDirectRecordPath ? segments.at(-1) : undefined;
    if (recordId) {
      routeParams.id = recordId;
      routeParams.editSlug = splat;
    }
  }

  return routeParams;
};

export const DesignerPublishedPage: React.FC<DesignerPublishedPageProps> = ({ slug }) => {
  const { currentUser, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const routeParams = React.useMemo(
    () => buildRouteParamsFromRouter(params as Record<string, string | undefined>, searchParams),
    [params, searchParams],
  );

  useDesignerPublishedShellHeader({
    enabled: Boolean(routeParams.id && routeParams.editSlug),
    editSlug: routeParams.editSlug,
  });

  const parsed = parsePinnedDesignerLoaderRef(slug);
  const draftQuery = useQuery({
    queryKey: componentDesignerQueryKeys.publishedPage(parsed.componentPath),
    queryFn: ({ signal }) => loadComponentDesignerDraft(
      parsed.componentPath,
      parsed.publishedVersion,
      { signal },
    ),
    enabled: parsed.componentPath.trim().length > 0,
    staleTime: 60_000,
    retry: designerPublishedPageQueryRetry,
    retryDelay: designerPublishedPageQueryRetryDelay,
  });

  // Warm sibling CMS Settings drafts so left-rail section switches hit cache
  // (no AppRouteLoading blank + less “deep refresh” feel).
  React.useEffect(() => {
    if (!isCmsSettingsPublishedComponentPath(parsed.componentPath)) {
      return;
    }
    for (const path of CMS_SETTINGS_PUBLISHED_COMPONENT_PATHS) {
      void queryClient.prefetchQuery({
        queryKey: componentDesignerQueryKeys.publishedPage(path),
        queryFn: () => loadComponentDesignerDraft(path),
      });
    }
  }, [parsed.componentPath, queryClient]);

  useComponentUsageHitOnce(
    parsed.componentPath,
    parsed.componentPath,
    'designer',
    Boolean(draftQuery.data),
  );

  // Prefer cached data over a full-route loading cover when navigating between
  // prefetched CMS Settings siblings.
  if (shouldShowDesignerPublishedDraftLoading({
    authLoading,
    hasDraftData: Boolean(draftQuery.data),
    isPending: draftQuery.isPending,
    isFetching: draftQuery.isFetching,
  })) {
    return <AppRouteLoading variant="embedded" />;
  }

  if (draftQuery.isError && !isAbortError(draftQuery.error)) {
    const message = formatQueryError(draftQuery.error, 'Failed to load published layout.');
    return (
      <div className="flex min-h-[240px] items-center justify-center p-6">
        <div className="rounded-xl border border-rose-200 bg-white px-5 py-4 text-sm text-rose-700">
          Designer layout <span className="font-semibold">{parsed.componentPath}</span> is not available.
          <p className="mt-2 text-xs text-rose-600">{message}</p>
        </div>
      </div>
    );
  }

  if (!draftQuery.data) {
    return <AppRouteLoading variant="embedded" />;
  }

  // Mount grid hydration only after auth snapshot is stable (avoids anonymous→user re-fetch stall).
  if (!currentUser) {
    return <AppRouteLoading variant="embedded" />;
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden animate-in fade-in duration-150">
      <DesignerDocumentPreview
        key={`${parsed.componentPath}@v${parsed.publishedVersion ?? 'current'}`}
        document={draftQuery.data.document}
        bindingDefinitions={draftQuery.data.bindingDefinitions ?? EMPTY_BINDING_DEFINITIONS}
        interactive
        layoutMode="shell"
        routeParams={routeParams}
        authUser={currentUser}
      />
    </div>
  );
};
