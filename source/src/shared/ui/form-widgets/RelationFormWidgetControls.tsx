import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, ChevronsLeft, ChevronsRight, EyeOff, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  DEFAULT_GRID_PAGE_SIZE,
  GRID_PAGE_SIZES,
} from '../../lib/gridPagingConstants';
import { useGridListPresentation } from '../../lib/useGridListPresentation';
import { ActionTooltip } from '../ActionTooltip';
import { AppButton } from '../AppButton';
import { AppTableGrid } from '../AppTableGrid';
import {
  SPLIT_BUTTON_MENU_ITEM_CLASS,
  SPLIT_BUTTON_MENU_PANEL_FIXED_CLASS,
  useSplitButtonMenu,
} from '../AppSplitButton';
import { CreateEditModalShell } from '../CreateEditModalShell';
import {
  UiCheckboxChoiceList,
  UiRadioChoiceList,
} from '../FormChoiceFields';
import { GridPagingFooter } from '../GridPagingFooter';
import {
  UiInput,
  UiSelect,
} from '../HeroFieldControls';
import { resolveHeroUiFieldSizeTokens, type HeroUiFieldSize } from '../heroFieldSize';
import {
  DIALOG_NESTED_BACKDROP_Z_CLASS,
  APP_TABLE_GRID_ACTION_CELL_CLASS,
  APP_TABLE_GRID_ACTION_HEADER_CLASS,
  ICON_ACTION_BUTTON_SM_CLASS,
  ICON_ACTION_DELETE_CLASS,
  ICON_ACTION_EDIT_CLASS,
  resolveHeroUiFieldBorderClass,
} from '../surfaceClasses';
import { UiCombobox } from '../UiCombobox';
import type {
  RelationButtonGroupControlProps,
  RelationCardListControlProps,
  RelationCheckboxListControlProps,
  RelationDropdownButtonControlProps,
  RelationDropdownButtonMenuPlacement,
  RelationFormWidgetCollectionProps,
  RelationFormWidgetHiddenProps,
  RelationFormWidgetMultiProps,
  RelationFormWidgetNestedRecordProps,
  RelationFormWidgetRow,
  RelationFormWidgetSingleProps,
  RelationGridEditMode,
  RelationLookupColumn,
  RelationLookupControlProps,
  RelationLookupRecord,
  RelationRadioListControlProps,
  RelationRelatedGridControlProps,
  RelationRepeaterControlProps,
  RelationTagsListControlProps,
  RelationTagsListSelectPlacement,
} from './relationFormWidgetTypes';
import {
  RELATION_GRID_EDIT_MODE_OPTIONS,
  RELATION_TAGS_LIST_SELECT_PLACEMENT_OPTIONS,
} from './relationFormWidgetTypes';

const useRelationCollectionAddRegistration = (
  onRegisterAdd: RelationFormWidgetCollectionProps['onRegisterAdd'],
  add: () => void,
  disabled: boolean,
  label: string,
) => {
  useLayoutEffect(() => {
    if (!onRegisterAdd) return;
    onRegisterAdd({ add, disabled, label });
    return () => onRegisterAdd(null);
  }, [onRegisterAdd, add, disabled, label]);
};

const DROPDOWN_BUTTON_MENU_MAX_HEIGHT = 224;
const DROPDOWN_BUTTON_MENU_MIN_COMFORT = 140;

const resolveDropdownMenuSide = (
  placement: RelationDropdownButtonMenuPlacement,
  availableBelow: number,
  availableAbove: number,
): 'above' | 'below' => {
  if (placement === 'above') return 'above';
  if (placement === 'below') return 'below';
  const fitsBelow = availableBelow >= DROPDOWN_BUTTON_MENU_MIN_COMFORT;
  return fitsBelow || availableBelow >= availableAbove ? 'below' : 'above';
};

const chipClass = (active: boolean, disabled?: boolean) => cn(
  'inline-flex items-center gap-1 rounded-[6px] border px-2 py-0.5 text-xs font-medium transition-colors',
  active
    ? 'border-violet-300 bg-violet-50 text-violet-800'
    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
  disabled && 'pointer-events-none opacity-60',
);

const newChildRow = (rows: readonly { id: string }[]) => ({
  id: `row-${rows.length + 1}-${Date.now().toString(36).slice(-4)}`,
  title: 'New related row',
  status: 'Draft',
});

/** ui-grid actions column width: padding + (20 × count) + (7 × (count − 1)). */
const relationGridActionsWidth = (actionCount: number) => (
  3 * 2 + 20 * actionCount + 7 * Math.max(0, actionCount - 1)
);

/** Trailing chrome for has-many collections (optional leading controls + Add). */
const RelationCollectionHeader: React.FC<{
  addLabel: string;
  disabled?: boolean;
  onAdd: () => void;
  leading?: React.ReactNode;
}> = ({ addLabel, disabled, onAdd, leading }) => (
  <div className="flex min-h-8 flex-wrap items-center justify-end gap-2">
    {leading}
    <AppButton
      type="button"
      intent="secondary"
      size="sm"
      disabled={disabled}
      onClick={onAdd}
    >
      <Plus className="h-3.5 w-3.5" aria-hidden />
      {addLabel}
    </AppButton>
  </div>
);

