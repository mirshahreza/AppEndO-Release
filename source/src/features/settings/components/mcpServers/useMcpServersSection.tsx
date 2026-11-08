import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  resolveDefaultCapabilityPackIds,
  type AiCapabilityPackId,
} from '../../../../shared/api/contracts/ai/capabilityPacks';
import {
  DEFAULT_AI_HTTP_SETTINGS,
  DEFAULT_AI_MCP_INBOUND_HOST_SETTINGS,
  DEFAULT_AI_WEB_SEARCH_SETTINGS,
} from '../../../../shared/api/contracts/ai/constants';
import type {
  AiHttpSettings,
  AiMcpInboundHostSettings,
  AiMcpServerConfig,
  AiMcpServerPublicConfig,
  AiWebSearchSettings,
} from '../../../../shared/api/contracts/ai/types';
import type { FunctionAccessControl } from '../../../../shared/api/contracts/server-functions/accessControl';
import { formatQueryError } from '../../../../shared/api/client';
import { useAiSettingsQuery } from '../../../../shared/api/queries/aiModels';
import {
  useMcpServersQuery,
  useCreateMcpServerMutation,
  useDeleteMcpServerMutation,
  useTestMcpServerMutation,
  useUpdateMcpServerMutation,
} from '../../../../shared/api/queries/mcpServers';
import { useUpdateAiDefaultCapabilityPacksMutation } from '../../../../shared/api/queries/aiDefaultCapabilityPacks';
import { useUpdateAiWebSearchMutation } from '../../../../shared/api/queries/aiWebSearch';
import { useUpdateAiInboundMcpMutation } from '../../../../shared/api/queries/aiInboundMcp';
import { useUpdateAiHttpMutation } from '../../../../shared/api/queries/aiHttp';
import { useReplaceMcpResourceAccessControlMutation } from '../../../../shared/api/queries/aiMcpAccess';
import { APP_LIST_PREFERENCE_KEYS } from '../../../../shared/lib/listPreferenceKeys';
import { usePersistedListFilters } from '../../../../shared/lib/usePersistedListPreferences';
import { buildMcpGridRows, filterMcpGridRows, type McpGridRow } from './buildMcpGridRows';
import { EMPTY_MCP_SERVER_FORM } from './constants';
import { buildMcpResourceAccessTarget } from './mcpResourceAccess';
import type { McpResourceAccessTarget } from './McpResourceAccessModal';
import { useSettingsMcpServersOverlayDeepLink } from '../../hooks/useSettingsMcpServersOverlayDeepLink';

type ToastState = { type: 'success' | 'error'; text: string } | null;

type McpServersListFilters = {
  searchInput: string;
};

const DEFAULT_MCP_SERVERS_FILTERS: McpServersListFilters = {
  searchInput: '',
};

function sanitizeMcpServersFilters(raw: unknown): McpServersListFilters | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  return {
    searchInput: typeof record.searchInput === 'string' ? record.searchInput : '',
  };
}

const validateMcpForm = (form: AiMcpServerConfig, mode: 'create' | 'edit'): string | null => {
  if (!form.label.trim()) return 'Label is required.';
  if (!form.id.trim()) return 'Server ID is required.';
  if (form.transport === 'stdio' && !form.command?.trim()) return 'Command is required for stdio transport.';
  if ((form.transport === 'sse' || form.transport === 'http') && !form.url?.trim()) {
    return 'URL is required for remote transport.';
  }
  if (mode === 'create' && !/^[a-z0-9][a-z0-9-]{0,62}$/.test(form.id)) {
    return 'Server ID must be a lowercase slug.';
  }
  return null;
};

const toWebSearchDraft = (settings?: { provider?: AiWebSearchSettings['provider']; maxResults?: number }) => ({
  provider: settings?.provider ?? DEFAULT_AI_WEB_SEARCH_SETTINGS.provider,
  apiKey: '',
  maxResults: settings?.maxResults ?? DEFAULT_AI_WEB_SEARCH_SETTINGS.maxResults ?? 5,
});

const formatHttpHostnamesDraft = (hostnames: string[] = []): string => hostnames.join('\n');

