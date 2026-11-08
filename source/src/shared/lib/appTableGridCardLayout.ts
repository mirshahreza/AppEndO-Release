import type React from 'react';
import type { AppTableGridColumnDef, GridColumnCardRole } from './appTableGridQuery';
import { isColumnHiddenAtViewport } from './gridRowActions';
import type { ViewportTier } from './viewportTokens';

export type ResolvedCardColumn<TRow> = {
  column: AppTableGridColumnDef<TRow>;
  role: GridColumnCardRole;
  label: React.ReactNode;
  priority: number;
};

export type ResolvedCardLayout<TRow> = {
  title: ResolvedCardColumn<TRow> | null;
  subtitle: ResolvedCardColumn<TRow> | null;
  media: ResolvedCardColumn<TRow> | null;
  meta: ReadonlyArray<ResolvedCardColumn<TRow>>;
  fields: ReadonlyArray<ResolvedCardColumn<TRow>>;
  actions: ResolvedCardColumn<TRow> | null;
};

const AUDIT_COLUMN_IDS = new Set(['created_at', 'updated_at', 'created_by', 'updated_by']);

function isActionsColumn<TRow>(column: AppTableGridColumnDef<TRow>): boolean {
  return column.id === 'actions' || column.id.endsWith('_actions') || column.id === 'detail';
}

function resolveViewportRole<TRow>(
  column: AppTableGridColumnDef<TRow>,
  role: GridColumnCardRole,
  viewportTier: ViewportTier,
): GridColumnCardRole {
  if (viewportTier === 'phone' && column.card?.phoneRole) {
    return column.card.phoneRole;
  }
  if (viewportTier === 'tablet' && column.card?.tabletRole) {
    return column.card.tabletRole;
  }
  return role;
}

function resolveExplicitRole<TRow>(
  column: AppTableGridColumnDef<TRow>,
): GridColumnCardRole | null {
  if (column.card?.role) {
    return column.card.role;
  }
  return null;
}

function inferCardRole<TRow>(
  column: AppTableGridColumnDef<TRow>,
  columns: ReadonlyArray<AppTableGridColumnDef<TRow>>,
): GridColumnCardRole {
  if (isActionsColumn(column)) {
    return 'actions';
  }
  if (column.id === 'id') {
    return 'hidden';
  }
  if (AUDIT_COLUMN_IDS.has(column.id)) {
    return 'meta';
  }

  const hasExplicitTitle = columns.some((entry) => entry.card?.role === 'title');
  if (!hasExplicitTitle) {
    const firstDataColumn = columns.find((entry) => {
      const role = resolveExplicitRole(entry);
      if (role) {
        return role === 'title';
      }
      return !isActionsColumn(entry) && entry.id !== 'id' && !AUDIT_COLUMN_IDS.has(entry.id);
    });
    if (firstDataColumn?.id === column.id) {
      return 'title';
    }
  }

  return 'field';
}

function resolveCardRole<TRow>(
  column: AppTableGridColumnDef<TRow>,
  columns: ReadonlyArray<AppTableGridColumnDef<TRow>>,
): GridColumnCardRole {
  return resolveExplicitRole(column) ?? inferCardRole(column, columns);
}

/** Canonical default `card.role` for a column. Consumers map their column model to `AppTableGridColumnDef.card`. */
export function resolveColumnCardRole<TRow>(
  column: AppTableGridColumnDef<TRow>,
  columns: ReadonlyArray<AppTableGridColumnDef<TRow>>,
): GridColumnCardRole {
  return resolveCardRole(column, columns);
}

function resolveCardLabel<TRow>(
  column: AppTableGridColumnDef<TRow>,
  role: GridColumnCardRole,
): React.ReactNode {
  if (role === 'media') {
    return '';
  }
  if (column.card?.label !== undefined) {
    return column.card.label;
  }
  return column.label;
}

function resolveCardPriority<TRow>(column: AppTableGridColumnDef<TRow>, role: GridColumnCardRole): number {
  if (column.card?.priority != null) {
    return column.card.priority;
  }
  if (role === 'media') {
    return -20;
  }
  if (role === 'title') {
    return 0;
  }
  if (role === 'subtitle') {
    return 10;
  }
  if (role === 'actions') {
    return 1000;
  }
  if (role === 'meta') {
    return 500 + (AUDIT_COLUMN_IDS.has(column.id) ? 1 : 0);
  }
  return 100;
}

export function resolveCardLayout<TRow>(
  columns: ReadonlyArray<AppTableGridColumnDef<TRow>>,
  viewportTier: ViewportTier,
): ResolvedCardLayout<TRow> {
  const resolved = columns
    .filter((column) => !isColumnHiddenAtViewport(column.hideBelow, viewportTier))
    .map((column) => {
      const role = resolveViewportRole(column, resolveCardRole(column, columns), viewportTier);
      return {
        column,
        role,
        label: resolveCardLabel(column, role),
        priority: resolveCardPriority(column, role),
      } satisfies ResolvedCardColumn<TRow>;
    })
    .filter((entry) => entry.role !== 'hidden');

  const byRole = (role: GridColumnCardRole) => resolved.filter((entry) => entry.role === role);

  const titleCandidates = byRole('title');
  const subtitleCandidates = byRole('subtitle');
  const mediaCandidates = byRole('media');
  const meta = byRole('meta').sort((left, right) => left.priority - right.priority);
  const fields = byRole('field').sort((left, right) => left.priority - right.priority);
  const actionsCandidates = byRole('actions');

  return {
    title: titleCandidates[0] ?? null,
    subtitle: subtitleCandidates[0] ?? null,
    media: mediaCandidates[0] ?? null,
    meta,
    fields,
    actions: actionsCandidates[0] ?? null,
  };
}

export const APP_TABLE_GRID_STANDARD_CARD_PRIMARY_FIELD_COUNT = 3;

export type StandardCardPartition<TRow> = {
  media: ResolvedCardColumn<TRow> | null;
  primaryFields: ReadonlyArray<ResolvedCardColumn<TRow>>;
  labeledFields: ReadonlyArray<ResolvedCardColumn<TRow>>;
  actions: ResolvedCardColumn<TRow> | null;
};

export function partitionStandardCardLayout<TRow>(
  layout: ResolvedCardLayout<TRow>,
): StandardCardPartition<TRow> {
  const dataFields: ResolvedCardColumn<TRow>[] = [];
  if (layout.title) {
    dataFields.push(layout.title);
  }
  if (layout.subtitle) {
    dataFields.push(layout.subtitle);
  }
  dataFields.push(...layout.fields);

  const primaryFields = dataFields.slice(0, APP_TABLE_GRID_STANDARD_CARD_PRIMARY_FIELD_COUNT);
  const labeledFields = [
    ...dataFields.slice(APP_TABLE_GRID_STANDARD_CARD_PRIMARY_FIELD_COUNT),
    ...layout.meta,
  ].sort((left, right) => left.priority - right.priority);

  return {
    media: layout.media,
    primaryFields,
    labeledFields,
    actions: layout.actions,
  };
}
