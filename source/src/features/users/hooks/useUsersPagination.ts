import { useCallback, useEffect, useMemo, useState, type UIEvent, type SetStateAction } from 'react';
import type { UsersListQuery } from '../../../shared/api/queries/users';
import {
  createUsersWhereFields,
  sanitizeUsersWhereTree,
} from '../../../shared/api/contracts/users/usersListWhere';
import { DEFAULT_FILTER_MATCH_LOGIC, type FilterMatchLogic } from '../../../shared/lib/filterMatchLogic';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { usePersistedListFilters } from '../../../shared/lib/usePersistedListPreferences';
import { TOOLBAR_FILTER_RADIO_ALL_VALUE, type WhereGroupNode } from '../../../shared/ui';
import type { GridListMode } from '../../../shared/lib/gridPagingConstants';

export type ToolbarCheckboxFilterOption = {
  id: string;
  label: string;
};

type UsersToolbarPersistedFilters = {
  searchInput: string;
  roleMatchLogic: FilterMatchLogic;
  personTypeCode: string;
  roleFilters: Record<string, boolean>;
  where: WhereGroupNode;
};

const DEFAULT_USERS_TOOLBAR_FILTERS: UsersToolbarPersistedFilters = {
  searchInput: '',
  roleMatchLogic: DEFAULT_FILTER_MATCH_LOGIC,
  personTypeCode: TOOLBAR_FILTER_RADIO_ALL_VALUE,
  roleFilters: {},
  where: sanitizeUsersWhereTree(null),
};

function isFilterMatchLogic(value: unknown): value is FilterMatchLogic {
  return value === 'or' || value === 'and';
}

function sanitizeUsersToolbarFilters(raw: unknown): UsersToolbarPersistedFilters | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const roleFiltersRaw = record.roleFilters;
  const roleFilters: Record<string, boolean> = {};
  if (typeof roleFiltersRaw === 'object' && roleFiltersRaw !== null && !Array.isArray(roleFiltersRaw)) {
    for (const [key, value] of Object.entries(roleFiltersRaw)) {
      if (typeof value === 'boolean') roleFilters[key] = value;
    }
  }
  const whereSource = record.where ?? (record.kind === 'group' ? record : null);
  return {
    searchInput: typeof record.searchInput === 'string' ? record.searchInput : '',
    roleMatchLogic: isFilterMatchLogic(record.roleMatchLogic)
      ? record.roleMatchLogic
      : DEFAULT_FILTER_MATCH_LOGIC,
    personTypeCode: typeof record.personTypeCode === 'string'
      ? record.personTypeCode
      : TOOLBAR_FILTER_RADIO_ALL_VALUE,
    roleFilters,
    where: sanitizeUsersWhereTree(whereSource),
  };
}

export function buildSelectedFilterValues(filters: Record<string, boolean>): string | undefined {
  const selected = Object.entries(filters)
    .filter(([, checked]) => checked)
    .map(([value]) => value);
  return selected.length > 0 ? selected.join(',') : undefined;
}

export function buildSelectedRoleNames(roleFilters: Record<string, boolean>): string | undefined {
  return buildSelectedFilterValues(roleFilters);
}

