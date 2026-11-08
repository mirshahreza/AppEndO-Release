import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { AppRouteLoading } from '../../components/AppRouteLoading';
import type { DesignerBindingDefinitions } from '../../domain/component-designer/types';
import {
  componentDesignerQueryKeys,
  loadComponentDesignerVersion,
  loadDesignerStagingPreview,
} from '../../shared/api/queries/component-designer';
import { useExperienceManifestQuery } from '../../shared/api/queries/platform';
import { DesignerPreviewCulturePortalBar } from './components/DesignerPreviewCulturePortalBar';
import { DesignerPreviewViewport } from './components/DesignerPreviewViewport';
import { useDesignerPreviewContext } from './hooks/useDesignerPreviewContext';
import {
  COMPONENT_ALONE_PORTAL_SEGMENT,
  COMPONENT_ALONE_SHELL_LAYOUT_KEY,
  resolvePreviewPortalShellKey,
} from './lib/designerPreviewPortal';
import { readDesignerPreviewSession, resolvePreviewCultureId } from './lib/designerPreviewSession';
import {
  isDesignerPreviewDirectionMessage,
  resolveEffectivePreviewDirection,
} from './lib/designerPreviewDirection';
import { resolveCultureById } from '../../core/culture/MountCultureResolver';

export const ComponentDesignerOutlinePreview: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const componentPath = searchParams.get('component')?.trim() ?? '';
  const sessionId = searchParams.get('session')?.trim() ?? '';
  const stagingToken = searchParams.get('staging')?.trim() ?? '';
  const isEmbedded = searchParams.get('embedded') === '1';
  const previewContext = useDesignerPreviewContext();
  const manifestQuery = useExperienceManifestQuery('admin');
  const initializedRef = React.useRef(false);

  const embeddedCultureId = searchParams.get('culture')?.trim() ?? '';
  const embeddedPortalSegment = searchParams.get('portal')?.trim() || COMPONENT_ALONE_PORTAL_SEGMENT;
  const [localDirectionOverride, setLocalDirectionOverride] = React.useState<'ltr' | 'rtl' | null>(null);

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || !isDesignerPreviewDirectionMessage(event.data)) {
        return;
      }

      setLocalDirectionOverride(
        event.data.direction === 'culture' ? null : event.data.direction,
      );
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const activeCultureId = isEmbedded ? embeddedCultureId : previewContext.selectedCultureId;
  const previewDirectionOverride = isEmbedded
    ? localDirectionOverride
    : previewContext.previewDirectionOverride;
  const previewRtlEnabled = resolveEffectivePreviewDirection(
    resolveCultureById(resolvePreviewCultureId(activeCultureId)).direction,
    previewDirectionOverride,
  ) === 'rtl';
  const activePortalSegment = isEmbedded ? embeddedPortalSegment : previewContext.selectedPortalSegment;
  const portalShellKey = React.useMemo(() => {
    if (isEmbedded && embeddedPortalSegment === COMPONENT_ALONE_PORTAL_SEGMENT) {
      return COMPONENT_ALONE_SHELL_LAYOUT_KEY;
    }

    return resolvePreviewPortalShellKey(activePortalSegment, previewContext.portalOptions);
  }, [activePortalSegment, embeddedPortalSegment, isEmbedded, previewContext.portalOptions]);

  const draftQuery = useQuery({
    queryKey: componentDesignerQueryKeys.draftVersions(componentPath || stagingToken),
    queryFn: () => loadComponentDesignerVersion(componentPath),
    enabled: componentPath.length > 0,
  });

  const stagingQuery = useQuery({
    queryKey: [...componentDesignerQueryKeys.all, 'staging-preview', stagingToken],
    queryFn: () => loadDesignerStagingPreview(stagingToken),
    enabled: stagingToken.length > 0,
  });

  const sessionPayload = React.useMemo(
    () => (!componentPath && sessionId ? readDesignerPreviewSession(sessionId) : null),
    [componentPath, sessionId],
  );

  React.useEffect(() => {
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;
    previewContext.setSelectedCultureId(searchParams.get('culture')?.trim() ?? '');
    previewContext.setSelectedPortalSegment(
      searchParams.get('portal')?.trim() || COMPONENT_ALONE_PORTAL_SEGMENT,
    );
  }, [previewContext, searchParams]);

  const syncSearchParams = React.useCallback((cultureId: string, portalSegment: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (cultureId.trim()) {
        next.set('culture', cultureId.trim());
      } else {
        next.delete('culture');
      }
      if (portalSegment.trim()) {
        next.set('portal', portalSegment.trim());
      } else {
        next.delete('portal');
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  if (!componentPath && !sessionId && !stagingToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-loading p-6">
        <div className="rounded-xl border border-rose-200 bg-white px-5 py-4 text-sm text-rose-700">
          Missing preview target. Open preview from the Components workspace.
        </div>
      </div>
    );
  }

  if (stagingToken) {
    if (stagingQuery.isLoading) {
      return <AppRouteLoading />;
    }

    if (stagingQuery.isError || !stagingQuery.data) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-surface-loading p-6">
          <div className="rounded-xl border border-rose-200 bg-white px-5 py-4 text-sm text-rose-700">
            Staging preview link expired or is unavailable.
          </div>
        </div>
      );
    }
  } else if (componentPath) {
    if (draftQuery.isLoading) {
      return <AppRouteLoading />;
    }

    if (draftQuery.isError || !draftQuery.data) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-surface-loading p-6">
          <div className="rounded-xl border border-rose-200 bg-white px-5 py-4 text-sm text-rose-700">
            Saved component preview is unavailable. Save the component and try again.
          </div>
        </div>
      );
    }
  } else if (!sessionPayload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-loading p-6">
        <div className="rounded-xl border border-rose-200 bg-white px-5 py-4 text-sm text-rose-700">
          Preview session expired or is unavailable. Return to Components and open preview again.
        </div>
      </div>
    );
  }

  const shouldWaitForManifest = !isEmbedded || !componentPath;
  if (shouldWaitForManifest && (manifestQuery.isLoading || previewContext.isLoading)) {
    return <AppRouteLoading />;
  }

  const previewDocument = stagingQuery.data?.document
    ?? draftQuery.data?.document
    ?? sessionPayload?.document
    ?? null;
  const previewBindings = (stagingQuery.data?.bindingDefinitions
    ?? draftQuery.data?.bindingDefinitions
    ?? sessionPayload?.bindingDefinitions
    ?? {}) as DesignerBindingDefinitions;
  const previewResults = sessionPayload?.previewResults ?? {};
  const previewTitle = stagingQuery.data?.componentPath
    ?? draftQuery.data?.name
    ?? sessionPayload?.document.name
    ?? 'Component';

  if (!previewDocument) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-loading p-6">
        <div className="rounded-xl border border-rose-200 bg-white px-5 py-4 text-sm text-rose-700">
          Preview content is unavailable.
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-screen w-full flex-col overflow-hidden bg-white"
      data-testid="component-designer-outline-preview"
    >
      {!isEmbedded ? (
        <div className="shrink-0 border-b border-border-subtle bg-white px-3 py-2">
          <h1 className="text-sm font-semibold text-slate-800">
            Preview — {previewTitle}
          </h1>
        </div>
      ) : null}

      {!isEmbedded ? (
        <DesignerPreviewCulturePortalBar
          cultureOptions={previewContext.cultureOptions}
          portalOptions={previewContext.portalOptions}
          selectedCultureId={previewContext.selectedCultureId}
          selectedPortalSegment={previewContext.selectedPortalSegment}
          componentName={previewTitle}
          previewRtlEnabled={previewRtlEnabled}
          onPreviewRtlToggle={() => {
            const cultureDirection = resolveCultureById(
              resolvePreviewCultureId(previewContext.selectedCultureId),
            ).direction;
            const nextOverride = previewRtlEnabled
              ? (cultureDirection === 'rtl' ? 'ltr' : null)
              : 'rtl';
            previewContext.setPreviewDirectionOverride(nextOverride);
          }}
          onCultureChange={(nextCultureId) => {
            previewContext.setSelectedCultureId(nextCultureId);
            syncSearchParams(nextCultureId, previewContext.selectedPortalSegment);
          }}
          onPortalChange={(nextPortalSegment) => {
            previewContext.setSelectedPortalSegment(nextPortalSegment);
            syncSearchParams(previewContext.selectedCultureId, nextPortalSegment);
          }}
        />
      ) : null}

      <DesignerPreviewViewport
        document={previewDocument}
        bindingDefinitions={previewBindings}
        previewResults={previewResults}
        selectedCultureId={isEmbedded ? embeddedCultureId : previewContext.selectedCultureId}
        previewDirectionOverride={previewDirectionOverride}
        portalShellKey={portalShellKey}
        portalSegment={activePortalSegment}
        portalOptions={previewContext.portalOptions}
        simulatedRole={sessionPayload?.simulatedRole ?? ''}
        fullHeight
        className="min-h-0 flex-1"
      />
    </div>
  );
};
