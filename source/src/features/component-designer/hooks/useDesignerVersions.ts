import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  createStateFromNewLayoutPreset,
  NEW_LAYOUT_STATUS_MESSAGE,
  type NewLayoutPresetCategory,
} from '../../../domain/component-designer/layout-presets';
import type { NewLayoutPresetId } from '../../../domain/component-designer/layout-presets/types';
import type { CreateComponentWizardResult } from '../components/create-wizard/CreateComponentWizardDialog';
import type { CatalogCreateKind } from '../components/create-wizard/catalogCreateKinds';
import {
  isValidDesignerComponentName,
  normalizeDesignerComponentName,
  suggestDesignerComponentName,
} from '../utils/componentName';
import { normalizeComponentFolder } from '../utils/componentFolder';
import {
  createComponentDesignerVersion,
  deleteComponentDesignerVersion,
  invalidateComponentDesignerDrafts,
  invalidateDesignerPublishedViews,
  listDesignerCanvasComments,
  loadComponentDesignerVersion,
  updateComponentDesignerVersion,
  useComponentDesignerDraftsQuery,
  componentDesignerQueryKeys,
  type DesignerVersionRecord,
  type DesignerVersionSummary,
} from '../../../shared/api/queries/component-designer';
import { isRetiredDesignerCatalogComponent } from '../../../shared/lib/packageStudioSidebar';
import { documentLostContentComparedTo, syncCodeToCanvas } from '../../../domain/component-designer/codegen';
import type { DesignerAction, DesignerState } from '../../../domain/component-designer/types';
import {
  buildAutoFormDocument,
  documentHasDesignedContent,
  mergeAutoFormIntoDocument,
  resolveAutoFormInsertTarget,
  type AutoFormBuildConfig,
  type AutoFormInsertTarget,
} from '../../../domain/component-designer/autoFormTemplateBuilder';
import {
  buildAutoTableDocument,
  mergeAutoTableIntoDocument,
  resolveAutoTableInsertTarget,
  type AutoTableBuildConfig,
  type AutoTableInsertTarget,
} from '../../../domain/component-designer/autoTableTemplateBuilder';
import { normalizeBindingDefinitions } from '../../../domain/component-designer/bindingRegistry';
import { createDefaultDesignerViewport } from '../../../domain/component-designer/state';
import { createDraftFingerprint, toDraftSummaryFromRecord } from './designerUtils';
import { getBuiltInComponentRecord, isBuiltInComponentId, mergeComponentsCatalog } from '../../../domain/component-designer/layout-presets/builtInComponents';
import { catalogSearchTags, catalogItemMatchesKindFilter, catalogItemMatchesBuiltInFilter, DEFAULT_CATALOG_KIND_FILTER, DEFAULT_CATALOG_BUILTIN_FILTER } from '../../../domain/component-designer/layout-presets/catalogSystemTags';
import {
  DEFAULT_DRAFT_FOLDER,
  isSystemManagedShellLayoutDraft,
  resolveCanonicalDesignerDraftFolder,
} from '../../../shared/lib/designerShellEntry';
import {
  resolveDesignerViewportForComponent,
  waitForDesignerViewportPaint,
} from '../lib/designerViewportPrefs';

export type PendingLeaveAction =
  | { type: 'load-component'; draftId: string }
  | { type: 'reload-active-component' }
  | { type: 'new-layout'; kind: CatalogCreateKind }
  | { type: 'auto-form' }
  | { type: 'auto-table' }
  | { type: 'duplicate-component'; draftId: string }
  | { type: 'navigate-away' }
  | { type: 'page-reload' };

export type UseDesignerVersionsParams = {
  state: DesignerState;
  dispatch: React.Dispatch<DesignerAction>;
  flashToolbarStatus: (message: string) => void;
  setPreviewState: React.Dispatch<React.SetStateAction<DesignerPreviewRuntimeState>>;
  loadCodeFromCompanionTsx: (
    tsx: string,
    snapshot?: {
      document: DesignerState['document'];
      bindingDefinitions: DesignerState['bindingDefinitions'];
    },
  ) => void;
  resetCodeFromGenerated: () => void;
};

export type UseDesignerVersionsResult = {
  drafts: DesignerVersionSummary[];
  draftDialogMode: DesignerDialogMode;
  draftDialogBusy: boolean;
  draftDialogError: string | null;
  draftNameInput: string;
  setDraftNameInput: React.Dispatch<React.SetStateAction<string>>;
  draftFolderInput: string;
  setDraftFolderInput: React.Dispatch<React.SetStateAction<string>>;
  draftTagsInput: string[];
  setDraftTagsInput: React.Dispatch<React.SetStateAction<string[]>>;
  isDraftsLoading: boolean;
  activeDraftId: string | null;
  isCreateWizardOpen: boolean;
  setIsCreateWizardOpen: React.Dispatch<React.SetStateAction<boolean>>;
  createWizardKind: CatalogCreateKind;
  selectedNewLayoutCategory: NewLayoutPresetCategory;
  setSelectedNewLayoutCategory: React.Dispatch<React.SetStateAction<NewLayoutPresetCategory>>;
  loadingComponentId: string | null;
  hasUnsavedChanges: boolean;
  isSavingDraft: boolean;
  canSaveDraft: boolean;
  activeDraftSummary: DesignerVersionSummary | null;
  activeComponentName: string;
  filteredComponentDrafts: DesignerVersionSummary[];
  componentGroups: Record<string, DesignerVersionSummary[]>;
  catalogKindFilter: string;
  setCatalogKindFilter: React.Dispatch<React.SetStateAction<string>>;
  catalogBuiltInFilter: string;
  setCatalogBuiltInFilter: React.Dispatch<React.SetStateAction<string>>;
  isActiveBuiltIn: boolean;
  isActivePackageComponent: boolean;
  isUnsavedChangesDialogOpen: boolean;
  resetDesignerWorkspace: (presetId?: NewLayoutPresetId) => void;
  openCreateWizard: (kind: CatalogCreateKind) => void;
  isAutoFormWizardOpen: boolean;
  setIsAutoFormWizardOpen: React.Dispatch<React.SetStateAction<boolean>>;
  autoFormWizardEntryMode: 'catalog' | 'canvas';
  openAutoFormWizard: (options?: { entryMode?: 'catalog' | 'canvas' }) => void;
  applyAutoFormResult: (config: AutoFormBuildConfig) => void;
  isAutoTableWizardOpen: boolean;
  setIsAutoTableWizardOpen: React.Dispatch<React.SetStateAction<boolean>>;
  autoTableWizardEntryMode: 'catalog' | 'canvas';
  openAutoTableWizard: (options?: { entryMode?: 'catalog' | 'canvas' }) => void;
  applyAutoTableResult: (config: AutoTableBuildConfig) => void;
  handleStartNewLayout: (presetId: NewLayoutPresetId, identity: { name: string; tags?: string[] }) => void;
  handleCreateWizardComplete: (result: CreateComponentWizardResult) => void;
  handleToolbarSaveClick: () => void;
  handleRenameComponent: (name: string) => Promise<boolean>;
  handleUpdateComponentFolder: (folder: string) => Promise<boolean>;
  isRenameBusy: boolean;
  handleSaveDraft: () => Promise<void>;
  handleLoadComponentFromList: (draftId: string) => void;
  handleReloadActiveComponentFromDisk: () => void;
  isReloadingActiveComponent: boolean;
  canReloadActiveComponentFromDisk: boolean;
  handleRefreshComponents: () => void;
  handleDuplicateComponent: (draftId: string) => void;
  handleEditComponent: (draftId: string) => void;
  handleEditComponentTags: (draftId: string) => void;
  handleDeleteComponent: (draftId: string) => void;
  deleteTargetDraftId: string | null;
  deleteTargetComponentName: string;
  handleDuplicateDraft: (tags?: string[]) => Promise<void>;
  handleSaveEditDraft: (tags?: string[]) => Promise<void>;
  handleSaveComponentTags: (tags: string[]) => Promise<void>;
  handleConfirmDeleteComponent: () => Promise<void>;
  handleCancelDraftDialog: () => void;
  handleCancelUnsavedChangesDialog: () => void;
  handleDiscardUnsavedChanges: () => void;
  handleSaveUnsavedChanges: () => Promise<void>;
  requestNavigateAway: (proceed: () => void) => void;
  requestPageReload: () => void;
  setDraftDialogMode: React.Dispatch<React.SetStateAction<DesignerDialogMode>>;
  setDraftDialogError: React.Dispatch<React.SetStateAction<string | null>>;
};

