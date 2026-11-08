import type { ComponentType, ReactNode } from 'react';
import type { RelationFormWidget } from '../../api/contracts/data-api';
import type { CreateEditModalSize } from '../CreateEditModalShell';
import type { HeroUiFieldSize } from '../heroFieldSize';

/** Related-record option used by picker-style relation widgets. */
export type RelationFormWidgetOptionItem = {
  id: string;
  label: string;
};

/** Column shown in the lookup dialog grid. */
export type RelationLookupColumn = {
  id: string;
  label: string;
  width?: number;
  /** Marks the primary label column (row header). */
  isRowHeader?: boolean;
};

/** Rich related-record row for lookup grids (label + extra cells). */
export type RelationLookupRecord = {
  id: string;
  label: string;
  /** Extra cell values keyed by `RelationLookupColumn.id`. */
  values?: Record<string, string>;
};

/** Dialog sizes supported by the flexible lookup picker. */
export type RelationLookupDialogSize = Extract<
  CreateEditModalSize,
  'md' | 'lg' | 'xl' | '2xl' | '3xl' | '5xl' | 'maximized' | 'full'
>;

export type RelationLookupResultsLayout = 'grid' | 'list';

/** Child row used by has-many / has-one nested editors. */
export type RelationFormWidgetRow = {
  id: string;
  title: string;
  status: string;
};

export type RelationFormWidgetControlBaseProps = {
  size?: HeroUiFieldSize;
  disabled?: boolean;
  className?: string;
  /** Accessible name for the control group. */
  ariaLabel?: string;
};

export type RelationLookupControlProps = RelationFormWidgetControlBaseProps & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  dialogTitle?: string;
  /** Dialog chrome size — includes maximized / full viewport. Default `2xl`. */
  dialogSize?: RelationLookupDialogSize;
  /**
   * `grid` — searchable AppTableGrid (hero chrome) with configurable columns (default).
   * `list` — compact overlay list under the search field.
   */
  resultsLayout?: RelationLookupResultsLayout;
  /** Grid columns when `resultsLayout="grid"`. Defaults to Title only. */
  columns?: readonly RelationLookupColumn[];
  /** Rich rows for the picker. Prefer over `options` when showing a grid. */
  records?: readonly RelationLookupRecord[];
  /** Simple id/label options — used when `records` is omitted. */
  options?: readonly RelationFormWidgetOptionItem[];
  showClear?: boolean;
  showSearchButton?: boolean;
  /** Initial page size for the lookup grid. Default platform grid page size. */
  pageSize?: number;
  /** Page-size choices in the lookup footer. */
  pageSizes?: readonly number[];
};

