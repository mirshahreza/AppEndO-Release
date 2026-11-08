import {
  applyResponseDataPath,
  normalizeHydrationResolvedValue,
  readNestedContextValue,
  resolveOperationUrl,
} from './bindingResourceModel';
import { readResponseTotalCount } from './designerDataGridRuntime';
import { designerFetch } from './bindingMutationRuntime';
import { buildBindingQuerySearchParams } from './bindingQueryParams';
import type { PreviewDataSourceHydrationTarget } from './bindingDynamicActionsCodegen';
import {
  buildHydrationTargetCacheKey,
  getCachedHydrationResult,
  invalidateHydrationCache,
  setCachedHydrationResult,
} from './designerPreviewHydrationCache';
import { appendDataApiNoCacheQueryParam } from '../../shared/lib/dataApiNoCache';
import { mergeHwyMemberDirectoryLegacyFilterQueryParams } from '../hwy/hwyMemberDirectoryLegacyFilterModel';

const isEmptyHydrationBindingValue = (
  designerStore: Record<string, unknown>,
  dataPath: string,
): boolean => {
  if (dataPath.startsWith('static:')) {
    return false;
  }
  const value = readNestedContextValue(designerStore, dataPath);
  return value === undefined || value === null || String(value).trim().length === 0;
};

/** Selection-scoped filters only — route/toolbar/column filters may be empty on first load. */
const isRequiredFilterBindingPath = (dataPath: string): boolean => {
  if (dataPath.startsWith('static:')) {
    return false;
  }
  return dataPath.trim().startsWith('selection.');
};

export const shouldSkipPreviewHydrationTarget = (
  target: PreviewDataSourceHydrationTarget,
  designerStore: Record<string, unknown>,
): boolean => {
  for (const dataPath of Object.values(target.urlParams ?? {})) {
    if (isEmptyHydrationBindingValue(designerStore, dataPath)) {
      return true;
    }
  }

  for (const [paramName, dataPath] of Object.entries(target.queryParams ?? {})) {
    if (
      paramName.startsWith('filter[')
      && isRequiredFilterBindingPath(dataPath)
      && isEmptyHydrationBindingValue(designerStore, dataPath)
    ) {
      return true;
    }
  }

  return false;
};

export const resolveHydrationTargetUrl = (
  target: PreviewDataSourceHydrationTarget,
  designerStore: Record<string, unknown>,
): string => {
  const urlParams = target.urlParams ?? {};
  const baseUrl = Object.keys(urlParams).length === 0
    ? target.endpoint
    : resolveOperationUrl(target.endpoint, designerStore, urlParams);

  const queryParams = mergeHwyMemberDirectoryLegacyFilterQueryParams(
    target.queryParams ?? {},
    target.endpoint,
  );
  if (Object.keys(queryParams).length === 0) {
    return baseUrl;
  }

  const searchParams = buildBindingQuerySearchParams(
    queryParams,
    (dataPath) => readNestedContextValue(designerStore, dataPath),
  );
  const queryString = searchParams.toString();
  if (!queryString) {
    return baseUrl;
  }

  return baseUrl.includes('?') ? `${baseUrl}&${queryString}` : `${baseUrl}?${queryString}`;
};

export const normalizeHydrationRows = (resolved: unknown): Record<string, unknown>[] | undefined => {
  if (!Array.isArray(resolved)) {
    return undefined;
  }

  return resolved.filter((row): row is Record<string, unknown> =>
    typeof row === 'object' && row !== null && !Array.isArray(row),
  );
};

