import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useOptionalPortal } from '../../../app/platform/PortalContext';
import { usePlatformMount } from '../../../app/platform/PlatformMountContext';
import { isAbortError } from '../../../shared/api/client';
import {
  serverFunctionsQueryKeys,
  useServerFunctionsCatalogQuery,
  type ServerFunctionsCatalog,
} from '../../../shared/api/queries/server-functions';
import { isPackageServerFunction } from '../../../shared/api/contracts/server-functions/packageFunctions';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { usePersistedListFilters } from '../../../shared/lib/usePersistedListPreferences';
import { BUILTIN_FILTER_ALL, matchesBuiltInFilter, migrateLegacyBuiltInFilter } from '../../../shared/lib/builtInFilter';
import type { ServerFunctionItem, ServerFunctionMethod } from '../types';
import {
  buildServerFunctionEditRelativePath,
  buildServerFunctionListRelativePath,
  buildServerFunctionNewRelativePath,
  findServerFunctionByEditSlug,
  isHiddenServerFunctionEditSlug,
  parseServerFunctionEditSlug,
  SERVER_FUNCTION_NEW_SLUG,
} from '../serverFunctionRoute';
import { mergeCatalogFunctionsWithDrafts } from './serverFunctionDraftCache';

export type ServerFunctionMethodFilter = 'ALL' | ServerFunctionMethod;

type ServerFunctionsListFilters = {
  searchQuery: string;
  methodFilter: ServerFunctionMethodFilter;
  builtInFilter: string;
};

const SERVER_FUNCTION_METHODS: ReadonlyArray<ServerFunctionMethod> = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
];

const DEFAULT_SERVER_FUNCTION_FILTERS: ServerFunctionsListFilters = {
  searchQuery: '',
  methodFilter: 'ALL',
  builtInFilter: BUILTIN_FILTER_ALL,
};

function sanitizeServerFunctionFilters(raw: unknown): ServerFunctionsListFilters | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const methodFilter = record.methodFilter === 'ALL'
    || (typeof record.methodFilter === 'string'
      && (SERVER_FUNCTION_METHODS as readonly string[]).includes(record.methodFilter))
    ? record.methodFilter as ServerFunctionMethodFilter
    : 'ALL';
  return {
    searchQuery: typeof record.searchQuery === 'string' ? record.searchQuery : '',
    methodFilter,
    builtInFilter: migrateLegacyBuiltInFilter(record),
  };
}

export type SetActiveServerFunctionOptions = {
  isNewDraft?: boolean;
};

type UseServerFunctionCatalogInput = {
  addLog: (msg: string, type?: 'info' | 'success' | 'warn') => void;
};

const EMPTY_CATALOG_FUNCTIONS: ServerFunctionItem[] = [];