export const useDesignerVersions = ({
  state,
  dispatch,
  flashToolbarStatus,
  setPreviewState,
  loadCodeFromCompanionTsx,
  resetCodeFromGenerated,
}: UseDesignerVersionsParams): UseDesignerVersionsResult => {
  const queryClient = useQueryClient();
  const draftsQuery = useComponentDesignerDraftsQuery();
  const [drafts, setDrafts] = React.useState<DesignerVersionSummary[]>([]);
  const [draftDialogMode, setDraftDialogMode] = React.useState<DesignerDialogMode>(null);
  const [draftDialogBusy, setDraftDialogBusy] = React.useState(false);
  const [draftDialogError, setDraftDialogError] = React.useState<string | null>(null);
  const [draftNameInput, setDraftNameInput] = React.useState('');
  const [draftFolderInput, setDraftFolderInput] = React.useState('');
  const [draftTagsInput, setDraftTagsInput] = React.useState<string[]>([]);
  const [isDraftsLoading, setIsDraftsLoading] = React.useState(false);
  const [activeDraftId, setActiveDraftId] = React.useState<string | null>(null);
  const [lastSavedDraftFingerprint, setLastSavedDraftFingerprint] = React.useState<string | null>(null);
  const [isCreateWizardOpen, setIsCreateWizardOpen] = React.useState(false);
  const [createWizardKind, setCreateWizardKind] = React.useState<CatalogCreateKind>('crud-set');
  const [isAutoFormWizardOpen, setIsAutoFormWizardOpen] = React.useState(false);
  const [autoFormWizardEntryMode, setAutoFormWizardEntryMode] = React.useState<'catalog' | 'canvas'>('catalog');
  const [isAutoTableWizardOpen, setIsAutoTableWizardOpen] = React.useState(false);
  const [autoTableWizardEntryMode, setAutoTableWizardEntryMode] = React.useState<'catalog' | 'canvas'>('catalog');
  const [selectedNewLayoutCategory, setSelectedNewLayoutCategory] = React.useState<NewLayoutPresetCategory>('all');
  const [loadingComponentId, setLoadingComponentId] = React.useState<string | null>(null);
  const [duplicateSourceDraftId, setDuplicateSourceDraftId] = React.useState<string | null>(null);
  const [editTargetDraftId, setEditTargetDraftId] = React.useState<string | null>(null);
  const [deleteTargetDraftId, setDeleteTargetDraftId] = React.useState<string | null>(null);
  const [pendingLeaveAction, setPendingLeaveAction] = React.useState<PendingLeaveAction | null>(null);
  const [pendingLeaveAfterSave, setPendingLeaveAfterSave] = React.useState<PendingLeaveAction | null>(null);
  const routeLeaveProceedRef = React.useRef<(() => void) | null>(null);
  const tagsSaveGenerationRef = React.useRef(0);
  const [isRenameBusy, setIsRenameBusy] = React.useState(false);
  const [catalogKindFilter, setCatalogKindFilter] = React.useState(DEFAULT_CATALOG_KIND_FILTER);
  const [catalogBuiltInFilter, setCatalogBuiltInFilter] = React.useState(DEFAULT_CATALOG_BUILTIN_FILTER);

  const currentDraftFingerprint = React.useMemo(
    () => createDraftFingerprint(state.document, state.bindingDefinitions),
    [state.bindingDefinitions, state.document],
  );

  const hasUnsavedChanges = lastSavedDraftFingerprint !== null
    && currentDraftFingerprint !== lastSavedDraftFingerprint;

  const isUnsavedChangesDialogOpen = pendingLeaveAction !== null;

  const activeDraftSummary = React.useMemo(
    () => drafts.find((item) => item.id === activeDraftId) ?? null,
    [activeDraftId, drafts],
  );

  const activeComponentName = state.document.name;

  const isActiveBuiltIn = Boolean(activeDraftSummary?.isBuiltIn);
  const isActivePackageComponent = Boolean(activeDraftSummary?.isPackageComponent);

  const isSavingDraft = draftDialogBusy && (draftDialogMode === null || draftDialogMode === 'save');
  const canSaveDraft = (hasUnsavedChanges || isActiveBuiltIn) && !isSavingDraft;

  const deleteTargetDraftSummary = React.useMemo(
    () => (deleteTargetDraftId ? drafts.find((item) => item.id === deleteTargetDraftId) ?? null : null),
    [deleteTargetDraftId, drafts],
  );

  const deleteTargetComponentName = deleteTargetDraftSummary?.name ?? activeComponentName;

  const filteredComponentDrafts = React.useMemo(() => {
    const searchValue = state.paletteSearch.trim().toLowerCase();

    return drafts.filter((item) => {
      if (isRetiredDesignerCatalogComponent(item.name ?? '')) {
        return false;
      }

      if (isSystemManagedShellLayoutDraft(item)) {
        return false;
      }

      if (!catalogItemMatchesKindFilter(item, catalogKindFilter)) {
        return false;
      }

      if (!catalogItemMatchesBuiltInFilter(item, catalogBuiltInFilter)) {
        return false;
      }

      if (!searchValue) {
        return true;
      }

      return (
        (item.name ?? '').toLowerCase().includes(searchValue)
        || (item.packageId ?? '').toLowerCase().includes(searchValue)
        || catalogSearchTags(item).some((tag) => tag.toLowerCase().includes(searchValue))
      );
    });
  }, [catalogBuiltInFilter, catalogKindFilter, drafts, state.paletteSearch]);

  const componentGroups = React.useMemo(() => {
    const groups: Record<string, DesignerVersionSummary[]> = {};
    filteredComponentDrafts.forEach((item) => {
      const folderName = item.folder || 'general';
      if (!groups[folderName]) {
        groups[folderName] = [];
      }
      groups[folderName].push(item);
    });
    return groups;
  }, [filteredComponentDrafts]);

  const refreshDrafts = React.useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsDraftsLoading(true);
    }
    try {
      const result = await draftsQuery.refetch();
      if (result.data) {
        setDrafts(mergeComponentsCatalog(result.data));
      }
    } catch (error) {
      flashToolbarStatus((error as Error).message || 'Failed to load components.');
    } finally {
      if (!options?.silent) {
        setIsDraftsLoading(false);
      }
    }
  }, [draftsQuery.refetch, flashToolbarStatus]);

  React.useEffect(() => {
    if (draftsQuery.data) {
      setDrafts(mergeComponentsCatalog(draftsQuery.data));
    }
  }, [draftsQuery.data]);

  const upsertDraftSummary = React.useCallback((record: DesignerVersionRecord) => {
    const summary = toDraftSummaryFromRecord(record);
    setDrafts((previous) => mergeComponentsCatalog([
      ...previous.filter((item) => !item.isBuiltIn && item.id !== summary.id),
      summary,
    ]));
  }, []);

  const applyPersistedDraftMetadata = React.useCallback((
    draft: DesignerVersionRecord,
    options?: { syncWorkspaceName?: boolean },
  ) => {
    const syncWorkspaceName = options?.syncWorkspaceName ?? draft.id === activeDraftId;

    setDrafts((previous) => previous.map((item) => (
      item.id === draft.id
        ? {
            ...item,
            name: draft.name,
            folder: draft.folder ?? item.folder ?? 'general',
            tags: Array.isArray(draft.tags) ? draft.tags : (item.tags ?? []),
            createdAt: draft.metadata.createdAt,
            updatedAt: draft.metadata.updatedAt,
            createdBy: draft.metadata.createdBy,
            updatedBy: draft.metadata.updatedBy,
          }
        : item
    )));

    if (syncWorkspaceName) {
      dispatch({
        type: 'set-document-name',
        name: draft.name,
      });
      setDraftNameInput(draft.name);
      setDraftFolderInput(draft.folder ?? 'general');
    }
  }, [activeDraftId, dispatch]);

  React.useEffect(() => {
    if (lastSavedDraftFingerprint === null) {
      setLastSavedDraftFingerprint(createDraftFingerprint(state.document, state.bindingDefinitions));
    }
  }, [lastSavedDraftFingerprint, state.bindingDefinitions, state.document]);

  const loadDraftIntoWorkspace = React.useCallback(async (
    draftId: string,
    options?: { reload?: boolean },
  ) => {
    setLoadingComponentId(draftId);
    try {
      const draft = isBuiltInComponentId(draftId)
        ? getBuiltInComponentRecord(draftId)
        : await loadComponentDesignerVersion(draftId, undefined, { bypassCache: options?.reload === true });

      if (!draft) {
        throw new Error('Component not found.');
      }

      const normalizedBindings = normalizeBindingDefinitions(draft.bindingDefinitions);
      const loadedFingerprint = createDraftFingerprint(draft.document, normalizedBindings);
      setLastSavedDraftFingerprint(loadedFingerprint);

      const rootChildren = draft.document.nodes[draft.document.rootNodeId]?.children ?? [];
      const preferredSelectedNodeId = rootChildren[0] ?? draft.document.rootNodeId;
      const restoredViewport = resolveDesignerViewportForComponent(
        draft.name,
        draft.workspace?.viewport ?? null,
      )
        ?? createDefaultDesignerViewport();

      dispatch({
        type: 'hydrate-document',
        document: draft.document,
        bindingDefinitions: normalizedBindings,
        preferredSelectedNodeId,
        viewport: restoredViewport,
      });

      if (!isBuiltInComponentId(draftId)) {
        try {
          const comments = await listDesignerCanvasComments(draft.id);
          dispatch({ type: 'hydrate-canvas-comments', comments });
        } catch {
          dispatch({ type: 'hydrate-canvas-comments', comments: [] });
        }
      }

      await waitForDesignerViewportPaint();

      const companionTsx = typeof draft.companionTsx === 'string' && draft.companionTsx.trim().length > 0
        ? draft.companionTsx
        : null;
      // Only trust the companion TSX for the Code tab when it actually reproduces the
      // document that's rendered on canvas — otherwise a stale/incompatible companion
      // would show code that doesn't match the design (see draftTsxHydration.ts).
      const companionMatchesCanvas = companionTsx !== null && (() => {
        const syncResult = syncCodeToCanvas({
          format: 'tsx',
          code: companionTsx,
          currentDocument: draft.document,
          currentBindingDefinitions: draft.bindingDefinitions,
        });
        return syncResult.ok === true && !documentLostContentComparedTo(draft.document, syncResult.document);
      })();

      if (companionTsx !== null && companionMatchesCanvas) {
        loadCodeFromCompanionTsx(companionTsx, {
          document: draft.document,
          bindingDefinitions: draft.bindingDefinitions ?? {},
        });
      } else {
        resetCodeFromGenerated();
      }

      setActiveDraftId(draft.id);
      setDraftNameInput(draft.name);
      setDraftFolderInput(draft.folder ?? 'general');
      setPreviewState({ isRunning: false, lastRunAt: null, diagnostics: [], results: {}, logs: [] });
    } catch (error) {
      flashToolbarStatus((error as Error).message || 'Failed to load component.');
    } finally {
      setLoadingComponentId(null);
    }
  }, [dispatch, flashToolbarStatus, loadCodeFromCompanionTsx, resetCodeFromGenerated, setPreviewState]);

  const openDuplicateDialog = React.useCallback((draftId: string) => {
    const source = drafts.find((item) => item.id === draftId);
    const sourceName = source?.name ?? 'component';
    setDuplicateSourceDraftId(draftId);
    setDraftDialogError(null);
    setDraftNameInput(normalizeDesignerComponentName(`${sourceName}-copy`));
    setDraftFolderInput(source?.folder ?? 'general');
    setDraftTagsInput(source?.tags ?? []);
    setDraftDialogMode('duplicate');
  }, [drafts]);

  const autoFormInsertTargetRef = React.useRef<AutoFormInsertTarget | null>(null);
  const autoTableInsertTargetRef = React.useRef<AutoTableInsertTarget | null>(null);

  const prepareAutoFormWizardOpen = React.useCallback((options?: {
    entryMode?: 'catalog' | 'canvas';
    insertTarget?: AutoFormInsertTarget | null;
  }): boolean => {
    const entryMode = options?.entryMode ?? 'catalog';
    setAutoFormWizardEntryMode(entryMode);

    const target = options?.insertTarget !== undefined
      ? options.insertTarget
      : resolveAutoFormInsertTarget(state.document, state.selectedNodeId);
    autoFormInsertTargetRef.current = target;

    if (!target && documentHasDesignedContent(state.document)) {
      flashToolbarStatus(
        'Select the target Form (or Modal) on the canvas first, then run Build form from API.',
      );
      return false;
    }

    return true;
  }, [flashToolbarStatus, state.document, state.selectedNodeId]);

  const prepareAutoTableWizardOpen = React.useCallback((options?: {
    entryMode?: 'catalog' | 'canvas';
    insertTarget?: AutoTableInsertTarget | null;
  }): boolean => {
    const entryMode = options?.entryMode ?? 'catalog';
    setAutoTableWizardEntryMode(entryMode);

    const target = options?.insertTarget !== undefined
      ? options.insertTarget
      : resolveAutoTableInsertTarget(state.document, state.selectedNodeId);
    // Dual entry from day one: blank canvas → fresh document; otherwise always insert
    // into root / selected container (never block the way Auto Form used to).
    autoTableInsertTargetRef.current = target
      ?? (documentHasDesignedContent(state.document)
        ? { mode: 'container-insert', parentNodeId: state.document.rootNodeId }
        : null);

    return true;
  }, [state.document, state.selectedNodeId]);

  const executePendingLeaveAction = React.useCallback((action: PendingLeaveAction) => {
    if (action.type === 'navigate-away') {
      const proceed = routeLeaveProceedRef.current;
      routeLeaveProceedRef.current = null;
      proceed?.();
      return;
    }

    if (action.type === 'page-reload') {
      window.location.reload();
      return;
    }

    if (action.type === 'duplicate-component') {
      openDuplicateDialog(action.draftId);
      return;
    }

    if (action.type === 'load-component') {
      void loadDraftIntoWorkspace(action.draftId);
      return;
    }

    if (action.type === 'reload-active-component') {
      if (activeDraftId) {
        void loadDraftIntoWorkspace(activeDraftId, { reload: true });
      }
      return;
    }

    if (action.type === 'auto-form') {
      if (!prepareAutoFormWizardOpen({ entryMode: autoFormWizardEntryMode })) {
        return;
      }
      setIsAutoFormWizardOpen(true);
      return;
    }

    if (action.type === 'auto-table') {
      if (!prepareAutoTableWizardOpen({ entryMode: autoTableWizardEntryMode })) {
        return;
      }
      setIsAutoTableWizardOpen(true);
      return;
    }

    if (action.type === 'new-layout') {
      setSelectedNewLayoutCategory('all');
      setCreateWizardKind(action.kind);
      setIsCreateWizardOpen(true);
    }
  }, [
    activeDraftId,
    autoFormWizardEntryMode,
    autoTableWizardEntryMode,
    loadDraftIntoWorkspace,
    openDuplicateDialog,
    prepareAutoFormWizardOpen,
    prepareAutoTableWizardOpen,
  ]);

  const resetDesignerWorkspace = React.useCallback((presetId: NewLayoutPresetId = 'blank') => {
    const { state: next, preferredSelectedNodeId } = createStateFromNewLayoutPreset(presetId);
    const suggestedName = presetId === 'blank'
      ? suggestDesignerComponentName(drafts.map((item) => item.name))
      : '';
    const namedDocument = { ...next.document, name: suggestedName };
    dispatch({
      type: 'hydrate-document',
      document: namedDocument,
      bindingDefinitions: next.bindingDefinitions,
      preferredSelectedNodeId,
      resetViewport: true,
    });
    setActiveDraftId(null);
    setDraftNameInput(suggestedName);
    setDraftFolderInput(DEFAULT_DRAFT_FOLDER);
    setLastSavedDraftFingerprint(createDraftFingerprint(namedDocument, next.bindingDefinitions));
    setPreviewState({ isRunning: false, lastRunAt: null, diagnostics: [], results: {}, logs: [] });
    flashToolbarStatus(NEW_LAYOUT_STATUS_MESSAGE[presetId]);
  }, [dispatch, drafts, flashToolbarStatus, setPreviewState]);

  const openCreateWizard = React.useCallback((kind: CatalogCreateKind) => {
    if (hasUnsavedChanges) {
      setPendingLeaveAction({ type: 'new-layout', kind });
      return;
    }

    setSelectedNewLayoutCategory('all');
    setCreateWizardKind(kind);
    setIsCreateWizardOpen(true);
  }, [hasUnsavedChanges]);

  const openAutoFormWizard = React.useCallback((options?: {
    entryMode?: 'catalog' | 'canvas';
  }) => {
    const entryMode = options?.entryMode
      ?? (documentHasDesignedContent(state.document) ? 'canvas' : 'catalog');

    if (hasUnsavedChanges) {
      setAutoFormWizardEntryMode(entryMode);
      setPendingLeaveAction({ type: 'auto-form' });
      return;
    }

    if (!prepareAutoFormWizardOpen({ entryMode })) {
      return;
    }

    setIsAutoFormWizardOpen(true);
  }, [hasUnsavedChanges, prepareAutoFormWizardOpen, state.document]);

  const applyAutoFormResult = React.useCallback((config: AutoFormBuildConfig) => {
    // Explicit target from prepare (canvas selection) always wins — never fall back to
    // "guess from documentHasDesignedContent" when a merge target was already resolved.
    const insertTarget = autoFormInsertTargetRef.current
      ?? resolveAutoFormInsertTarget(state.document, state.selectedNodeId);
    const canReplaceBlankCanvas = !documentHasDesignedContent(state.document);

    if (!insertTarget && !canReplaceBlankCanvas) {
      flashToolbarStatus(
        'Select a Form (or Modal containing a Form) before Build form from API — otherwise your layout would be replaced.',
      );
      setIsAutoFormWizardOpen(false);
      autoFormInsertTargetRef.current = null;
      return;
    }

    // When an explicit insert target is present, always merge — never rebuild a fresh document.
    const result = insertTarget
      ? mergeAutoFormIntoDocument(state.document, state.bindingDefinitions, config, insertTarget)
      : buildAutoFormDocument(config);

    dispatch({
      type: 'hydrate-document',
      document: result.document,
      bindingDefinitions: result.bindingDefinitions,
      preferredSelectedNodeId: result.preferredSelectedNodeId,
      resetViewport: !insertTarget,
    });
    if (!insertTarget) {
      setActiveDraftId(null);
      setDraftNameInput('');
      setDraftFolderInput('');
    }
    setLastSavedDraftFingerprint(createDraftFingerprint(result.document, result.bindingDefinitions));
    setPreviewState({ isRunning: false, lastRunAt: null, diagnostics: [], results: {}, logs: [] });
    setIsAutoFormWizardOpen(false);
    autoFormInsertTargetRef.current = null;
    flashToolbarStatus(
      insertTarget
        ? 'Form generated inside the selected container — review bindings and save when ready.'
        : 'Form generated from API — review and save when ready.',
    );
  }, [dispatch, flashToolbarStatus, setPreviewState, state.bindingDefinitions, state.document, state.selectedNodeId]);

  const openAutoTableWizard = React.useCallback((options?: {
    entryMode?: 'catalog' | 'canvas';
  }) => {
    const entryMode = options?.entryMode
      ?? (documentHasDesignedContent(state.document) ? 'canvas' : 'catalog');

    if (hasUnsavedChanges) {
      setAutoTableWizardEntryMode(entryMode);
      setPendingLeaveAction({ type: 'auto-table' });
      return;
    }

    if (!prepareAutoTableWizardOpen({ entryMode })) {
      return;
    }

    setIsAutoTableWizardOpen(true);
  }, [hasUnsavedChanges, prepareAutoTableWizardOpen, state.document]);

  const applyAutoTableResult = React.useCallback((config: AutoTableBuildConfig) => {
    const insertTarget = autoTableInsertTargetRef.current
      ?? resolveAutoTableInsertTarget(state.document, state.selectedNodeId);
    const canReplaceBlankCanvas = !documentHasDesignedContent(state.document);

    if (!insertTarget && !canReplaceBlankCanvas) {
      flashToolbarStatus(
        'Could not resolve an insert target for the table. Select a container (or clear the canvas) and try again.',
      );
      setIsAutoTableWizardOpen(false);
      autoTableInsertTargetRef.current = null;
      return;
    }

    const result = insertTarget
      ? mergeAutoTableIntoDocument(state.document, state.bindingDefinitions, config, insertTarget)
      : buildAutoTableDocument(config);

    dispatch({
      type: 'hydrate-document',
      document: result.document,
      bindingDefinitions: result.bindingDefinitions,
      preferredSelectedNodeId: result.preferredSelectedNodeId,
      resetViewport: !insertTarget,
    });
    if (!insertTarget) {
      setActiveDraftId(null);
      setDraftNameInput('');
      setDraftFolderInput('');
    }
    setLastSavedDraftFingerprint(createDraftFingerprint(result.document, result.bindingDefinitions));
    setPreviewState({ isRunning: false, lastRunAt: null, diagnostics: [], results: {}, logs: [] });
    setIsAutoTableWizardOpen(false);
    autoTableInsertTargetRef.current = null;
    flashToolbarStatus(
      insertTarget
        ? 'Table generated into the canvas — review bindings and save when ready.'
        : 'Table generated from API — review and save when ready.',
    );
  }, [dispatch, flashToolbarStatus, setPreviewState, state.bindingDefinitions, state.document, state.selectedNodeId]);

  const handleStartNewLayout = React.useCallback((
    _presetId: NewLayoutPresetId,
    _identity: { name: string; tags?: string[] },
  ) => {
    setIsCreateWizardOpen(false);
  }, []);

  const handleCreateWizardComplete = React.useCallback((
    _result: CreateComponentWizardResult,
  ) => {
    setIsCreateWizardOpen(false);
  }, []);

  const openSaveDialog = React.useCallback(() => {
    setDraftDialogError(null);
    if (activeDraftId !== null) {
      setDraftNameInput(normalizeDesignerComponentName(activeComponentName));
      setDraftFolderInput(activeDraftSummary?.folder ?? 'general');
    }
    setDraftDialogMode('save');
  }, [activeComponentName, activeDraftId, activeDraftSummary?.folder]);

  const handleQuickSaveDraft = React.useCallback(async () => {
    if (!activeDraftId) {
      return false;
    }

    setDraftDialogBusy(true);
    setDraftDialogError(null);
    try {
      const draft = await updateComponentDesignerVersion(activeDraftId, {
        name: activeComponentName,
        document: state.document,
        bindingDefinitions: state.bindingDefinitions,
        workspace: {
          viewport: state.viewport,
        },
      });

      upsertDraftSummary(draft);
      dispatch({
        type: 'hydrate-document',
        document: draft.document,
        bindingDefinitions: draft.bindingDefinitions,
        preferredSelectedNodeId: state.selectedNodeId,
      });
      setActiveDraftId(draft.id);
      setLastSavedDraftFingerprint(createDraftFingerprint(draft.document, draft.bindingDefinitions));
      setDraftNameInput(draft.name);
      setDraftDialogMode(null);
      invalidateDesignerPublishedViews(queryClient, {
        shellKey: draft.name,
        pageSlug: draft.name,
      });
      await refreshDrafts({ silent: true });
      flashToolbarStatus('Saved.');
      return true;
    } catch (error) {
      const message = (error as Error).message || 'Failed to save component.';
      setDraftDialogError(message);
      flashToolbarStatus(message);
      return false;
    } finally {
      setDraftDialogBusy(false);
    }
  }, [activeComponentName, activeDraftId, dispatch, flashToolbarStatus, queryClient, refreshDrafts, state.bindingDefinitions, state.document, state.selectedNodeId, upsertDraftSummary]);

  const handleRenameComponent = React.useCallback(async (rawName: string): Promise<boolean> => {
    const componentName = normalizeDesignerComponentName(rawName);
    if (!componentName) {
      flashToolbarStatus('Component name is required.');
      return false;
    }

    if (!isValidDesignerComponentName(componentName)) {
      flashToolbarStatus('Use only lowercase letters, numbers, commas, and dashes.');
      return false;
    }

    if (componentName === normalizeDesignerComponentName(activeComponentName)) {
      return true;
    }

    if (!activeDraftId) {
      dispatch({ type: 'set-document-name', name: componentName });
      setDraftNameInput(componentName);
      return true;
    }

    if (isActivePackageComponent) {
      flashToolbarStatus('Installed package components cannot be renamed here.');
      return false;
    }

    setIsRenameBusy(true);
    try {
      const draft = await updateComponentDesignerVersion(activeDraftId, {
        name: componentName,
      });
      upsertDraftSummary(draft);
      setActiveDraftId(draft.id);
      applyPersistedDraftMetadata(draft, { syncWorkspaceName: true });
      flashToolbarStatus(`Renamed to ${draft.name}.`);
      return true;
    } catch (error) {
      flashToolbarStatus((error as Error).message || 'Failed to rename component.');
      return false;
    } finally {
      setIsRenameBusy(false);
    }
  }, [
    activeComponentName,
    activeDraftId,
    applyPersistedDraftMetadata,
    dispatch,
    flashToolbarStatus,
    isActivePackageComponent,
    upsertDraftSummary,
  ]);

  const handleUpdateComponentFolder = React.useCallback(async (rawFolder: string): Promise<boolean> => {
    const folder = resolveCanonicalDesignerDraftFolder(rawFolder);
    const currentFolder = normalizeComponentFolder(activeDraftSummary?.folder ?? draftFolderInput);
    if (folder === currentFolder) {
      setDraftFolderInput(folder);
      return true;
    }

    if (!activeDraftId) {
      setDraftFolderInput(folder);
      return true;
    }

    if (isActiveBuiltIn) {
      flashToolbarStatus('Built-in components cannot be moved.');
      return false;
    }

    if (isActivePackageComponent) {
      flashToolbarStatus('Installed package components cannot be moved here.');
      return false;
    }

    setIsRenameBusy(true);
    try {
      const draft = await updateComponentDesignerVersion(activeDraftId, {
        folder,
      });
      applyPersistedDraftMetadata(draft, { syncWorkspaceName: true });
      flashToolbarStatus(`Moved to folder ${draft.folder ?? folder}.`);
      return true;
    } catch (error) {
      flashToolbarStatus((error as Error).message || 'Failed to update folder.');
      return false;
    } finally {
      setIsRenameBusy(false);
    }
  }, [
    activeDraftId,
    activeDraftSummary?.folder,
    applyPersistedDraftMetadata,
    draftFolderInput,
    flashToolbarStatus,
    isActiveBuiltIn,
    isActivePackageComponent,
  ]);

  const reportSaveValidationError = React.useCallback((message: string) => {
    setDraftDialogError(message);
    if (draftDialogMode !== 'save') {
      flashToolbarStatus(message);
    }
  }, [draftDialogMode, flashToolbarStatus]);

  const handleSaveDraft = React.useCallback(async () => {
    const isCreateSave = activeDraftId === null;
    if (isCreateSave && draftNameInput.trim() === '') {
      reportSaveValidationError('Component name is required.');
      return;
    }

    const componentName = isCreateSave ? normalizeDesignerComponentName(draftNameInput) : activeComponentName;
    if (!componentName) {
      reportSaveValidationError('Component name is required.');
      return;
    }

    if (isCreateSave && !isValidDesignerComponentName(componentName)) {
      reportSaveValidationError('Use only lowercase letters, numbers, commas, and dashes.');
      return;
    }

    setDraftDialogBusy(true);
    setDraftDialogError(null);
    try {
      const draft = isCreateSave
        ? await createComponentDesignerVersion({
            id: state.document.id,
            name: componentName,
            folder: resolveCanonicalDesignerDraftFolder(draftFolderInput),
            tags: draftTagsInput,
            document: state.document,
            bindingDefinitions: state.bindingDefinitions,
            workspace: {
              viewport: state.viewport,
            },
          })
        : await updateComponentDesignerVersion(activeDraftId!, {
            name: activeComponentName,
            document: state.document,
            bindingDefinitions: state.bindingDefinitions,
            workspace: {
              viewport: state.viewport,
            },
          });

      setDraftFolderInput(normalizeComponentFolder(draft.folder ?? draftFolderInput));
      upsertDraftSummary(draft);

      dispatch({
        type: 'hydrate-document',
        document: draft.document,
        bindingDefinitions: draft.bindingDefinitions,
        preferredSelectedNodeId: state.selectedNodeId,
      });
      setActiveDraftId(draft.id);
      setLastSavedDraftFingerprint(createDraftFingerprint(draft.document, draft.bindingDefinitions));
      setDraftNameInput(draft.name);
      setDraftDialogMode(null);
      void refreshDrafts({ silent: true });
      invalidateDesignerPublishedViews(queryClient, {
        shellKey: draft.name,
        pageSlug: draft.name,
      });
      flashToolbarStatus('Saved.');

      if (pendingLeaveAfterSave) {
        const nextAction = pendingLeaveAfterSave;
        setPendingLeaveAfterSave(null);
        executePendingLeaveAction(nextAction);
      }
    } catch (error) {
      const message = (error as Error).message || 'Failed to save component.';
      setDraftDialogError(message);
      if (draftDialogMode !== 'save') {
        flashToolbarStatus(message);
      }
    } finally {
      setDraftDialogBusy(false);
    }
  }, [activeComponentName, activeDraftId, draftDialogMode, draftFolderInput, draftNameInput, draftTagsInput, dispatch, executePendingLeaveAction, flashToolbarStatus, pendingLeaveAfterSave, queryClient, refreshDrafts, reportSaveValidationError, state.bindingDefinitions, state.document, state.selectedNodeId, upsertDraftSummary]);

  const handleToolbarSaveClick = React.useCallback(() => {
    if (!canSaveDraft) {
      return;
    }

    if (activeDraftId === null) {
      const componentName = normalizeDesignerComponentName(draftNameInput);
      if (
        draftNameInput.trim() === ''
        || !isValidDesignerComponentName(componentName)
      ) {
        openSaveDialog();
        return;
      }

      void handleSaveDraft();
      return;
    }

    void handleQuickSaveDraft();
  }, [activeDraftId, canSaveDraft, draftNameInput, handleQuickSaveDraft, handleSaveDraft, openSaveDialog]);

  const handleRefreshComponents = React.useCallback(() => {
    void refreshDrafts();
  }, [refreshDrafts]);

  const handleReloadActiveComponentFromDisk = React.useCallback(() => {
    if (!activeDraftId || isActiveBuiltIn) {
      flashToolbarStatus(isActiveBuiltIn ? 'Built-in components cannot be reloaded from disk.' : 'Save the component before reloading from disk.');
      return;
    }

    if (hasUnsavedChanges) {
      setPendingLeaveAction({ type: 'reload-active-component' });
      return;
    }

    void loadDraftIntoWorkspace(activeDraftId, { reload: true });
  }, [activeDraftId, flashToolbarStatus, hasUnsavedChanges, isActiveBuiltIn, loadDraftIntoWorkspace]);

  const handleLoadComponentFromList = React.useCallback((draftId: string) => {
    if (draftId === activeDraftId) {
      return;
    }

    if (loadingComponentId !== null) {
      if (loadingComponentId === draftId) {
        return;
      }
      return;
    }

    if (hasUnsavedChanges) {
      setPendingLeaveAction({ type: 'load-component', draftId });
      return;
    }

    executePendingLeaveAction({ type: 'load-component', draftId });
  }, [activeDraftId, executePendingLeaveAction, hasUnsavedChanges, loadingComponentId]);

  const openEditDialog = React.useCallback((draftId: string) => {
    const target = drafts.find((item) => item.id === draftId);
    if (!target) {
      return;
    }

    setEditTargetDraftId(draftId);
    setDraftDialogError(null);
    setDraftNameInput(target.name);
    setDraftFolderInput(target.folder ?? 'general');
    setDraftTagsInput(target.tags ?? []);
    setDraftDialogMode('edit');
  }, [drafts]);

  const handleEditComponent = React.useCallback((draftId: string) => {
    if (draftDialogBusy) {
      return;
    }

    const target = drafts.find((item) => item.id === draftId);
    if (target?.isPackageComponent) {
      flashToolbarStatus('Open the component to edit its installed package source.');
      void loadDraftIntoWorkspace(draftId);
      return;
    }

    openEditDialog(draftId);
  }, [draftDialogBusy, drafts, flashToolbarStatus, loadDraftIntoWorkspace, openEditDialog]);

  const openTagsDialog = React.useCallback((draftId: string) => {
    const target = drafts.find((item) => item.id === draftId);
    if (!target) {
      return;
    }

    setEditTargetDraftId(draftId);
    setDraftDialogError(null);
    setDraftNameInput(target.name);
    setDraftTagsInput(target.tags ?? []);
    setDraftDialogMode('tags');
  }, [drafts]);

  const handleEditComponentTags = React.useCallback((draftId: string) => {
    if (draftDialogBusy) {
      return;
    }

    const target = drafts.find((item) => item.id === draftId);
    if (target?.isPackageComponent) {
      flashToolbarStatus('Open the component to edit its installed package source.');
      void loadDraftIntoWorkspace(draftId);
      return;
    }

    openTagsDialog(draftId);
  }, [draftDialogBusy, drafts, flashToolbarStatus, loadDraftIntoWorkspace, openTagsDialog]);

  const handleDuplicateComponent = React.useCallback((draftId: string) => {
    if (draftDialogBusy) {
      return;
    }

    const target = drafts.find((item) => item.id === draftId);
    if (target?.isPackageComponent) {
      flashToolbarStatus('Installed package components cannot be duplicated here.');
      return;
    }

    if (hasUnsavedChanges && draftId === activeDraftId) {
      setPendingLeaveAction({ type: 'duplicate-component', draftId });
      return;
    }

    openDuplicateDialog(draftId);
  }, [activeDraftId, draftDialogBusy, drafts, flashToolbarStatus, hasUnsavedChanges, openDuplicateDialog]);

  const handleDeleteComponent = React.useCallback((draftId: string) => {
    if (draftDialogBusy) {
      return;
    }

    const target = drafts.find((item) => item.id === draftId);
    if (target?.isBuiltIn) {
      flashToolbarStatus('Built-in components cannot be deleted.');
      return;
    }

    if (target?.isPackageComponent) {
      flashToolbarStatus('Uninstall the package to remove this component.');
      return;
    }

    setDeleteTargetDraftId(draftId);
    setDraftDialogError(null);
    setDraftDialogMode('delete');
  }, [draftDialogBusy, drafts, flashToolbarStatus]);

  const handleSaveEditDraft = React.useCallback(async (tags?: string[]) => {
    const targetDraftId = editTargetDraftId;
    if (!targetDraftId) {
      return;
    }

    const componentName = normalizeDesignerComponentName(draftNameInput);
    if (!componentName) {
      setDraftDialogError('Component name is required.');
      return;
    }

    if (!isValidDesignerComponentName(componentName)) {
      setDraftDialogError('Use only lowercase letters, numbers, commas, and dashes.');
      return;
    }

    const nextTags = tags ?? draftTagsInput;

    setDraftDialogBusy(true);
    setDraftDialogError(null);
    try {
      const draft = await updateComponentDesignerVersion(targetDraftId, {
        name: componentName,
        tags: nextTags,
      });

      upsertDraftSummary(draft);
      if (targetDraftId === activeDraftId) {
        setActiveDraftId(draft.id);
      }

      applyPersistedDraftMetadata({
        ...draft,
        tags: Array.isArray(draft.tags) ? draft.tags : nextTags,
      }, { syncWorkspaceName: targetDraftId === activeDraftId });

      invalidateComponentDesignerDrafts(queryClient);
      await refreshDrafts({ silent: true });

      setEditTargetDraftId(null);
      setDraftDialogMode(null);
      flashToolbarStatus(`Updated ${draft.name}.`);
    } catch (error) {
      setDraftDialogError((error as Error).message || 'Failed to update component.');
    } finally {
      setDraftDialogBusy(false);
    }
  }, [activeDraftId, applyPersistedDraftMetadata, draftFolderInput, draftNameInput, draftTagsInput, editTargetDraftId, flashToolbarStatus, queryClient, refreshDrafts, upsertDraftSummary]);

  const handleSaveComponentTags = React.useCallback(async (tags: string[]) => {
    const targetDraftId = editTargetDraftId;
    if (!targetDraftId) {
      return;
    }

    const generation = tagsSaveGenerationRef.current + 1;
    tagsSaveGenerationRef.current = generation;
    setDraftTagsInput(tags);
    setDraftDialogError(null);
    try {
      const draft = await updateComponentDesignerVersion(targetDraftId, {
        tags,
      });

      if (generation !== tagsSaveGenerationRef.current) {
        return;
      }

      upsertDraftSummary(draft);
      if (targetDraftId === activeDraftId) {
        setActiveDraftId(draft.id);
      }
      if (draft.id !== targetDraftId) {
        setEditTargetDraftId(draft.id);
      }

      applyPersistedDraftMetadata({
        ...draft,
        tags: Array.isArray(draft.tags) ? draft.tags : tags,
      }, { syncWorkspaceName: targetDraftId === activeDraftId });

      if (draft.id !== targetDraftId) {
        await refreshDrafts({ silent: true });
      }
    } catch (error) {
      if (generation !== tagsSaveGenerationRef.current) {
        return;
      }
      setDraftDialogError((error as Error).message || 'Failed to update tags.');
    }
  }, [activeDraftId, applyPersistedDraftMetadata, editTargetDraftId, refreshDrafts, upsertDraftSummary]);

  const handleDuplicateDraft = React.useCallback(async (tags?: string[]) => {
    if (!duplicateSourceDraftId) {
      return;
    }

    const componentName = normalizeDesignerComponentName(draftNameInput);
    if (!componentName) {
      setDraftDialogError('Component name is required.');
      return;
    }

    if (!isValidDesignerComponentName(componentName)) {
      setDraftDialogError('Use only lowercase letters, numbers, commas, and dashes.');
      return;
    }

    const nextTags = tags ?? draftTagsInput;

    setDraftDialogBusy(true);
    setDraftDialogError(null);
    try {
      const draft = await createComponentDesignerVersion({
        name: componentName,
        folder: resolveCanonicalDesignerDraftFolder(draftFolderInput),
        tags: nextTags,
        duplicateFromId: duplicateSourceDraftId,
        document: state.document,
        bindingDefinitions: state.bindingDefinitions,
      });

      upsertDraftSummary(draft);
      setActiveDraftId(draft.id);
      dispatch({
        type: 'hydrate-document',
        document: draft.document,
        bindingDefinitions: draft.bindingDefinitions,
        preferredSelectedNodeId: draft.document.rootNodeId,
      });
      setLastSavedDraftFingerprint(createDraftFingerprint(draft.document, draft.bindingDefinitions));
      setDraftNameInput(draft.name);
      setDuplicateSourceDraftId(null);
      setDraftDialogMode(null);
      setPreviewState({ isRunning: false, lastRunAt: null, diagnostics: [], results: {}, logs: [] });
      void refreshDrafts({ silent: true });
      flashToolbarStatus(`Duplicated as ${draft.name}.`);
    } catch (error) {
      setDraftDialogError((error as Error).message || 'Failed to duplicate component.');
    } finally {
      setDraftDialogBusy(false);
    }
  }, [dispatch, draftFolderInput, draftNameInput, draftTagsInput, duplicateSourceDraftId, flashToolbarStatus, refreshDrafts, setPreviewState, state.bindingDefinitions, state.document, upsertDraftSummary]);

  const handleConfirmDeleteComponent = React.useCallback(async () => {
    const targetDraftId = deleteTargetDraftId ?? activeDraftId;
    if (!targetDraftId) {
      return;
    }

    const deletedName = deleteTargetComponentName;
    const shouldResetWorkspace = targetDraftId === activeDraftId;
    setDraftDialogBusy(true);
    setDraftDialogError(null);
    try {
      await deleteComponentDesignerVersion(targetDraftId);
      setDeleteTargetDraftId(null);
      setDraftDialogMode(null);
      if (shouldResetWorkspace) {
        resetDesignerWorkspace('blank');
      }
      await refreshDrafts();
      void queryClient.invalidateQueries({ queryKey: componentDesignerQueryKeys.unusedComponents() });
      flashToolbarStatus(`Deleted ${deletedName}.`);
    } catch (error) {
      setDraftDialogError((error as Error).message || 'Failed to delete component.');
    } finally {
      setDraftDialogBusy(false);
    }
  }, [activeDraftId, deleteTargetComponentName, deleteTargetDraftId, flashToolbarStatus, refreshDrafts, resetDesignerWorkspace]);

  const handleCancelDraftDialog = React.useCallback(() => {
    if (draftDialogBusy && draftDialogMode !== 'tags') {
      return;
    }

    const wasTagsDialog = draftDialogMode === 'tags';
    setDuplicateSourceDraftId(null);
    setEditTargetDraftId(null);
    setDeleteTargetDraftId(null);
    setDraftDialogMode(null);
    setDraftDialogError(null);

    if (wasTagsDialog) {
      invalidateComponentDesignerDrafts(queryClient);
      void refreshDrafts({ silent: true });
    }
  }, [draftDialogBusy, draftDialogMode, queryClient, refreshDrafts]);

  const requestNavigateAway = React.useCallback((proceed: () => void) => {
    if (pendingLeaveAction !== null) {
      return;
    }

    routeLeaveProceedRef.current = proceed;
    setPendingLeaveAction({ type: 'navigate-away' });
  }, [pendingLeaveAction]);

  const requestPageReload = React.useCallback(() => {
    if (pendingLeaveAction !== null) {
      return;
    }

    setPendingLeaveAction({ type: 'page-reload' });
  }, [pendingLeaveAction]);

  const handleCancelUnsavedChangesDialog = React.useCallback(() => {
    routeLeaveProceedRef.current = null;
    setPendingLeaveAction(null);
  }, []);

  const handleDiscardUnsavedChanges = React.useCallback(() => {
    const action = pendingLeaveAction;
    setPendingLeaveAction(null);
    if (!action) {
      return;
    }

    executePendingLeaveAction(action);
  }, [executePendingLeaveAction, pendingLeaveAction]);

  const handleSaveUnsavedChanges = React.useCallback(async () => {
    const action = pendingLeaveAction;
    if (!action) {
      return;
    }

    if (activeDraftId === null) {
      setPendingLeaveAfterSave(action);
      setPendingLeaveAction(null);
      await handleSaveDraft();
      return;
    }

    const saved = await handleQuickSaveDraft();
    if (saved) {
      setPendingLeaveAction(null);
      executePendingLeaveAction(action);
    }
  }, [activeDraftId, executePendingLeaveAction, handleQuickSaveDraft, handleSaveDraft, pendingLeaveAction]);

  return {
    drafts,
    draftDialogMode,
    draftDialogBusy,
    draftDialogError,
    draftNameInput,
    setDraftNameInput,
    draftFolderInput,
    setDraftFolderInput,
    draftTagsInput,
    setDraftTagsInput,
    isDraftsLoading: isDraftsLoading || draftsQuery.isLoading,
    activeDraftId,
    isCreateWizardOpen,
    setIsCreateWizardOpen,
    createWizardKind,
    selectedNewLayoutCategory,
    setSelectedNewLayoutCategory,
    loadingComponentId,
    hasUnsavedChanges,
    isSavingDraft,
    canSaveDraft,
    activeDraftSummary,
    activeComponentName,
    filteredComponentDrafts,
    componentGroups,
    catalogKindFilter,
    setCatalogKindFilter,
    catalogBuiltInFilter,
    setCatalogBuiltInFilter,
    isActiveBuiltIn,
    isActivePackageComponent,
    isUnsavedChangesDialogOpen,
    resetDesignerWorkspace,
    openCreateWizard,
    isAutoFormWizardOpen,
    setIsAutoFormWizardOpen,
    autoFormWizardEntryMode,
    openAutoFormWizard,
    applyAutoFormResult,
    isAutoTableWizardOpen,
    setIsAutoTableWizardOpen,
    autoTableWizardEntryMode,
    openAutoTableWizard,
    applyAutoTableResult,
    handleStartNewLayout,
    handleCreateWizardComplete,
    handleToolbarSaveClick,
    handleRenameComponent,
    handleUpdateComponentFolder,
    isRenameBusy,
    handleSaveDraft,
    handleLoadComponentFromList,
    handleReloadActiveComponentFromDisk,
    isReloadingActiveComponent: loadingComponentId !== null && loadingComponentId === activeDraftId,
    canReloadActiveComponentFromDisk: activeDraftId !== null && !isActiveBuiltIn && !isActivePackageComponent,
    handleRefreshComponents,
    handleDuplicateComponent,
    handleEditComponent,
    handleEditComponentTags,
    handleDeleteComponent,
    deleteTargetDraftId,
    deleteTargetComponentName,
    handleDuplicateDraft,
    handleSaveEditDraft,
    handleSaveComponentTags,
    handleConfirmDeleteComponent,
    handleCancelDraftDialog,
    handleCancelUnsavedChangesDialog,
    handleDiscardUnsavedChanges,
    handleSaveUnsavedChanges,
    requestNavigateAway,
    requestPageReload,
    setDraftDialogMode,
    setDraftDialogError,
  };
};