const RelationGridEditModeSelect: React.FC<{
  value: RelationGridEditMode;
  onChange: (mode: RelationGridEditMode) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => (
  <div className="w-[9.75rem] shrink-0">
    <UiSelect
      size="sm"
      value={value}
      isDisabled={disabled}
      ariaLabel="Edit mode"
      onChange={(event) => {
        const next = event.target.value as RelationGridEditMode;
        if (RELATION_GRID_EDIT_MODE_OPTIONS.some((option) => option.value === next)) {
          onChange(next);
        }
      }}
    >
      {RELATION_GRID_EDIT_MODE_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </UiSelect>
  </div>
);

const useRelationCollectionEditMode = ({
  rows,
  onRowsChange,
  disabled,
  editMode: editModeProp,
  onEditModeChange,
  showEditModeSelect = true,
  onRegisterAdd,
  addLabel,
}: {
  rows: readonly RelationFormWidgetRow[];
  onRowsChange?: (next: RelationFormWidgetRow[]) => void;
  disabled?: boolean;
  editMode?: RelationGridEditMode;
  onEditModeChange?: (mode: RelationGridEditMode) => void;
  showEditModeSelect?: boolean;
  onRegisterAdd?: RelationFormWidgetCollectionProps['onRegisterAdd'];
  addLabel: string;
}) => {
  const [uncontrolledEditMode, setUncontrolledEditMode] = useState<RelationGridEditMode>('row');
  const editMode = editModeProp ?? uncontrolledEditMode;
  const setEditMode = (mode: RelationGridEditMode) => {
    onEditModeChange?.(mode);
    if (editModeProp === undefined) {
      setUncontrolledEditMode(mode);
    }
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogRowId, setDialogRowId] = useState<string | null>(null);
  const [dialogDraft, setDialogDraft] = useState<RelationFormWidgetRow | null>(null);
  const canMutate = Boolean(onRowsChange) && !disabled;

  const updateRow = useCallback((id: string, patch: Partial<{ title: string; status: string }>) => {
    if (!onRowsChange) return;
    onRowsChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }, [onRowsChange, rows]);

  const openDialogForRow = useCallback((row: RelationFormWidgetRow) => {
    setDialogRowId(row.id);
    setDialogDraft({ ...row });
  }, []);

  const closeDialog = useCallback(() => {
    setDialogRowId(null);
    setDialogDraft(null);
  }, []);

  const saveDialog = useCallback(() => {
    if (!dialogRowId || !dialogDraft || !onRowsChange) {
      closeDialog();
      return;
    }
    const exists = rows.some((row) => row.id === dialogRowId);
    onRowsChange(
      exists
        ? rows.map((row) => (row.id === dialogRowId ? { ...dialogDraft } : row))
        : [...rows, { ...dialogDraft }],
    );
    closeDialog();
  }, [closeDialog, dialogDraft, dialogRowId, onRowsChange, rows]);

  const add = useCallback(() => {
    const next = newChildRow(rows);
    onRowsChange?.([...rows, next]);
    if (editMode === 'row') {
      setEditingId(next.id);
    } else if (editMode === 'dialog') {
      openDialogForRow(next);
    }
  }, [editMode, onRowsChange, openDialogForRow, rows]);

  useRelationCollectionAddRegistration(onRegisterAdd, add, !canMutate, addLabel);

  useEffect(() => {
    if (editMode !== 'row') {
      setEditingId(null);
    }
    if (editMode !== 'dialog') {
      closeDialog();
    }
  }, [closeDialog, editMode]);

  const deleteRow = useCallback((id: string) => {
    if (editingId === id) setEditingId(null);
    if (dialogRowId === id) closeDialog();
    onRowsChange?.(rows.filter((item) => item.id !== id));
  }, [closeDialog, dialogRowId, editingId, onRowsChange, rows]);

  const showInputsFor = (id: string) => (
    editMode === 'direct' || (editMode === 'row' && editingId === id)
  );
  const isRowEditing = (id: string) => editMode === 'row' && editingId === id;

  const editModeSelect = showEditModeSelect ? (
    <RelationGridEditModeSelect
      value={editMode}
      onChange={setEditMode}
      disabled={disabled}
    />
  ) : null;

  return {
    editMode,
    editingId,
    setEditingId,
    canMutate,
    updateRow,
    add,
    openDialogForRow,
    closeDialog,
    saveDialog,
    dialogDraft,
    setDialogDraft,
    dialogOpen: Boolean(dialogRowId && dialogDraft),
    deleteRow,
    showInputsFor,
    isRowEditing,
    editModeSelect,
  };
};

const RelationChildEditDialog: React.FC<{
  open: boolean;
  draft: RelationFormWidgetRow | null;
  size?: HeroUiFieldSize;
  canMutate: boolean;
  onClose: () => void;
  onSave: () => void;
  onDraftChange: (patch: Partial<RelationFormWidgetRow>) => void;
}> = ({ open, draft, size = 'sm', canMutate, onClose, onSave, onDraftChange }) => {
  if (!open || !draft) return null;
  return (
    <CreateEditModalShell
      size="md"
      backdropClassName={DIALOG_NESTED_BACKDROP_Z_CLASS}
      title="Edit related item"
      onClose={onClose}
      onBackdropClick={onClose}
      footer={(
        <div className="flex w-full items-center justify-end gap-2">
          <AppButton intent="secondary" size="sm" onClick={onClose}>
            <X className="h-3.5 w-3.5" aria-hidden />
            Cancel
          </AppButton>
          <AppButton intent="primary" size="sm" disabled={!canMutate} onClick={onSave}>
            <Check className="h-3.5 w-3.5" aria-hidden />
            Save
          </AppButton>
        </div>
      )}
    >
      <div className="grid grid-cols-1 gap-3">
        <div className="flex flex-col gap-[2px]">
          <span className="ps-[4px] text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Title
          </span>
          <UiInput
            size={size}
            value={draft.title}
            isDisabled={!canMutate}
            autoDir
            ariaLabel="Related item title"
            onChange={(event) => onDraftChange({ title: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-[2px]">
          <span className="ps-[4px] text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Status
          </span>
          <UiSelect
            size={size}
            value={draft.status}
            isDisabled={!canMutate}
            ariaLabel="Related item status"
            onChange={(event) => onDraftChange({ status: event.target.value })}
          >
            {RELATION_CHILD_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </UiSelect>
        </div>
      </div>
    </CreateEditModalShell>
  );
};

const RelationItemEditDeleteActions: React.FC<{
  editMode: RelationGridEditMode;
  canMutate: boolean;
  title: string;
  isRowEditing: boolean;
  onEditToggle: () => void;
  onDelete: () => void;
}> = ({ editMode, canMutate, title, isRowEditing, onEditToggle, onDelete }) => (
  <div className="flex shrink-0 items-center">
    {editMode !== 'direct' ? (
      <>
        <ActionTooltip content={isRowEditing ? 'Done' : 'Edit'}>
          <button
            type="button"
            className={cn(
              ICON_ACTION_BUTTON_SM_CLASS,
              ICON_ACTION_EDIT_CLASS,
              !canMutate && 'text-slate-400 hover:bg-transparent hover:text-slate-400',
            )}
            disabled={!canMutate}
            aria-label={isRowEditing ? `Done editing ${title}` : `Edit ${title}`}
            onClick={onEditToggle}
          >
            {isRowEditing ? (
              <Check className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
        </ActionTooltip>
        <span className="mx-[3.5px] h-3 border-s border-slate-200" aria-hidden />
      </>
    ) : null}
    <ActionTooltip content="Delete">
      <button
        type="button"
        className={cn(
          ICON_ACTION_BUTTON_SM_CLASS,
          ICON_ACTION_DELETE_CLASS,
          !canMutate && 'text-slate-400 hover:bg-transparent hover:text-slate-400',
        )}
        disabled={!canMutate}
        aria-label={`Delete ${title}`}
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
      </button>
    </ActionTooltip>
  </div>
);

const RELATION_CHILD_STATUS_OPTIONS = ['Draft', 'Published', 'Archived'] as const;

const DEFAULT_LOOKUP_COLUMNS: readonly RelationLookupColumn[] = [
  { id: 'title', label: 'Title', isRowHeader: true },
];

const toLookupRecords = (
  records: readonly RelationLookupRecord[] | undefined,
  options: readonly { id: string; label: string }[] | undefined,
): RelationLookupRecord[] => {
  if (records && records.length > 0) {
    return [...records];
  }
  return (options ?? []).map((option) => ({
    id: option.id,
    label: option.label,
    values: { title: option.label },
  }));
};

const recordMatchesQuery = (record: RelationLookupRecord, needle: string): boolean => {
  if (!needle) return true;
  if (record.label.toLowerCase().includes(needle)) return true;
  if (record.id.toLowerCase().includes(needle)) return true;
  return Object.values(record.values ?? {}).some((cell) => cell.toLowerCase().includes(needle));
};

/**
 * Lookup — selected label + Search / Clear; Search opens a flexible picker dialog.
 * Grid mode fills the remaining dialog body (100% width/height) and always paginates.
 * Distinct from Select (`UiSelect`) and Typeahead (inline combobox).
 */
export const RelationLookupControl: React.FC<RelationLookupControlProps> = ({
  options,
  records,
  columns,
  value,
  onChange,
  size = 'sm',
  disabled,
  className,
  placeholder = 'No record selected',
  ariaLabel = 'Lookup related record',
  dialogTitle = 'Look up related record',
  dialogSize = '2xl',
  resultsLayout = 'grid',
  showClear = true,
  showSearchButton = true,
  pageSize: initialPageSize = DEFAULT_GRID_PAGE_SIZE,
  pageSizes = GRID_PAGE_SIZES,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pageSize, setPageSize] = useState(initialPageSize);
  const sizeTokens = resolveHeroUiFieldSizeTokens(size);
  const resolvedRecords = useMemo(() => toLookupRecords(records, options), [options, records]);
  const resolvedColumns = columns && columns.length > 0 ? columns : DEFAULT_LOOKUP_COLUMNS;
  const selected = resolvedRecords.find((record) => record.id === value);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return resolvedRecords.filter((record) => recordMatchesQuery(record, needle));
  }, [query, resolvedRecords]);

  const presentation = useGridListPresentation({
    items: filtered,
    pageSize,
    listMode: 'paging',
    resetKeys: [query, open],
  });

  useEffect(() => {
    setPageSize(initialPageSize);
  }, [initialPageSize]);

  const closeDialog = () => {
    setOpen(false);
    setQuery('');
  };

  const pickRecord = (id: string) => {
    onChange(id);
    closeDialog();
  };

  const isFullscreenDialog = dialogSize === 'maximized' || dialogSize === 'full';
  const useGrid = resultsLayout === 'grid';

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'flex w-full min-w-0 items-stretch overflow-hidden bg-white',
          resolveHeroUiFieldBorderClass(false),
          '!rounded-[6px]',
          sizeTokens.controlHeightClass,
          disabled && 'opacity-60',
        )}
      >
        <div
          className={cn(
            'min-w-0 flex-1 truncate px-2.5 leading-none',
            sizeTokens.textClass,
            'flex items-center',
            selected ? 'font-medium text-slate-800' : 'text-slate-400',
          )}
          aria-label={ariaLabel}
        >
          {selected?.label ?? placeholder}
        </div>
        {showSearchButton ? (
          <AppButton
            type="button"
            intent="secondary"
            size="icon-sm"
            className="h-full shrink-0 rounded-none border-0 border-s border-slate-200"
            disabled={disabled}
            aria-label="Search related records"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => {
              setQuery('');
              setOpen(true);
            }}
          >
            <Search className="h-3.5 w-3.5" aria-hidden />
          </AppButton>
        ) : null}
        {showClear ? (
          <AppButton
            type="button"
            intent="secondary"
            size="icon-sm"
            tabStop="skip"
            className="h-full shrink-0 rounded-none border-0 border-s border-slate-200"
            disabled={disabled || !value}
            aria-label="Clear related record"
            onClick={() => onChange('')}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </AppButton>
        ) : null}
      </div>

      {open ? (
        <CreateEditModalShell
          size={dialogSize}
          backdropClassName={DIALOG_NESTED_BACKDROP_Z_CLASS}
          shellClassName={cn(
            useGrid && !isFullscreenDialog && 'h-[min(92vh,48rem)]',
            !useGrid && '!overflow-visible',
          )}
          title={dialogTitle}
          onClose={closeDialog}
          onBackdropClick={closeDialog}
          bodyOuterClassName={cn(
            useGrid
              ? 'min-h-0 flex flex-1 flex-col !overflow-hidden'
              : '!overflow-visible',
          )}
          bodyClassName={cn(
            useGrid
              ? 'flex h-full min-h-0 flex-1 flex-col gap-3 !overflow-hidden !px-0 !pt-[15px] !pb-0'
              : '!overflow-visible',
          )}
          gradient={!useGrid}
        >
          <div className={cn(
            'flex flex-col gap-[2px]',
            useGrid ? 'shrink-0 px-[15px]' : 'relative z-20',
          )}
          >
            <label className="ps-[4px] text-xs font-semibold uppercase tracking-wider text-slate-600">
              Search
            </label>
            <UiInput
              size="sm"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoDir={false}
              autoFocus
              placeholder="Type to filter records…"
              ariaLabel="Filter related records"
            />
            {!useGrid ? (
              <div
                className="absolute inset-x-0 top-full z-[80] mt-1 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg"
                role="listbox"
                aria-label="Matching related records"
              >
                {filtered.length === 0 ? (
                  <div className="px-3 py-3 text-center text-xs text-slate-500">
                    No matching records.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100 py-0.5">
                    {filtered.map((record) => {
                      const selectedRow = record.id === value;
                      return (
                        <li key={record.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={selectedRow}
                            className={cn(
                              'flex w-full items-start gap-3 px-3 py-2 text-start transition-colors',
                              selectedRow ? 'bg-indigo-50' : 'hover:bg-slate-50',
                            )}
                            onClick={() => pickRecord(record.id)}
                          >
                            <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                            <span className={cn(
                              'min-w-0 flex-1 truncate text-sm',
                              selectedRow ? 'font-semibold text-indigo-800' : 'font-medium text-slate-800',
                            )}
                            >
                              {record.label}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : null}
          </div>

          {useGrid ? (
            <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
              <div className="mx-[15px] flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200">
                <AppTableGrid
                  chrome="hero"
                  ariaLabel="Lookup related records"
                  size="sm"
                  className="h-full min-h-0"
                  scrollOwner="self"
                  scrollClassName="h-full min-h-0"
                  getRowKey={(row) => row.id}
                  rows={presentation.displayItems}
                  onRowClick={(row) => pickRecord(row.id)}
                  getRowClassName={(row) => (
                    row.id === value ? 'bg-indigo-50/80' : undefined
                  )}
                  emptyMessage="No matching records."
                  columns={resolvedColumns.map((column) => ({
                    id: column.id,
                    label: column.label,
                    width: column.width,
                    isRowHeader: column.isRowHeader,
                    renderCell: (row) => {
                      const cell = column.id === 'title'
                        ? (row.values?.title ?? row.label)
                        : (row.values?.[column.id] ?? '');
                      if (column.isRowHeader || column.id === 'title') {
                        return (
                          <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                            {row.id === value ? (
                              <Check className="h-3.5 w-3.5 shrink-0 text-indigo-600" aria-hidden />
                            ) : null}
                            {cell}
                          </span>
                        );
                      }
                      return <span className="text-slate-600">{cell}</span>;
                    },
                  }))}
                />
              </div>
              <GridPagingFooter
                totalCount={presentation.totalCount}
                safePage={presentation.safePage}
                pageSize={pageSize}
                pageSizes={pageSizes}
                onPageSizeChange={(nextSize) => {
                  setPageSize(nextSize);
                  presentation.setPage(1);
                }}
                sortBy="title"
                sortOptions={[{ value: 'title', label: 'Title' }]}
                onSortByChange={() => undefined}
                sortDirection="asc"
                onToggleSortDirection={() => undefined}
                showSortControls={false}
                totalPages={presentation.totalPages}
                pageNumbers={presentation.pageNumbers}
                onPageChange={presentation.setPage}
              />
            </div>
          ) : null}
        </CreateEditModalShell>
      ) : null}
    </div>
  );
};

/**
 * Select — compact closed list (`UiSelect`), no typing.
 * Widget id: `select`.
 */
export const RelationSelectControl: React.FC<RelationFormWidgetSingleProps> = ({
  options,
  value,
  onChange,
  size = 'sm',
  disabled,
  className,
  placeholder = 'Select…',
  ariaLabel = 'Related record',
}) => (
  <UiSelect
    size={size}
    value={value}
    onChange={(event) => onChange(event.target.value)}
    isDisabled={disabled}
    className={className}
    ariaLabel={ariaLabel}
  >
    <option value="">{placeholder}</option>
    {options.map((option) => (
      <option key={option.id} value={option.id}>{option.label}</option>
    ))}
  </UiSelect>
);

/**
 * Dropdown button — AppButton trigger shows the selected label; click opens a list.
 * Placement defaults to auto (prefer below, flip above when space is tight).
 * Widget id: `dropdownButton`. Distinct from `select` (`UiSelect` field chrome).
 */
export const RelationDropdownButtonControl: React.FC<RelationDropdownButtonControlProps> = ({
  options,
  value,
  onChange,
  disabled,
  className,
  placeholder = 'Select…',
  ariaLabel = 'Related record',
  menuPlacement = 'auto',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | undefined>();
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const menuRef = useSplitButtonMenu(isOpen, setIsOpen, panelRef);
  const selected = options.find((option) => option.id === value);
  const displayLabel = selected?.label ?? placeholder;

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuStyle(undefined);
      return;
    }

    const updatePosition = () => {
      const anchor = menuRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const gap = 6;
      const availableBelow = window.innerHeight - rect.bottom - gap - 8;
      const availableAbove = rect.top - gap - 8;
      const side = resolveDropdownMenuSide(menuPlacement, availableBelow, availableAbove);
      const maxHeight = Math.max(
        96,
        Math.min(
          DROPDOWN_BUTTON_MENU_MAX_HEIGHT,
          side === 'below' ? availableBelow : availableAbove,
        ),
      );
      const next: React.CSSProperties = {
        left: rect.left,
        minWidth: Math.max(rect.width, 10 * 16),
        maxHeight,
        overflowY: 'auto',
      };
      if (side === 'below') {
        next.top = rect.bottom + gap;
      } else {
        next.bottom = window.innerHeight - rect.top + gap;
      }
      setMenuStyle(next);
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, menuPlacement, menuRef, options.length]);

  const menuPanel = isOpen ? (
    <div
      ref={panelRef}
      className={cn(SPLIT_BUTTON_MENU_PANEL_FIXED_CLASS, 'py-1')}
      style={menuStyle}
      role="listbox"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const isSelected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="option"
            aria-selected={isSelected}
            className={cn(
              SPLIT_BUTTON_MENU_ITEM_CLASS,
              'gap-2',
              isSelected && 'bg-indigo-50 text-indigo-700',
            )}
            onClick={() => {
              onChange(option.id);
              setIsOpen(false);
            }}
          >
            {isSelected ? (
              <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : (
              <span className="h-3.5 w-3.5 shrink-0" aria-hidden />
            )}
            <span className="truncate font-medium">{option.label}</span>
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <div ref={menuRef} className={cn('relative inline-flex max-w-full', className)}>
      <AppButton
        type="button"
        intent="secondary"
        size="sm"
        disabled={disabled}
        className="max-w-full"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        title={displayLabel}
        onClick={() => {
          if (!disabled) {
            setIsOpen((open) => !open);
          }
        }}
      >
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 transition-transform',
            isOpen && 'rotate-180',
          )}
          aria-hidden
        />
        <span className="min-w-0 max-w-[14rem] truncate">
          {displayLabel}
        </span>
      </AppButton>
      {menuPanel && typeof document !== 'undefined'
        ? createPortal(menuPanel, document.body)
        : null}
    </div>
  );
};

/** Radio list — single choice as radio buttons (vertical or horizontal). */
export const RelationRadioListControl: React.FC<RelationRadioListControlProps> = ({
  options,
  value,
  onChange,
  size = 'sm',
  disabled,
  className,
  ariaLabel = 'Radio related record',
  orientation = 'horizontal',
}) => (
  <UiRadioChoiceList
    value={value}
    onChange={onChange}
    size={size}
    disabled={disabled}
    className={className}
    ariaLabel={ariaLabel}
    orientation={orientation}
    options={options.map((option) => ({ value: option.id, label: option.label }))}
  />
);

/** Single choice as buttons — horizontal wrap (default) or vertical stack. */
export const RelationButtonGroupControl: React.FC<RelationButtonGroupControlProps> = ({
  options,
  value,
  onChange,
  disabled,
  className,
  ariaLabel = 'Related record button group',
  orientation = 'horizontal',
}) => (
  <div
    className={cn(
      'flex gap-1.5',
      orientation === 'vertical' ? 'flex-col items-stretch' : 'flex-row flex-wrap',
      className,
    )}
    role="group"
    aria-label={ariaLabel}
  >
    {options.map((option) => {
      const selected = option.id === value;
      return (
        <AppButton
          key={option.id}
          type="button"
          intent={selected ? 'primary' : 'secondary'}
          size="sm"
          disabled={disabled}
          className={orientation === 'vertical' ? 'w-full justify-start' : undefined}
          onClick={() => onChange(option.id)}
          aria-pressed={selected}
        >
          <Check className={cn('h-3.5 w-3.5', !selected && 'opacity-30')} aria-hidden />
          {option.label}
        </AppButton>
      );
    })}
  </div>
);

/**
 * Typeahead — type-in-field filter (`UiCombobox`).
 * Distinct from Lookup (dialog search) and Dropdown button (no typing).
 */
export const RelationTypeaheadControl: React.FC<RelationFormWidgetSingleProps> = ({
  options,
  value,
  onChange,
  size = 'sm',
  disabled,
  className,
  placeholder = 'Type to filter…',
  ariaLabel = 'Typeahead related record',
}) => (
  <UiCombobox
    size={size}
    value={value}
    onChange={(event) => onChange(event.target.value)}
    isDisabled={disabled}
    placeholder={placeholder}
    ariaLabel={ariaLabel}
    className={className}
    items={options.map((option) => ({ id: option.id, textValue: option.label }))}
  />
);

/** Compact inline card with fields for one owned child (has-one). */
export const RelationNestedCardControl: React.FC<RelationFormWidgetNestedRecordProps> = ({
  row,
  onRowChange,
  size = 'sm',
  disabled,
  className,
  ariaLabel = 'Nested related record',
}) => (
  <div
    className={cn(
      'rounded-[6px] border border-slate-200 bg-slate-50/80 p-3',
      disabled && 'opacity-60',
      className,
    )}
    role="group"
    aria-label={ariaLabel}
  >
    {row ? (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Related record
          </p>
          <AppButton
            type="button"
            intent="secondary"
            size="sm"
            disabled={disabled || !onRowChange}
            aria-label="Clear related record"
            onClick={() => onRowChange?.(null)}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Clear
          </AppButton>
        </div>
        <UiInput
          size={size}
          value={row.title}
          isDisabled={disabled}
          autoDir
          ariaLabel={`${ariaLabel} title`}
          onChange={(event) => onRowChange?.({ ...row, title: event.target.value })}
        />
        <UiSelect
          size={size}
          value={row.status}
          isDisabled={disabled}
          ariaLabel={`${ariaLabel} status`}
          onChange={(event) => onRowChange?.({ ...row, status: event.target.value })}
        >
          <option value="Draft">Draft</option>
          <option value="Published">Published</option>
          <option value="Archived">Archived</option>
        </UiSelect>
      </div>
    ) : (
      <div className="flex flex-col items-start gap-2">
        <p className="text-xs text-slate-500">No related record.</p>
        <AppButton
          type="button"
          intent="secondary"
          size="sm"
          disabled={disabled || !onRowChange}
          onClick={() => onRowChange?.(newChildRow([]))}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Create related
        </AppButton>
      </div>
    )}
  </div>
);

/** Fuller nested field section for one owned child (has-one). */
export const RelationNestedFormControl: React.FC<RelationFormWidgetNestedRecordProps> = ({
  row,
  onRowChange,
  size = 'sm',
  disabled,
  className,
  ariaLabel = 'Nested related form',
}) => (
  <div
    className={cn(
      'rounded-[6px] border border-slate-200 bg-white p-3',
      disabled && 'opacity-60',
      className,
    )}
    role="group"
    aria-label={ariaLabel}
  >
    <div className="mb-2 flex items-center justify-between gap-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        Nested form
      </p>
      {row ? (
        <AppButton
          type="button"
          intent="secondary"
          size="sm"
          disabled={disabled || !onRowChange}
          aria-label="Remove related record"
          onClick={() => onRowChange?.(null)}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          Remove
        </AppButton>
      ) : null}
    </div>
    {row ? (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-[2px]">
          <span className="ps-[4px] text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Title
          </span>
          <UiInput
            size={size}
            value={row.title}
            isDisabled={disabled}
            autoDir
            ariaLabel={`${ariaLabel} title`}
            onChange={(event) => onRowChange?.({ ...row, title: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-[2px]">
          <span className="ps-[4px] text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Status
          </span>
          <UiSelect
            size={size}
            value={row.status}
            isDisabled={disabled}
            ariaLabel={`${ariaLabel} status`}
            onChange={(event) => onRowChange?.({ ...row, status: event.target.value })}
          >
            <option value="Draft">Draft</option>
            <option value="Published">Published</option>
            <option value="Archived">Archived</option>
          </UiSelect>
        </div>
        <div className="flex flex-col gap-[2px] sm:col-span-2">
          <span className="ps-[4px] text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Notes
          </span>
          <UiInput
            size={size}
            value={`Linked child · ${row.id}`}
            isDisabled
            autoDir={false}
            ariaLabel={`${ariaLabel} notes`}
          />
        </div>
      </div>
    ) : (
      <AppButton
        type="button"
        intent="secondary"
        size="sm"
        disabled={disabled || !onRowChange}
        onClick={() => onRowChange?.(newChildRow([]))}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        Create related
      </AppButton>
    )}
  </div>
);

/** Multi-select related records as checkboxes (belongs-to-many). */
export const RelationCheckboxListControl: React.FC<RelationCheckboxListControlProps> = ({
  options,
  values,
  onChange,
  size = 'sm',
  disabled,
  className,
  ariaLabel = 'Related records',
  orientation = 'horizontal',
}) => {
  const selected = useMemo(() => new Set(values), [values]);
  return (
    <div role="group" aria-label={ariaLabel} className={className}>
      <UiCheckboxChoiceList
        idPrefix="relation-checkbox"
        size={size}
        disabled={disabled}
        orientation={orientation}
        options={options.map((option) => ({
          id: option.id,
          label: option.label,
          checked: selected.has(option.id),
          onChange: (checked) => {
            if (checked) {
              onChange([...values, option.id]);
              return;
            }
            onChange(values.filter((id) => id !== option.id));
          },
        }))}
      />
    </div>
  );
};

/** Tags list — removable chips plus an add control (belongs-to-many). */
export const RelationTagsListControl: React.FC<RelationTagsListControlProps> = ({
  options,
  values,
  onChange,
  size = 'sm',
  disabled,
  className,
  placeholder = 'Add related…',
  ariaLabel = 'Tags list',
  selectPlacement = 'inline',
}) => {
  const selected = useMemo(() => new Set(values), [values]);
  const available = options.filter((option) => !selected.has(option.id));
  const isInline = selectPlacement === 'inline';
  /** Match chip height (`h-7`) when the add control sits in the same row. */
  const addControlSize = isInline ? 'xs' : size;
  const [typeaheadValue, setTypeaheadValue] = useState('');
  const [comboboxRevision, setComboboxRevision] = useState(0);

  useEffect(() => {
    if (typeaheadValue && selected.has(typeaheadValue)) {
      setTypeaheadValue('');
      setComboboxRevision((revision) => revision + 1);
    }
  }, [selected, typeaheadValue]);

  const addFromId = (next: string) => {
    if (!next || selected.has(next)) return;
    onChange([...values, next]);
    setTypeaheadValue('');
    setComboboxRevision((revision) => revision + 1);
  };

  const availableItems = available.map((option) => ({
    id: option.id,
    textValue: option.label,
  }));

  const addControl = available.length > 0 ? (
    <div className={isInline ? 'min-w-[8.5rem] flex-1 self-center' : 'w-full'}>
      {isInline ? (
        <UiCombobox
          key={comboboxRevision}
          size={addControlSize}
          value={typeaheadValue}
          onChange={(event) => addFromId(event.target.value)}
          isDisabled={disabled}
          placeholder={placeholder}
          ariaLabel={`${ariaLabel} typeahead`}
          items={availableItems}
          menuTrigger="focus"
          className="!h-7 !min-h-7 !border-0 !shadow-none"
        />
      ) : (
        <UiSelect
          size={addControlSize}
          value=""
          onChange={(event) => addFromId(event.target.value)}
          isDisabled={disabled}
          ariaLabel={`${ariaLabel} add`}
        >
          <option value="">{placeholder}</option>
          {available.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </UiSelect>
      )}
    </div>
  ) : null;

  const chips = (
    <>
      {values.length === 0 && !isInline ? (
        <span className="text-xs text-slate-400">{placeholder}</span>
      ) : null}
      {values.map((id) => {
        const option = options.find((item) => item.id === id);
        if (!option) return null;
        return (
          <span
            key={id}
            className={cn(chipClass(true, disabled), 'h-7 py-0')}
          >
            {option.label}
            <button
              type="button"
              className="rounded p-0.5 text-violet-700 hover:bg-violet-100"
              disabled={disabled}
              aria-label={`Remove ${option.label}`}
              onClick={() => onChange(values.filter((item) => item !== id))}
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        );
      })}
    </>
  );

  const chipsShell = (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-wrap items-center gap-1.5 rounded-[6px] border border-slate-300 bg-white px-2 shadow-sm',
        isInline ? 'min-h-7 py-1' : 'min-h-8 py-1.5',
      )}
    >
      {chips}
      {isInline ? addControl : null}
      {values.length === 0 && isInline && !addControl ? (
        <span className="text-xs text-slate-400">{placeholder}</span>
      ) : null}
    </div>
  );

  return (
    <div className={cn('flex flex-col gap-1.5', className)} role="group" aria-label={ariaLabel}>
      {selectPlacement === 'above' ? addControl : null}
      {chipsShell}
      {selectPlacement === 'below' ? addControl : null}
    </div>
  );
};

/** @deprecated Use RelationTagsListControl. */
export const RelationMultiSelectControl: React.FC<RelationTagsListControlProps> = (props) => (
  <RelationTagsListControl {...props} />
);

/** Resolve Tags list select placement from a raw string. */
export const resolveRelationTagsListSelectPlacement = (
  value: string | null | undefined,
): RelationTagsListSelectPlacement => (
  RELATION_TAGS_LIST_SELECT_PLACEMENT_OPTIONS.some((option) => option.value === value)
    ? (value as RelationTagsListSelectPlacement)
    : 'inline'
);

/** Chip tags for attaching peers (belongs-to-many). */
export const RelationTagsControl: React.FC<RelationFormWidgetMultiProps> = ({
  options,
  values,
  onChange,
  disabled,
  className,
  ariaLabel = 'Tag related records',
}) => {
  const selected = useMemo(() => new Set(values), [values]);
  return (
    <div
      className={cn('flex flex-wrap gap-1.5', className)}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const active = selected.has(option.id);
        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            className={chipClass(active, disabled)}
            aria-pressed={active}
            onClick={() => {
              if (active) {
                onChange(values.filter((id) => id !== option.id));
                return;
              }
              onChange([...values, option.id]);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

/** Available ↔ selected transfer lists (belongs-to-many). */
export const RelationDualListControl: React.FC<RelationFormWidgetMultiProps> = ({
  options,
  values,
  onChange,
  disabled,
  className,
  ariaLabel = 'Dual list related records',
}) => {
  const selected = useMemo(() => new Set(values), [values]);
  const available = options.filter((option) => !selected.has(option.id));
  const selectedOptions = values
    .map((id) => options.find((option) => option.id === id))
    .filter((option): option is NonNullable<typeof option> => Boolean(option));

  return (
    <div
      className={cn('grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr]', className)}
      role="group"
      aria-label={ariaLabel}
    >
      <div className="rounded-[6px] border border-slate-200 bg-white p-2">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Available
        </p>
        <ul className="m-0 flex max-h-36 list-none flex-col gap-1 overflow-y-auto p-0">
          {available.length === 0 ? (
            <li className="text-xs text-slate-400">None</li>
          ) : available.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                disabled={disabled}
                className="w-full rounded px-1.5 py-1 text-start text-xs text-slate-700 hover:bg-slate-50"
                onClick={() => onChange([...values, option.id])}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-row items-center justify-center gap-1 sm:flex-col">
        <AppButton
          type="button"
          intent="secondary"
          size="sm"
          disabled={disabled || available.length === 0}
          aria-label="Attach all"
          onClick={() => onChange(options.map((option) => option.id))}
        >
          <ChevronsRight className="h-3.5 w-3.5" aria-hidden />
        </AppButton>
        <AppButton
          type="button"
          intent="secondary"
          size="sm"
          disabled={disabled || values.length === 0}
          aria-label="Detach all"
          onClick={() => onChange([])}
        >
          <ChevronsLeft className="h-3.5 w-3.5" aria-hidden />
        </AppButton>
      </div>
      <div className="rounded-[6px] border border-violet-200 bg-violet-50/40 p-2">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-700">
          Selected
        </p>
        <ul className="m-0 flex max-h-36 list-none flex-col gap-1 overflow-y-auto p-0">
          {selectedOptions.length === 0 ? (
            <li className="text-xs text-slate-400">None</li>
          ) : selectedOptions.map((option) => (
            <li key={option.id} className="flex items-center justify-between gap-1">
              <span className="truncate text-xs text-slate-700">{option.label}</span>
              <button
                type="button"
                disabled={disabled}
                className="rounded p-0.5 text-violet-700 hover:bg-violet-100"
                aria-label={`Detach ${option.label}`}
                onClick={() => onChange(values.filter((id) => id !== option.id))}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

/** Child-record grid with add / edit / remove (has-many). Edit mode: Direct / Row / Dialog. */
export const RelationRelatedGridControl: React.FC<RelationRelatedGridControlProps> = ({
  rows,
  onRowsChange,
  size = 'sm',
  disabled,
  className,
  ariaLabel = 'Related grid',
  showAddButton = true,
  onRegisterAdd,
  editMode: editModeProp,
  onEditModeChange,
  showEditModeSelect = true,
}) => {
  const {
    editMode,
    setEditingId,
    canMutate,
    updateRow,
    add,
    openDialogForRow,
    closeDialog,
    saveDialog,
    dialogDraft,
    setDialogDraft,
    dialogOpen,
    deleteRow,
    showInputsFor,
    isRowEditing,
    editModeSelect,
  } = useRelationCollectionEditMode({
    rows,
    onRowsChange,
    disabled,
    editMode: editModeProp,
    onEditModeChange,
    showEditModeSelect,
    onRegisterAdd,
    addLabel: 'Add row',
  });

  const actionCount = editMode === 'direct' ? 1 : 2;

  return (
    <div className={cn('flex flex-col gap-2', disabled && 'opacity-60', className)}>
      {showAddButton ? (
        <RelationCollectionHeader
          addLabel="Add row"
          disabled={!canMutate}
          onAdd={add}
          leading={editModeSelect}
        />
      ) : null}
      <AppTableGrid
        chrome="hero"
        ariaLabel={ariaLabel}
        size="sm"
        scrollOwner="panel"
        stickyHeader={false}
        getRowKey={(row) => row.id}
        rows={rows}
        columns={[
          {
            id: 'title',
            label: 'Title',
            isRowHeader: true,
            renderCell: (row) => (
              showInputsFor(row.id) ? (
                <UiInput
                  size={size}
                  value={row.title}
                  isDisabled={!canMutate}
                  autoDir
                  ariaLabel={`Title for ${row.id}`}
                  onChange={(event) => updateRow(row.id, { title: event.target.value })}
                />
              ) : (
                <span className="font-medium text-slate-800">{row.title}</span>
              )
            ),
          },
          {
            id: 'status',
            label: 'Status',
            width: editMode === 'direct' ? 140 : 120,
            renderCell: (row) => (
              showInputsFor(row.id) ? (
                <UiSelect
                  size={size}
                  value={row.status}
                  isDisabled={!canMutate}
                  ariaLabel={`Status for ${row.id}`}
                  onChange={(event) => updateRow(row.id, { status: event.target.value })}
                >
                  {RELATION_CHILD_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </UiSelect>
              ) : (
                <span className="text-slate-600">{row.status}</span>
              )
            ),
          },
          {
            id: 'actions',
            label: '',
            width: relationGridActionsWidth(actionCount),
            headerClassName: APP_TABLE_GRID_ACTION_HEADER_CLASS,
            cellClassName: APP_TABLE_GRID_ACTION_CELL_CLASS,
            sort: false,
            filter: false,
            renderCell: (row) => (
              <div className="flex items-center justify-end">
                <RelationItemEditDeleteActions
                  editMode={editMode}
                  canMutate={canMutate}
                  title={row.title}
                  isRowEditing={isRowEditing(row.id)}
                  onEditToggle={() => {
                    if (editMode === 'row') {
                      setEditingId(isRowEditing(row.id) ? null : row.id);
                      return;
                    }
                    openDialogForRow(row);
                  }}
                  onDelete={() => deleteRow(row.id)}
                />
              </div>
            ),
          },
        ]}
        emptyMessage="No related records."
      />

      <RelationChildEditDialog
        open={dialogOpen}
        draft={dialogDraft}
        size={size}
        canMutate={canMutate}
        onClose={closeDialog}
        onSave={saveDialog}
        onDraftChange={(patch) => setDialogDraft((current) => (
          current ? { ...current, ...patch } : current
        ))}
      />
    </div>
  );
};

/** @deprecated Use RelationRelatedGridControl — kept as alias for older imports. */
export const RelationRelatedListControl = RelationRelatedGridControl;

/** @deprecated Use RelationRelatedGridControl with editMode="direct". */
export const RelationInlineTableControl: React.FC<RelationRelatedGridControlProps> = (props) => (
  <RelationRelatedGridControl {...props} editMode={props.editMode ?? 'direct'} />
);

/** Card view of owned children with add / edit / remove (has-many). Edit mode: Direct / Row / Dialog. */
export const RelationCardListControl: React.FC<RelationCardListControlProps> = ({
  rows,
  onRowsChange,
  size = 'sm',
  disabled,
  className,
  ariaLabel = 'Related card list',
  showAddButton = true,
  onRegisterAdd,
  editMode: editModeProp,
  onEditModeChange,
  showEditModeSelect = true,
}) => {
  const {
    editMode,
    setEditingId,
    canMutate,
    updateRow,
    add,
    openDialogForRow,
    closeDialog,
    saveDialog,
    dialogDraft,
    setDialogDraft,
    dialogOpen,
    deleteRow,
    showInputsFor,
    isRowEditing,
    editModeSelect,
  } = useRelationCollectionEditMode({
    rows,
    onRowsChange,
    disabled,
    editMode: editModeProp,
    onEditModeChange,
    showEditModeSelect,
    onRegisterAdd,
    addLabel: 'Add card',
  });

  return (
    <div className={cn('flex flex-col gap-2', disabled && 'opacity-60', className)} role="group" aria-label={ariaLabel}>
      {showAddButton ? (
        <RelationCollectionHeader
          addLabel="Add card"
          disabled={!canMutate}
          onAdd={add}
          leading={editModeSelect}
        />
      ) : null}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rows.length === 0 ? (
          <p className="text-xs text-slate-400 sm:col-span-2">No related records.</p>
        ) : rows.map((row) => {
          const editing = showInputsFor(row.id);
          return (
            <div
              key={row.id}
              className="flex flex-col gap-2 rounded-[6px] border border-slate-200 bg-white p-3"
            >
              <div className="flex items-start justify-between gap-2">
                {editing ? (
                  <UiInput
                    size={size}
                    value={row.title}
                    isDisabled={!canMutate}
                    autoDir
                    ariaLabel={`Title for ${row.id}`}
                    onChange={(event) => updateRow(row.id, { title: event.target.value })}
                  />
                ) : (
                  <p className="m-0 min-w-0 flex-1 text-sm font-medium text-slate-800">
                    {row.title}
                  </p>
                )}
                <RelationItemEditDeleteActions
                  editMode={editMode}
                  canMutate={canMutate}
                  title={row.title}
                  isRowEditing={isRowEditing(row.id)}
                  onEditToggle={() => {
                    if (editMode === 'row') {
                      setEditingId(isRowEditing(row.id) ? null : row.id);
                      return;
                    }
                    openDialogForRow(row);
                  }}
                  onDelete={() => deleteRow(row.id)}
                />
              </div>
              {editing ? (
                <UiSelect
                  size={size}
                  value={row.status}
                  isDisabled={!canMutate}
                  ariaLabel={`Status for ${row.id}`}
                  onChange={(event) => updateRow(row.id, { status: event.target.value })}
                >
                  {RELATION_CHILD_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </UiSelect>
              ) : (
                <p className="m-0 text-xs text-slate-600">{row.status}</p>
              )}
            </div>
          );
        })}
      </div>

      <RelationChildEditDialog
        open={dialogOpen}
        draft={dialogDraft}
        size={size}
        canMutate={canMutate}
        onClose={closeDialog}
        onSave={saveDialog}
        onDraftChange={(patch) => setDialogDraft((current) => (
          current ? { ...current, ...patch } : current
        ))}
      />
    </div>
  );
};

/** Stacked field groups — one panel per child (has-many). Edit mode: Direct / Row / Dialog. */
export const RelationRepeaterControl: React.FC<RelationRepeaterControlProps> = ({
  rows,
  onRowsChange,
  size = 'sm',
  disabled,
  className,
  ariaLabel = 'Related repeater',
  showAddButton = true,
  onRegisterAdd,
  editMode: editModeProp,
  onEditModeChange,
  showEditModeSelect = true,
}) => {
  const {
    editMode,
    setEditingId,
    canMutate,
    updateRow,
    add,
    openDialogForRow,
    closeDialog,
    saveDialog,
    dialogDraft,
    setDialogDraft,
    dialogOpen,
    deleteRow,
    showInputsFor,
    isRowEditing,
    editModeSelect,
  } = useRelationCollectionEditMode({
    rows,
    onRowsChange,
    disabled,
    editMode: editModeProp,
    onEditModeChange,
    showEditModeSelect,
    onRegisterAdd,
    addLabel: 'Add item',
  });

  return (
    <div className={cn('flex flex-col gap-2', disabled && 'opacity-60', className)} role="group" aria-label={ariaLabel}>
      {showAddButton ? (
        <RelationCollectionHeader
          addLabel="Add item"
          disabled={!canMutate}
          onAdd={add}
          leading={editModeSelect}
        />
      ) : null}
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400">No related records.</p>
      ) : rows.map((row, index) => {
        const editing = showInputsFor(row.id);
        return (
          <div
            key={row.id}
            className="rounded-[6px] border border-slate-200 bg-slate-50/70 p-3"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="m-0 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {`Item ${index + 1}`}
              </p>
              <RelationItemEditDeleteActions
                editMode={editMode}
                canMutate={canMutate}
                title={row.title || `Item ${index + 1}`}
                isRowEditing={isRowEditing(row.id)}
                onEditToggle={() => {
                  if (editMode === 'row') {
                    setEditingId(isRowEditing(row.id) ? null : row.id);
                    return;
                  }
                  openDialogForRow(row);
                }}
                onDelete={() => deleteRow(row.id)}
              />
            </div>
            {editing ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <UiInput
                  size={size}
                  value={row.title}
                  isDisabled={!canMutate}
                  autoDir
                  ariaLabel={`Title for ${row.id}`}
                  onChange={(event) => updateRow(row.id, { title: event.target.value })}
                />
                <UiSelect
                  size={size}
                  value={row.status}
                  isDisabled={!canMutate}
                  ariaLabel={`Status for ${row.id}`}
                  onChange={(event) => updateRow(row.id, { status: event.target.value })}
                >
                  {RELATION_CHILD_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </UiSelect>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                <p className="m-0 text-sm font-medium text-slate-800">{row.title}</p>
                <p className="m-0 text-xs text-slate-600">{row.status}</p>
              </div>
            )}
          </div>
        );
      })}

      <RelationChildEditDialog
        open={dialogOpen}
        draft={dialogDraft}
        size={size}
        canMutate={canMutate}
        onClose={closeDialog}
        onSave={saveDialog}
        onDraftChange={(patch) => setDialogDraft((current) => (
          current ? { ...current, ...patch } : current
        ))}
      />
    </div>
  );
};

/** Loaded for the API but not shown on the form. */
export const RelationHiddenControl: React.FC<RelationFormWidgetHiddenProps> = ({
  note = 'Hidden — value is loaded for the API but not shown on the form.',
  className,
  ariaLabel = 'Hidden relation field',
}) => (
  <div
    className={cn(
      'flex items-start gap-2 rounded-[6px] border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500',
      className,
    )}
    role="note"
    aria-label={ariaLabel}
  >
    <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
    <span>{note}</span>
  </div>
);