const getFixtureData = (
  fixtureSet: string,
  url: string,
  target: PreviewDataSourceHydrationTarget,
): unknown => {
  const normUrl = url.toLowerCase();
  const normVar = (target.dataVar || '').toLowerCase();

  if (fixtureSet === 'viz-sales-q1') {
    return target.resultShape === 'record'
      ? { label: 'Jan', revenue: 4200, cost: 2800 }
      : [
        { label: 'Jan', revenue: 4200, cost: 2800 },
        { label: 'Feb', revenue: 5100, cost: 3100 },
        { label: 'Mar', revenue: 4800, cost: 2950 },
      ];
  }

  if (fixtureSet === 'viz-org-tree') {
    return target.resultShape === 'record'
      ? { id: 'org-root', label: 'Head Office' }
      : [{ id: 'org-root', label: 'Head Office', children: [{ id: 'sales', label: 'Sales' }] }];
  }

  if (fixtureSet === 'viz-project-timeline') {
    return target.resultShape === 'record'
      ? { id: 'evt-1', title: 'Project kickoff', start: '2026-01-15' }
      : [
        { id: 'evt-1', title: 'Project kickoff', start: '2026-01-15', end: '2026-01-15' },
        { id: 'evt-2', title: 'Design phase', start: '2026-02-01', end: '2026-03-15' },
      ];
  }

  if (fixtureSet === 'empty-state') {
    return target.resultShape === 'record' ? {} : [];
  }

  if (fixtureSet === 'large-dataset') {
    const items = [];
    for (let i = 1; i <= 100; i++) {
      items.push({
        id: i,
        name: `Mock Record ${i}`,
        title: `Mock Title ${i}`,
        value: i * 10,
        email: `user${i}@example.com`,
        status: i % 2 === 0 ? 'Active' : 'Inactive',
        price: Number((i * 1.5).toFixed(2)),
        date: `2026-07-${String((i % 28) + 1).padStart(2, '0')}`,
      });
    }
    return target.resultShape === 'record' ? items[0] : items;
  }

  // default / sales-demo
  if (
    normUrl.includes('product') ||
    normUrl.includes('item') ||
    normUrl.includes('catalog') ||
    normUrl.includes('inventory') ||
    normVar.includes('product') ||
    normVar.includes('item')
  ) {
    const products = [
      { id: 1, name: 'Premium Coffee Beans', price: 14.99, category: 'Beverages', stock: 120, status: 'In Stock' },
      { id: 2, name: 'Loose Leaf Green Tea', price: 9.99, category: 'Beverages', stock: 85, status: 'In Stock' },
      { id: 3, name: 'Espresso Maker', price: 129.99, category: 'Equipment', stock: 15, status: 'Low Stock' },
      { id: 4, name: 'Coffee Grinder', price: 49.99, category: 'Equipment', stock: 0, status: 'Out of Stock' },
    ];
    return target.resultShape === 'record' ? products[0] : products;
  }

  if (
    normUrl.includes('order') ||
    normUrl.includes('sale') ||
    normUrl.includes('transaction') ||
    normUrl.includes('invoice') ||
    normVar.includes('order') ||
    normVar.includes('sale')
  ) {
    const orders = [
      { id: 101, customer: 'Alice Smith', total: 44.97, status: 'Paid', date: '2026-07-01' },
      { id: 102, customer: 'Bob Jones', total: 129.99, status: 'Shipped', date: '2026-07-02' },
      { id: 103, customer: 'Charlie Brown', total: 9.99, status: 'Pending', date: '2026-07-03' },
    ];
    return target.resultShape === 'record' ? orders[0] : orders;
  }

  if (
    normUrl.includes('user') ||
    normUrl.includes('contact') ||
    normUrl.includes('customer') ||
    normUrl.includes('employee') ||
    normUrl.includes('member') ||
    normUrl.includes('profile') ||
    normVar.includes('user') ||
    normVar.includes('contact') ||
    normVar.includes('customer')
  ) {
    const users = [
      { id: 1, name: 'Alice Smith', email: 'alice@example.com', role: 'Customer', status: 'Active' },
      { id: 2, name: 'Bob Jones', email: 'bob@example.com', role: 'Customer', status: 'Active' },
      { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', role: 'Guest', status: 'Pending' },
    ];
    return target.resultShape === 'record' ? users[0] : users;
  }

  const defaultData = [
    { id: 1, title: 'Demo Item 1', value: 'Value 1', status: 'Active' },
    { id: 2, title: 'Demo Item 2', value: 'Value 2', status: 'Inactive' },
  ];
  return target.resultShape === 'record' ? defaultData[0] : defaultData;
};

export const hydrationTotalCountKeyForDataVar = (dataVar: string): string => `${dataVar}__total`;

/** Set on published preview while a store-driven hydration refetch (page/sort/filter) is in flight. */
export const HYDRATION_REFETCH_IN_FLIGHT_KEY = '__designerHydrationRefetchInFlight';

export const isDesignerHydrationRefetchInFlight = (
  dataContext: Record<string, unknown>,
): boolean => dataContext[HYDRATION_REFETCH_IN_FLIGHT_KEY] === true;

/** One silent retry for published shell list hydrations (cold API / aborted first pass). */
export const SHELL_HYDRATION_LIST_RETRY_DELAY_MS = 600;

export const SHELL_HYDRATION_LIST_MAX_ATTEMPTS = 4;

export const hydrationResultsHaveRetryableListErrors = (
  results: Record<string, unknown>,
  targets: PreviewDataSourceHydrationTarget[],
): boolean => {
  for (const target of targets) {
    if (target.resultShape === 'record') {
      continue;
    }
    if (results[`error_${target.dataVar}`] === true && results[target.dataVar] === undefined) {
      return true;
    }
  }
  return false;
};

/** Aborted or skipped list hydrations return `{}` — retry instead of leaving the grid loading forever. */
export const hydrationResultsMissingExpectedListData = (
  results: Record<string, unknown>,
  targets: PreviewDataSourceHydrationTarget[],
): boolean => {
  const listTargets = targets.filter((target) => target.resultShape !== 'record');
  if (listTargets.length === 0) {
    return false;
  }
  return listTargets.some((target) => {
    if (results[`error_${target.dataVar}`] === true) {
      return false;
    }
    return results[target.dataVar] === undefined;
  });
};

export type DesignerHydrationFetchResult = {
  resolved: unknown;
  rawPayload: unknown;
};

export type DesignerHydrationFetchOptions = {
  bypassCache?: boolean;
  /** Skip Data API GET response cache (toolbar refresh / post-mutation list reload). */
  bypassServerCache?: boolean;
  /** Published Studio pages must surface API errors — not sales-demo fixtures. */
  allowFixtureFallback?: boolean;
  signal?: AbortSignal;
};

export const isHydrationFetchAbortError = (error: unknown): boolean => (
  error instanceof DOMException && error.name === 'AbortError'
) || (error instanceof Error && error.name === 'AbortError');

export const fetchDesignerHydrationTargetResult = async (
  target: PreviewDataSourceHydrationTarget,
  designerStore: Record<string, unknown>,
  options: DesignerHydrationFetchOptions = {},
): Promise<DesignerHydrationFetchResult> => {
  const allowFixtureFallback = options.allowFixtureFallback !== false;
  const cacheKey = buildHydrationTargetCacheKey(target, designerStore);

  if (!options.bypassCache) {
    const cached = getCachedHydrationResult(cacheKey);
    if (cached) {
      return cached as Promise<DesignerHydrationFetchResult>;
    }
  }

  const selectedFixtureSet = (designerStore?.fixtureSet as string)
    || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('fixtureSet') : null)
    || 'sales-demo';

  const request = (async (): Promise<DesignerHydrationFetchResult> => {
    let url = resolveHydrationTargetUrl(target, designerStore);
    if (options.bypassServerCache) {
      url = appendDataApiNoCacheQueryParam(url);
    }
    try {
      const response = await designerFetch(url, { signal: options.signal });
      if (!response.ok) {
        throw new Error(`Hydration request failed (${response.status})`);
      }

      const payload = await response.json();
      if (
        payload
        && typeof payload === 'object'
        && !Array.isArray(payload)
        && (payload as Record<string, unknown>).success === false
      ) {
        const record = payload as Record<string, unknown>;
        const message = record.error ?? record.message ?? record.detail;
        throw new Error(typeof message === 'string' && message.trim()
          ? message.trim()
          : 'Request failed');
      }
      return {
        resolved: applyResponseDataPath(payload, target.responseMapping),
        rawPayload: payload,
      };
    } catch (error) {
      if (isHydrationFetchAbortError(error)) {
        throw error;
      }
      if (options.bypassCache || !allowFixtureFallback) {
        throw error;
      }

      const fixtureData = getFixtureData(selectedFixtureSet, url, target);
      return {
        resolved: applyResponseDataPath(fixtureData, target.responseMapping),
        rawPayload: fixtureData,
      };
    }
  })();

  if (!options.bypassCache) {
    setCachedHydrationResult(cacheKey, request);
    void request.catch(() => {
      invalidateHydrationCache(cacheKey);
    });
  }

  return request;
};

