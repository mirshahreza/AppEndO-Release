import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useOptionalPortal } from '../../../app/platform/PortalContext';
import { usePlatformMount } from '../../../app/platform/PlatformMountContext';
import { formatApiErrorMessage, isApiError } from '../../../shared/api/client';
import { showAppFeedbackToast } from '../../../shared/ui';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { usePersistedListFilters } from '../../../shared/lib/usePersistedListPreferences';
import { useListPageToolbarScroll } from '../../../shared/lib/useListPageToolbarScroll';
import { usePublishAiPageContext } from '../../../shared/lib/aiPageContextStore';
import { useCurrentUserDisplay } from '../../../hooks/useCurrentUserDisplay';
import {
  isIdeaImportance,
  isIdeaMaturity,
  isIdeaScale,
  type CreateProductIdeaInput,
  type IdeaTeamPerson,
  type ProductIdeaRecord,
} from '../../../shared/api/contracts/idea-foundry/types';
import { useAvailableAiModelsQuery } from '../../../shared/api/queries/aiModels';
import {
  useCreateProductIdeaMutation,
  useIdeaPackageHomesQuery,
  useProductIdeaQuery,
  useProductIdeasListQuery,
  useUpdateProductIdeaMutation,
} from '../../../shared/api/queries/idea-foundry';
import { usePackagesGridQuery } from '../../../shared/api/queries/packages';
import {
  compareIdeas,
  DEFAULT_IDEA_SORT,
  DEFAULT_IDEA_SORT_DIRECTION,
  homesFromPackageCatalog,
  isIdeaSortDirection,
  isIdeaSortField,
  toIdeaWriteInput,
} from '../ideaFoundryCatalog';
import {
  buildIdeaFoundryEditRelativePath,
  buildIdeaFoundryListRelativePath,
  parseIdeaFoundryEditSlug,
  parseIdeaFoundryEditSlugFromPathname,
  resolveIdeaIdFromEditSlug,
} from '../ideaFoundryRoute';
import { useIdeaFoundryShellHeader } from '../hooks/useIdeaFoundryShellHeader';
import { IdeaCreateWizardModal } from './IdeaCreateWizardModal';
import { IdeaFoundryBoard } from './IdeaFoundryBoard';
import { IdeaFoundryToolbar, type IdeaFoundryFilters } from './IdeaFoundryToolbar';
import { IdeaFoundryView, type IdeaMarkdownField } from './IdeaFoundryView';

const errorMessage = (error: unknown, fallback: string): string => {
  if (isApiError(error)) {
    return formatApiErrorMessage(error);
  }
  return error instanceof Error ? error.message : fallback;
};

const DEFAULT_FILTERS: IdeaFoundryFilters = {
  searchQuery: '',
  maturity: '',
  importance: '',
  scale: '',
  sortBy: DEFAULT_IDEA_SORT,
  sortDirection: DEFAULT_IDEA_SORT_DIRECTION,
};

function sanitizeFilters(raw: unknown): IdeaFoundryFilters | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  return {
    searchQuery: typeof record.searchQuery === 'string' ? record.searchQuery : '',
    maturity: typeof record.maturity === 'string' && isIdeaMaturity(record.maturity) ? record.maturity : '',
    importance: typeof record.importance === 'string' && isIdeaImportance(record.importance) ? record.importance : '',
    scale: typeof record.scale === 'string' && isIdeaScale(record.scale) ? record.scale : '',
    sortBy: isIdeaSortField(record.sortBy) ? record.sortBy : DEFAULT_IDEA_SORT,
    sortDirection: isIdeaSortDirection(record.sortDirection) ? record.sortDirection : DEFAULT_IDEA_SORT_DIRECTION,
  };
}

