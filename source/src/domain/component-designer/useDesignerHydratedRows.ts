import * as React from 'react';
import { collectPreviewDataSourceHydrationTargets } from './bindingDynamicActionsCodegen';
import { buildHydrationTargetCacheKey } from './designerPreviewHydrationCache';
import {
  fetchDesignerHydrationTarget,
  normalizeHydrationRows,
  shouldSkipPreviewHydrationTarget,
} from './designerPreviewHydration';
import type { DesignerBindingDefinitions, DesignerDocument } from './types';

export type DesignerHydratedRowsState = {
  rows: Record<string, unknown>[] | undefined;
  isLoading: boolean;
  refresh: () => void;
};

/**
 * Bug found (parity audit item 0): the canvas's only live-data hook for a Data Source Hydration
 * target (previously `useDesignerGridListRows`, grid-only) always rebuilt a fresh, DEFAULT
 * `designerStore` from `bindingDefinitions` instead of reading the live/current store, and its
 * `useEffect` dependency array never included anything store-derived — so a toolbar
 * search/filter/date-range value never triggered a real refetch, in the canvas OR (since charts
 * and non-chart viz widgets had no hydration hook here at all) anywhere in the live Designer.
 * `resolveHydrationTargetUrl`/`buildHydrationTargetCacheKey` already build the fetch URL (and a
 * cache key) directly from a passed-in `designerStore`, including toolbar-driven `queryParams` —
 * this hook just never passed the real one in, or re-ran when it changed. Generalized (grid was
 * the only caller before) so chart/viz canvas hydration can reuse the same, now-reactive,
 * mechanism instead of duplicating it.
 */
export const useDesignerHydratedRows = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
  dataVar: string | undefined,
  designerStore: Record<string, unknown> | undefined,
): DesignerHydratedRowsState => {
  const [rows, setRows] = React.useState<Record<string, unknown>[] | undefined>(undefined);
  const [isLoading, setIsLoading] = React.useState(true);
  const [refreshNonce, setRefreshNonce] = React.useState(0);

  const hydrationTarget = React.useMemo(() => {
    if (!dataVar) {
      return undefined;
    }
    const targets = collectPreviewDataSourceHydrationTargets(document, bindingDefinitions);
    return targets.find((target) => target.dataVar === dataVar);
  }, [bindingDefinitions, dataVar, document]);

  const store = designerStore ?? {};
  const cacheKey = hydrationTarget ? buildHydrationTargetCacheKey(hydrationTarget, store) : undefined;

  const refresh = React.useCallback(() => {
    setRefreshNonce((previous) => previous + 1);
  }, []);

  React.useEffect(() => {
    if (!hydrationTarget) {
      setRows(undefined);
      setIsLoading(false);
      return undefined;
    }

    let cancelled = false;
    setIsLoading(true);

    if (shouldSkipPreviewHydrationTarget(hydrationTarget, store)) {
      setRows([]);
      setIsLoading(false);
      return undefined;
    }

    void fetchDesignerHydrationTarget(hydrationTarget, store, {
      bypassCache: refreshNonce > 0,
      bypassServerCache: refreshNonce > 0,
    })
      .then((resolved) => {
        if (cancelled) {
          return;
        }
        setRows(normalizeHydrationRows(resolved) ?? []);
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setRows([]);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrationTarget, cacheKey, refreshNonce]);

  return { rows, isLoading, refresh };
};
