import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AiAgentSettings,
  AiGlobalSettings,
  AiModelEntry,
  AiModelPublicEntry,
  AiProviderConfig,
  AiProviderKind,
  AiProviderPublicConfig,
} from '../../../../shared/api/contracts/ai/types';
import {
  AI_PROVIDER_SETUP_TEMPLATES,
  buildAiProviderConfigFromTemplate,
  DEFAULT_AI_AGENT_SETTINGS,
  getAiProviderLabel,
} from '../../../../shared/api/contracts/ai/constants';
import { formatQueryError } from '../../../../shared/api/client';
import { useSettingsAiModelsOverlayDeepLink } from '../../hooks/useSettingsAiModelsOverlayDeepLink';
import { APP_LIST_PREFERENCE_KEYS } from '../../../../shared/lib/listPreferenceKeys';
import { usePersistedListFilters } from '../../../../shared/lib/usePersistedListPreferences';
import {
  useAiSettingsQuery,
  useCreateAiModelMutation,
  useCreateAiProviderMutation,
  useDeleteAiModelMutation,
  useDeleteAiProviderMutation,
  useTestAiModelMutation,
  useTestAiProviderMutation,
  useUpdateAiGlobalSettingsMutation,
  useUpdateAiModelMutation,
  useUpdateAiProviderMutation,
} from '../../../../shared/api/queries/aiModels';
import {
  useUpdateAiAgentSettingsMutation,
  type AiAgentSettingsUpdate,
} from '../../../../shared/api/queries/aiAgentSettings';
import type { AiProviderDeleteTarget } from './AiProviderDeleteModal';
import { useSettingsFormT } from '../../hooks/useSettingsFormT';
import { useListPageToolbarScroll } from '../../../../shared/lib/useListPageToolbarScroll';
import { createAiModelsTreeGridColumns, renderAiModelsNodeLabel, type AiModelsTreeGridActions } from './aiModelsTreeGridColumns';
import {
  buildAiModelsTreeRows,
  buildDefaultExpandedById,
  parseProviderTreeRowId,
  type AiModelsTreeRow,
} from './aiModelsTree';
import {
  DEFAULT_AI_GLOBAL,
  EMPTY_AI_MODEL_FORM,
  EMPTY_AI_PROVIDER_FORM,
  providerRequiresAzureFields,
  slugifyModelId,
} from './constants';

type ToastState = { type: 'success' | 'error'; text: string } | null;

type AiModelsListFilters = {
  searchInput: string;
  showEnabledOnly: boolean;
};

const DEFAULT_AI_MODELS_FILTERS: AiModelsListFilters = {
  searchInput: '',
  showEnabledOnly: true,
};

function sanitizeAiModelsFilters(raw: unknown): AiModelsListFilters | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  return {
    searchInput: typeof record.searchInput === 'string' ? record.searchInput : '',
    showEnabledOnly: typeof record.showEnabledOnly === 'boolean' ? record.showEnabledOnly : true,
  };
}

const toGlobalDraft = (settings?: AiGlobalSettings | null): AiGlobalSettings => ({
  enabled: settings?.enabled ?? DEFAULT_AI_GLOBAL.enabled,
  defaultModelId: settings?.defaultModelId ?? DEFAULT_AI_GLOBAL.defaultModelId,
  chatRateLimitPerMinute: settings?.chatRateLimitPerMinute ?? DEFAULT_AI_GLOBAL.chatRateLimitPerMinute,
});

const toAgentDraft = (agent?: AiAgentSettings | null): AiAgentSettingsUpdate => ({
  contextSummarizeWithLlm: agent?.contextSummarizeWithLlm
    ?? DEFAULT_AI_AGENT_SETTINGS.contextSummarizeWithLlm
    ?? true,
});

const toProviderForm = (provider: AiProviderPublicConfig): AiProviderConfig => {
  const { hasApiKey: _hasApiKey, ...rest } = provider;
  return { ...rest, apiKey: '' };
};