export type RelationFormWidgetSingleProps = RelationFormWidgetControlBaseProps & {
  options: readonly RelationFormWidgetOptionItem[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

/** Layout direction for radio / button group / checkbox list pickers. */
export type RelationChoiceOrientation = 'horizontal' | 'vertical';

export type RelationRadioListControlProps = RelationFormWidgetSingleProps & {
  /** Default `horizontal`. */
  orientation?: RelationChoiceOrientation;
};

export type RelationButtonGroupControlProps = RelationFormWidgetSingleProps & {
  /** Default `horizontal`. */
  orientation?: RelationChoiceOrientation;
};

export type RelationCheckboxListControlProps = RelationFormWidgetMultiProps & {
  /** Default `horizontal`. */
  orientation?: RelationChoiceOrientation;
};

/**
 * Menu placement for the dropdown button.
 * `auto` prefers below and flips above when there is not enough space.
 */
export type RelationDropdownButtonMenuPlacement = 'auto' | 'above' | 'below';

export type RelationDropdownButtonControlProps = RelationFormWidgetSingleProps & {
  /** Menu placement. Default `auto` (prefer below, flip when tight). */
  menuPlacement?: RelationDropdownButtonMenuPlacement;
};

export type RelationFormWidgetMultiProps = RelationFormWidgetControlBaseProps & {
  options: readonly RelationFormWidgetOptionItem[];
  values: readonly string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
};

/** Where the add-select sits relative to the tags chips (Tags list). */
export const RELATION_TAGS_LIST_SELECT_PLACEMENT_VALUES = ['inline', 'above', 'below'] as const;
export type RelationTagsListSelectPlacement = (typeof RELATION_TAGS_LIST_SELECT_PLACEMENT_VALUES)[number];

export const RELATION_TAGS_LIST_SELECT_PLACEMENT_OPTIONS: readonly {
  value: RelationTagsListSelectPlacement;
  label: string;
}[] = [
  { value: 'inline', label: 'Inline' },
  { value: 'above', label: 'Above' },
  { value: 'below', label: 'Below' },
];

export type RelationTagsListControlProps = RelationFormWidgetMultiProps & {
  /** Default `inline`. */
  selectPlacement?: RelationTagsListSelectPlacement;
};

export type RelationCollectionAddApi = {
  add: () => void;
  disabled: boolean;
  label: string;
};

/** How has-many collection items are edited (grid / card list / repeater). */
export const RELATION_GRID_EDIT_MODE_VALUES = ['direct', 'row', 'dialog'] as const;
export type RelationGridEditMode = (typeof RELATION_GRID_EDIT_MODE_VALUES)[number];

export const RELATION_GRID_EDIT_MODE_OPTIONS: readonly {
  value: RelationGridEditMode;
  label: string;
  description: string;
}[] = [
  {
    value: 'direct',
    label: 'Direct edit',
    description: 'Fields stay editable on the surface.',
  },
  {
    value: 'row',
    label: 'Row edit',
    description: 'Read-only until Edit toggles inline fields on that item.',
  },
  {
    value: 'dialog',
    label: 'Dialog edit',
    description: 'Read-only until Edit opens a dialog for that item.',
  },
];

export type RelationFormWidgetCollectionProps = RelationFormWidgetControlBaseProps & {
  rows: readonly RelationFormWidgetRow[];
  onRowsChange?: (rows: RelationFormWidgetRow[]) => void;
  /**
   * When false, the internal Add row is omitted (host places Add via `onRegisterAdd`).
   * Default true.
   */
  showAddButton?: boolean;
  /** Publish Add action for host chrome (e.g. gallery title row). */
  onRegisterAdd?: (api: RelationCollectionAddApi | null) => void;
};

/** Shared by Related grid, Card list, and Repeater. */
export type RelationCollectionEditModeControlProps = RelationFormWidgetCollectionProps & {
  /** Edit interaction. Default `row`. */
  editMode?: RelationGridEditMode;
  onEditModeChange?: (mode: RelationGridEditMode) => void;
  /**
   * Show the edit-mode select next to Add.
   * Default true. Set false when the host renders the select (gallery title row).
   */
  showEditModeSelect?: boolean;
};

export type RelationRelatedGridControlProps = RelationCollectionEditModeControlProps;
export type RelationCardListControlProps = RelationCollectionEditModeControlProps;
export type RelationRepeaterControlProps = RelationCollectionEditModeControlProps;

export type RelationFormWidgetNestedRecordProps = RelationFormWidgetControlBaseProps & {
  row: RelationFormWidgetRow | null;
  onRowChange?: (row: RelationFormWidgetRow | null) => void;
};

export type RelationFormWidgetHiddenProps = RelationFormWidgetControlBaseProps & {
  /** Developer-facing note when the field is intentionally not rendered. */
  note?: string;
};

/** Shared props bag accepted by the catalog gallery demos. */
export type RelationFormWidgetDemoProps = {
  size?: HeroUiFieldSize;
  disabled?: boolean;
  /**
   * Gallery mounts this node in the card title row (demo options without an extra body line).
   * Clear with `null` on unmount.
   */
  setTitleExtra?: (extra: ReactNode | null) => void;
};

export type RelationFormWidgetComponentMap = {
  [K in RelationFormWidget]: ComponentType<RelationFormWidgetDemoProps>;
};
