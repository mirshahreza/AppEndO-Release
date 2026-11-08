import React, { type UIEvent } from 'react';
import { cn } from '../../../lib/utils';
import {
  ListPageToolbarScrollProvider,
  useListPageToolbarScrollContext,
} from './ListPageToolbarScrollContext';
import { ListPageToolbarScrollRoot } from './ListPageToolbarScrollHost';
import { PAGE_TOOLBAR_SINGLE_ROW_CLASS } from '../surfaceClasses';

export type ListPageShellProps = {
  children: React.ReactNode;
  className?: string;
  'data-testid'?: string;
  /**
   * Extra grid scroll work (infinite load, `presentation.handleScrollEnd`, …).
   * Toolbar collapse is always wired by the shell — do not call `useListPageToolbarScroll` in feature hooks.
   */
  onGridScroll?: (event: UIEvent<HTMLDivElement>) => void;
};

/**
 * Canonical root for every full-height admin list (CRUD, ops lists, settings grids).
 * One provider per page: collapsing toolbar + `AppTableGrid` scroll merge via context.
 */
export function ListPageShell({
  children,
  className,
  onGridScroll,
  'data-testid': dataTestId,
}: ListPageShellProps) {
  return (
    <ListPageToolbarScrollProvider onGridScroll={onGridScroll}>
      <div
        data-testid={dataTestId}
        className={cn('flex h-full min-h-0 w-full flex-col bg-white font-sans', className)}
      >
        {children}
      </div>
    </ListPageToolbarScrollProvider>
  );
}

/** @deprecated Use `ListPageShell` */
export const ListPageColumn = ListPageShell;

export type ListPageToolbarFrameProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Standard list toolbar row: scroll-collapse host + `PAGE_TOOLBAR_SINGLE_ROW_CLASS`.
 * Must be a descendant of `ListPageShell` (collapse state comes from context).
 */
export function ListPageToolbarFrame({ children, className }: ListPageToolbarFrameProps) {
  const scroll = useListPageToolbarScrollContext();
  const collapsed = scroll?.listToolbarCollapsed ?? false;

  return (
    <ListPageToolbarScrollRoot
      collapsed={collapsed}
      className={cn(`${PAGE_TOOLBAR_SINGLE_ROW_CLASS} justify-between gap-2 lg:gap-3`, className)}
    >
      {children}
    </ListPageToolbarScrollRoot>
  );
}
