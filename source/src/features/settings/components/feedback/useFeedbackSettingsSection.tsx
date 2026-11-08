import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatQueryError } from '../../../../shared/api/client';
import type { PlatformFeedbackConfig } from '../../../../shared/api/contracts/feedback/types';
import { normalizePlatformFeedbackConfig } from '../../../../shared/api/contracts/feedback/normalizers';
import {
  useFeedbackSettingsConfigQuery,
  useSaveFeedbackSettingsConfigMutation,
} from '../../../../shared/api/queries/feedback';

export function useFeedbackSettingsSection(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const configQuery = useFeedbackSettingsConfigQuery(enabled);
  const saveMutation = useSaveFeedbackSettingsConfigMutation();

  const [savedConfig, setSavedConfig] = useState<PlatformFeedbackConfig | null>(null);
  const [draftConfig, setDraftConfig] = useState<PlatformFeedbackConfig | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!configQuery.data) return;
    const normalized = normalizePlatformFeedbackConfig(configQuery.data);
    setSavedConfig(normalized);
    setDraftConfig(normalized);
    setFormError(null);
  }, [configQuery.data]);

  const isDirty = useMemo(() => {
    if (!savedConfig || !draftConfig) return false;
    return JSON.stringify(savedConfig) !== JSON.stringify(draftConfig);
  }, [draftConfig, savedConfig]);

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!draftConfig) return false;
    setFormError(null);
    setIsSaving(true);
    try {
      const saved = await saveMutation.mutateAsync(draftConfig);
      const normalized = normalizePlatformFeedbackConfig(saved);
      setSavedConfig(normalized);
      setDraftConfig(normalized);
      return true;
    } catch (error) {
      setFormError(formatQueryError(error, 'Failed to save feedback settings.'));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [draftConfig, saveMutation]);

  const updateDraft = useCallback((updater: (current: PlatformFeedbackConfig) => PlatformFeedbackConfig) => {
    setDraftConfig((current) => (current ? updater(current) : current));
  }, []);

  return {
    isLoading: configQuery.isLoading,
    isError: configQuery.isError,
    loadError: configQuery.isError
      ? formatQueryError(configQuery.error, 'Failed to load feedback settings.')
      : null,
    retryLoad: configQuery.refetch,
    draftConfig,
    updateDraft,
    formError,
    isDirty,
    isSaving,
    handleSave,
  };
}

export type FeedbackSettingsSectionModel = ReturnType<typeof useFeedbackSettingsSection>;
