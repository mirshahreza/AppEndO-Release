import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatQueryError } from '../../../../shared/api/client';
import { isAiModelChatCapable } from '../../../../shared/api/contracts/ai/constants';
import {
  EUA_CAPABILITY_TOGGLE_LABELS,
  type EuaAssistSettings,
  normalizeEuaAssistSettings,
} from '../../../../shared/api/contracts/ai/euaAssistSettings';
import { EUA_CAPABILITY_KEYS } from '../../../../shared/api/contracts/ai/euaFieldAssist';
import type { AiModelEntry } from '../../../../shared/api/contracts/ai/types';
import { useAiSettingsQuery } from '../../../../shared/api/queries/aiModels';
import {
  useEuaSettingsQuery,
  useUpdateEuaSettingsMutation,
} from '../../../../shared/api/queries/euaFieldAssist';

export type EuaModelSelectOption = {
  id: string;
  label: string;
};

const sortModelsByName = (left: AiModelEntry, right: AiModelEntry) => (
  left.name.localeCompare(right.name)
);

const formatModelOptionLabel = (model: AiModelEntry, platformDefaultModelId: string): string => (
  model.id === platformDefaultModelId
    ? `${model.name} (Platform default)`
    : model.name
);

const buildTextModelOptions = (
  models: AiModelEntry[],
  platformDefaultModelId: string,
): EuaModelSelectOption[] => (
  models
    .filter((model) => model.enabled && isAiModelChatCapable(model))
    .sort(sortModelsByName)
    .map((model) => ({
      id: model.id,
      label: formatModelOptionLabel(model, platformDefaultModelId),
    }))
);

const buildVisionModelOptions = (
  models: AiModelEntry[],
  platformDefaultModelId: string,
): EuaModelSelectOption[] => (
  models
    .filter((model) => model.enabled && (model.capabilities.vision || model.capabilities.chat))
    .sort(sortModelsByName)
    .map((model) => ({
      id: model.id,
      label: formatModelOptionLabel(model, platformDefaultModelId),
    }))
);

const resolveStoredModelId = (
  storedId: string | undefined,
  options: EuaModelSelectOption[],
  platformDefaultModelId: string,
): string => {
  const trimmed = storedId?.trim();
  if (trimmed && options.some((option) => option.id === trimmed)) {
    return trimmed;
  }
  if (platformDefaultModelId && options.some((option) => option.id === platformDefaultModelId)) {
    return platformDefaultModelId;
  }
  return options[0]?.id ?? '';
};

const toStoredModelOverride = (
  selectedId: string,
  platformDefaultModelId: string,
): string | undefined => {
  const trimmed = selectedId.trim();
  if (!trimmed || trimmed === platformDefaultModelId) {
    return undefined;
  }
  return trimmed;
};

export function useEuaAssistSection(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const settingsQuery = useEuaSettingsQuery(enabled);
  const aiSettingsQuery = useAiSettingsQuery({ enabled });
  const updateMutation = useUpdateEuaSettingsMutation();

  const [saved, setSaved] = useState<EuaAssistSettings>(normalizeEuaAssistSettings(null));
  const [draft, setDraft] = useState<EuaAssistSettings>(normalizeEuaAssistSettings(null));
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!settingsQuery.data) {
      return;
    }
    const next = normalizeEuaAssistSettings(settingsQuery.data);
    setSaved(next);
    setDraft(next);
    setFormError(null);
  }, [settingsQuery.data]);

  const isDirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [draft, saved]);

  const handleSave = useCallback(async (): Promise<boolean> => {
    setFormError(null);
    setIsSaving(true);
    try {
      const next = await updateMutation.mutateAsync(draft);
      const normalized = normalizeEuaAssistSettings(next);
      setSaved(normalized);
      setDraft(normalized);
      return true;
    } catch (error) {
      setFormError(formatQueryError(error, 'Failed to save end-user AI settings.'));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [draft, updateMutation]);

  const setCapability = useCallback((key: typeof EUA_CAPABILITY_KEYS[number], value: boolean) => {
    setDraft((current) => ({
      ...current,
      capabilities: {
        ...current.capabilities,
        [key]: value,
      },
    }));
  }, []);

  const platformDefaultModelId = aiSettingsQuery.data?.defaultModelId?.trim() ?? '';
  const textModelOptions = useMemo(
    () => buildTextModelOptions(aiSettingsQuery.data?.models ?? [], platformDefaultModelId),
    [aiSettingsQuery.data?.models, platformDefaultModelId],
  );
  const visionModelOptions = useMemo(
    () => buildVisionModelOptions(aiSettingsQuery.data?.models ?? [], platformDefaultModelId),
    [aiSettingsQuery.data?.models, platformDefaultModelId],
  );

  const selectedTextModelId = useMemo(
    () => resolveStoredModelId(draft.defaultTextModelId, textModelOptions, platformDefaultModelId),
    [draft.defaultTextModelId, platformDefaultModelId, textModelOptions],
  );
  const selectedVisionModelId = useMemo(
    () => resolveStoredModelId(draft.defaultVisionModelId, visionModelOptions, platformDefaultModelId),
    [draft.defaultVisionModelId, platformDefaultModelId, visionModelOptions],
  );

  const setTextModelId = useCallback((modelId: string) => {
    setDraft((current) => ({
      ...current,
      defaultTextModelId: toStoredModelOverride(modelId, platformDefaultModelId),
    }));
  }, [platformDefaultModelId]);

  const setVisionModelId = useCallback((modelId: string) => {
    setDraft((current) => ({
      ...current,
      defaultVisionModelId: toStoredModelOverride(modelId, platformDefaultModelId),
    }));
  }, [platformDefaultModelId]);

  return {
    isLoading: settingsQuery.isLoading || aiSettingsQuery.isLoading,
    isSaving,
    isDirty,
    formError,
    draft,
    setDraft,
    setCapability,
    handleSave,
    capabilityKeys: EUA_CAPABILITY_KEYS,
    capabilityLabels: EUA_CAPABILITY_TOGGLE_LABELS,
    textModelOptions,
    visionModelOptions,
    selectedTextModelId,
    selectedVisionModelId,
    setTextModelId,
    setVisionModelId,
    modelsAvailable: textModelOptions.length > 0,
  };
}

export type EuaAssistSectionModel = ReturnType<typeof useEuaAssistSection>;
