import type { DesignerApiOperationMethod } from '../../../domain/component-designer/types';
import type { AccessibleApiRouteItem } from '../../../shared/api/contracts/my-apis/types';

export const API_ENDPOINT_METHODS: readonly DesignerApiOperationMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
];

export const normalizeApiEndpointMethod = (method: string): DesignerApiOperationMethod => {
  const upper = method.trim().toUpperCase();
  return (API_ENDPOINT_METHODS as readonly string[]).includes(upper)
    ? (upper as DesignerApiOperationMethod)
    : 'GET';
};

export const normalizeApiEndpointPath = (value: string): string => (
  value.trim().replace(/\/+$/, '').toLowerCase()
);

export const filterAccessibleApiRoutes = (
  routes: AccessibleApiRouteItem[],
  term: string,
  methodFilter?: readonly DesignerApiOperationMethod[],
): AccessibleApiRouteItem[] => {
  const allowed = methodFilter && methodFilter.length > 0
    ? new Set(methodFilter.map((entry) => entry.toUpperCase()))
    : null;

  const scoped = allowed
    ? routes.filter((route) => allowed.has(route.method.toUpperCase()))
    : routes;

  const normalizedTerm = term.trim().toLowerCase();
  if (!normalizedTerm) {
    return scoped;
  }

  return scoped.filter((route) => (
    route.path.toLowerCase().includes(normalizedTerm)
    || route.name.toLowerCase().includes(normalizedTerm)
    || route.method.toLowerCase().includes(normalizedTerm)
    || route.folder.toLowerCase().includes(normalizedTerm)
  ));
};

export const findAccessibleApiRouteMatch = (
  routes: AccessibleApiRouteItem[],
  path: string,
  method: DesignerApiOperationMethod,
): AccessibleApiRouteItem | undefined => {
  const target = normalizeApiEndpointPath(path);
  if (!target) {
    return undefined;
  }

  const matches = routes.filter((route) => normalizeApiEndpointPath(route.path) === target);
  if (matches.length === 0) {
    return undefined;
  }

  return matches.find((route) => normalizeApiEndpointMethod(route.method) === method) ?? matches[0];
};

export const groupAccessibleApiRoutes = (
  routes: AccessibleApiRouteItem[],
): Array<[string, AccessibleApiRouteItem[]]> => {
  const groups = new Map<string, AccessibleApiRouteItem[]>();
  for (const route of routes) {
    const folder = route.folder.trim() || 'General';
    const bucket = groups.get(folder);
    if (bucket) {
      bucket.push(route);
    } else {
      groups.set(folder, [route]);
    }
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
};
