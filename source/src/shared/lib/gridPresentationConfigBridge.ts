import type { GridCardBelowTier, GridPresentationMode } from './appTableGridPresentation';
import type { GridCompactCardsPerRow, GridCompactLayout } from './gridCompactViewport';

export type GridPresentationInheritLayout = 'inherit' | GridCompactLayout;
export type GridPresentationTriState = 'inherit' | 'on' | 'off';

/** AppTableGrid presentation + compact policy shared by Base Components and CRUD Set configurators. */
export type GridPresentationFieldsConfig = {
  presentation: GridPresentationMode;
  cardBelow: GridCardBelowTier;
  compactPhoneLayout: GridPresentationInheritLayout;
  compactTabletLayout: GridPresentationInheritLayout;
  compactShowActions: boolean;
  compactTabletCardsPerRow?: GridCompactCardsPerRow;
  compactFreezeFirstColumn?: GridPresentationTriState;
  compactCollapseExtraFields?: boolean;
  compactVisibleFieldCount?: number;
  compactShowMeta?: boolean;
};

export type GridRowActionsFieldsConfig = {
  rowActions: boolean;
  maxVisibleActions: number;
};

type CrudSetCompactLike = {
  phoneLayout?: GridPresentationInheritLayout;
  tabletLayout?: GridPresentationInheritLayout;
  tabletCardsPerRow?: GridCompactCardsPerRow;
  freezeFirstColumn?: GridPresentationTriState;
  collapseExtraFields?: boolean;
  visibleFieldCount?: number;
  showActions?: boolean;
  showMeta?: boolean;
};

type CrudSetGridLike = {
  presentation?: GridPresentationMode;
  cardBelow?: GridCardBelowTier;
  compact?: CrudSetCompactLike;
};

export const gridPresentationFieldsFromCrudSetGrid = (
  grid: CrudSetGridLike,
  defaults: {
    presentation: GridPresentationMode;
    cardBelow: GridCardBelowTier;
  },
): GridPresentationFieldsConfig => {
  const compact = grid.compact ?? {};
  return {
    presentation: grid.presentation ?? defaults.presentation,
    cardBelow: grid.cardBelow ?? defaults.cardBelow,
    compactPhoneLayout: compact.phoneLayout ?? 'inherit',
    compactTabletLayout: compact.tabletLayout ?? 'inherit',
    compactTabletCardsPerRow: compact.tabletCardsPerRow,
    compactFreezeFirstColumn: compact.freezeFirstColumn,
    compactCollapseExtraFields: compact.collapseExtraFields,
    compactVisibleFieldCount: compact.visibleFieldCount,
    compactShowActions: compact.showActions !== false,
    compactShowMeta: compact.showMeta !== false,
  };
};

export const crudSetGridPatchFromPresentationFields = (
  patch: Partial<GridPresentationFieldsConfig>,
  current: CrudSetGridLike,
): CrudSetGridLike => {
  const compact = current.compact ?? {};
  const nextCompact: CrudSetCompactLike = { ...compact };

  if (patch.compactPhoneLayout != null) {
    nextCompact.phoneLayout = patch.compactPhoneLayout;
  }
  if (patch.compactTabletLayout != null) {
    nextCompact.tabletLayout = patch.compactTabletLayout;
  }
  if (patch.compactTabletCardsPerRow != null) {
    nextCompact.tabletCardsPerRow = patch.compactTabletCardsPerRow;
  }
  if (patch.compactFreezeFirstColumn != null) {
    nextCompact.freezeFirstColumn = patch.compactFreezeFirstColumn;
  }
  if (patch.compactCollapseExtraFields != null) {
    nextCompact.collapseExtraFields = patch.compactCollapseExtraFields;
  }
  if (patch.compactVisibleFieldCount != null) {
    nextCompact.visibleFieldCount = patch.compactVisibleFieldCount;
  }
  if (patch.compactShowActions != null) {
    nextCompact.showActions = patch.compactShowActions;
  }
  if (patch.compactShowMeta != null) {
    nextCompact.showMeta = patch.compactShowMeta;
  }

  return {
    ...current,
    ...(patch.presentation != null ? { presentation: patch.presentation } : {}),
    ...(patch.cardBelow != null ? { cardBelow: patch.cardBelow } : {}),
    compact: nextCompact,
  };
};