const parseHttpHostnamesDraft = (value: string): string[] => (
  value
    .split(/[\n,]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
);

const toInboundHostDraft = (settings?: AiMcpInboundHostSettings) => ({
  enabled: settings?.enabled ?? DEFAULT_AI_MCP_INBOUND_HOST_SETTINGS.enabled,
  apiKey: '',
  serviceRoleName: settings?.serviceRoleName ?? DEFAULT_AI_MCP_INBOUND_HOST_SETTINGS.serviceRoleName,
});

const toHttpDraft = (settings?: AiHttpSettings) => ({
  allowedHostnamesText: formatHttpHostnamesDraft(settings?.allowedHostnames ?? DEFAULT_AI_HTTP_SETTINGS.allowedHostnames),
});

export function useMcpServersSection(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const settingsQuery = useAiSettingsQuery({ enabled });
  const webSearchMutation = useUpdateAiWebSearchMutation();
  const httpMutation = useUpdateAiHttpMutation();
  const inboundHostMutation = useUpdateAiInboundMcpMutation();
  const defaultPacksMutation = useUpdateAiDefaultCapabilityPacksMutation();
  const serversQuery = useMcpServersQuery(enabled);
  const createMutation = useCreateMcpServerMutation();
  const updateMutation = useUpdateMcpServerMutation();
  const deleteMutation = useDeleteMcpServerMutation();
  const testMutation = useTestMcpServerMutation();
  const replaceResourceAccessMutation = useReplaceMcpResourceAccessControlMutation();

  const servers = serversQuery.data ?? [];
  const [filters, setFilters] = usePersistedListFilters({
    listKey: APP_LIST_PREFERENCE_KEYS.mcpServers,
    defaultFilters: DEFAULT_MCP_SERVERS_FILTERS,
    sanitize: sanitizeMcpServersFilters,
  });
  const searchInput = filters.searchInput;
  const setSearchInput = useCallback((next: string) => {
    setFilters({ searchInput: next });
  }, [setFilters]);
  const [toast, setToast] = useState<ToastState>(null);
  const [editRow, setEditRow] = useState<McpGridRow | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState<AiMcpServerConfig>(EMPTY_MCP_SERVER_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AiMcpServerPublicConfig | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [testingServerId, setTestingServerId] = useState<string | null>(null);
  const [webSearchDraft, setWebSearchDraft] = useState(toWebSearchDraft());
  const [webSearchError, setWebSearchError] = useState<string | null>(null);
  const [httpDraft, setHttpDraft] = useState(toHttpDraft());
  const [httpError, setHttpError] = useState<string | null>(null);
  const [inboundHostDraft, setInboundHostDraft] = useState(toInboundHostDraft());
  const [inboundHostError, setInboundHostError] = useState<string | null>(null);
  const [builtinDefaultEnabled, setBuiltinDefaultEnabled] = useState(false);
  const [builtinPackError, setBuiltinPackError] = useState<string | null>(null);
  const [accessTarget, setAccessTarget] = useState<McpResourceAccessTarget | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);

  const resourceAccessControl = settingsQuery.data?.mcp?.resourceAccessControl;

  useEffect(() => {
    if (!settingsQuery.data?.webSearch) return;
    setWebSearchDraft(toWebSearchDraft(settingsQuery.data.webSearch));
    setWebSearchError(null);
  }, [settingsQuery.data?.webSearch]);

  useEffect(() => {
    if (!settingsQuery.data?.http) return;
    setHttpDraft(toHttpDraft(settingsQuery.data.http));
    setHttpError(null);
  }, [settingsQuery.data?.http]);

  useEffect(() => {
    if (!settingsQuery.data?.mcp?.inboundHost) return;
    setInboundHostDraft(toInboundHostDraft(settingsQuery.data.mcp.inboundHost));
    setInboundHostError(null);
  }, [settingsQuery.data?.mcp?.inboundHost]);

  const defaultPackIds = useMemo(
    () => resolveDefaultCapabilityPackIds(settingsQuery.data?.mcp?.defaultCapabilityPackIds),
    [settingsQuery.data?.mcp?.defaultCapabilityPackIds],
  );

  const gridRows = useMemo(() => buildMcpGridRows({
    defaultPackIds,
    webSearchProvider: settingsQuery.data?.webSearch?.provider ?? DEFAULT_AI_WEB_SEARCH_SETTINGS.provider,
    inboundHostEnabled: settingsQuery.data?.mcp?.inboundHost?.enabled ?? false,
    servers,
  }), [
    defaultPackIds,
    servers,
    settingsQuery.data?.mcp?.inboundHost?.enabled,
    settingsQuery.data?.webSearch?.provider,
  ]);

  const filteredGridRows = useMemo(
    () => filterMcpGridRows(gridRows, searchInput),
    [gridRows, searchInput],
  );

  const openCreateModal = () => {
    setForm({ ...EMPTY_MCP_SERVER_FORM });
    setFormError(null);
    setShowCreateModal(true);
  };

  const openEditRow = (row: McpGridRow) => {
    setFormError(null);
    setWebSearchError(null);
    setHttpError(null);
    setInboundHostError(null);
    setBuiltinPackError(null);

    if (row.kind === 'external-server' && row.server) {
      setForm({
        ...row.server,
        env: undefined,
      });
      setEditRow(row);
      return;
    }

    if (row.kind === 'builtin-pack' && row.packId === 'appendo-web') {
      setWebSearchDraft(toWebSearchDraft(settingsQuery.data?.webSearch));
    } else if (row.kind === 'builtin-pack' && row.packId === 'appendo-http') {
      setHttpDraft(toHttpDraft(settingsQuery.data?.http));
    } else if (row.kind === 'inbound-host') {
      setInboundHostDraft(toInboundHostDraft(settingsQuery.data?.mcp?.inboundHost));
    } else if (row.kind === 'builtin-pack' && row.packId) {
      setBuiltinDefaultEnabled(defaultPackIds.includes(row.packId));
    }

    setEditRow(row);
  };

  const closeEditRow = () => {
    setEditRow(null);
    setFormError(null);
    setWebSearchError(null);
    setHttpError(null);
    setInboundHostError(null);
    setBuiltinPackError(null);
  };

  const handleSubmitCreateForm = async () => {
    const validationError = validateMcpForm(form, 'create');
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setFormError(null);
    try {
      await createMutation.mutateAsync(form);
      setToast({ type: 'success', text: `MCP server "${form.label}" created.` });
      setShowCreateModal(false);
    } catch (error) {
      setFormError(formatQueryError(error, 'Failed to save MCP server.'));
    }
  };

  const handleSubmitEditForm = async () => {
    const validationError = validateMcpForm(form, 'edit');
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setFormError(null);
    try {
      await updateMutation.mutateAsync({ id: form.id, payload: form });
      setToast({ type: 'success', text: `MCP server "${form.label}" updated.` });
      closeEditRow();
    } catch (error) {
      setFormError(formatQueryError(error, 'Failed to save MCP server.'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setToast({ type: 'success', text: `MCP server "${deleteTarget.label}" deleted.` });
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(formatQueryError(error, 'Failed to delete MCP server.'));
    }
  };

  const handleTest = async (server: AiMcpServerPublicConfig) => {
    setTestingServerId(server.id);
    try {
      const result = await testMutation.mutateAsync(server.id);
      setToast({
        type: 'success',
        text: result.message || `Connection to "${server.label}" succeeded.`,
      });
    } catch (error) {
      setToast({
        type: 'error',
        text: formatQueryError(error, `Connection test failed for "${server.label}".`),
      });
    } finally {
      setTestingServerId(null);
    }
  };

  const handleSaveWebSearch = async () => {
    if (webSearchDraft.provider !== 'disabled' && !webSearchDraft.apiKey.trim() && !settingsQuery.data?.webSearch?.hasApiKey) {
      setWebSearchError('API key is required when a search provider is enabled.');
      return;
    }

    setWebSearchError(null);
    try {
      const payload: AiWebSearchSettings = {
        provider: webSearchDraft.provider,
        maxResults: webSearchDraft.maxResults,
        apiKey: webSearchDraft.apiKey.trim() || undefined,
      };
      await webSearchMutation.mutateAsync(payload);
      setWebSearchDraft(toWebSearchDraft({
        provider: payload.provider,
        maxResults: payload.maxResults,
      }));
      setToast({ type: 'success', text: 'Web search settings saved.' });
      closeEditRow();
    } catch (error) {
      setWebSearchError(formatQueryError(error, 'Failed to save web search settings.'));
    }
  };

  const handleSaveInboundHost = async () => {
    if (inboundHostDraft.enabled && !inboundHostDraft.apiKey.trim() && !settingsQuery.data?.mcp?.inboundHost?.hasApiKey) {
      setInboundHostError('API key is required when inbound MCP host is enabled.');
      return;
    }

    setInboundHostError(null);
    try {
      const payload: AiMcpInboundHostSettings = {
        enabled: inboundHostDraft.enabled,
        apiKey: inboundHostDraft.apiKey.trim() || undefined,
        serviceRoleName: inboundHostDraft.serviceRoleName,
      };
      await inboundHostMutation.mutateAsync(payload);
      setInboundHostDraft(toInboundHostDraft({
        enabled: payload.enabled,
        serviceRoleName: payload.serviceRoleName,
      }));
      setToast({ type: 'success', text: 'Inbound MCP host settings saved.' });
      closeEditRow();
    } catch (error) {
      setInboundHostError(formatQueryError(error, 'Failed to save inbound MCP host settings.'));
    }
  };

  const handleSaveHttp = async () => {
    setHttpError(null);
    try {
      const payload: AiHttpSettings = {
        allowedHostnames: parseHttpHostnamesDraft(httpDraft.allowedHostnamesText),
      };
      await httpMutation.mutateAsync(payload);
      setHttpDraft(toHttpDraft(payload));
      setToast({ type: 'success', text: 'HTTP allowlist settings saved.' });
      closeEditRow();
    } catch (error) {
      setHttpError(formatQueryError(error, 'Failed to save HTTP settings.'));
    }
  };

  const handleSaveBuiltinPack = async () => {
    const packId = editRow?.packId;
    if (!packId || packId === 'appendo-web' || packId === 'appendo-http') return;

    setBuiltinPackError(null);
    try {
      const nextPackIds = new Set(defaultPackIds);
      if (builtinDefaultEnabled) {
        nextPackIds.add(packId);
      } else {
        nextPackIds.delete(packId);
      }

      await defaultPacksMutation.mutateAsync({
        defaultCapabilityPackIds: [...nextPackIds] as AiCapabilityPackId[],
      });
      setToast({ type: 'success', text: `"${editRow?.label ?? packId}" default settings saved.` });
      closeEditRow();
    } catch (error) {
      setBuiltinPackError(formatQueryError(error, 'Failed to save capability pack settings.'));
    }
  };

  const openAccessRow = (row: McpGridRow) => {
    setAccessError(null);
    const target = buildMcpResourceAccessTarget(row, resourceAccessControl);
    if (!target) return;
    setAccessTarget(target);
  };

  const closeAccessRow = () => {
    setAccessTarget(null);
    setAccessError(null);
  };

  const handleSaveAccess = async (accessControl: FunctionAccessControl) => {
    if (!accessTarget) return;

    setAccessError(null);
    try {
      if (accessTarget.resourceKind === 'external_mcp') {
        const server = servers.find((item) => item.id === accessTarget.resourceId);
        if (!server || server.managedByPlugin) {
          throw new Error('External MCP server was not found.');
        }

        await updateMutation.mutateAsync({
          id: accessTarget.resourceId,
          payload: {
            ...server,
            env: undefined,
            accessControl,
          },
        });
      } else {
        await replaceResourceAccessMutation.mutateAsync({
          resourceId: accessTarget.resourceId,
          payload: {
            resourceKind: accessTarget.resourceKind,
            accessControl,
          },
        });
      }

      setToast({ type: 'success', text: `Access settings saved for "${accessTarget.label}".` });
      closeAccessRow();
    } catch (error) {
      const message = formatQueryError(error, 'Failed to save MCP access settings.');
      setAccessError(message);
      setToast({ type: 'error', text: message });
    }
  };

  const builtinCount = gridRows.filter((row) => row.kind === 'builtin-pack').length;
  const externalCount = gridRows.filter((row) => row.kind === 'external-server').length;

  useSettingsMcpServersOverlayDeepLink({
    showCreateModal,
    openCreateModal,
    resourceAccessOpen: Boolean(accessTarget),
  });

  return {
    settingsQuery,
    serversQuery,
    gridRows,
    filteredGridRows,
    searchInput,
    setSearchInput,
    toast,
    setToast,
    editRow,
    openEditRow,
    closeEditRow,
    showCreateModal,
    setShowCreateModal,
    form,
    setForm,
    formError,
    openCreateModal,
    handleSubmitCreateForm,
    handleSubmitEditForm,
    deleteTarget,
    setDeleteTarget,
    deleteError,
    handleDelete,
    handleTest,
    testingServerId,
    isSaving: createMutation.isPending || updateMutation.isPending,
    isSavingWebSearch: webSearchMutation.isPending,
    isSavingHttp: httpMutation.isPending,
    isSavingInboundHost: inboundHostMutation.isPending,
    isSavingBuiltinPack: defaultPacksMutation.isPending,
    webSearchDraft,
    setWebSearchDraft,
    webSearchError,
    handleSaveWebSearch,
    hasStoredWebSearchApiKey: Boolean(settingsQuery.data?.webSearch?.hasApiKey),
    httpDraft,
    setHttpDraft,
    httpError,
    handleSaveHttp,
    inboundHostDraft,
    setInboundHostDraft,
    inboundHostError,
    handleSaveInboundHost,
    hasStoredInboundHostApiKey: Boolean(settingsQuery.data?.mcp?.inboundHost?.hasApiKey),
    builtinDefaultEnabled,
    setBuiltinDefaultEnabled,
    builtinPackError,
    handleSaveBuiltinPack,
    accessTarget,
    accessError,
    openAccessRow,
    closeAccessRow,
    handleSaveAccess,
    isSavingAccess: replaceResourceAccessMutation.isPending || updateMutation.isPending,
    builtinCount,
    externalCount,
  };
}

export type McpServersSectionModel = ReturnType<typeof useMcpServersSection>;
