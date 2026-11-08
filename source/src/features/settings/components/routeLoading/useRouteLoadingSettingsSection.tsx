import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatQueryError } from '../../../../shared/api/client';
import type { PlatformRouteLoadingConfig } from '../../../../shared/api/contracts/routeLoading/schema';
import {
  normalizePlatformRouteLoadingConfig,
  resolveEffectiveRouteLoadingExperience,
} from '../../../../shared/api/contracts/routeLoading/normalizers';
import {
  useRouteLoadingSettingsConfigQuery,
  useSaveRouteLoadingSettingsConfigMutation,
} from '../../../../shared/api/queries/routeLoading';

export function useRouteLoadingSettingsSection(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const configQuery = useRouteLoadingSettingsConfigQuery(enabled);
  const saveMutation = useSaveRouteLoadingSettingsConfigMutation();

  const [savedConfig, setSavedConfig] = useState<PlatformRouteLoadingConfig | null>(null);
  const [draftConfig, setDraftConfig] = useState<PlatformRouteLoadingConfig | null>(null);
  const [previewVariant, setPreviewVariant] = useState<'fullscreen' | 'embedded'>('fullscreen');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!configQuery.data) return;
    const normalized = normalizePlatformRouteLoadingConfig(configQuery.data);
    setSavedConfig(normalized);
    setDraftConfig(normalized);
    setFormError(null);
  }, [configQuery.data]);

  const isDirty = useMemo(() => {
    if (!savedConfig || !draftConfig) return false;
    return JSON.stringify(savedConfig) !== JSON.stringify(draftConfig);
  }, [draftConfig, savedConfig]);

  const previewExperience = useMemo(() => {
    if (!draftConfig) return null;
    return resolveEffectiveRouteLoadingExperience(draftConfig, previewVariant);
  }, [draftConfig, previewVariant]);

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!draftConfig) return false;
    setFormError(null);
    setIsSaving(true);
    try {
      const saved = await saveMutation.mutateAsync(draftConfig);
      const normalized = normalizePlatformRouteLoadingConfig(saved);
      setSavedConfig(normalized);
      setDraftConfig(normalized);
      return true;
    } catch (error) {
      setFormError(formatQueryError(error, 'Failed to save route loading settings.'));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [draftConfig, saveMutation]);

  const updateDraft = useCallback((updater: (current: PlatformRouteLoadingConfig) => PlatformRouteLoadingConfig) => {
    setDraftConfig((current) => (current ? updater(current) : current));
  }, []);

  return {
    isLoading: configQuery.isLoading,
    isError: configQuery.isError,
    loadError: configQuery.isError
      ? formatQueryError(configQuery.error, 'Failed to load route loading settings.')
      : null,
    retryLoad: configQuery.refetch,
    draftConfig,
    updateDraft,
    previewVariant,
    setPreviewVariant,
    previewExperience,
    formError,
    isDirty,
    isSaving,
    handleSave,
  };
}

export type RouteLoadingSettingsSectionModel = ReturnType<typeof useRouteLoadingSettingsSection>;
