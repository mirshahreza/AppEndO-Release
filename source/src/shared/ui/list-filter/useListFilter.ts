import { useCallback, useState } from 'react';
import { createEmptyWhereTree } from '../where-builder/whereBuilderModel';
import type { WhereField, WhereGroupNode, WhereOperator } from '../where-builder/whereBuilderModel';
import type { ListFilterButtonProps } from './ListFilterButton';
import type { ListFilterDialogProps } from './ListFilterDialog';
import type { ListFilterSummaryBandProps } from './ListFilterSummaryBand';
import {
  countListWhereConditions,
  formatListWhereSummary,
  isListWhereTreeActive,
  sanitizeListWhereTree,
} from './listWhereFilter';

export type UseListFilterArgs = {
  value: WhereGroupNode;
  fields: readonly WhereField[];
  operators?: readonly WhereOperator[];
  onApply: (next: WhereGroupNode) => void;
  /** Extra work after Clear (for example dropping a deep-link query param). */
  onClear?: () => void;
};

export type ListFilterController = {
  filterOpen: boolean;
  filterDraft: WhereGroupNode;
  setFilterDraft: (next: WhereGroupNode) => void;
  openFilter: () => void;
  closeFilter: () => void;
  applyFilter: () => void;
  clearFilter: () => void;
  filterActive: boolean;
  filterSummary: string;
  filterConditionCount: number;
  filterButtonProps: ListFilterButtonProps;
  filterSummaryProps: ListFilterSummaryBandProps;
  filterDialogProps: ListFilterDialogProps;
};

/**
 * Shared List Filter controller: toolbar button, where-builder dialog, header-2 summary.
 * Pages persist `value` themselves; this hook only owns the dialog draft.
 */
export function useListFilter({
  value,
  fields,
  operators,
  onApply,
  onClear,
}: UseListFilterArgs): ListFilterController {
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState<WhereGroupNode>(value);

  const filterActive = isListWhereTreeActive(value, operators);
  const filterSummary = formatListWhereSummary(value, fields);
  const filterConditionCount = countListWhereConditions(value, operators);

  const openFilter = useCallback(() => {
    setFilterDraft(sanitizeListWhereTree(value, fields, operators));
    setFilterOpen(true);
  }, [fields, operators, value]);

  const closeFilter = useCallback(() => {
    setFilterOpen(false);
  }, []);

  const applyFilter = useCallback(() => {
    onApply(sanitizeListWhereTree(filterDraft, fields, operators));
    setFilterOpen(false);
  }, [fields, filterDraft, onApply, operators]);

  const clearFilter = useCallback(() => {
    const empty = createEmptyWhereTree();
    onApply(empty);
    setFilterDraft(empty);
    setFilterOpen(false);
    onClear?.();
  }, [onApply, onClear]);

  return {
    filterOpen,
    filterDraft,
    setFilterDraft,
    openFilter,
    closeFilter,
    applyFilter,
    clearFilter,
    filterActive,
    filterSummary,
    filterConditionCount,
    filterButtonProps: {
      active: filterActive,
      conditionCount: filterConditionCount,
      onClick: openFilter,
    },
    filterSummaryProps: {
      summary: filterSummary,
      onEdit: openFilter,
      onClear: clearFilter,
    },
    filterDialogProps: {
      isOpen: filterOpen,
      fields,
      operators,
      value: filterDraft,
      onChange: setFilterDraft,
      onApply: applyFilter,
      onClose: closeFilter,
    },
  };
}
