import { useMemo } from 'react';
import {
  changeReasonPolicySchema,
  functionChangeReasonFallback,
  type ChangeReasonPolicy,
} from '../contracts/record-events';
import { useServerFunctionsCatalogQuery } from './server-functions';

const catalogRouteKey = (method: string, path: string): string => {
  const withoutQuery = path.split('?')[0]?.trim() || '/';
  const normalized = withoutQuery.length > 1 && withoutQuery.endsWith('/')
    ? withoutQuery.slice(0, -1)
    : withoutQuery;
  return `${method.toUpperCase()} ${normalized}`;
};

export const useNamedApiChangeReasonPolicy = (
  method: string,
  path: string,
  fallback: ChangeReasonPolicy,
): ChangeReasonPolicy => {
  const catalog = useServerFunctionsCatalogQuery();
  return useMemo(() => {
    const key = catalogRouteKey(method, path);
    const fn = catalog.data?.functions.find((item) => catalogRouteKey(item.method, item.path) === key);
    const parsed = changeReasonPolicySchema.safeParse(fn?.metadataJson?.changeReason);
    if (parsed.success) {
      return { ...fallback, ...parsed.data };
    }
    return functionChangeReasonFallback(method, path) ?? fallback;
  }, [catalog.data?.functions, fallback, method, path]);
};