export const fetchDesignerHydrationTarget = async (
  target: PreviewDataSourceHydrationTarget,
  designerStore: Record<string, unknown>,
  options: DesignerHydrationFetchOptions = {},
): Promise<unknown> => {
  const { resolved } = await fetchDesignerHydrationTargetResult(target, designerStore, options);
  return resolved;
};

export const fetchDesignerHydrationData = async (
  targets: PreviewDataSourceHydrationTarget[],
  designerStore: Record<string, unknown>,
  options: DesignerHydrationFetchOptions = {},
): Promise<Record<string, unknown>> => {
  const results: Record<string, unknown> = {};

  await Promise.all(targets.map(async (target) => {
    if (shouldSkipPreviewHydrationTarget(target, designerStore)) {
      return;
    }

    try {
      const { resolved, rawPayload } = await fetchDesignerHydrationTargetResult(target, designerStore, options);
      const normalized = normalizeHydrationResolvedValue(
        resolved,
        target.resultShape ?? (Object.keys(target.urlParams ?? {}).length > 0 ? 'record' : 'rows'),
      );

      if (normalized !== undefined && normalized !== null) {
        results[target.dataVar] = normalized;
      }

      const totalPath = target.responseMapping?.totalPath?.trim();
      if (
        totalPath
        && (target.resultShape === 'rows' || (target.resultShape ?? 'rows') === 'rows')
      ) {
        const total = readResponseTotalCount(rawPayload, totalPath);
        if (Number.isFinite(total) && total >= 0) {
          results[hydrationTotalCountKeyForDataVar(target.dataVar)] = total;
        }
      }
    } catch (error) {
      if (isHydrationFetchAbortError(error)) {
        return;
      }
      if (options.allowFixtureFallback === false) {
        results[`error_${target.dataVar}`] = true;
      }
    }
  }));

  return results;
};

/** Keep stale list rows visible when a later page/filter fetch fails (504, etc.). */
export const pruneHydrationGridErrorsWhenRowsPresent = (
  next: Record<string, unknown>,
  targets: PreviewDataSourceHydrationTarget[],
): void => {
  for (const target of targets) {
    if (target.resultShape === 'record') {
      continue;
    }
    const errorKey = `error_${target.dataVar}`;
    if (next[errorKey] !== true) {
      continue;
    }
    const rows = next[target.dataVar];
    if (Array.isArray(rows) && rows.length > 0) {
      delete next[errorKey];
    }
  }
};
