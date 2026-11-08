import { useCallback, useEffect, useState } from 'react';
import { useOptionalGridColumnLayouts } from '../../contexts/GridColumnLayoutsContext';
import {
  areColumnLayoutsEqual,
  createDefaultColumnLayout,
  sanitizeColumnLayout,
  type GridColumnLayoutChangeMeta,
  type GridColumnLayoutState,
} from './appTableGridColumnLayout';
import type { AppTableGridColumnDef } from './appTableGridQuery';
import { resolveStoredGridColumnLayout } from './userGridColumnLayouts';
import { flushStoredColumnLayout, persistStoredColumnLayout, resolveStoredColumnLayout } from './listPreferencesStorage';

export type UseGridColumnLayoutOptions<TRow> = {
  columns: ReadonlyArray<AppTableGridColumnDef<TRow>>;
  gridId?: string;
  initialLayout?: GridColumnLayoutState;
  onLayoutChange?: (layout: GridColumnLayoutState, meta: GridColumnLayoutChangeMeta) => void;
};

export function useGridColumnLayout<TRow>({
  columns,
  gridId,
  initialLayout,
  onLayoutChange,
}: UseGridColumnLayoutOptions<TRow>) {
  const gridLayouts = useOptionalGridColumnLayouts();
  const storedLayout = resolveStoredGridColumnLayout(gridLayouts?.layouts ?? {}, gridId);
  const storedLocalLayout = gridId ? resolveStoredColumnLayout(gridId) : null;

  const [layout, setLayout] = useState<GridColumnLayoutState>(() => {
    const seed = storedLayout ?? storedLocalLayout ?? initialLayout ?? createDefaultColumnLayout(columns);
    return sanitizeColumnLayout(seed, columns);
  });

  useEffect(() => {
    if (!gridId || !gridLayouts) {
      return;
    }
    const nextStoredLayout = gridLayouts.getLayout(gridId);
    if (!nextStoredLayout) {
      return;
    }
    setLayout((current) => {
      const sanitized = sanitizeColumnLayout(nextStoredLayout, columns);
      return areColumnLayoutsEqual(current, sanitized) ? current : sanitized;
    });
  }, [columns, gridId, gridLayouts]);

  useEffect(() => {
    setLayout((current) => {
      const sanitized = sanitizeColumnLayout(current, columns);
      return areColumnLayoutsEqual(current, sanitized) ? current : sanitized;
    });
  }, [columns]);

  const commitLayout = useCallback((
    nextLayout: GridColumnLayoutState,
    meta: GridColumnLayoutChangeMeta,
  ) => {
    const sanitized = sanitizeColumnLayout(nextLayout, columns);
    setLayout((current) => (areColumnLayoutsEqual(current, sanitized) ? current : sanitized));
    if (gridId && gridLayouts) {
      gridLayouts.persistLayout(gridId, sanitized);
    }
    if (gridId) {
      persistStoredColumnLayout(gridId, sanitized);
    }
    onLayoutChange?.(sanitized, meta);
  }, [columns, gridId, gridLayouts, onLayoutChange]);

  useEffect(() => () => {
    if (gridId) {
      flushStoredColumnLayout(gridId);
    }
  }, [gridId]);

  return {
    layout,
    setLayout: commitLayout,
  };
}

