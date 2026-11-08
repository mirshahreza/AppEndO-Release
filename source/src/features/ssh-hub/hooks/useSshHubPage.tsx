import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useOptionalPortal } from '../../../app/platform/PortalContext';
import { usePlatformMount } from '../../../app/platform/PlatformMountContext';
import { formatQueryError } from '../../../shared/api/client';
import type { SshHubAuthMethod, SshHubConnectionPublic, SshHubConnectionWritePayload } from '../../../shared/api/contracts/ssh-hub/types';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { usePersistedListFilters } from '../../../shared/lib/usePersistedListPreferences';
import { useRemoteHubOverlayDeepLink } from '../../../shared/routing/useRemoteHubOverlayDeepLink';
import {
  useCreateSshHubConnectionMutation,
  useDeleteSshHubConnectionMutation,
  useSshHubConnectionsQuery,
  useUpdateSshHubConnectionMutation,
} from '../../../shared/api/queries/ssh-hub';
import {
  buildSshHubListRelativePath,
  findSshHubConnectionByEditSlug,
  parseSshHubEditSlug,
  shouldLeaveSshHubEditor,
} from '../sshHubRoute';
import {
  closeSshHubSessionTab,
  createSshHubSessionTab,
  type SshHubSessionTab,
} from '../sshHubTabTypes';

export type SshHubAuthFilter = 'ALL' | SshHubAuthMethod;

type SshHubListFilters = {
  searchQuery: string;
  authFilter: SshHubAuthFilter;
};

const DEFAULT_FILTERS: SshHubListFilters = {
  searchQuery: '',
  authFilter: 'ALL',
};

function sanitizeFilters(raw: unknown): SshHubListFilters | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const authFilter = record.authFilter === 'password' || record.authFilter === 'privateKey' || record.authFilter === 'ALL'
    ? record.authFilter
    : 'ALL';
  return {
    searchQuery: typeof record.searchQuery === 'string' ? record.searchQuery : '',
    authFilter,
  };
}

export type SshHubConnectionFormState = {
  name: string;
  host: string;
  port: string;
  username: string;
  authMethod: SshHubAuthMethod;
  password: string;
  privateKey: string;
  passphrase: string;
  initialPath: string;
  tags: string[];
  note: string;
};

const emptyForm = (): SshHubConnectionFormState => ({
  name: '',
  host: '',
  port: '22',
  username: '',
  authMethod: 'password',
  password: '',
  privateKey: '',
  passphrase: '',
  initialPath: '',
  tags: [],
  note: '',
});

