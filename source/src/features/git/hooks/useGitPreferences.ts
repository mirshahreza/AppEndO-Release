import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatQueryError } from '../../../shared/api/client';
import {
  useGitSettingsQuery,
  useGitStatusQuery,
  useTestGitSettingsMutation,
  useUpdateGitSettingsMutation,
} from '../../../shared/api/queries/git';
import type { GitSettingsPublic } from '../../../shared/api/contracts/git/types';
import {
  createEmptyGitSettingsForm,
  toGitSettingsForm,
  toGitSettingsPayload,
  validateGitPreferencesForm,
  type GitSettingsFormState,
} from '../gitSettingsForm';

export function useGitPreferences(settings: GitSettingsPublic | undefined) {
  const settingsQuery = useGitSettingsQuery();
  const statusQuery = useGitStatusQuery();
  const updateMutation = useUpdateGitSettingsMutation();
  const testMutation = useTestGitSettingsMutation();

  const [savedForm, setSavedForm] = useState<GitSettingsFormState>(createEmptyGitSettingsForm());
  const [draftForm, setDraftForm] = useState<GitSettingsFormState>(createEmptyGitSettingsForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const syncFormsFromSettings = useCallback((source?: GitSettingsPublic) => {
    const data = source ?? settingsQuery.data;
    const status = statusQuery.data;
    if (!data) {
      return;
    }
    const next = toGitSettingsForm(data, status);
    setSavedForm(next);
    setDraftForm(next);
    setFormError(null);
  }, [settingsQuery.data, statusQuery.data]);

  useEffect(() => {
    if (settings) {
      syncFormsFromSettings(settings);
    }
  }, [settings, syncFormsFromSettings]);

  const isDirty = useMemo(
    () => JSON.stringify(savedForm) !== JSON.stringify(draftForm),
    [draftForm, savedForm],
  );

  const handleSave = useCallback(async (): Promise<boolean> => {
    const validationError = validateGitPreferencesForm(draftForm);
    if (validationError) {
      setFormError(validationError);
      return false;
    }

    setFormError(null);
    setIsSaving(true);
    try {
      const saved = await updateMutation.mutateAsync(toGitSettingsPayload(draftForm));
      const next = toGitSettingsForm(saved, statusQuery.data);
      setSavedForm(next);
      setDraftForm(next);
      await statusQuery.refetch();
      return true;
    } catch (error) {
      setFormError(formatQueryError(error, 'Failed to save git preferences.'));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [draftForm, statusQuery, updateMutation]);

  const handleTest = useCallback(async () => {
    const validationError = validateGitPreferencesForm(draftForm);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setFormError(null);
    setIsTesting(true);
    try {
      const result = await testMutation.mutateAsync(toGitSettingsPayload(draftForm));
      setTestMessage({
        type: result.success ? 'success' : 'error',
        text: result.message,
      });
      window.setTimeout(() => setTestMessage(null), 3200);
      if (result.success) {
        await statusQuery.refetch();
      }
    } catch (error) {
      setFormError(formatQueryError(error, 'Failed to test git connection.'));
    } finally {
      setIsTesting(false);
    }
  }, [draftForm, statusQuery, testMutation]);

  return {
    draftForm,
    setDraftForm,
    formError,
    isDirty,
    isSaving,
    isTesting,
    testMessage,
    handleSave,
    handleTest,
    resetFromSettings: syncFormsFromSettings,
  };
}

export type GitPreferencesModel = ReturnType<typeof useGitPreferences>;
