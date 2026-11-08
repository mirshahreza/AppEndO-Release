import { useCallback, useMemo, useState } from 'react';
import {
  useInstallLibraryMutation,
  useLibrariesListQuery,
  useUninstallLibraryMutation,
  useUpgradeLibraryMutation,
} from '../../../shared/api/queries/libraries';
import { formatQueryError } from '../../../shared/api/client';
import { isNpmPackageName } from '../../../core/packages/developerLibraries';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { usePersistedListFilters } from '../../../shared/lib/usePersistedListPreferences';
import { BUILTIN_FILTER_ALL, migrateLegacyBuiltInFilter } from '../../../shared/lib/builtInFilter';
import { createLibraryGridColumns, createLibraryCardRowActions } from '../libraryGridColumns';
import { filterLibraries } from '../lib/libraryListFilters';
import type { LibraryGridRow } from '../types';
export type LibrariesPageState = ReturnType<typeof useLibrariesPage>;

const emptyInstallForm = { name: '', versionRange: '' };

type LibrariesListFilters = {
  searchInput: string;
  builtInFilter: string;
};

const DEFAULT_LIBRARIES_FILTERS: LibrariesListFilters = {
  searchInput: '',
  builtInFilter: BUILTIN_FILTER_ALL,
};

function sanitizeLibrariesFilters(raw: unknown): LibrariesListFilters | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const searchInput = typeof record.searchInput === 'string' ? record.searchInput : '';
  return {
    searchInput,
    builtInFilter: migrateLegacyBuiltInFilter(record),
  };
}

export function useLibrariesPage() {
  const [filters, setFilters] = usePersistedListFilters({
    listKey: APP_LIST_PREFERENCE_KEYS.libraries,
    defaultFilters: DEFAULT_LIBRARIES_FILTERS,
    sanitize: sanitizeLibrariesFilters,
  });
  const { searchInput, builtInFilter } = filters;
  const [deleteTarget, setDeleteTarget] = useState<LibraryGridRow | null>(null);
  const [installOpen, setInstallOpen] = useState(false);
  const [installForm, setInstallForm] = useState(emptyInstallForm);
  const [installError, setInstallError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const listQuery = useLibrariesListQuery();
  const installMutation = useInstallLibraryMutation();
  const upgradeMutation = useUpgradeLibraryMutation();
  const uninstallMutation = useUninstallLibraryMutation();

  const setSearchInput = useCallback((next: string) => {
    setFilters((current) => ({ ...current, searchInput: next }));
  }, [setFilters]);

  const setBuiltInFilter = useCallback((next: string) => {
    setFilters((current) => ({ ...current, builtInFilter: next }));
  }, [setFilters]);

  const installedRows: LibraryGridRow[] = useMemo(
    () => (listQuery.data ?? []).map((row) => ({ ...row, installed: true })),
    [listQuery.data],
  );

  const displayRows = useMemo(
    () => [...filterLibraries(installedRows, { builtInFilter, query: searchInput })]
      .sort((a, b) => a.name.localeCompare(b.name)),
    [builtInFilter, installedRows, searchInput],
  );

  const pendingName = installMutation.variables?.name
    ?? upgradeMutation.variables
    ?? uninstallMutation.variables
    ?? null;

  const gridColumnHandlers = useMemo(
    () => ({
      onUpgrade: (row: LibraryGridRow) => {
        setActionError(null);
        upgradeMutation.mutate(
          row.name,
          { onError: (error: unknown) => setActionError(error instanceof Error ? error.message : 'Upgrade failed.') },
        );
      },
      onUninstall: (row: LibraryGridRow) => {
        setActionError(null);
        setDeleteTarget(row);
      },
      pendingName: typeof pendingName === 'string' ? pendingName : pendingName?.name ?? null,
    }),
    [pendingName, upgradeMutation],
  );

  const gridColumns = useMemo(
    () => createLibraryGridColumns(gridColumnHandlers),
    [gridColumnHandlers],
  );

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await uninstallMutation.mutateAsync(deleteTarget.name);
      setDeleteTarget(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Uninstall failed.');
    }
  };

  const openInstall = () => {
    setInstallForm(emptyInstallForm);
    setInstallError(null);
    setInstallOpen(true);
  };

  const closeInstall = () => {
    if (installMutation.isPending) return;
    setInstallOpen(false);
    setInstallError(null);
  };

  const submitInstall = async () => {
    const name = installForm.name.trim();
    if (!name || !isNpmPackageName(name)) {
      setInstallError('Enter a valid npm package name.');
      return;
    }
    const existing = installedRows.find((row) => row.name === name);
    if (existing?.core) {
      setInstallError(`"${name}" is provided by the platform.`);
      return;
    }
    if (existing) {
      setInstallError(`"${name}" is already installed. Use Upgrade on that row.`);
      return;
    }
    setInstallError(null);
    setActionError(null);
    try {
      await installMutation.mutateAsync({
        name,
        versionRange: installForm.versionRange.trim() || undefined,
      });
      setInstallOpen(false);
      setInstallForm(emptyInstallForm);
    } catch (error) {
      setInstallError(error instanceof Error ? error.message : 'Install failed.');
    }
  };

    return {
    searchInput,
    setSearchInput,
    builtInFilter,
    setBuiltInFilter,
    gridColumns,
    getCardRowActions: (row: LibraryGridRow) => createLibraryCardRowActions(row, gridColumnHandlers),
    displayRows,
    rowCount: displayRows.length,
    isLoading: listQuery.isLoading,
    isError: listQuery.isError,
    error: listQuery.error ? formatQueryError(listQuery.error, 'Failed to load libraries.') : null,
    retryLoad: () => {
      void listQuery.refetch();
    },
    isRefreshing: listQuery.isFetching,
    isRetrying: listQuery.isFetching && listQuery.isError,
    actionError,
    deleteTarget,
    cancelDelete: () => setDeleteTarget(null),
    confirmDelete,
    isMutating: installMutation.isPending || upgradeMutation.isPending || uninstallMutation.isPending,
    isInstalling: installMutation.isPending,
    installOpen,
    installForm,
    installError,
    openInstall,
    closeInstall,
    setInstallName: (name: string) => setInstallForm((current) => ({ ...current, name })),
    setInstallVersionRange: (versionRange: string) => setInstallForm((current) => ({ ...current, versionRange })),
    submitInstall,
  };
}