const toModelPayload = (form: AiModelEntry, mode: 'create' | 'edit'): AiModelEntry => {
  const modelId = form.modelId.trim();
  return {
    ...form,
    modelId,
    name: modelId,
    id: mode === 'create' ? slugifyModelId(modelId) : form.id,
    note: undefined,
    maxOutputTokens: undefined,
    temperatureDefault: undefined,
  };
};

const validateModelForm = (
  form: AiModelEntry,
  mode: 'create' | 'edit',
  configuredProviderKinds: AiProviderKind[],
): string | null => {
  if (mode === 'create' && configuredProviderKinds.length === 0) {
    return 'Add at least one provider before creating a model.';
  }
  if (mode === 'create' && !configuredProviderKinds.includes(form.provider)) {
    return 'Choose a configured provider for this model.';
  }
  if (!form.modelId.trim()) return 'Model ID is required.';
  if (mode === 'create') {
    const id = slugifyModelId(form.modelId);
    if (!id) return 'Model ID must contain letters or numbers.';
  }
  if (providerRequiresAzureFields(form.provider)) {
    if (!form.deploymentName?.trim()) return 'Deployment name is required for Azure OpenAI.';
    if (!form.apiVersion?.trim()) return 'API version is required for Azure OpenAI.';
  }
  return null;
};

