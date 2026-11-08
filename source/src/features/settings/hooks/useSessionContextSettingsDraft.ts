import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildRecordScopeSourceEntries,
  buildShellIdentitySourceEntries,
  buildSystemCapabilitySourceEntries,
  parseProfileSessionSourceId,
  parseUserAccountSessionSourceId,
  SESSION_CONTEXT_SYSTEM_ACCOUNT_FIELD_SET,
  SESSION_CONTEXT_SYSTEM_PROFILE_FIELD_SET,
  type SessionContextSourceEntry,
  type SessionContextSourceGroup,
} from '../../../shared/api/contracts/settings/sessionContext';
import {
  useSaveSessionContextSettingsMutation,
  useSessionContextSettingsQuery,
} from '../../../shared/api/queries/sessionContextSettings';

const SHELL_IDENTITY_GROUP: SessionContextSourceGroup = {
  id: 'shell_identity',
  title: 'Shell identity (system)',
  description:
    'Always on for the studio header. Username, email, first name, last name, and profile image stay locked with Server and Client checked.',
  entries: buildShellIdentitySourceEntries(),
};

const SYSTEM_GROUP: SessionContextSourceGroup = {
  id: 'system',
  title: 'System (built-in)',
  description: 'Always included. Administrators cannot change these channels.',
  entries: buildSystemCapabilitySourceEntries(),
};

const RECORD_SCOPE_GROUP: SessionContextSourceGroup = {
  id: 'record_scope',
  title: 'Record scope (system)',
  description:
    'Built-in org / geo memberships. Always on server context for Record Policy.',
  entries: buildRecordScopeSourceEntries(),
};

const isSystemOwnedSource = (entry: SessionContextSourceEntry): boolean => {
  if (entry.kind === 'shell_identity' || entry.kind === 'system' || entry.kind === 'record_scope') {
    return true;
  }
  if (entry.id.startsWith('system:')) return true;
  const accountField = parseUserAccountSessionSourceId(entry.id);
  if (accountField && SESSION_CONTEXT_SYSTEM_ACCOUNT_FIELD_SET.has(accountField)) return true;
  const profileField = parseProfileSessionSourceId(entry.id);
  if (profileField && SESSION_CONTEXT_SYSTEM_PROFILE_FIELD_SET.has(profileField)) return true;
  return false;
};

/** Canonical locked groups win — never trust a stale API payload for shell identity ticks. */
export const withCanonicalSessionContextGroups = (
  groups: SessionContextSourceGroup[],
): SessionContextSourceGroup[] => {
  const rest = groups
    .filter((group) => (
      group.id !== 'system'
      && group.id !== 'shell_identity'
      && group.id !== 'record_scope'
    ))
    .map((group) => ({
      ...group,
      entries: group.entries
        .filter((entry) => !isSystemOwnedSource(entry))
        .map((entry) => ({ ...entry })),
    }));

  return [
    {
      ...SHELL_IDENTITY_GROUP,
      entries: SHELL_IDENTITY_GROUP.entries.map((entry) => ({ ...entry })),
    },
    {
      ...SYSTEM_GROUP,
      entries: SYSTEM_GROUP.entries.map((entry) => ({ ...entry })),
    },
    {
      ...RECORD_SCOPE_GROUP,
      entries: RECORD_SCOPE_GROUP.entries.map((entry) => ({ ...entry })),
    },
    ...rest,
  ];
};

const cloneGroups = (groups: SessionContextSourceGroup[]): SessionContextSourceGroup[] =>
  withCanonicalSessionContextGroups(groups).map((group) => ({
    ...group,
    entries: group.entries.map((entry) => ({ ...entry })),
  }));

const flattenEntries = (groups: SessionContextSourceGroup[]): SessionContextSourceEntry[] =>
  groups.flatMap((group) => group.entries);

const isDirtyGroups = (
  saved: SessionContextSourceGroup[],
  draft: SessionContextSourceGroup[],
): boolean => {
  const savedMap = new Map(flattenEntries(saved).map((entry) => [entry.id, entry]));
  for (const entry of flattenEntries(draft)) {
    if (entry.locked) continue;
    const original = savedMap.get(entry.id);
    if (!original) return true;
    if (original.server !== entry.server || original.client !== entry.client) {
      return true;
    }
  }
  const draftEditable = flattenEntries(draft).filter((entry) => !entry.locked);
  const savedEditable = flattenEntries(saved).filter((entry) => !entry.locked);
  return draftEditable.length !== savedEditable.length;
};

export function useSessionContextSettingsDraft(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const settingsQuery = useSessionContextSettingsQuery({ enabled });
  const saveMutation = useSaveSessionContextSettingsMutation();
  const [draftGroups, setDraftGroups] = useState<SessionContextSourceGroup[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const savedGroups = useMemo(
    () => cloneGroups(settingsQuery.data ?? []),
    [settingsQuery.data],
  );

  useEffect(() => {
    setDraftGroups(cloneGroups(savedGroups));
  }, [savedGroups]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const isDirty = isDirtyGroups(savedGroups, draftGroups);
  const isSaving = saveMutation.isPending;

  const updateEntry = useCallback((
    entryId: string,
    patch: Partial<Pick<SessionContextSourceEntry, 'server' | 'client'>>,
  ) => {
    setDraftGroups((current) => current.map((group) => ({
      ...group,
      entries: group.entries.map((entry) => {
        if (entry.id !== entryId || entry.locked) return entry;
        return { ...entry, ...patch };
      }),
    })));
  }, []);

  const handleReset = useCallback(() => {
    setDraftGroups(cloneGroups(savedGroups));
    setSaveError(null);
  }, [savedGroups]);

  const handleSave = useCallback(async (): Promise<boolean> => {
    setSaveError(null);
    try {
      const payload = {
        entries: flattenEntries(draftGroups)
          .filter((entry) => !entry.locked)
          .map((entry) => ({
            id: entry.id,
            server: entry.server,
            client: entry.client,
          })),
      };
      const { data, response } = await saveMutation.mutateAsync(payload);
      if (!response.ok || !data.success) {
        const errorText = (data as unknown as { error?: string }).error;
        const message = typeof errorText === 'string' && errorText.trim()
          ? errorText
          : 'Failed to save session context settings.';
        setSaveError(message);
        setToast({ type: 'error', text: message });
        return false;
      }
      setToast({ type: 'success', text: 'Session context settings saved.' });
      return true;
    } catch (error) {
      const message = error instanceof Error && error.message.trim()
        ? error.message
        : 'Failed to save session context settings.';
      setSaveError(message);
      setToast({ type: 'error', text: message });
      return false;
    }
  }, [draftGroups, saveMutation]);

  return {
    settingsQuery,
    draftGroups,
    saveError,
    toast,
    isDirty,
    isSaving,
    updateEntry,
    handleReset,
    handleSave,
  };
}

export type SessionContextSettingsDraftModel = ReturnType<typeof useSessionContextSettingsDraft>;
