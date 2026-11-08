import React from 'react';
import { cn } from '../../../lib/utils';
import { LIST_PAGE_TOOLBAR_SCROLL_HOST_CLASS } from './listPageToolbarScrollChrome';
import { useListPageToolbarScrollContext } from './ListPageToolbarScrollContext';

export type ListPageToolbarScrollHostProps = {
  collapsed?: boolean;
  className?: string;
  children: React.ReactNode;
};

/**
 * Animates list toolbar hide/show (grid 0fr/1fr + inner fade). Wrap the `PAGE_TOOLBAR_*` root — do not
 * put `page-toolbar-scroll-collapsed` height hacks on the toolbar when this host is used.
 */
export function ListPageToolbarScrollHost({
  collapsed = false,
  className,
  children,
}: ListPageToolbarScrollHostProps) {
  return (
    <div
      className={cn(LIST_PAGE_TOOLBAR_SCROLL_HOST_CLASS, className)}
      data-list-page-toolbar-scroll-host=""
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <div className="list-page-toolbar-scroll-host-clip min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

export type ListPageToolbarScrollRootProps = {
  /** When omitted, uses `ListPageColumn` / `ListPageToolbarScrollProvider` context. */
  collapsed?: boolean;
  className?: string;
  children: React.ReactNode;
};

/** Host + single toolbar root (`PAGE_TOOLBAR_*` className on the inner div). */
export function ListPageToolbarScrollRoot({
  collapsed: collapsedProp,
  className,
  children,
}: ListPageToolbarScrollRootProps) {
  const scrollContext = useListPageToolbarScrollContext();
  const collapsed = collapsedProp ?? scrollContext?.listToolbarCollapsed ?? false;

  return (
    <ListPageToolbarScrollHost collapsed={collapsed}>
      <div className={className}>{children}</div>
    </ListPageToolbarScrollHost>
  );
}