export function useUsersToolbarFilters(
  availableRoles: ReadonlyArray<string>,
) {
  const [toolbarFilters, setToolbarFilters] = usePersistedListFilters({
    listKey: APP_LIST_PREFERENCE_KEYS.users,
    defaultFilters: DEFAULT_USERS_TOOLBAR_FILTERS,
    sanitize: sanitizeUsersToolbarFilters,
  });
  const [searchText, setSearchText] = useState(toolbarFilters.searchInput);

  useEffect(() => {
    setToolbarFilters((prev) => {
      const nextRoleFilters: Record<string, boolean> = {};
      let changed = false;
      for (const role of availableRoles) {
        const nextValue = prev.roleFilters[role] === true;
        nextRoleFilters[role] = nextValue;
        if (Boolean(prev.roleFilters[role]) !== nextValue) changed = true;
      }
      for (const key of Object.keys(prev.roleFilters)) {
        if (!availableRoles.includes(key)) changed = true;
      }
      if (!changed && Object.keys(prev.roleFilters).length === availableRoles.length) {
        return prev;
      }
      return { ...prev, roleFilters: nextRoleFilters };
    });
  }, [availableRoles, setToolbarFilters]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchText(toolbarFilters.searchInput), 300);
    return () => window.clearTimeout(timer);
  }, [toolbarFilters.searchInput]);

  const setSearchInput = useCallback((searchInput: string) => {
    setToolbarFilters((prev) => ({ ...prev, searchInput }));
  }, [setToolbarFilters]);

  const setRoleFilters = useCallback((
    roleFilters: SetStateAction<Record<string, boolean>>,
  ) => {
    setToolbarFilters((prev) => ({
      ...prev,
      roleFilters: typeof roleFilters === 'function'
        ? roleFilters(prev.roleFilters)
        : roleFilters,
    }));
  }, [setToolbarFilters]);

  const setRoleMatchLogic = useCallback((roleMatchLogic: FilterMatchLogic) => {
    setToolbarFilters((prev) => ({ ...prev, roleMatchLogic }));
  }, [setToolbarFilters]);

  const setPersonTypeCode = useCallback((personTypeCode: string) => {
    setToolbarFilters((prev) => ({ ...prev, personTypeCode }));
  }, [setToolbarFilters]);

  const setWhere = useCallback((where: WhereGroupNode) => {
    setToolbarFilters((prev) => ({
      ...prev,
      where: sanitizeUsersWhereTree(where),
    }));
  }, [setToolbarFilters]);

  const whereFields = useMemo(() => createUsersWhereFields(), []);

  const selectedRoleNames = useMemo(
    () => buildSelectedFilterValues(toolbarFilters.roleFilters),
    [toolbarFilters.roleFilters],
  );

  return {
    searchInput: toolbarFilters.searchInput,
    setSearchInput,
    searchText,
    roleFilters: toolbarFilters.roleFilters,
    setRoleFilters,
    roleMatchLogic: toolbarFilters.roleMatchLogic,
    setRoleMatchLogic,
    selectedRoleNames,
    personTypeCode: toolbarFilters.personTypeCode,
    setPersonTypeCode,
    where: toolbarFilters.where,
    setWhere,
    whereFields,
  };
}

export function useUsersPagingState({
  pageSize,
  listMode,
  resetKeys,
}: {
  pageSize: number;
  listMode: GridListMode;
  resetKeys: ReadonlyArray<unknown>;
}) {
  const [page, setPage] = useState(1);
  const [infiniteVisibleCount, setInfiniteVisibleCount] = useState(pageSize);

  useEffect(() => {
    setPage(1);
    setInfiniteVisibleCount(pageSize);
  }, [pageSize, listMode, ...resetKeys]);

  const listQueryPaging = useMemo((): Pick<UsersListQuery, 'page' | 'pageSize'> => ({
    page: listMode === 'infinite' ? 1 : page,
    pageSize: listMode === 'infinite' ? infiniteVisibleCount : pageSize,
  }), [infiniteVisibleCount, listMode, page, pageSize]);

  const loadMore = useCallback(() => {
    setInfiniteVisibleCount((current) => current + pageSize);
  }, [pageSize]);

  const handleScrollEnd = useCallback((event: UIEvent<HTMLDivElement>, totalCount: number, hasMore: boolean) => {
    if (listMode !== 'infinite' || !hasMore) {
      return;
    }
    const element = event.currentTarget;
    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (remaining <= 48) {
      setInfiniteVisibleCount((current) => Math.min(current + pageSize, totalCount));
    }
  }, [listMode, pageSize]);

  return {
    page,
    setPage,
    infiniteVisibleCount,
    listQueryPaging,
    loadMore,
    handleScrollEnd,
  };
}

export function buildUsersPagingFooter({
  totalCount,
  pageSize,
  listMode,
  page,
  infiniteVisibleCount,
}: {
  totalCount: number;
  pageSize: number;
  listMode: GridListMode;
  page: number;
  infiniteVisibleCount: number;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageNumbers: number[] = [];
  const start = Math.max(1, safePage - 2);
  const end = Math.min(totalPages, safePage + 2);
  for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
    pageNumbers.push(pageNumber);
  }

  const visibleInfiniteCount = Math.min(infiniteVisibleCount, totalCount);
  const hasMore = listMode === 'infinite' && visibleInfiniteCount < totalCount;

  return {
    safePage,
    totalPages,
    pageNumbers,
    visibleInfiniteCount,
    hasMore,
  };
}
