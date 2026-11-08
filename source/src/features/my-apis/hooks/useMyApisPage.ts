import { useCallback, useMemo, useState } from 'react';
import { useAccessibleApiRoutesQuery } from '../../../shared/api/queries/my-apis';
import type { AccessibleApiRouteItem } from '../../../shared/api/contracts/my-apis/types';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { usePersistedListFilters } from '../../../shared/lib/usePersistedListPreferences';

export type MyApisPageModel = ReturnType<typeof useMyApisPage>;

type MyApisListFilters = {
  searchInput: string;
};

const DEFAULT_MY_APIS_FILTERS: MyApisListFilters = {
  searchInput: '',
};

function sanitizeMyApisFilters(raw: unknown): MyApisListFilters | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  return {
    searchInput: typeof record.searchInput === 'string' ? record.searchInput : '',
  };
}

export function useMyApisPage() {
  const routesQuery = useAccessibleApiRoutesQuery();
  const [filters, setFilters] = usePersistedListFilters({
    listKey: APP_LIST_PREFERENCE_KEYS.myApis,
    defaultFilters: DEFAULT_MY_APIS_FILTERS,
    sanitize: sanitizeMyApisFilters,
  });
  const searchInput = filters.searchInput;
  const setSearchInput = useCallback((next: string) => {
    setFilters({ searchInput: next });
  }, [setFilters]);
  const [testRoute, setTestRoute] = useState<AccessibleApiRouteItem | null>(null);

  const normalizedSearch = searchInput.trim().toLowerCase();

  const filteredRoutes = useMemo(() => {
    const items = routesQuery.data ?? [];
    if (!normalizedSearch) {
      return items;
    }

    return items.filter((route) => (
      route.name.toLowerCase().includes(normalizedSearch)
      || route.path.toLowerCase().includes(normalizedSearch)
      || route.method.toLowerCase().includes(normalizedSearch)
      || route.folder.toLowerCase().includes(normalizedSearch)
      || route.id.toLowerCase().includes(normalizedSearch)
    ));
  }, [normalizedSearch, routesQuery.data]);

    return {
    routesQuery,
    searchInput,
    setSearchInput,
    filteredRoutes,
    totalCount: routesQuery.data?.length ?? 0,
    testRoute,
    openTestModal: (route: AccessibleApiRouteItem) => setTestRoute(route),
    closeTestModal: () => setTestRoute(null),
  };
}
