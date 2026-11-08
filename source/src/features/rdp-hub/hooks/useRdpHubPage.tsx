import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useOptionalPortal } from '../../../app/platform/PortalContext';
import { usePlatformMount } from '../../../app/platform/PlatformMountContext';
import { formatQueryError } from '../../../shared/api/client';
import type {
  RdpHubConnectionPublic,
  RdpHubConnectionWritePayload,
  RdpHubSecurityMode,
} from '../../../shared/api/contracts/rdp-hub/types';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { usePersistedListFilters } from '../../../shared/lib/usePersistedListPreferences';
import { useRemoteHubOverlayDeepLink } from '../../../shared/routing/useRemoteHubOverlayDeepLink';
import {
  useCreateRdpHubConnectionMutation,
  useDeleteRdpHubConnectionMutation,
  useRdpHubConnectionsQuery,
  useUpdateRdpHubConnectionMutation,
} from '../../../shared/api/queries/rdp-hub';
import {
  buildRdpHubListRelativePath,
  findRdpHubConnectionByEditSlug,
  parseRdpHubEditSlug,
} from '../rdpHubRoute';
import {
  closeRdpHubSessionTab,
  createRdpHubSessionTab,
  type RdpHubSessionTab,
} from '../rdpHubTabTypes';

export type RdpHubSecurityFilter = 'ALL' | RdpHubSecurityMode;

type RdpHubListFilters = {
  searchQuery: string;
  securityFilter: RdpHubSecurityFilter;
};

const DEFAULT_FILTERS: RdpHubListFilters = {
  searchQuery: '',
  securityFilter: 'ALL',
};

function sanitizeFilters(raw: unknown): RdpHubListFilters | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const securityFilter = record.securityFilter === 'any'
    || record.securityFilter === 'nla'
    || record.securityFilter === 'tls'
    || record.securityFilter === 'rdp'
    || record.securityFilter === 'ALL'
    ? record.securityFilter
    : 'ALL';
  return {
    searchQuery: typeof record.searchQuery === 'string' ? record.searchQuery : '',
    securityFilter,
  };
}

export type RdpHubConnectionFormState = {
  name: string;
  host: string;
  port: string;
  username: string;
  domain: string;
  security: RdpHubSecurityMode;
  ignoreCert: boolean;
  password: string;
  tags: string[];
  note: string;
};

const emptyForm = (): RdpHubConnectionFormState => ({
  name: '',
  host: '',
  port: '3389',
  username: '',
  domain: '',
  security: 'nla',
  ignoreCert: true,
  password: '',
  tags: [],
  note: '',
});

export function useRdpHubPage() {
  const navigate = useNavigate();
  const { mountId, toMountPath } = usePlatformMount();
  const application = useOptionalPortal();
  const routeParamSuffix = useParams()['*'];
  const applicationSuffix = application?.pageRemainderPath.replace(/^\/+/, '') || undefined;
  const editSlugFromUrl = parseRdpHubEditSlug(applicationSuffix ?? routeParamSuffix);

  const catalogQuery = useRdpHubConnectionsQuery();
  const createMutation = useCreateRdpHubConnectionMutation();
  const updateMutation = useUpdateRdpHubConnectionMutation();
  const deleteMutation = useDeleteRdpHubConnectionMutation();

  const connections = catalogQuery.data ?? [];
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [settingsTarget, setSettingsTarget] = useState<RdpHubConnectionPublic | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RdpHubConnectionPublic | null>(null);
  const [form, setForm] = useState<RdpHubConnectionFormState>(emptyForm);
  const [sessionTabs, setSessionTabs] = useState<RdpHubSessionTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const seededEditSlugRef = useRef<string | null>(null);

  const [filters, setFilters] = usePersistedListFilters<RdpHubListFilters>({
    listKey: APP_LIST_PREFERENCE_KEYS.rdpHub,
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

  const setSecurityFilter = useCallback((value: RdpHubSecurityFilter) => {
    setFilters((prev) => ({ ...prev, securityFilter: value }));
  }, [setFilters]);

  const activeTab = sessionTabs.find((tab) => tab.id === activeTabId) ?? sessionTabs[0] ?? null;
  const activeConnection = useMemo(
    () => (activeTab
      ? connections.find((item) => item.id === activeTab.connectionId) ?? null
      : null),
    [activeTab, connections],
  );

  const openConnection = useCallback((connection: RdpHubConnectionPublic, options?: { additional?: boolean }) => {
    setSessionTabs((prev) => {
      if (!options?.additional) {
        const existing = prev.find((tab) => tab.connectionId === connection.id);
        if (existing) {
          setActiveTabId(existing.id);
          return prev;
        }
      }
      const tab = createRdpHubSessionTab(connection.id);
      setActiveTabId(tab.id);
      return [...prev, tab];
    });
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setSessionTabs((prev) => {
      const closed = closeRdpHubSessionTab(prev, tabId, activeTabId);
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
    if (!editSlugFromUrl || catalogQuery.isLoading) {
      return;
    }
    const match = findRdpHubConnectionByEditSlug(connections, editSlugFromUrl);
    if (!match) {
      navigate(toMountPath(buildRdpHubListRelativePath(mountId)), { replace: true });
      return;
    }
    if (seededEditSlugRef.current === editSlugFromUrl) {
      return;
    }
    seededEditSlugRef.current = editSlugFromUrl;
    openConnection(match);
    navigate(toMountPath(buildRdpHubListRelativePath(mountId)), { replace: true });
  }, [catalogQuery.isLoading, connections, editSlugFromUrl, mountId, navigate, openConnection, toMountPath]);

  const openCreate = useCallback(() => {
    setForm(emptyForm());
    setIsCreateOpen(true);
  }, []);

  const openSettings = useCallback((connection: RdpHubConnectionPublic) => {
    setForm({
      name: connection.name,
      host: connection.host,
      port: String(connection.port),
      username: connection.username,
      domain: connection.domain,
      security: connection.security,
      ignoreCert: connection.ignoreCert,
      password: '',
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

  const buildPayload = useCallback((): RdpHubConnectionWritePayload => {
    const payload: RdpHubConnectionWritePayload = {
      name: form.name,
      host: form.host,
      port: Number(form.port),
      username: form.username,
      domain: form.domain,
      security: form.security,
      ignoreCert: form.ignoreCert,
      tags: form.tags,
      note: form.note,
    };
    if (form.password) {
      payload.password = form.password;
    }
    return payload;
  }, [form]);

  const saveCreate = useCallback(async () => {
    try {
      const item = await createMutation.mutateAsync(buildPayload());
      closeForm();
      showToast('success', 'RDP connection created.');
      openConnection(item);
    } catch (error) {
      showToast('error', formatQueryError(error, 'Failed to create RDP connection.'));
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
      showToast('success', 'RDP connection updated.');
      openConnection(item);
    } catch (error) {
      showToast('error', formatQueryError(error, 'Failed to update RDP connection.'));
    }
  }, [buildPayload, closeForm, openConnection, settingsTarget, showToast, updateMutation]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      showToast('success', 'RDP connection deleted.');
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
      showToast('error', formatQueryError(error, 'Failed to delete RDP connection.'));
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
    securityFilter: filters.securityFilter,
    setSecurityFilter,
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

export type RdpHubPageState = ReturnType<typeof useRdpHubPage>;
