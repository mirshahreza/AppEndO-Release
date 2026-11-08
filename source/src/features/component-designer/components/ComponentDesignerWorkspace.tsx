import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AppRouteLoading } from '../../../components/AppRouteLoading';
import { STUDIO_MOUNT_ID } from '../../../shared/api/contracts/platform/mountConstants';
import { createComponentDesignerVersion } from '../../../shared/api/queries/component-designer';
import { useOptionalPortal } from '../../../app/platform/PortalContext';
import { useOptionalPlatformMount } from '../../../app/platform/PlatformMountContext';
import { buildMountAbsolutePath } from '../../../app/platform/platformConfigHelpers';
import { ComponentDesignerPageView, useComponentDesignerPage } from '../hooks/useComponentDesignerPage';
import { usePublishAiPageContext } from '../../../shared/lib/aiPageContextStore';
import {
  DESIGNER_NEW_DRAFT_PARAM,
  isDesignerNewDraftSearchParam,
  resolveStudioMountPathPrefix,
} from '../lib/designerDraftPath';
import {
  buildComponentDesignerListRelativePath,
  buildLiveDesignerRelativePath,
  buildLiveDesignerRelativePathFromSlug,
  CLIENT_COMPONENT_NEW_SLUG,
  parseComponentDesignerEditSlug,
  parseLiveDesignerComponentPath,
  resolveDesignerDraftIdFromEditSlug,
} from '../componentDesignerRoute';
import { LiveDesignerWorkspace } from './live-designer/LiveDesignerWorkspace';
import { buildShellDesignerDraftCreatePayload } from '../lib/shellDesignerDraft';
import { parseShellDesignerComponentPath, DEFAULT_DRAFT_FOLDER } from '../../../shared/lib/designerShellEntry';
import { canonicalizeDesignerItemSlug } from '../../../shared/lib/designerComponentPath';
import { createStateFromNewLayoutPreset } from '../../../domain/component-designer/layout-presets/newLayoutPresets';
import type { NewLayoutPresetId } from '../../../domain/component-designer/layout-presets/types';
import { buildAutoFormDocument } from '../../../domain/component-designer/autoFormTemplateBuilder';
import { buildAutoTableDocument } from '../../../domain/component-designer/autoTableTemplateBuilder';
import { buildCrudSetDocument } from '../../../domain/component-designer/crudSetDocumentBuilder';
import type { CreateComponentWizardResult } from './create-wizard/CreateComponentWizardDialog';

function resolveComponentDesignerMountId(pathname: string, mountIdFromContext: string | null): string {
  if (mountIdFromContext) {
    return mountIdFromContext;
  }

  const cultureMatch = pathname.match(/^\/([^/]+)\/studio(?:\/|$)/);
  if (cultureMatch) {
    return cultureMatch[1];
  }

  return STUDIO_MOUNT_ID;
}

