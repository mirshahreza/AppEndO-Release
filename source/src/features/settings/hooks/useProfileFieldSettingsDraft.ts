import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useProfileFieldSettingsQuery,
  useSaveProfileFieldSettingsMutation,
} from '../../../shared/api/queries/profileFieldsSettings';
import {
  buildSavePayload,
  isDirtyRows,
  toDraftRow,
  type ProfileFieldDraftRow,
} from '../components/profileFields/constants';

export function useProfileFieldSettingsDraft(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const settingsQuery = useProfileFieldSettingsQuery({ enabled });
  const saveMutation = useSaveProfileFieldSettingsMutation();
  const [draftRows, setDraftRows] = useState<ProfileFieldDraftRow[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const savedRows = useMemo(
    () => (settingsQuery.data ?? []).map(toDraftRow),
    [settingsQuery.data],
  );

  useEffect(() => {
    setDraftRows(savedRows);
  }, [savedRows]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const isDirty = isDirtyRows(savedRows, draftRows);
  const isSaving = saveMutation.isPending;

  const updateRow = useCallback((profileField: string, patch: Partial<ProfileFieldDraftRow>) => {
    setDraftRows((current) => current.map((row) => (
      row.profileField === profileField ? { ...row, ...patch } : row
    )));
  }, []);

  const handleReset = useCallback(() => {
    setDraftRows(savedRows);
    setSaveError(null);
  }, [savedRows]);

  const handleSave = useCallback(async (): Promise<boolean> => {
    setSaveError(null);
    try {
      const { data, response } = await saveMutation.mutateAsync(buildSavePayload(draftRows));
      if (!response.ok || !data.success) {
        const message = typeof data.error === 'string' && data.error.trim()
          ? data.error
          : 'Failed to save profile field settings.';
        setSaveError(message);
        setToast({ type: 'error', text: message });
        return false;
      }
      setToast({ type: 'success', text: 'Profile field settings saved.' });
      return true;
    } catch (error) {
      const message = error instanceof Error && error.message.trim()
        ? error.message
        : 'Failed to save profile field settings.';
      setSaveError(message);
      setToast({ type: 'error', text: message });
      return false;
    }
  }, [draftRows, saveMutation]);

  return {
    settingsQuery,
    draftRows,
    saveError,
    toast,
    isDirty,
    isSaving,
    updateRow,
    handleReset,
    handleSave,
  };
}

export type ProfileFieldSettingsDraftModel = ReturnType<typeof useProfileFieldSettingsDraft>;
