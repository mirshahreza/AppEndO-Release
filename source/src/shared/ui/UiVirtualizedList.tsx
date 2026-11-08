import React, { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '../../lib/utils';
import {
  GRID_TABLE_ROW_ESTIMATE_PX,
  GRID_VIRTUAL_OVERSCAN,
} from '../lib/gridVirtualizationConstants';

export type UiVirtualizedListItem = {
  id: string;
  label: string;
  hint?: string;
};

export type UiVirtualizedListProps = {
  items?: readonly UiVirtualizedListItem[];
  itemCount?: number;
  labelPrefix?: string;
  height?: number;
  estimateSize?: number;
  className?: string;
};

const buildRows = (
  items: readonly UiVirtualizedListItem[] | undefined,
  itemCount: number,
  labelPrefix: string,
): UiVirtualizedListItem[] => {
  if (items && items.length > 0) {
    if (items.length >= itemCount) {
      return [...items];
    }
    const extra = Array.from({ length: itemCount - items.length }, (_, index) => {
      const number = items.length + index + 1;
      return { id: `row-${number}`, label: `${labelPrefix} ${number}` };
    });
    return [...items, ...extra];
  }
  return Array.from({ length: Math.max(0, itemCount) }, (_, index) => ({
    id: `row-${index + 1}`,
    label: `${labelPrefix} ${index + 1}`,
  }));
};

/** Non-table long list that only mounts visible rows. */
export const UiVirtualizedList: React.FC<UiVirtualizedListProps> = ({
  items,
  itemCount = 80,
  labelPrefix = 'Row',
  height = 240,
  estimateSize = GRID_TABLE_ROW_ESTIMATE_PX,
  className,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rows = useMemo(
    () => buildRows(items, itemCount, labelPrefix),
    [items, itemCount, labelPrefix],
  );
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    overscan: GRID_VIRTUAL_OVERSCAN,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <div
      ref={scrollRef}
      className={cn('w-full max-w-md overflow-auto rounded-lg border border-slate-200 bg-white', className)}
      style={{ height }}
    >
      <ul className="relative m-0 list-none p-0" style={{ height: rowVirtualizer.getTotalSize() }}>
        {virtualRows.map((virtualRow) => {
          const row = rows[virtualRow.index];
          if (!row) {
            return null;
          }
          return (
            <li
              key={row.id}
              className="absolute start-0 top-0 flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3"
              style={{ height: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }}
            >
              <span className="truncate text-sm text-slate-800">{row.label}</span>
              {row.hint ? <span className="shrink-0 text-[11px] text-cyan-700">{row.hint}</span> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
