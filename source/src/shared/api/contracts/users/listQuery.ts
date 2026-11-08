import type { GridQueryState } from '../../../lib/appTableGridQuery';
import { parseFilterMatchLogic, type FilterMatchLogic } from '../../../lib/filterMatchLogic';

export type { FilterMatchLogic };

export type UsersListQuery = {
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  email?: string;
  full_name?: string;
  roles?: string;
  roleNames?: string;
  roleMatch?: FilterMatchLogic;
  personTypeCode?: string;
  search?: string;
  locked?: 'true' | 'false';
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  page?: number;
  pageSize?: number;
  /** Serialized List Filter where tree (JSON). */
  where?: string;
};

const SORT_FIELDS = new Set(['email', 'full_name', 'created_at', 'updated_at']);
export const USERS_DEFAULT_PAGE_SIZE = 50;
export const USERS_MAX_PAGE_SIZE = 500;
const DEFAULT_PAGE_SIZE = USERS_DEFAULT_PAGE_SIZE;
const MAX_PAGE_SIZE = USERS_MAX_PAGE_SIZE;

function parsePositiveInt(raw: unknown, fallback: number, max: number): number {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(parsed, max);
}

function parseSortDir(raw: unknown): 'asc' | 'desc' | undefined {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value === 'asc') return 'asc';
  if (value === 'desc') return 'desc';
  return undefined;
}

function parseLockedFilter(raw: unknown): 'true' | 'false' | undefined {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value === 'true' || value === 'false') {
    return value;
  }
  return undefined;
}

export function parseUsersListQuery(raw: Record<string, unknown>): UsersListQuery {
  const sortBy = String(raw.sortBy ?? '').trim();
  const sortDir = parseSortDir(raw.sortDir ?? raw.sortDirection);

  return {
    sortBy: SORT_FIELDS.has(sortBy) ? sortBy : undefined,
    sortDir,
    email: String(raw.email ?? raw.emailFilter ?? '').trim() || undefined,
    full_name: String(raw.full_name ?? raw.fullName ?? raw.fullNameFilter ?? '').trim() || undefined,
    roles: String(raw.roles ?? raw.rolesFilter ?? '').trim() || undefined,
    roleNames: String(raw.roleNames ?? raw.role_names ?? '').trim() || undefined,
    roleMatch: parseFilterMatchLogic(raw.roleMatch ?? raw.role_match),
    personTypeCode: String(raw.personTypeCode ?? raw.person_type_code ?? '').trim() || undefined,
    search: String(raw.search ?? raw.q ?? '').trim() || undefined,
    locked: parseLockedFilter(raw.locked),
    createdFrom: String(raw.createdFrom ?? '').trim() || undefined,
    createdTo: String(raw.createdTo ?? '').trim() || undefined,
    updatedFrom: String(raw.updatedFrom ?? '').trim() || undefined,
    updatedTo: String(raw.updatedTo ?? '').trim() || undefined,
    page: parsePositiveInt(raw.page, 1, Number.MAX_SAFE_INTEGER),
    pageSize: parsePositiveInt(raw.pageSize ?? raw.page_size ?? raw.limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
    where: String(raw.where ?? '').trim() || undefined,
  };
}

export function mapGridQueryToUsersListQuery(query: GridQueryState): UsersListQuery {
  const params: UsersListQuery = {};

  if (query.sort) {
    params.sortBy = query.sort.columnId;
    params.sortDir = query.sort.direction;
  }

  for (const [columnId, filter] of Object.entries(query.filters)) {
    if (filter.type === 'text') {
      if (columnId === 'email') params.email = filter.value;
      if (columnId === 'full_name') params.full_name = filter.value;
      if (columnId === 'roles') params.roles = filter.value;
    }
    if (filter.type === 'boolean' && columnId === 'locked') {
      if (filter.value === 'true' || filter.value === 'false') {
        params.locked = filter.value;
      }
    }
    if (filter.type === 'dateRange' && columnId === 'created_at') {
      params.createdFrom = filter.from ?? undefined;
      params.createdTo = filter.to ?? undefined;
    }
    if (filter.type === 'dateRange' && columnId === 'updated_at') {
      params.updatedFrom = filter.from ?? undefined;
      params.updatedTo = filter.to ?? undefined;
    }
  }

  return params;
}

export function appendUsersListParams(searchParams: URLSearchParams, query: UsersListQuery) {
  if (query.sortBy) searchParams.set('sortBy', query.sortBy);
  if (query.sortDir) searchParams.set('sortDir', query.sortDir);
  if (query.email?.trim()) searchParams.set('email', query.email.trim());
  if (query.full_name?.trim()) searchParams.set('full_name', query.full_name.trim());
  if (query.roles?.trim()) searchParams.set('roles', query.roles.trim());
  if (query.roleNames?.trim()) searchParams.set('roleNames', query.roleNames.trim());
  if (query.roleMatch) searchParams.set('roleMatch', query.roleMatch);
  if (query.personTypeCode?.trim()) searchParams.set('personTypeCode', query.personTypeCode.trim());
  if (query.search?.trim()) searchParams.set('search', query.search.trim());
  if (query.locked) searchParams.set('locked', query.locked);
  if (query.createdFrom?.trim()) searchParams.set('createdFrom', query.createdFrom.trim());
  if (query.createdTo?.trim()) searchParams.set('createdTo', query.createdTo.trim());
  if (query.updatedFrom?.trim()) searchParams.set('updatedFrom', query.updatedFrom.trim());
  if (query.updatedTo?.trim()) searchParams.set('updatedTo', query.updatedTo.trim());
  if (query.page != null) searchParams.set('page', String(query.page));
  if (query.pageSize != null) searchParams.set('pageSize', String(query.pageSize));
  if (query.where?.trim()) searchParams.set('where', query.where.trim());
}
