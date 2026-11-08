import { DEFAULT_APP_TABLE_GRID_CELL_PADDING_X_PX } from './appTableGridShell';
import { APP_TABLE_GRID_LAST_COLUMN_OVERLAY_INSET_PX } from '../ui/surfaceClasses';
import type { ViewportTier } from './viewportTokens';
import type { GridColumnHideBelow } from './appTableGridQuery';
import type { AppTableGridCardVariant } from './appTableGridCardView';

export type GridRowActionIntent =
  | 'view'
  | 'edit'
  | 'delete'
  | 'access'
  | 'utility'
  | 'warning';

export type GridCardActionsPlacement = 'footer' | 'header' | 'none';

export type GridCardActionsChrome = 'footer' | 'header' | 'header-hover' | 'none';

export type GridCardVariantForActions = AppTableGridCardVariant;

/** Default inline icon budget before remaining actions collapse into the overflow menu. */
export const DEFAULT_GRID_MAX_VISIBLE_ACTIONS = 3;

/** Card footer inline budget when `cardActionsMaxVisible` is omitted on `AppTableGrid`. */
export function resolveGridCardActionsMaxVisible(
  viewportTier: ViewportTier,
  override?: number,
): number {
  if (override !== undefined && Number.isFinite(override)) {
    return Math.max(1, Math.floor(override));
  }
  if (viewportTier === 'phone') {
    return 1;
  }
  if (viewportTier === 'tablet') {
    return 2;
  }
  return DEFAULT_GRID_MAX_VISIBLE_ACTIONS;
}

/** Horizontal cell padding used by the actions-column width formula (cellPaddingX on each side). */
const GRID_ACTIONS_CELL_PADDING_PX = DEFAULT_APP_TABLE_GRID_CELL_PADDING_X_PX * 2;

/** One 20px icon plus a 7px separator (3px + 1px border + 3px) between tools. */
export const GRID_ACTION_SLOT_PX = 20;
export const GRID_ACTION_GAP_PX = 7;

/**
 * Width budget for an actions column: padding + (20 × slots) + (7 × (slots − 1)).
 * `slotCount` is the number of visible tools including the overflow trigger.
 */
export function gridActionsColumnWidth(slotCount: number): number {
  const slots = Math.max(1, Math.floor(slotCount));
  return GRID_ACTIONS_CELL_PADDING_PX + GRID_ACTION_SLOT_PX * slots + GRID_ACTION_GAP_PX * Math.max(0, slots - 1);
}

/**
 * Last-column actions width on self-scrolling AppTableGrid with default overlay scroll gutter
 * (+{@link APP_TABLE_GRID_LAST_COLUMN_OVERLAY_INSET_PX}px inline padding per side on last cells).
 */
export function gridActionsColumnWidthForOverlayLastColumn(slotCount: number): number {
  return gridActionsColumnWidth(slotCount) + APP_TABLE_GRID_LAST_COLUMN_OVERLAY_INSET_PX * 2;
}

export function resolveGridActionSlotCount(actionCount: number, maxVisible: number): number {
  const visible = Math.max(1, Math.floor(maxVisible));
  const count = Math.max(0, actionCount);
  if (count <= visible) {
    return Math.max(1, count);
  }
  return visible;
}

export type GridRowActionCardFooterFields = {
  id: string;
  cardLabeled?: boolean;
  disabled?: boolean;
};

/**
 * Card footers: keep `cardLabeled` on the first enabled action when the designated
 * primary is disabled (e.g. ADMIN role with edit locked on phone's single visible slot).
 */
export function orderCardFooterGridRowActions<T extends GridRowActionCardFooterFields>(
  actions: readonly T[],
): T[] {
  const labeledDisabled = actions.some((action) => action.cardLabeled && action.disabled);
  if (!labeledDisabled) {
    return [
      ...actions.filter((action) => action.cardLabeled),
      ...actions.filter((action) => !action.cardLabeled),
    ];
  }

  const firstEnabled = actions.find((action) => !action.disabled);
  if (!firstEnabled) {
    return [
      ...actions.filter((action) => action.cardLabeled),
      ...actions.filter((action) => !action.cardLabeled),
    ];
  }

  const resolved = actions.map((action) => ({
    ...action,
    cardLabeled: action.id === firstEnabled.id,
  }));
  return [
    ...resolved.filter((action) => action.cardLabeled),
    ...resolved.filter((action) => !action.cardLabeled),
  ];
}

export function splitGridRowActions<T>(
  actions: readonly T[],
  maxVisible: number = DEFAULT_GRID_MAX_VISIBLE_ACTIONS,
): { inline: T[]; overflow: T[] } {
  const visible = Math.max(1, Math.floor(maxVisible));
  if (actions.length <= visible) {
    return { inline: [...actions], overflow: [] };
  }
  // Reserve one slot for the overflow trigger, but always keep at least one inline action.
  const inlineCount = Math.max(1, visible - 1);
  return {
    inline: actions.slice(0, inlineCount),
    overflow: actions.slice(inlineCount),
  };
}

export function isColumnHiddenAtViewport(
  hideBelow: GridColumnHideBelow | undefined,
  viewportTier: ViewportTier,
): boolean {
  if (!hideBelow) {
    return false;
  }
  if (hideBelow === 'md') {
    return viewportTier === 'phone';
  }
  return viewportTier === 'phone' || viewportTier === 'tablet';
}

export function resolveCardActionsChrome(
  placement: GridCardActionsPlacement | undefined,
  _variant?: AppTableGridCardVariant,
): GridCardActionsChrome {
  if (placement === 'none' || placement === 'header') {
    return placement;
  }
  return 'footer';
}
