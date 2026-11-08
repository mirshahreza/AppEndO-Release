import type { CrudSetColumn } from '../../domain/component-designer/crudSetSpec';
import {
  crudSetColumnCellKind,
  crudSetColumnLabel,
} from '../../domain/component-designer/crudSetSpec';
import {
  DEFAULT_WHERE_OPERATORS,
  type WhereField,
  type WhereGroupNode,
} from './where-builder/whereBuilderModel';
import {
  filterRecordsByListWhereTree,
  isListWhereTreeActive,
} from './list-filter/listWhereFilter';

const cellKindToWhereFieldType = (
  kind: ReturnType<typeof crudSetColumnCellKind>,
): WhereField['type'] => {
  if (kind === 'date' || kind === 'audit') return 'date';
  if (kind === 'boolean-icon' || kind === 'lock-status') return 'boolean';
  return 'text';
};

export const crudSetColumnsToWhereFields = (
  columns: readonly CrudSetColumn[],
): WhereField[] => columns.map((column) => ({
  id: column.field,
  label: crudSetColumnLabel(column),
  type: cellKindToWhereFieldType(crudSetColumnCellKind(column)),
}));

export const crudSetListWhereFilterEnabled = (
  spec: { filterBar?: { listWhereFilter?: boolean } },
): boolean => spec.filterBar?.listWhereFilter !== false;

export const applyCrudSetListWhereFilter = <TRow extends Record<string, unknown>>(
  rows: readonly TRow[],
  tree: WhereGroupNode,
): TRow[] => {
  if (!isListWhereTreeActive(tree, DEFAULT_WHERE_OPERATORS)) {
    return [...rows];
  }
  return filterRecordsByListWhereTree(rows, tree, DEFAULT_WHERE_OPERATORS);
};