const IdeaFoundryViewHost: React.FC<{
  ideaId: string;
  onBack: () => void;
  onMissing: () => void;
  onReconfigure: (idea: ProductIdeaRecord) => void;
}> = ({ ideaId, onBack, onMissing, onReconfigure }) => {
  const query = useProductIdeaQuery(ideaId);
  const updateMutation = useUpdateProductIdeaMutation();
  const idea = query.data ?? null;

  useEffect(() => {
    if (!query.isError) {
      return;
    }
    onMissing();
  }, [onMissing, query.isError]);

  const persistIdeaField = useCallback((field: 'title' | IdeaMarkdownField, value: string) => {
    if (!idea) return;
    const trimmed = value.trim();
    if (!trimmed) {
      showAppFeedbackToast('That field cannot be empty.', { type: 'error' });
      return;
    }
    if (field === 'title' && trimmed.length > 255) {
      showAppFeedbackToast('Title must be 255 characters or fewer.', { type: 'error' });
      return;
    }
    const input = toIdeaWriteInput(idea);
    if (!input) {
      showAppFeedbackToast('Add a decision maker and a model before editing this idea.', { type: 'error' });
      return;
    }
    updateMutation.mutate(
      { id: idea.id, input: { ...input, [field]: trimmed } },
      {
        onSuccess: () => {
          showAppFeedbackToast('Idea updated.', { type: 'success' });
        },
        onError: (error) => {
          showAppFeedbackToast(errorMessage(error, 'Failed to update idea.'), { type: 'error' });
        },
      },
    );
  }, [idea, updateMutation]);

  if (!idea) {
    return (
      <div className="flex h-full items-center justify-center text-sm font-normal text-slate-500">
        Loading idea…
      </div>
    );
  }

  return (
    <IdeaFoundryView
      idea={idea}
      onBack={onBack}
      onReconfigure={() => onReconfigure(idea)}
      onSaveTitle={(value) => persistIdeaField('title', value)}
      onSaveMarkdown={persistIdeaField}
    />
  );
};

