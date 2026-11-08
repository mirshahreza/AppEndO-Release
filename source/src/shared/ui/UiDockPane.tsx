import * as React from 'react';
import { cn } from '../../lib/utils';

export const UI_DOCK_PANE_EDGES = ['left', 'right', 'top', 'bottom'] as const;

export type UiDockPaneDock = (typeof UI_DOCK_PANE_EDGES)[number];

export type UiDockPaneProps = React.HTMLAttributes<HTMLDivElement> & {
  dock?: UiDockPaneDock;
};

export const isUiDockPaneDock = (value: unknown): value is UiDockPaneDock =>
  value === 'left' || value === 'right' || value === 'top' || value === 'bottom';

export const readUiDockPaneDock = (value: unknown): UiDockPaneDock =>
  isUiDockPaneDock(value) ? value : 'left';

export const UI_DOCK_PANE_EDGE_CLASS: Record<UiDockPaneDock, string> = {
  left: 'flex h-full min-h-0 w-64 shrink-0 flex-col border-e border-default-200',
  right: 'flex h-full min-h-0 w-64 shrink-0 flex-col border-s border-default-200',
  top: 'flex min-h-14 w-full shrink-0 flex-row border-b border-default-200',
  bottom: 'flex min-h-14 w-full shrink-0 flex-row border-t border-default-200',
};

export const isVerticalUiDockPane = (dock: UiDockPaneDock): boolean =>
  dock === 'top' || dock === 'bottom';

export const isLeadingUiDockPane = (dock: UiDockPaneDock): boolean =>
  dock === 'left' || dock === 'top';

export const UiDockPane: React.FC<UiDockPaneProps> = ({
  dock: dockProp = 'left',
  className,
  children,
  ...rest
}) => {
  const dock = readUiDockPaneDock(dockProp);

  return (
    <div
      {...rest}
      className={cn(UI_DOCK_PANE_EDGE_CLASS[dock], className)}
      data-dock={dock}
    >
      {children}
    </div>
  );
};