export function useServerFunctionCatalog({ addLog }: UseServerFunctionCatalogInput) {
  const navigate = useNavigate();
  const location = useLocation();
  const { mountId, toMountPath } = usePlatformMount();
  const application = useOptionalPortal();
  const routeParamSuffix = useParams()['*'];
  const applicationSuffix = application?.pageRemainderPath.replace(/^\/+/, '') || undefined;
  const pathSuffix = applicationSuffix ?? routeParamSuffix;
  const editSlugFromUrl = parseServerFunctionEditSlug(pathSuffix);
  const isNewDraftFromUrl = editSlugFromUrl === SERVER_FUNCTION_NEW_SLUG;

  const queryClient = useQueryClient();
  const catalogQuery = useServerFunctionsCatalogQuery();
  const catalogErrorsLoggedRef = useRef<string | null>(null);
  const catalogFetchErrorLoggedRef = useRef(false);
  const skipUrlToStateSyncRef = useRef(false);
  const [draftRevision, setDraftRevision] = useState(0);

  const bumpDraftRevision = useCallback(() => {
    setDraftRevision((revision) => revision + 1);
  }, []);

  const refreshCatalog = useCallback(() => {
    void catalogQuery.refetch();
  }, [catalogQuery]);

  const catalogFunctions = catalogQuery.data?.functions ?? EMPTY_CATALOG_FUNCTIONS;

  const functions = useMemo(
    () => mergeCatalogFunctionsWithDrafts(queryClient, catalogFunctions),
    [catalogFunctions, catalogQuery.dataUpdatedAt, draftRevision, queryClient],
  );

  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [filters, setFilters] = usePersistedListFilters({
    listKey: APP_LIST_PREFERENCE_KEYS.serverFunctions,
    defaultFilters: DEFAULT_SERVER_FUNCTION_FILTERS,
    sanitize: sanitizeServerFunctionFilters,
  });
  const { searchQuery, methodFilter, builtInFilter } = filters;

  const setSearchQuery = useCallback((next: string) => {
    setFilters((prev) => ({ ...prev, searchQuery: next }));
  }, [setFilters]);

  const setMethodFilter = useCallback((next: SetStateAction<ServerFunctionMethodFilter>) => {
    setFilters((prev) => ({
      ...prev,
      methodFilter: typeof next === 'function' ? next(prev.methodFilter) : next,
    }));
  }, [setFilters]);

  const setBuiltInFilter = useCallback((next: string) => {
    setFilters((prev) => ({ ...prev, builtInFilter: next }));
  }, [setFilters]);

  const setActiveId = useCallback((
    id: string | null,
    options?: SetActiveServerFunctionOptions,
  ) => {
    skipUrlToStateSyncRef.current = true;
    setActiveIdState(id);

    if (id === null) {
      navigate(
        toMountPath(
          options?.isNewDraft
            ? buildServerFunctionNewRelativePath(mountId)
            : buildServerFunctionListRelativePath(mountId),
        ),
      );
      return;
    }

    const target = functions.find((fn) => fn.id === id);
    if (target) {
      navigate(toMountPath(buildServerFunctionEditRelativePath(target, mountId)));
    }
  }, [functions, mountId, navigate, toMountPath]);

  const loadFunctionFromList = useCallback((id: string) => {
    if (id === activeId) {
      return;
    }

    setActiveId(id);
  }, [activeId, setActiveId]);

  useEffect(() => {
    if (!catalogQuery.data) {
      return;
    }

    if (skipUrlToStateSyncRef.current) {
      skipUrlToStateSyncRef.current = false;
      return;
    }

    if (!editSlugFromUrl) {
      if (activeId !== null) {
        setActiveIdState(null);
      }
      return;
    }

    if (isNewDraftFromUrl) {
      if (activeId !== null) {
        setActiveIdState(null);
      }
      return;
    }

    if (isHiddenServerFunctionEditSlug(editSlugFromUrl)) {
      navigate(toMountPath(buildServerFunctionListRelativePath(mountId)), { replace: true });
      return;
    }

    const matched = findServerFunctionByEditSlug(functions, editSlugFromUrl);
    if (!matched) {
      navigate(toMountPath(buildServerFunctionListRelativePath(mountId)), { replace: true });
      return;
    }

    if (activeId !== matched.id) {
      setActiveIdState(matched.id);
    }
  }, [
    activeId,
    catalogQuery.data,
    editSlugFromUrl,
    functions,
    isNewDraftFromUrl,
    mountId,
    navigate,
    toMountPath,
  ]);

  useEffect(() => {
    // Only canonicalize edit URLs while the route still carries an edit slug.
    // Without this guard, leaving the edit view (e.g. main nav → Server Functions list)
    // briefly keeps activeId set and this effect would navigate back to the editor.
    if (!activeId || !editSlugFromUrl) {
      return;
    }

    const target = functions.find((fn) => fn.id === activeId);
    if (!target) {
      return;
    }

    const canonicalPath = toMountPath(buildServerFunctionEditRelativePath(target, mountId));
    if (location.pathname !== canonicalPath) {
      navigate(canonicalPath, { replace: true });
    }
  }, [activeId, editSlugFromUrl, functions, location.pathname, mountId, navigate, toMountPath]);

  const upsertCatalogFunction = useCallback((fn: ServerFunctionItem) => {
    queryClient.setQueryData<ServerFunctionsCatalog>(serverFunctionsQueryKeys.catalog(), (current) => {
      if (!current) {
        return current;
      }
      const exists = current.functions.some((item) => item.id === fn.id);
      return {
        ...current,
        functions: exists
          ? current.functions.map((item) => (item.id === fn.id ? fn : item))
          : [...current.functions, fn],
      };
    });
  }, [queryClient]);

  const replaceCatalogFunctionIdentity = useCallback((previousId: string, fn: ServerFunctionItem) => {
    queryClient.setQueryData<ServerFunctionsCatalog>(serverFunctionsQueryKeys.catalog(), (current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        functions: [
          ...current.functions.filter((item) => item.id !== previousId),
          fn,
        ],
      };
    });
  }, [queryClient]);

  useEffect(() => {
    const catalog = catalogQuery.data;
    if (!catalog) {
      return;
    }
    const errorKey = [catalog.systemError, catalog.customError]
      .filter(Boolean)
      .join('||');
    if (!errorKey || catalogErrorsLoggedRef.current === errorKey) {
      return;
    }
    catalogErrorsLoggedRef.current = errorKey;
    if (catalog.systemError) {
      addLog(catalog.systemError, 'warn');
    }
    if (catalog.customError) {
      addLog(catalog.customError, 'warn');
    }
  }, [addLog, catalogQuery.data]);

  useEffect(() => {
    if (!catalogQuery.isError || catalogFetchErrorLoggedRef.current) {
      return;
    }
    if (isAbortError(catalogQuery.error)) {
      return;
    }
    catalogFetchErrorLoggedRef.current = true;
    addLog('Failed to load API functions. Falling back to built-ins.', 'warn');
  }, [addLog, catalogQuery.error, catalogQuery.isError]);

  const filteredFunctions = useMemo(() => functions.filter((fn) => {
    if (!matchesBuiltInFilter(Boolean(fn.isBuiltIn) && !isPackageServerFunction(fn), builtInFilter)) {
      return false;
    }
    if (methodFilter !== 'ALL' && fn.method !== methodFilter) return false;

    const normalizedSearch = searchQuery.trim().toLowerCase();
    if (!normalizedSearch) {
      return true;
    }

    return (
      fn.name.toLowerCase().includes(normalizedSearch)
      || fn.path.toLowerCase().includes(normalizedSearch)
      || fn.method.toLowerCase().includes(normalizedSearch)
      || (fn.metadataJson?.catalogTags ?? []).some((tag) => tag.toLowerCase().includes(normalizedSearch))
    );
  }), [builtInFilter, functions, methodFilter, searchQuery]);

  const groups = useMemo(() => {
    const nextGroups: Record<string, ServerFunctionItem[]> = {};
    filteredFunctions.forEach((fn) => {
      const fName = fn.folder || 'general';
      if (!nextGroups[fName]) {
        nextGroups[fName] = [];
      }
      nextGroups[fName].push(fn);
    });
    return nextGroups;
  }, [filteredFunctions]);

  return {
    queryClient,
    catalogQuery,
    catalogFunctions,
    functions,
    activeId,
    setActiveId,
    loadFunctionFromList,
    isNewDraftRoute: isNewDraftFromUrl,
    editSlugFromUrl,
    searchQuery,
    setSearchQuery,
    methodFilter,
    setMethodFilter,
    builtInFilter,
    setBuiltInFilter,
    filteredFunctions,
    groups,
    bumpDraftRevision,
    upsertCatalogFunction,
    replaceCatalogFunctionIdentity,
    refreshCatalog,
  };
}

export type ServerFunctionCatalogState = ReturnType<typeof useServerFunctionCatalog>;
