import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useOptionalPortal } from '../../../app/platform/PortalContext';
import { usePlatformMount } from '../../../app/platform/PlatformMountContext';
import { formatQueryError } from '../../../shared/api/client';
import type {
  FileHubAuthMethod,
  FileHubConnectionPublic,
  FileHubConnectionWritePayload,
  FileHubProtocol,
} from '../../../shared/api/contracts/file-hub/types';
import {
  FILE_HUB_DEFAULT_PORTS,
  parseFileHubPort,
  protocolAllowsPrivateKey,
  validateFileHubDisplayName,
  validateFileHubHost,
  validateFileHubUsername,
} from '../../../shared/api/contracts/file-hub/validation';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { usePersistedListFilters } from '../../../shared/lib/usePersistedListPreferences';
import { useRemoteHubOverlayDeepLink } from '../../../shared/routing/useRemoteHubOverlayDeepLink';
import {
  useCreateFileHubConnectionMutation,
  useDeleteFileHubConnectionMutation,
  useFileHubConnectionsQuery,
  useUpdateFileHubConnectionMutation,
} from '../../../shared/api/queries/file-hub';
import {
  buildFileHubListRelativePath,
  findFileHubConnectionByEditSlug,
  parseFileHubEditSlug,
} from '../fileHubRoute';
import {
  closeFileHubSessionTab,
  createFileHubSessionTab,
  type FileHubSessionTab,
} from '../fileHubTabTypes';

export type FileHubProtocolFilter = 'ALL' | FileHubProtocol;

type FileHubListFilters = {
  searchQuery: string;
  protocolFilter: FileHubProtocolFilter;
};

const DEFAULT_FILTERS: FileHubListFilters = {
  searchQuery: '',
  protocolFilter: 'ALL',
};

function sanitizeFilters(raw: unknown): FileHubListFilters | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const protocolFilter = record.protocolFilter === 'sftp'
    || record.protocolFilter === 'ftp'
    || record.protocolFilter === 'ftps'
    || record.protocolFilter === 'ALL'
    ? record.protocolFilter
    : 'ALL';
  return {
    searchQuery: typeof record.searchQuery === 'string' ? record.searchQuery : '',
    protocolFilter,
  };
}

export type FileHubConnectionFormState = {
  name: string;
  protocol: FileHubProtocol;
  host: string;
  port: string;
  username: string;
  authMethod: FileHubAuthMethod;
  password: string;
  privateKey: string;
  passphrase: string;
  initialPath: string;
  tags: string[];
  note: string;
};

const emptyForm = (): FileHubConnectionFormState => ({
  name: '',
  protocol: 'sftp',
  host: '',
  port: String(FILE_HUB_DEFAULT_PORTS.sftp),
  username: '',
  authMethod: 'password',
  password: '',
  privateKey: '',
  passphrase: '',
  initialPath: '',
  tags: [],
  note: '',
});

