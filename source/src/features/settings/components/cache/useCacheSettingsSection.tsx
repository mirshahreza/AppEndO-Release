import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatQueryError } from '../../../../shared/api/client';
import {
  useCacheSettingsQuery,
  useTestCacheSettingsMutation,
  useUpdateCacheSettingsMutation,
} from '../../../../shared/api/queries/cache';
import {
  createEmptyCacheSettingsForm,
  toCacheSettingsForm,
  toCacheSettingsPayload,
  validateCacheSettingsForm,
  type CacheSettingsFormState,
} from '../../../cache/cacheSettingsForm';

export function useCacheSettingsSection(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const settingsQuery = useCacheSettingsQuery({ enabled });
  const updateMutation = useUpdateCacheSettingsMutation();
  const testMutation = useTestCacheSettingsMutation();

  const [savedForm, setSavedForm] = useState<CacheSettingsFormState>(createEmptyCacheSettingsForm());
  const [draftForm, setDraftForm] = useState<CacheSettingsFormState>(createEmptyCacheSettingsForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!settingsQuery.data) {
      return;
    }
    const next = toCacheSettingsForm(settingsQuery.data);
    setSavedForm(next);
    setDraftForm(next);
    setFormError(null);
  }, [settingsQuery.data]);

  const isDirty = useMemo(
    () => JSON.stringify(savedForm) !== JSON.stringify(draftForm),
    [draftForm, savedForm],
  );

  const handleSave = useCallback(async (): Promise<boolean> => {
    const validationError = validateCacheSettingsForm(draftForm);
    if (validationError) {
      setFormError(validationError);
      return false;
    }

    setFormError(null);
    setIsSaving(true);
    try {
      const saved = await updateMutation.mutateAsync(toCacheSettingsPayload(draftForm));
      const next = toCacheSettingsForm(saved);
      setSavedForm(next);
      setDraftForm(next);
      return true;
    } catch (error) {
      setFormError(formatQueryError(error, 'Failed to save cache settings.'));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [draftForm, updateMutation]);

  const showTestToast = useCallback((type: 'success' | 'error', text: string) => {
    setTestMessage({ type, text });
    window.setTimeout(() => setTestMessage(null), 3200);
  }, []);

  const handleTest = useCallback(async () => {
    const validationError = validateCacheSettingsForm(draftForm);
    if (validationError) {
      showTestToast('error', validationError);
      return;
    }

    setFormError(null);
    setIsTesting(true);
    try {
      const result = await testMutation.mutateAsync(toCacheSettingsPayload(draftForm));
      showTestToast(result.success ? 'success' : 'error', result.message);
    } catch (error) {
      showTestToast('error', formatQueryError(error, 'Failed to test cache settings.'));
    } finally {
      setIsTesting(false);
    }
  }, [draftForm, showTestToast, testMutation]);

  return {
    isLoading: settingsQuery.isLoading,
    isError: settingsQuery.isError,
    loadError: settingsQuery.isError
      ? formatQueryError(settingsQuery.error, 'Failed to load cache settings.')
      : null,
    retryLoad: settingsQuery.refetch,
    draftForm,
    setDraftForm,
    formError,
    isDirty,
    isSaving,
    isTesting,
    handleSave,
    handleTest,
    testMessage,
  };
}

export type CacheSettingsSectionModel = ReturnType<typeof useCacheSettingsSection>;