export function useSshHubPage() {
  const navigate = useNavigate();
  const { mountId, toMountPath } = usePlatformMount();
  const application = useOptionalPortal();
  const routeParamSuffix = useParams()['*'];
  const applicationSuffix = application?.pageRemainderPath.replace(/^\/+/, '') || undefined;
  const editSlugFromUrl = parseSshHubEditSlug(applicationSuffix ?? routeParamSuffix);

  const catalogQuery = useSshHubConnectionsQuery();
  const createMutation = useCreateSshHubConnectionMutation();
  const updateMutation = useUpdateSshHubConnectionMutation();
  const deleteMutation = useDeleteSshHubConnectionMutation();

  const connections = catalogQuery.data ?? [];
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [settingsTarget, setSettingsTarget] = useState<SshHubConnectionPublic | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SshHubConnectionPublic | null>(null);
  const [form, setForm] = useState<SshHubConnectionFormState>(emptyForm);
  const [sessionTabs, setSessionTabs] = useState<SshHubSessionTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const seededEditSlugRef = useRef<string | null>(null);

  const [filters, setFilters] = usePersistedListFilters<SshHubListFilters>({
    listKey: APP_LIST_PREFERENCE_KEYS.sshHub,
    defaultFilters: DEFAULT_FILTERS,
    sanitize: sanitizeFilters,
  });

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text });
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const setSearchQuery = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, searchQuery: value }));
  }, [setFilters]);

  const setAuthFilter = useCallback((value: SshHubAuthFilter) => {
    setFilters((prev) => ({ ...prev, authFilter: value }));
  }, [setFilters]);

  const activeTab = sessionTabs.find((tab) => tab.id === activeTabId) ?? sessionTabs[0] ?? null;
  const activeConnection = useMemo(
    () => (activeTab
      ? connections.find((item) => item.id === activeTab.connectionId) ?? null
      : null),
    [activeTab, connections],
  );

  const openConnection = useCallback((connection: SshHubConnectionPublic, options?: { additional?: boolean }) => {
    setSessionTabs((prev) => {
      if (!options?.additional) {
        const existing = prev.find((tab) => tab.connectionId === connection.id);
        if (existing) {
          setActiveTabId(existing.id);
          return prev;
        }
      }
      const tab = createSshHubSessionTab(connection.id);
      setActiveTabId(tab.id);
      return [...prev, tab];
    });
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setSessionTabs((prev) => {
      const closed = closeSshHubSessionTab(prev, tabId, activeTabId);
      setActiveTabId(closed.activeTabId);
      return closed.tabs;
    });
  }, [activeTabId]);

  const closeEditor = useCallback(() => {
    if (activeTabId) {
      closeTab(activeTabId);
    }
  }, [activeTabId, closeTab]);

  useEffect(() => {
    if (shouldLeaveSshHubEditor({
      editSlug: editSlugFromUrl,
      isCatalogPending: catalogQuery.isLoading || catalogQuery.isFetching,
      connections,
    })) {
      navigate(toMountPath(buildSshHubListRelativePath(mountId)), { replace: true });
      return;
    }
    if (!editSlugFromUrl || catalogQuery.isLoading) {
      return;
    }
    const match = findSshHubConnectionByEditSlug(connections, editSlugFromUrl);
    if (!match || seededEditSlugRef.current === editSlugFromUrl) {
      return;
    }
    seededEditSlugRef.current = editSlugFromUrl;
    openConnection(match);
    navigate(toMountPath(buildSshHubListRelativePath(mountId)), { replace: true });
  }, [catalogQuery.isFetching, catalogQuery.isLoading, connections, editSlugFromUrl, mountId, navigate, openConnection, toMountPath]);

  const openCreate = useCallback(() => {
    setForm(emptyForm());
    setIsCreateOpen(true);
  }, []);

  const openSettings = useCallback((connection: SshHubConnectionPublic) => {
    setForm({
      name: connection.name,
      host: connection.host,
      port: String(connection.port),
      username: connection.username,
      authMethod: connection.authMethod,
      password: '',
      privateKey: '',
      passphrase: '',
      initialPath: connection.initialPath,
      tags: [...connection.tags],
      note: connection.note,
    });
    setSettingsTarget(connection);
  }, []);

  const closeForm = useCallback(() => {
    setIsCreateOpen(false);
    setSettingsTarget(null);
    setForm(emptyForm());
  }, []);

  const buildPayload = useCallback((): SshHubConnectionWritePayload => {
    const payload: SshHubConnectionWritePayload = {
      name: form.name,
      host: form.host,
      port: Number(form.port),
      username: form.username,
      authMethod: form.authMethod,
      initialPath: form.initialPath,
      tags: form.tags,
      note: form.note,
    };
    if (form.authMethod === 'password' && form.password) {
      payload.password = form.password;
    }
    if (form.authMethod === 'privateKey' && form.privateKey.trim()) {
      payload.privateKey = form.privateKey;
    }
    if (form.authMethod === 'privateKey' && form.passphrase) {
      payload.passphrase = form.passphrase;
    }
    return payload;
  }, [form]);

  const saveCreate = useCallback(async () => {
    try {
      const item = await createMutation.mutateAsync(buildPayload());
      closeForm();
      showToast('success', 'SSH connection created.');
      openConnection(item);
    } catch (error) {
      showToast('error', formatQueryError(error, 'Failed to create SSH connection.'));
    }
  }, [buildPayload, closeForm, createMutation, openConnection, showToast]);

  const saveSettings = useCallback(async () => {
    if (!settingsTarget) {
      return;
    }
    try {
      const item = await updateMutation.mutateAsync({
        id: settingsTarget.id,
        payload: buildPayload(),
      });
      closeForm();
      showToast('success', 'SSH connection updated.');
      openConnection(item);
    } catch (error) {
      showToast('error', formatQueryError(error, 'Failed to update SSH connection.'));
    }
  }, [buildPayload, closeForm, openConnection, settingsTarget, showToast, updateMutation]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      showToast('success', 'SSH connection deleted.');
      setSessionTabs((prev) => {
        const remaining = prev.filter((tab) => tab.connectionId !== deleteTarget.id);
        if (remaining.length === 0) {
          setActiveTabId(null);
          return remaining;
        }
        if (!remaining.some((tab) => tab.id === activeTabId)) {
          setActiveTabId(remaining[0]!.id);
        }
        return remaining;
      });
    } catch (error) {
      showToast('error', formatQueryError(error, 'Failed to delete SSH connection.'));
    }
  }, [activeTabId, deleteMutation, deleteTarget, showToast]);

  useRemoteHubOverlayDeepLink({
    createOpen: isCreateOpen,
    setCreateOpen: setIsCreateOpen,
    editConnectionKey: settingsTarget?.key ?? null,
    openEditConnection: (key) => {
      const match = connections.find((item) => item.key === key);
      if (match) {
        openSettings(match);
      }
    },
  });

  return {
    connections,
    isCatalogLoading: catalogQuery.isLoading,
    isCatalogFetching: catalogQuery.isFetching,
    onRefreshCatalog: () => {
      void catalogQuery.refetch();
    },
    searchQuery: filters.searchQuery,
    setSearchQuery,
    authFilter: filters.authFilter,
    setAuthFilter,
    sessionTabs,
    activeTabId,
    setActiveTabId,
    closeTab,
    editSlugFromUrl,
    activeConnection,
    openConnection,
    closeEditor,
    toast,
    isCreateOpen,
    openCreate,
    settingsTarget,
    openSettings,
    closeForm,
    form,
    setForm,
    saveCreate,
    saveSettings,
    isSaving: createMutation.isPending || updateMutation.isPending,
    deleteTarget,
    setDeleteTarget,
    confirmDelete,
    isDeleting: deleteMutation.isPending,
  };
}

export type SshHubPageState = ReturnType<typeof useSshHubPage>;