export function useFileHubPage() {
  const navigate = useNavigate();
  const { mountId, toMountPath } = usePlatformMount();
  const application = useOptionalPortal();
  const routeParamSuffix = useParams()['*'];
  const applicationSuffix = application?.pageRemainderPath.replace(/^\/+/, '') || undefined;
  const editSlugFromUrl = parseFileHubEditSlug(applicationSuffix ?? routeParamSuffix);

  const catalogQuery = useFileHubConnectionsQuery();
  const createMutation = useCreateFileHubConnectionMutation();
  const updateMutation = useUpdateFileHubConnectionMutation();
  const deleteMutation = useDeleteFileHubConnectionMutation();

  const connections = catalogQuery.data ?? [];
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [settingsTarget, setSettingsTarget] = useState<FileHubConnectionPublic | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FileHubConnectionPublic | null>(null);
  const [form, setForm] = useState<FileHubConnectionFormState>(emptyForm);
  const [sessionTabs, setSessionTabs] = useState<FileHubSessionTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const seededEditSlugRef = useRef<string | null>(null);

  const [filters, setFilters] = usePersistedListFilters<FileHubListFilters>({
    listKey: APP_LIST_PREFERENCE_KEYS.fileHub,
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

  const setProtocolFilter = useCallback((value: FileHubProtocolFilter) => {
    setFilters((prev) => ({ ...prev, protocolFilter: value }));
  }, [setFilters]);

  const activeTab = sessionTabs.find((tab) => tab.id === activeTabId) ?? sessionTabs[0] ?? null;
  const activeConnection = useMemo(
    () => (activeTab
      ? connections.find((item) => item.id === activeTab.connectionId) ?? null
      : null),
    [activeTab, connections],
  );

  const openConnection = useCallback((connection: FileHubConnectionPublic, options?: { additional?: boolean }) => {
    setSessionTabs((prev) => {
      if (!options?.additional) {
        const existing = prev.find((tab) => tab.connectionId === connection.id);
        if (existing) {
          setActiveTabId(existing.id);
          return prev;
        }
      }
      const tab = createFileHubSessionTab(connection.id);
      setActiveTabId(tab.id);
      return [...prev, tab];
    });
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setSessionTabs((prev) => {
      const closed = closeFileHubSessionTab(prev, tabId, activeTabId);
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
    const match = findFileHubConnectionByEditSlug(connections, editSlugFromUrl);
    if (!match) {
      navigate(toMountPath(buildFileHubListRelativePath(mountId)), { replace: true });
      return;
    }
    if (seededEditSlugRef.current === editSlugFromUrl) {
      return;
    }
    seededEditSlugRef.current = editSlugFromUrl;
    openConnection(match);
    navigate(toMountPath(buildFileHubListRelativePath(mountId)), { replace: true });
  }, [catalogQuery.isLoading, connections, editSlugFromUrl, mountId, navigate, openConnection, toMountPath]);

  const openCreate = useCallback(() => {
    setForm(emptyForm());
    setFormError(null);
    setIsCreateOpen(true);
  }, []);

  const openSettings = useCallback((connection: FileHubConnectionPublic) => {
    setForm({
      name: connection.name,
      protocol: connection.protocol,
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
    setFormError(null);
    setSettingsTarget(connection);
  }, []);

  const closeForm = useCallback(() => {
    setIsCreateOpen(false);
    setSettingsTarget(null);
    setFormError(null);
    setForm(emptyForm());
  }, []);

  const buildPayload = useCallback((): FileHubConnectionWritePayload => {
    const protocol = form.protocol;
    const authMethod = protocolAllowsPrivateKey(protocol) ? form.authMethod : 'password';
    const port = parseFileHubPort(form.port);
    if (port == null) {
      throw new Error('Port must be an integer between 1 and 65535.');
    }
    const payload: FileHubConnectionWritePayload = {
      name: form.name,
      protocol,
      host: form.host,
      port,
      username: form.username,
      authMethod,
      initialPath: form.initialPath,
      tags: form.tags,
      note: form.note,
    };
    if (authMethod === 'password' && form.password) {
      payload.password = form.password;
    }
    if (authMethod === 'privateKey' && form.privateKey.trim()) {
      payload.privateKey = form.privateKey;
    }
    if (authMethod === 'privateKey' && form.passphrase) {
      payload.passphrase = form.passphrase;
    }
    return payload;
  }, [form]);

  const validateForm = useCallback((): string | null => {
    const nameError = validateFileHubDisplayName(form.name);
    if (nameError) {
      return nameError;
    }
    const hostError = validateFileHubHost(form.host);
    if (hostError) {
      return hostError;
    }
    if (parseFileHubPort(form.port) == null) {
      return 'Port must be an integer between 1 and 65535.';
    }
    const usernameError = validateFileHubUsername(form.username);
    if (usernameError) {
      return usernameError;
    }
    const isEdit = Boolean(settingsTarget);
    const authMethod = protocolAllowsPrivateKey(form.protocol) ? form.authMethod : 'password';
    if (!isEdit && authMethod === 'password' && !form.password) {
      return 'Password is required for password authentication.';
    }
    if (!isEdit && authMethod === 'privateKey' && !form.privateKey.trim()) {
      return 'Private key is required for key authentication.';
    }
    return null;
  }, [form, settingsTarget]);

  const saveCreate = useCallback(async () => {
    const localError = validateForm();
    if (localError) {
      setFormError(localError);
      return;
    }
    try {
      setFormError(null);
      const item = await createMutation.mutateAsync(buildPayload());
      closeForm();
      showToast('success', 'Sftp connection created.');
      openConnection(item);
    } catch (error) {
      const message = formatQueryError(error, 'Failed to create Sftp connection.');
      setFormError(message);
      showToast('error', message);
    }
  }, [buildPayload, closeForm, createMutation, openConnection, showToast, validateForm]);

  const saveSettings = useCallback(async () => {
    if (!settingsTarget) {
      return;
    }
    const localError = validateForm();
    if (localError) {
      setFormError(localError);
      return;
    }
    try {
      setFormError(null);
      const item = await updateMutation.mutateAsync({
        id: settingsTarget.id,
        payload: buildPayload(),
      });
      closeForm();
      showToast('success', 'Sftp connection updated.');
      openConnection(item);
    } catch (error) {
      const message = formatQueryError(error, 'Failed to update Sftp connection.');
      setFormError(message);
      showToast('error', message);
    }
  }, [buildPayload, closeForm, openConnection, settingsTarget, showToast, updateMutation, validateForm]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      showToast('success', 'Sftp connection deleted.');
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
      showToast('error', formatQueryError(error, 'Failed to delete Sftp connection.'));
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
    catalogError: catalogQuery.isError
      ? formatQueryError(catalogQuery.error, 'Failed to load Sftp connections.')
      : null,
    onRefreshCatalog: () => {
      void catalogQuery.refetch();
    },
    searchQuery: filters.searchQuery,
    setSearchQuery,
    protocolFilter: filters.protocolFilter,
    setProtocolFilter,
    sessionTabs,
    activeTabId,
    setActiveTabId,
    closeTab,
    editSlugFromUrl,
    activeConnection,
    openConnection,
    closeEditor,
    toast,
    showToast,
    isCreateOpen,
    openCreate,
    settingsTarget,
    openSettings,
    closeForm,
    form,
    setForm: ((patch) => {
      setFormError(null);
      setForm(patch);
    }) as typeof setForm,
    formError,
    saveCreate,
    saveSettings,
    isSaving: createMutation.isPending || updateMutation.isPending,
    deleteTarget,
    setDeleteTarget,
    confirmDelete,
    isDeleting: deleteMutation.isPending,
  };
}

export type FileHubPageState = ReturnType<typeof useFileHubPage>;