export function useAiModelsSection(options?: { enabled?: boolean }) {
  const t = useSettingsFormT();
  const enabled = options?.enabled ?? true;
  const settingsQuery = useAiSettingsQuery({ enabled });
  const updateGlobalMutation = useUpdateAiGlobalSettingsMutation();
  const updateAgentMutation = useUpdateAiAgentSettingsMutation();
  const createModelMutation = useCreateAiModelMutation();
  const updateModelMutation = useUpdateAiModelMutation();
  const deleteModelMutation = useDeleteAiModelMutation();
  const deleteProviderMutation = useDeleteAiProviderMutation();
  const testModelMutation = useTestAiModelMutation();
  const createProviderMutation = useCreateAiProviderMutation();
  const updateProviderMutation = useUpdateAiProviderMutation();
  const testProviderMutation = useTestAiProviderMutation();

  const settings = settingsQuery.data;
  const models = settings?.models ?? [];
  const providers = settings?.providers ?? [];

  const [globalDraft, setGlobalDraft] = useState<AiGlobalSettings>(DEFAULT_AI_GLOBAL);
  const [filters, setFilters] = usePersistedListFilters({
    listKey: APP_LIST_PREFERENCE_KEYS.aiModels,
    defaultFilters: DEFAULT_AI_MODELS_FILTERS,
    sanitize: sanitizeAiModelsFilters,
  });
  const { searchInput, showEnabledOnly } = filters;
  const setSearchInput = useCallback((next: string) => {
    setFilters((prev) => ({ ...prev, searchInput: next }));
  }, [setFilters]);
  const setShowEnabledOnly = useCallback((next: boolean) => {
    setFilters((prev) => ({ ...prev, showEnabledOnly: next }));
  }, [setFilters]);
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<ToastState>(null);

  const [showModelModal, setShowModelModal] = useState(false);
  const [modelModalMode, setModelModalMode] = useState<'create' | 'edit'>('create');
  const [modelForm, setModelForm] = useState<AiModelEntry>(EMPTY_AI_MODEL_FORM);
  const [modelFormError, setModelFormError] = useState<string | null>(null);

  const [showProviderModal, setShowProviderModal] = useState(false);
  const [providerModalMode, setProviderModalMode] = useState<'create' | 'edit'>('edit');
  const [providerForm, setProviderForm] = useState<AiProviderConfig>(EMPTY_AI_PROVIDER_FORM);
  const [providerHasStoredApiKey, setProviderHasStoredApiKey] = useState(false);
  const [providerFormError, setProviderFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<AiModelPublicEntry | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteProviderTarget, setDeleteProviderTarget] = useState<AiProviderDeleteTarget | null>(null);
  const [deleteProviderError, setDeleteProviderError] = useState<string | null>(null);
  const [deletingProvider, setDeletingProvider] = useState<string | null>(null);
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [settingDefaultModelId, setSettingDefaultModelId] = useState<string | null>(null);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [preferencesDraft, setPreferencesDraft] = useState<AiGlobalSettings>(DEFAULT_AI_GLOBAL);
  const [showAgentPreferencesModal, setShowAgentPreferencesModal] = useState(false);
  const [agentPreferencesDraft, setAgentPreferencesDraft] = useState<AiAgentSettingsUpdate>(toAgentDraft());

  const savedGlobal = useMemo(() => toGlobalDraft(settings), [settings]);
  const savedAgent = useMemo(() => toAgentDraft(settings?.agent), [settings?.agent]);

  useEffect(() => {
    setGlobalDraft(savedGlobal);
  }, [savedGlobal]);

  useEffect(() => {
    if (models.length === 0) return;
    setExpandedById((current) => (
      Object.keys(current).length > 0 ? current : buildDefaultExpandedById(models)
    ));
  }, [models]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const openPreferencesModal = useCallback(() => {
    setPreferencesDraft(savedGlobal);
    setShowPreferencesModal(true);
  }, [savedGlobal]);

  const openAgentPreferencesModal = useCallback(() => {
    setAgentPreferencesDraft(savedAgent);
    setShowAgentPreferencesModal(true);
  }, [savedAgent]);

  const savedDefaultModelId = settings?.defaultModelId ?? globalDraft.defaultModelId;

  const filteredModels = useMemo(() => {
    let result = showEnabledOnly
      ? models.filter((model) => model.enabled)
      : models;

    const needle = searchInput.trim().toLowerCase();
    if (!needle) return result;

    return result.filter((model) => (
      model.name.toLowerCase().includes(needle)
      || model.modelId.toLowerCase().includes(needle)
      || model.provider.toLowerCase().includes(needle)
      || (model.providerLabel || '').toLowerCase().includes(needle)
    ));
  }, [models, searchInput, showEnabledOnly]);

  const treeRows = useMemo(
    () => buildAiModelsTreeRows(providers, filteredModels, expandedById),
    [expandedById, filteredModels, providers],
  );

  const providerCount = useMemo(
    () => new Set(filteredModels.map((model) => model.provider)).size,
    [filteredModels],
  );

  const showToast = (type: ToastState['type'], text: string) => setToast({ type, text });

  const handleSavePreferences = useCallback(async () => {
    try {
      const { data, response } = await updateGlobalMutation.mutateAsync(preferencesDraft);
      if (!response.ok || !data.success) {
        const message = typeof data.error === 'string' ? data.error : 'Failed to save AI settings.';
        showToast('error', message);
        return;
      }
      setGlobalDraft(preferencesDraft);
      setShowPreferencesModal(false);
      showToast('success', 'Chat preferences saved.');
    } catch (error) {
      showToast('error', formatQueryError(error, 'Failed to save AI settings.'));
    }
  }, [preferencesDraft, updateGlobalMutation]);

  const handleSaveAgentPreferences = useCallback(async () => {
    try {
      const { data, response } = await updateAgentMutation.mutateAsync(agentPreferencesDraft);
      if (!response.ok || !data.success) {
        const message = typeof data.error === 'string' ? data.error : 'Failed to save agent settings.';
        showToast('error', message);
        return;
      }
      setShowAgentPreferencesModal(false);
      showToast('success', 'Agent context preferences saved.');
    } catch (error) {
      showToast('error', formatQueryError(error, 'Failed to save agent settings.'));
    }
  }, [agentPreferencesDraft, updateAgentMutation]);

  const toggleExpand = useCallback((row: AiModelsTreeRow) => {
    setExpandedById((current) => ({
      ...current,
      [row.id]: !(current[row.id] ?? true),
    }));
  }, []);

  const configuredProviderKinds = useMemo(
    () => providers.map((item) => item.provider),
    [providers],
  );

  const openCreateModal = useCallback(() => {
    const firstProvider = configuredProviderKinds[0] ?? EMPTY_AI_MODEL_FORM.provider;
    setModelModalMode('create');
    setModelForm({
      ...EMPTY_AI_MODEL_FORM,
      provider: firstProvider,
      providerLabel: getAiProviderLabel(firstProvider),
      capabilities: { ...EMPTY_AI_MODEL_FORM.capabilities },
    });
    setModelFormError(null);
    setShowModelModal(true);
  }, [configuredProviderKinds]);

  const openCreateProviderModal = useCallback(() => {
    const used = new Set(providers.map((item) => item.provider));
    const firstAvailable = AI_PROVIDER_SETUP_TEMPLATES.find((item) => !used.has(item.kind));
    setProviderModalMode('create');
    setProviderForm(
      firstAvailable
        ? buildAiProviderConfigFromTemplate(firstAvailable.id)
        : { ...EMPTY_AI_PROVIDER_FORM },
    );
    setProviderHasStoredApiKey(false);
    setProviderFormError(null);
    setShowProviderModal(true);
  }, [providers]);

  const openEditModelModal = useCallback((model: AiModelPublicEntry) => {
    setModelModalMode('edit');
    setModelForm({ ...model, capabilities: { ...model.capabilities } });
    setModelFormError(null);
    setShowModelModal(true);
  }, []);

  const openEditProviderModal = useCallback((row: AiModelsTreeRow) => {
    if (!row.provider) return;
    setProviderModalMode('edit');
    setProviderForm(toProviderForm(row.provider));
    setProviderHasStoredApiKey(row.provider.hasApiKey);
    setProviderFormError(null);
    setShowProviderModal(true);
  }, []);

  const handleTreeRowClick = useCallback((row: AiModelsTreeRow) => {
    if (row.kind === 'provider') {
      openEditProviderModal(row);
      return;
    }
    if (row.kind === 'model' && row.model) {
      openEditModelModal(row.model);
    }
  }, [openEditModelModal, openEditProviderModal]);

  const isTreeRowClickable = useCallback(
    (row: AiModelsTreeRow) => row.kind === 'provider' || row.kind === 'model',
    [],
  );

  const handleSaveModel = useCallback(async () => {
    const payload = toModelPayload(modelForm, modelModalMode);
    const validationError = validateModelForm(payload, modelModalMode, configuredProviderKinds);
    if (validationError) {
      setModelFormError(validationError);
      return;
    }

    setModelFormError(null);

    const { isDefault: _isDefault, ...modelPayload } = payload;

    try {
      if (modelModalMode === 'create') {
        const { data, response } = await createModelMutation.mutateAsync(modelPayload);
        if (!response.ok || !data.success) {
          setModelFormError(typeof data.error === 'string' ? data.error : 'Failed to create AI model.');
          return;
        }
        showToast('success', 'AI model created.');
      } else {
        const { data, response } = await updateModelMutation.mutateAsync({ id: payload.id, payload: modelPayload });
        if (!response.ok || !data.success) {
          setModelFormError(typeof data.error === 'string' ? data.error : 'Failed to update AI model.');
          return;
        }
        showToast('success', 'AI model updated.');
      }
      setShowModelModal(false);
    } catch (error) {
      setModelFormError(formatQueryError(error, 'Failed to save AI model.'));
    }
  }, [configuredProviderKinds, createModelMutation, modelForm, modelModalMode, updateModelMutation]);

  const handleSaveProvider = useCallback(async () => {
    setProviderFormError(null);

    if (
      providerModalMode === 'create'
      && configuredProviderKinds.includes(providerForm.provider)
    ) {
      setProviderFormError('This provider type is already configured. Edit the existing row or choose another template.');
      return;
    }

    const payload: AiProviderConfig = {
      ...providerForm,
      providerLabel: providerForm.providerLabel?.trim() || undefined,
      note: undefined,
      organizationId: undefined,
    };

    try {
      if (providerModalMode === 'create') {
        const { data, response } = await createProviderMutation.mutateAsync({
          provider: providerForm.provider,
          payload,
        });
        if (!response.ok || !data.success) {
          setProviderFormError(typeof data.error === 'string' ? data.error : 'Failed to add provider.');
          return;
        }
        showToast('success', 'Provider added.');
      } else {
        const { data, response } = await updateProviderMutation.mutateAsync({
          provider: providerForm.provider,
          payload,
        });
        if (!response.ok || !data.success) {
          setProviderFormError(typeof data.error === 'string' ? data.error : 'Failed to update provider credentials.');
          return;
        }
        showToast('success', 'Provider credentials saved.');
      }
      setShowProviderModal(false);
    } catch (error) {
      setProviderFormError(formatQueryError(
        error,
        providerModalMode === 'create' ? 'Failed to add provider.' : 'Failed to update provider credentials.',
      ));
    }
  }, [configuredProviderKinds, createProviderMutation, providerForm, providerModalMode, updateProviderMutation]);

  const handleTestModel = useCallback(async (model: AiModelPublicEntry) => {
    setTestingModelId(model.id);
    try {
      const result = await testModelMutation.mutateAsync(model.id);
      if (!result.success) {
        showToast('error', result.error || 'Connection test failed.');
        return;
      }
      showToast('success', result.message || 'Connection successful.');
    } catch (error) {
      showToast('error', formatQueryError(error, 'Connection test failed.'));
    } finally {
      setTestingModelId(null);
    }
  }, [testModelMutation]);

  const handleTestProvider = useCallback(async (row: AiModelsTreeRow) => {
    const providerKind = row.provider?.provider ?? parseProviderTreeRowId(row.id);
    if (!providerKind) return;

    setTestingProvider(providerKind);
    try {
      const result = await testProviderMutation.mutateAsync(providerKind);
      if (!result.success) {
        showToast('error', result.error || 'Connection test failed.');
        return;
      }
      showToast('success', result.message || 'Connection successful.');
    } catch (error) {
      showToast('error', formatQueryError(error, 'Connection test failed.'));
    } finally {
      setTestingProvider(null);
    }
  }, [testProviderMutation]);

  const handleSetDefaultModel = useCallback(async (model: AiModelPublicEntry) => {
    if (!model.enabled) {
      showToast('error', 'Enable the model before setting it as default.');
      return;
    }
    if (model.id === savedDefaultModelId) return;

    setSettingDefaultModelId(model.id);
    try {
      const payload: AiGlobalSettings = {
        ...savedGlobal,
        defaultModelId: model.id,
      };
      const { data, response } = await updateGlobalMutation.mutateAsync(payload);
      if (!response.ok || !data.success) {
        const message = typeof data.error === 'string' ? data.error : 'Failed to set default model.';
        showToast('error', message);
        return;
      }
      setGlobalDraft(payload);
      showToast('success', `"${model.modelId}" is now the default model.`);
    } catch (error) {
      showToast('error', formatQueryError(error, 'Failed to set default model.'));
    } finally {
      setSettingDefaultModelId(null);
    }
  }, [savedDefaultModelId, savedGlobal, updateGlobalMutation]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      const { data, response } = await deleteModelMutation.mutateAsync(deleteTarget.id);
      if (!response.ok || !data.success) {
        setDeleteError(typeof data.error === 'string' ? data.error : 'Failed to delete AI model.');
        return;
      }
      setDeleteTarget(null);
      showToast('success', 'AI model deleted.');
    } catch (error) {
      setDeleteError(formatQueryError(error, 'Failed to delete AI model.'));
    }
  }, [deleteModelMutation, deleteTarget]);

  const confirmDeleteProvider = useCallback(async () => {
    if (!deleteProviderTarget) return;
    setDeleteProviderError(null);
    setDeletingProvider(deleteProviderTarget.provider);
    try {
      const { data, response } = await deleteProviderMutation.mutateAsync(deleteProviderTarget.provider);
      if (!response.ok || !data.success) {
        setDeleteProviderError(typeof data.error === 'string' ? data.error : 'Failed to delete AI provider.');
        return;
      }
      setDeleteProviderTarget(null);
      showToast('success', 'AI provider deleted.');
    } catch (error) {
      setDeleteProviderError(formatQueryError(error, 'Failed to delete AI provider.'));
    } finally {
      setDeletingProvider(null);
    }
  }, [deleteProviderMutation, deleteProviderTarget]);

  const treeGridActions = useMemo<AiModelsTreeGridActions>(() => ({
    onTestProvider: (row) => { void handleTestProvider(row); },
    onSetDefaultModel: (row) => {
      if (row.model) void handleSetDefaultModel(row.model);
    },
    onTestModel: (row) => {
      if (row.model) void handleTestModel(row.model);
    },
    onDeleteModel: (row) => {
      if (row.model) setDeleteTarget(row.model);
    },
    onDeleteProvider: (row) => {
      const providerKind = row.provider?.provider ?? parseProviderTreeRowId(row.id);
      if (!providerKind) return;
      setDeleteProviderError(null);
      setDeleteProviderTarget({
        provider: providerKind,
        providerLabel: row.provider?.providerLabel,
        modelCount: models.filter((model) => model.provider === providerKind).length,
      });
    },
    testingProvider,
    testingModelId,
    settingDefaultModelId,
    deletingProvider,
  }), [
    handleSetDefaultModel,
    handleTestModel,
    handleTestProvider,
    models,
    testingModelId,
    testingProvider,
    settingDefaultModelId,
    deletingProvider,
  ]);

  const treeColumns = useMemo(
    () => createAiModelsTreeGridColumns(treeGridActions, t),
    [treeGridActions, t],
  );

  const getNodeLabel = useCallback(
    (row: AiModelsTreeRow) => renderAiModelsNodeLabel(row, savedDefaultModelId, treeGridActions, t),
    [savedDefaultModelId, treeGridActions, t],
  );

  const modelProviderBaseUrl = useMemo(
    () => providers.find((item) => item.provider === modelForm.provider)?.baseUrl,
    [modelForm.provider, providers],
  );

  const { listToolbarCollapsed, handleGridScroll: handleTreeScroll } = useListPageToolbarScroll();

  useSettingsAiModelsOverlayDeepLink({
    showModelModal,
    openCreateModal,
    showProviderModal,
    openCreateProviderModal,
    showPreferencesModal,
    openPreferencesModal,
    showAgentPreferencesModal,
    openAgentPreferencesModal,
    deleteTarget,
    deleteProviderTarget,
  });

  return {
    settingsQuery,
    models,
    providers,
    filteredModels,
    treeRows,
    expandedById,
    toggleExpand,
    providerCount,
    handleTreeRowClick,
    isTreeRowClickable,
    globalDraft,
    setGlobalDraft,
    searchInput,
    setSearchInput,
    showEnabledOnly,
    setShowEnabledOnly,
    showPreferencesModal,
    setShowPreferencesModal,
    preferencesDraft,
    setPreferencesDraft,
    openPreferencesModal,
    handleSavePreferences,
    isSavingPreferences: updateGlobalMutation.isPending,
    showAgentPreferencesModal,
    setShowAgentPreferencesModal,
    agentPreferencesDraft,
    setAgentPreferencesDraft,
    openAgentPreferencesModal,
    handleSaveAgentPreferences,
    isSavingAgentPreferences: updateAgentMutation.isPending,
    isSavingModel: createModelMutation.isPending || updateModelMutation.isPending,
    isSavingProvider: createProviderMutation.isPending || updateProviderMutation.isPending,
    providerModalMode,
    configuredProviderKinds,
    openCreateProviderModal,
    toast,
    showModelModal,
    setShowModelModal,
    modelModalMode,
    modelForm,
    setModelForm,
    modelProviderBaseUrl,
    modelFormError,
    openCreateModal,
    handleSaveModel,
    showProviderModal,
    setShowProviderModal,
    providerForm,
    setProviderForm,
    providerHasStoredApiKey,
    providerFormError,
    handleSaveProvider,
    deleteTarget,
    setDeleteTarget,
    deleteError,
    confirmDelete,
    deleteProviderTarget,
    setDeleteProviderTarget,
    deleteProviderError,
    confirmDeleteProvider,
    treeColumns,
    getNodeLabel,
    handleTreeScroll,
  };
}

export type AiModelsSectionModel = ReturnType<typeof useAiModelsSection>;
