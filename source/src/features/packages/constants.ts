import { gridActionsColumnWidthForOverlayLastColumn } from '../../shared/lib/gridRowActions';

/** Three icon tools (view, download, delete) — ui-grid §Actions column + last-column overlay inset. */
export const ACTION_COLUMN_WIDTH = gridActionsColumnWidthForOverlayLastColumn(3);

export const PACKAGE_GRID_VERSION_COLUMN_WIDTH = 125;
export const PACKAGE_GRID_DEPENDENCY_COLUMN_WIDTH = 125;
/** Install/uninstall, repair, and repack share one column. */
export const PACKAGE_GRID_OPERATIONS_COLUMN_WIDTH = 344;

export const packageGridColumnStyle = (width: number) =>
  ({
    width: `${width}px`,
    minWidth: `${width}px`,
    maxWidth: `${width}px`,
  }) as const;

/** Keeps Uninstall / Repair / Repack the same width, height, and type inside the operations group. */
export const PACKAGE_GRID_OPERATION_BUTTON_EXTRA_CLASS =
  'box-border shrink-0 min-w-[6.5rem] px-2';
