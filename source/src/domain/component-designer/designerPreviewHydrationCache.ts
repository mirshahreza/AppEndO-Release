import type { PreviewDataSourceHydrationTarget } from './bindingDynamicActionsCodegen';
import { resolveHydrationTargetUrl } from './designerPreviewHydration';

const hydrationResultCache = new Map<string, Promise<unknown>>();

export const buildHydrationTargetCacheKey = (
  target: PreviewDataSourceHydrationTarget,
  designerStore: Record<string, unknown>,
): string => {
  const url = resolveHydrationTargetUrl(target, designerStore);
  const fixtureSet = (designerStore?.fixtureSet as string)
    || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('fixtureSet') : null)
    || 'sales-demo';
  return `${target.dataVar}\0${url}\0${fixtureSet}`;
};

export const buildHydrationPlanKey = (
  targets: PreviewDataSourceHydrationTarget[],
): string =>
  targets
    .map((target) => `${target.dataVar}\0${target.endpoint}\0${JSON.stringify(target.urlParams ?? {})}\0${JSON.stringify(target.queryParams ?? {})}`)
    .join('\n');

export const getCachedHydrationResult = (
  cacheKey: string,
): Promise<unknown> | undefined => hydrationResultCache.get(cacheKey);

export const setCachedHydrationResult = (
  cacheKey: string,
  result: Promise<unknown>,
): void => {
  hydrationResultCache.set(cacheKey, result);
};

export const invalidateHydrationCache = (cacheKey?: string): void => {
  if (!cacheKey) {
    hydrationResultCache.clear();
    return;
  }

  hydrationResultCache.delete(cacheKey);
};

export const invalidateHydrationCacheForTarget = (
  target: PreviewDataSourceHydrationTarget,
  designerStore: Record<string, unknown>,
): void => {
  invalidateHydrationCache(buildHydrationTargetCacheKey(target, designerStore));
};

export const __resetHydrationCacheForTests = (): void => {
  hydrationResultCache.clear();
};