export const ComponentDesignerWorkspace: React.FC = () => {
  const page = useComponentDesignerPage();
  const navigate = useNavigate();
  const location = useLocation();
  const portal = useOptionalPortal();
  const platformMount = useOptionalPlatformMount();
  const [searchParams, setSearchParams] = useSearchParams();
  const handledLoadIdRef = useRef<string | null>(null);
  const legacyQueryRedirectedRef = useRef(false);
  const creatingShellPathRef = useRef<string | null>(null);
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);

  const loadDraftId = searchParams.get('load')?.trim() || null;
  const legacyPathParam = searchParams.get('path')?.trim() || null;
  const legacyNewDraftParam = isDesignerNewDraftSearchParam(searchParams.get(DESIGNER_NEW_DRAFT_PARAM));

  const mountId = resolveComponentDesignerMountId(location.pathname, platformMount?.id ?? null);
  const mountPathPrefix = platformMount?.pathPrefix ?? resolveStudioMountPathPrefix(location.pathname);
  const toMountPath = useCallback((relativePath: string) => (
    platformMount
      ? buildMountAbsolutePath(platformMount.pathPrefix, relativePath)
      : buildMountAbsolutePath(mountPathPrefix, relativePath)
  ), [mountPathPrefix, platformMount]);

  const pathFromLocation = location.pathname.slice(mountPathPrefix.length).replace(/^\/+/, '');
  const pathFromPortal = portal?.pageRemainderPath.replace(/^\/+/, '') ?? '';
  // Prefer location for live-designer detection — portal remainder can lag/truncate on nested studio paths.
  const rawLiveDesignerComponentPath = parseLiveDesignerComponentPath(pathFromLocation)
    ?? parseLiveDesignerComponentPath(pathFromPortal);
  const liveDesignerComponentPath = rawLiveDesignerComponentPath
    ? (canonicalizeDesignerItemSlug(rawLiveDesignerComponentPath) || rawLiveDesignerComponentPath)
    : null;
  const pathSuffix = pathFromPortal || pathFromLocation;
  const classicEditSlug = parseComponentDesignerEditSlug(pathSuffix);
  const isNewDraftFromUrl = classicEditSlug === CLIENT_COMPONENT_NEW_SLUG;

  const navigateToList = useCallback(() => {
    navigate(toMountPath(buildComponentDesignerListRelativePath(mountId)));
  }, [mountId, navigate, toMountPath]);

  const navigateToLive = useCallback((
    draft: { folder?: string | null; name: string; id?: string },
  ) => {
    navigate(toMountPath(buildLiveDesignerRelativePath({
      folder: draft.folder ?? DEFAULT_DRAFT_FOLDER,
      name: draft.name,
    }, mountId)), {
      state: draft.id ? { liveDesignerDraftId: draft.id } : undefined,
    });
  }, [mountId, navigate, toMountPath]);

  const clearLegacyCatalogQueryParams = useCallback(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('path');
      next.delete(DESIGNER_NEW_DRAFT_PARAM);
      next.delete('load');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const handleOpenLiveDesigner = useCallback((draftId: string) => {
    const target = page.drafts.find((draft) => draft.id === draftId);
    if (!target) {
      return;
    }

    const goLive = () => {
      navigateToLive(target);
    };

    if (page.hasUnsavedChanges) {
      page.requestNavigateAway(goLive);
      return;
    }

    goLive();
  }, [navigateToLive, page.drafts, page.hasUnsavedChanges, page.requestNavigateAway]);

  const createDraftAndOpenLive = useCallback(async (input: {
    name: string;
    folder: string;
    tags?: string[];
    document: Parameters<typeof createComponentDesignerVersion>[0]['document'];
    bindingDefinitions: Parameters<typeof createComponentDesignerVersion>[0]['bindingDefinitions'];
    workspace?: Parameters<typeof createComponentDesignerVersion>[0]['workspace'];
  }) => {
    setIsCreatingDraft(true);
    try {
      const draft = await createComponentDesignerVersion({
        name: input.name,
        folder: input.folder,
        tags: input.tags,
        document: {
          ...input.document,
          name: input.name,
        },
        bindingDefinitions: input.bindingDefinitions,
        workspace: input.workspace,
      });
      page.handleRefreshComponents();
      page.flashToolbarStatus('Component created.');
      navigateToLive(draft);
    } catch (error) {
      page.flashToolbarStatus(
        (error as Error).message || 'Could not create the component. Check your connection and try again.',
        'error',
      );
    } finally {
      setIsCreatingDraft(false);
    }
  }, [navigateToLive, page]);

  const handleCreateWizardComplete = useCallback((result: CreateComponentWizardResult) => {
    const identity = result.identity;
    const name = identity.name.trim();
    if (!name) {
      page.flashToolbarStatus('Component name is required.', 'error');
      return;
    }

    if (result.kind === 'form') {
      const built = buildAutoFormDocument(result.config);
      void createDraftAndOpenLive({
        name,
        folder: DEFAULT_DRAFT_FOLDER,
        tags: identity.tags,
        document: built.document,
        bindingDefinitions: built.bindingDefinitions,
      });
      return;
    }

    if (result.kind === 'grid') {
      const built = buildAutoTableDocument(result.config);
      void createDraftAndOpenLive({
        name,
        folder: DEFAULT_DRAFT_FOLDER,
        tags: identity.tags,
        document: built.document,
        bindingDefinitions: built.bindingDefinitions,
      });
      return;
    }

    if (result.kind === 'crud-set') {
      const built = buildCrudSetDocument(result.spec);
      void createDraftAndOpenLive({
        name,
        folder: DEFAULT_DRAFT_FOLDER,
        tags: identity.tags,
        document: built.document,
        bindingDefinitions: built.bindingDefinitions,
      });
      return;
    }

    const presetId: NewLayoutPresetId = result.kind === 'templates' ? result.presetId : 'blank';
    const { state } = createStateFromNewLayoutPreset(presetId);
    void createDraftAndOpenLive({
      name,
      folder: DEFAULT_DRAFT_FOLDER,
      tags: identity.tags,
      document: state.document,
      bindingDefinitions: state.bindingDefinitions,
      workspace: { viewport: state.viewport },
    });
  }, [createDraftAndOpenLive, page]);

  // Legacy query params (?path= / ?newDraft=) → Live Designer or list.
  useEffect(() => {
    if (legacyQueryRedirectedRef.current) {
      return;
    }

    if (!legacyPathParam && !legacyNewDraftParam) {
      return;
    }

    legacyQueryRedirectedRef.current = true;

    if (legacyNewDraftParam) {
      navigate(toMountPath(buildComponentDesignerListRelativePath(mountId)), { replace: true });
      return;
    }

    navigate(
      toMountPath(buildLiveDesignerRelativePathFromSlug(legacyPathParam!, mountId)),
      { replace: true },
    );
  }, [
    legacyNewDraftParam,
    legacyPathParam,
    mountId,
    navigate,
    toMountPath,
  ]);

  // ?load=draftId → Live Designer.
  useEffect(() => {
    if (!loadDraftId || handledLoadIdRef.current === loadDraftId) {
      return;
    }

    if (page.isDraftsLoading) {
      return;
    }

    handledLoadIdRef.current = loadDraftId;
    const target = page.drafts.find((draft) => draft.id === loadDraftId);
    clearLegacyCatalogQueryParams();

    if (!target) {
      navigateToList();
      return;
    }

    navigateToLive(target);
  }, [
    clearLegacyCatalogQueryParams,
    loadDraftId,
    navigateToList,
    navigateToLive,
    page.drafts,
    page.isDraftsLoading,
  ]);

  // Classic edit slug /new → list; other classic slugs → Live Designer.
  useEffect(() => {
    if (!classicEditSlug || liveDesignerComponentPath) {
      return;
    }

    if (isNewDraftFromUrl) {
      navigate(toMountPath(buildComponentDesignerListRelativePath(mountId)), { replace: true });
      return;
    }

    navigate(
      toMountPath(buildLiveDesignerRelativePathFromSlug(classicEditSlug, mountId)),
      { replace: true },
    );
  }, [
    classicEditSlug,
    isNewDraftFromUrl,
    liveDesignerComponentPath,
    mountId,
    navigate,
    toMountPath,
  ]);

  // Flatten legacy edit/{folder}/{name} to edit/{name}.
  useEffect(() => {
    if (!rawLiveDesignerComponentPath || !liveDesignerComponentPath) {
      return;
    }

    if (rawLiveDesignerComponentPath === liveDesignerComponentPath) {
      return;
    }

    const existingId = resolveDesignerDraftIdFromEditSlug(page.drafts, rawLiveDesignerComponentPath);
    const shellTarget = parseShellDesignerComponentPath(rawLiveDesignerComponentPath);
    if (!existingId && shellTarget && page.isDraftsLoading) {
      return;
    }

    if (!existingId && shellTarget) {
      return;
    }

    navigate(
      toMountPath(buildLiveDesignerRelativePathFromSlug(liveDesignerComponentPath, mountId)),
      { replace: true },
    );
  }, [
    liveDesignerComponentPath,
    mountId,
    navigate,
    page.drafts,
    page.isDraftsLoading,
    rawLiveDesignerComponentPath,
    toMountPath,
  ]);

  // Missing portal-layouts draft on Live URL → create then stay on Live.
  useEffect(() => {
    if (!rawLiveDesignerComponentPath || page.isDraftsLoading) {
      return;
    }

    const existingId = resolveDesignerDraftIdFromEditSlug(page.drafts, rawLiveDesignerComponentPath);
    if (existingId) {
      creatingShellPathRef.current = null;
      return;
    }

    const shellTarget = parseShellDesignerComponentPath(rawLiveDesignerComponentPath);
    if (!shellTarget) {
      return;
    }

    if (creatingShellPathRef.current === rawLiveDesignerComponentPath) {
      return;
    }

    creatingShellPathRef.current = rawLiveDesignerComponentPath;
    const shellKey = shellTarget.shellKey;
    const componentPath = rawLiveDesignerComponentPath;

    void (async () => {
      setIsCreatingDraft(true);
      try {
        const draft = await createComponentDesignerVersion(
          buildShellDesignerDraftCreatePayload(shellKey),
        );
        page.handleRefreshComponents();
        navigateToLive(draft);
      } catch {
        // Keep the ref set so we do not retry-create in a loop while still on this URL.
        page.flashToolbarStatus(
          `Could not create the "${shellKey}" shell layout. Check your connection and try again.`,
          'error',
        );
        navigateToList();
      } finally {
        if (creatingShellPathRef.current === componentPath) {
          setIsCreatingDraft(false);
        }
      }
    })();
  }, [
    liveDesignerComponentPath,
    navigateToList,
    navigateToLive,
    page.drafts,
    page.flashToolbarStatus,
    page.handleRefreshComponents,
    page.isDraftsLoading,
    rawLiveDesignerComponentPath,
  ]);

  usePublishAiPageContext(liveDesignerComponentPath ? null : {
    layoutId: null,
    selectedNodeId: null,
    draftDirty: false,
  });

  if (liveDesignerComponentPath) {
    const draftIdFromNav = (
      location.state as { liveDesignerDraftId?: string } | null
    )?.liveDesignerDraftId?.trim() || null;
    const liveDraftId = draftIdFromNav
      || resolveDesignerDraftIdFromEditSlug(page.drafts, liveDesignerComponentPath);
    const shellTarget = parseShellDesignerComponentPath(rawLiveDesignerComponentPath ?? '');
    const waitingForShellCreate = Boolean(shellTarget) && !liveDraftId;

    if (page.isDraftsLoading || isCreatingDraft || waitingForShellCreate) {
      return (
        <AppRouteLoading
          label={waitingForShellCreate || isCreatingDraft ? 'Creating component…' : 'Loading…'}
        />
      );
    }

    return (
      <LiveDesignerWorkspace
        componentPath={liveDesignerComponentPath}
        draftId={liveDraftId}
        onBack={navigateToList}
      />
    );
  }

  // Classic edit slug is redirecting — avoid flashing catalog.
  if (classicEditSlug) {
    return <AppRouteLoading label="Opening designer…" />;
  }

  if (isCreatingDraft) {
    return <AppRouteLoading label="Creating component…" />;
  }

  return (
    <>
      <ComponentDesignerPageView
        {...page}
        handleCreateWizardComplete={handleCreateWizardComplete}
        isCatalogListMode
        onOpenLiveDesigner={handleOpenLiveDesigner}
      />
    </>
  );
};