export const IdeaFoundryWorkspace: React.FC = () => {
  const { listToolbarCollapsed, handleGridScroll } = useListPageToolbarScroll();
  const navigate = useNavigate();
  const location = useLocation();
  const { mountId, toMountPath } = usePlatformMount();
  const application = useOptionalPortal();
  const routeParamSuffix = useParams()['*'];
  const applicationSuffix = application?.pageRemainderPath.replace(/^\/+/, '') || undefined;
  const pathSuffix = applicationSuffix ?? routeParamSuffix;
  const editSlugFromUrl = useMemo(
    () => parseIdeaFoundryEditSlug(pathSuffix) ?? parseIdeaFoundryEditSlugFromPathname(location.pathname),
    [location.pathname, pathSuffix],
  );
  const ideaIdFromUrl = editSlugFromUrl
    ? resolveIdeaIdFromEditSlug(editSlugFromUrl)
    : null;

  const { currentUser, displayName, avatarXs, profile } = useCurrentUserDisplay();
  const actor = useMemo<IdeaTeamPerson | null>(() => {
    if (!currentUser?.id) return null;
    return {
      userId: currentUser.id,
      displayName,
      username: profile?.username?.trim() || displayName,
      avatarUrl: avatarXs,
    };
  }, [avatarXs, currentUser?.id, displayName, profile?.username]);
  const modelsQuery = useAvailableAiModelsQuery();
  const availableModels = useMemo(
    () => (modelsQuery.data?.models ?? [])
      .filter((model) => model.hasApiKey === true)
      .map((model) => ({
        id: model.id,
        name: model.name,
        provider: model.provider,
        providerLabel: model.providerLabel,
        modelId: model.modelId,
        isDefault: model.isDefault,
      })),
    [modelsQuery.data?.models],
  );
  const [filters, setFilters] = usePersistedListFilters({
    listKey: APP_LIST_PREFERENCE_KEYS.ideaFoundry,
    defaultFilters: DEFAULT_FILTERS,
    sanitize: sanitizeFilters,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [wizardMode, setWizardMode] = useState<'create' | 'reconfigure'>('create');
  const [reconfigureIdea, setReconfigureIdea] = useState<ProductIdeaRecord | null>(null);

  const listQuery = useProductIdeasListQuery();
  const homesQuery = useIdeaPackageHomesQuery();
  const packagesQuery = usePackagesGridQuery();
  const createMutation = useCreateProductIdeaMutation();
  const updateMutation = useUpdateProductIdeaMutation();

  const homes = useMemo(() => {
    if (homesQuery.data && homesQuery.data.length > 0) {
      return homesQuery.data;
    }
    return homesFromPackageCatalog(packagesQuery.data ?? []);
  }, [homesQuery.data, packagesQuery.data]);

  useIdeaFoundryShellHeader({ enabled: Boolean(ideaIdFromUrl) });

  usePublishAiPageContext({
    entityType: 'idea-foundry',
    activeFilters: {
      search: filters.searchQuery,
      maturity: filters.maturity,
      importance: filters.importance,
      scale: filters.scale,
      sortBy: filters.sortBy,
      sortDirection: filters.sortDirection,
      selectedId: ideaIdFromUrl,
    },
  });

  const items = useMemo(() => {
    const query = filters.searchQuery.trim().toLowerCase();
    const filtered = (listQuery.data ?? []).filter((item) => {
      if (query) {
        const haystack = [
          item.title,
          item.description,
          item.packageTitle ?? '',
          item.sectionTitle ?? '',
          item.frontOffice ?? '',
          item.backOffice ?? '',
          item.decisionMaker?.displayName ?? '',
          ...item.collaborators.map((person) => person.displayName),
          ...item.models.map((model) => model.name),
        ].join(' ').toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (filters.maturity && item.maturity !== filters.maturity) return false;
      if (filters.importance && item.importance !== filters.importance) return false;
      if (filters.scale && item.scale !== filters.scale) return false;
      return true;
    });
    return [...filtered].sort((left, right) => compareIdeas(left, right, filters.sortBy, filters.sortDirection));
  }, [filters, listQuery.data]);

  const navigateToList = useCallback(() => {
    navigate(toMountPath(buildIdeaFoundryListRelativePath(mountId)));
  }, [mountId, navigate, toMountPath]);

  const navigateToView = useCallback((id: string) => {
    navigate(toMountPath(buildIdeaFoundryEditRelativePath(id, mountId)));
  }, [mountId, navigate, toMountPath]);

  const handleMissingView = useCallback(() => {
    navigate(toMountPath(buildIdeaFoundryListRelativePath(mountId)), { replace: true });
  }, [mountId, navigate, toMountPath]);

  const closeWizard = useCallback(() => {
    setCreateOpen(false);
    setWizardMode('create');
    setReconfigureIdea(null);
    setCreateError(null);
  }, []);

  const openCreate = useCallback(() => {
    setCreateError(null);
    setWizardMode('create');
    setReconfigureIdea(null);
    setCreateOpen(true);
  }, []);

  const openReconfigure = useCallback((idea: ProductIdeaRecord) => {
    setCreateError(null);
    setWizardMode('reconfigure');
    setReconfigureIdea(idea);
    setCreateOpen(true);
  }, []);

  const handleCreate = useCallback((input: CreateProductIdeaInput) => {
    setCreateError(null);
    if (wizardMode === 'reconfigure' && reconfigureIdea) {
      updateMutation.mutate({ id: reconfigureIdea.id, input }, {
        onSuccess: () => {
          closeWizard();
          showAppFeedbackToast('Idea updated.', { type: 'success' });
        },
        onError: (error) => {
          setCreateError(errorMessage(error, 'Failed to reconfigure idea.'));
        },
      });
      return;
    }
    createMutation.mutate(input, {
      onSuccess: () => {
        closeWizard();
        showAppFeedbackToast('Idea registered.', { type: 'success' });
      },
      onError: (error) => {
        setCreateError(errorMessage(error, 'Failed to register idea.'));
      },
    });
  }, [closeWizard, createMutation, reconfigureIdea, updateMutation, wizardMode]);

  const listError = listQuery.error ? errorMessage(listQuery.error, 'Failed to load ideas.') : null;

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-white font-sans" data-testid="idea-foundry">
      {ideaIdFromUrl ? (
        <IdeaFoundryViewHost
          ideaId={ideaIdFromUrl}
          onBack={navigateToList}
          onMissing={handleMissingView}
          onReconfigure={openReconfigure}
        />
      ) : (
        <>
          <IdeaFoundryToolbar
            filters={filters}
            onFiltersChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
            onCreate={openCreate}
            onRefresh={() => { void listQuery.refetch(); }}
            isRefreshing={listQuery.isFetching && !listQuery.isLoading}
            listToolbarCollapsed={listToolbarCollapsed}
          />
          <IdeaFoundryBoard
            items={items}
            isLoading={listQuery.isLoading && !listQuery.data}
            loadError={listError}
            onRetry={() => { void listQuery.refetch(); }}
            isRetrying={listQuery.isFetching}
            onCreate={openCreate}
            onOpen={navigateToView}
            onScroll={handleGridScroll}
          />
        </>
      )}
      <IdeaCreateWizardModal
        key={wizardMode === 'reconfigure' && reconfigureIdea ? `reconfigure:${reconfigureIdea.id}` : 'create'}
        open={createOpen}
        isSaving={createMutation.isPending || updateMutation.isPending}
        error={createError}
        homes={homes}
        homesLoading={homesQuery.isLoading && packagesQuery.isLoading}
        actor={actor}
        availableModels={availableModels}
        modelsLoading={modelsQuery.isLoading}
        mode={wizardMode}
        initialIdea={reconfigureIdea}
        onClose={closeWizard}
        onClearError={() => setCreateError(null)}
        onCreate={handleCreate}
      />
    </div>
  );
};
