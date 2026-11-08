/**
 * Shared CRUD Set contract.
 * Canonical prose: docs/standards/crud-set.md
 * Wizard (operator) only writes these fields onto one CrudSet. Skill fills the
 * same spec, then renders that same component. Living sample: Base Components.
 */

import type { AppTableGridColumnDef } from '../../shared/lib/appTableGridQuery';
import { resolveColumnCardRole } from '../../shared/lib/appTableGridCardLayout';
import {
  APP_TABLE_GRID_COLUMN_CARD_ROLES,
  APP_TABLE_GRID_COLUMN_CARD_ROLE_LABELS,
  isAppTableGridColumnCardRole,
  type AppTableGridColumnCardRole,
} from '../../shared/lib/appTableGridCardView';
import { appTableGridUsesCardPresentation } from '../../shared/lib/appTableGridPresentation';

/** How the assistant fills `CrudSetSpec` options. Asked first, always. */
export type CrudSetCollectionMode = 'suggest-then-cut' | 'decide-now';

export const CRUD_SET_COLLECTION_MODES: readonly CrudSetCollectionMode[] = [
  'suggest-then-cut',
  'decide-now',
] as const;

/**
 * First question for wizard and AI. Options are the collection modes.
 * English UI copy — do not fork this string in the skill.
 */
export const CRUD_SET_FIRST_QUESTION =
  'Build with my suggestions now, and you cut later? Or do you want to decide everything now?';

export const CRUD_SET_COLLECTION_MODE_LABELS: Record<CrudSetCollectionMode, string> = {
  'suggest-then-cut': 'Build with my suggestions — cut later',
  'decide-now': 'Decide everything now',
};

export const isCrudSetCollectionMode = (value: unknown): value is CrudSetCollectionMode =>
  value === 'suggest-then-cut' || value === 'decide-now';

export const CRUD_SET_LIST_BODY_KINDS = ['grid', 'tree-grid', 'kanban', 'map'] as const;

export type CrudSetListBodyKind = (typeof CRUD_SET_LIST_BODY_KINDS)[number];

export const CRUD_SET_LIST_BODY_LABELS: Record<CrudSetListBodyKind, string> = {
  grid: 'Grid',
  'tree-grid': 'Tree grid',
  kanban: 'Kanban',
  map: 'Map',
};

export const isCrudSetListBodyKind = (value: unknown): value is CrudSetListBodyKind => (
  typeof value === 'string' && (CRUD_SET_LIST_BODY_KINDS as readonly string[]).includes(value)
);

export const parseCrudSetListBody = (value: unknown): CrudSetListBodyKind => (
  isCrudSetListBodyKind(value) ? value : 'grid'
);

/** Grid chrome, paging footer, and row-action column apply only to these bodies. */
export const crudSetListBodyUsesGrid = (listBody: CrudSetListBodyKind): boolean => (
  listBody === 'grid' || listBody === 'tree-grid'
);

export const CRUD_SET_KANBAN_HEIGHTS = ['auto', 'full'] as const;
export type CrudSetKanbanHeight = (typeof CRUD_SET_KANBAN_HEIGHTS)[number];
export const CRUD_SET_KANBAN_HEIGHT_LABELS: Record<CrudSetKanbanHeight, string> = {
  auto: 'Content height',
  full: 'Fill height',
};

export const CRUD_SET_KANBAN_COLUMN_WIDTHS = ['sm', 'md', 'lg'] as const;
export type CrudSetKanbanColumnWidth = (typeof CRUD_SET_KANBAN_COLUMN_WIDTHS)[number];
export const CRUD_SET_KANBAN_COLUMN_WIDTH_LABELS: Record<CrudSetKanbanColumnWidth, string> = {
  sm: 'Narrow (180px)',
  md: 'Medium (220px)',
  lg: 'Wide (280px)',
};

export const CRUD_SET_KANBAN_COLUMN_LAYOUTS = ['scroll', 'fill'] as const;
export type CrudSetKanbanColumnLayout = (typeof CRUD_SET_KANBAN_COLUMN_LAYOUTS)[number];
export const CRUD_SET_KANBAN_COLUMN_LAYOUT_LABELS: Record<CrudSetKanbanColumnLayout, string> = {
  scroll: 'Horizontal scroll',
  fill: 'Fill width',
};

export const CRUD_SET_KANBAN_DENSITIES = ['compact', 'comfortable'] as const;
export type CrudSetKanbanDensity = (typeof CRUD_SET_KANBAN_DENSITIES)[number];
export const CRUD_SET_KANBAN_DENSITY_LABELS: Record<CrudSetKanbanDensity, string> = {
  compact: 'Compact',
  comfortable: 'Comfortable',
};

export const CRUD_SET_KANBAN_TONES = [
  'slate',
  'violet',
  'cyan',
  'indigo',
  'emerald',
  'amber',
  'rose',
] as const;
export type CrudSetKanbanTone = (typeof CRUD_SET_KANBAN_TONES)[number];
export const CRUD_SET_KANBAN_TONE_LABELS: Record<CrudSetKanbanTone, string> = {
  slate: 'Slate',
  violet: 'Violet',
  cyan: 'Cyan',
  indigo: 'Indigo',
  emerald: 'Emerald',
  amber: 'Amber',
  rose: 'Rose',
};

export type CrudSetKanbanStatusColumn = {
  value: string;
  label?: string;
};

/** Kanban buckets cards by this dataset field. Default `status`. */
export type CrudSetKanbanConfig = {
  statusField?: string;
  /** Board columns in left-to-right order. The status field filter is omitted from the toolbar in kanban. */
  statusColumns?: CrudSetKanbanStatusColumn[];
  /** Card title. Default `title`, else the first column. */
  titleField?: string;
  /** Card description. Default `subtitle`. */
  descriptionField?: string;
  /** `full` fills the list body height. Default `full`. */
  height?: CrudSetKanbanHeight;
  columnWidth?: CrudSetKanbanColumnWidth;
  /** `scroll` uses fixed column widths; `fill` stretches columns across the board width. */
  columnLayout?: CrudSetKanbanColumnLayout;
  density?: CrudSetKanbanDensity;
  showCardCount?: boolean;
  showDescriptions?: boolean;
  /** Default column chrome when `coloredColumns` is false. */
  tone?: CrudSetKanbanTone;
  /** Cycle semantic tones per status column. Default true. */
  coloredColumns?: boolean;
  interactive?: boolean;
  enableKeyboardMove?: boolean;
  /** Omit columns with zero cards. Default false. */
  hideEmptyColumns?: boolean;
  /** Per-column card cap; `0` disables WIP limits. Default `0`. */
  wipLimit?: number;
};

export const CRUD_SET_DEFAULT_KANBAN: Required<Omit<CrudSetKanbanConfig, 'statusColumns'>> & {
  statusColumns: CrudSetKanbanStatusColumn[];
} = {
  statusField: 'status',
  statusColumns: [],
  titleField: 'title',
  descriptionField: 'subtitle',
  height: 'full',
  columnWidth: 'md',
  columnLayout: 'fill',
  density: 'comfortable',
  showCardCount: true,
  showDescriptions: true,
  tone: 'slate',
  coloredColumns: true,
  interactive: true,
  enableKeyboardMove: true,
  hideEmptyColumns: false,
  wipLimit: 0,
};

/** Pin map reads these dataset fields. Default `latitude` / `longitude` / `title`. */
export type CrudSetMapConfig = {
  latField?: string;
  lngField?: string;
  labelField?: string;
};

export const CRUD_SET_DEFAULT_MAP: Required<CrudSetMapConfig> = {
  latField: 'latitude',
  lngField: 'longitude',
  labelField: 'title',
};

export type CrudSetApiRef = {
  /** Server Function / Data API route the operator or agent selected. */
  endpointId: string;
};

/** How a CRUD Set grid cell renders. Default `text`. */
export const CRUD_SET_CELL_KINDS = [
  'text',
  'boolean-icon',
  'date',
  'badge',
  'chips',
  'lock-status',
  'link',
  'image',
  'audit',
] as const;

export type CrudSetCellKind = (typeof CRUD_SET_CELL_KINDS)[number];

export const CRUD_SET_CELL_KIND_LABELS: Record<CrudSetCellKind, string> = {
  text: 'Text',
  'boolean-icon': 'Boolean icon',
  date: 'Date',
  badge: 'Badge',
  chips: 'Chips',
  'lock-status': 'Lock status',
  link: 'Link',
  image: 'Image',
  audit: 'Audit (date + actor)',
};

export const isCrudSetCellKind = (value: unknown): value is CrudSetCellKind => (
  typeof value === 'string' && (CRUD_SET_CELL_KINDS as readonly string[]).includes(value)
);

/** Maps Auto Table / designer cell kinds onto the CRUD Set subset. */
export const toCrudSetCellKind = (value: unknown): CrudSetCellKind => {
  if (value === 'status-badge') {
    return 'badge';
  }
  if (value === 'avatar' || value === 'file-tile') {
    return 'image';
  }
  return isCrudSetCellKind(value) ? value : 'text';
};

/** Where a field sits on the Edit / View form. Grid columns still use array order. */
export const CRUD_SET_FORM_PLACEMENTS = ['main', 'side'] as const;

export type CrudSetFormPlacement = (typeof CRUD_SET_FORM_PLACEMENTS)[number];

export const CRUD_SET_FORM_PLACEMENT_LABELS: Record<CrudSetFormPlacement, string> = {
  main: 'Main',
  side: 'Side panel',
};

export const isCrudSetFormPlacement = (value: unknown): value is CrudSetFormPlacement => (
  value === 'main' || value === 'side'
);

export const RECORD_FORM_MODES = ['create', 'edit', 'view'] as const;

export type RecordFormMode = (typeof RECORD_FORM_MODES)[number];

export const RECORD_FORM_MODE_LABELS: Record<RecordFormMode, string> = {
  create: 'Create',
  edit: 'Edit',
  view: 'View',
};

export const isRecordFormMode = (value: unknown): value is RecordFormMode => (
  value === 'create' || value === 'edit' || value === 'view'
);

export const RECORD_FORM_PALETTE_ITEM_ID = 'heroui.record-form';

/**
 * Side-panel edge. `right` / `left` are physical. `end` follows the inline end
 * (opposite the theme direction). `start` follows the inline start (same as the theme direction).
 */
export const RECORD_FORM_SIDE_PANEL_PLACEMENTS = ['right', 'left', 'end', 'start'] as const;

export type RecordFormSidePanelPlacement = (typeof RECORD_FORM_SIDE_PANEL_PLACEMENTS)[number];

export const RECORD_FORM_SIDE_PANEL_PLACEMENT_LABELS: Record<RecordFormSidePanelPlacement, string> = {
  right: 'Right',
  left: 'Left',
  end: 'Opposite to theme direction',
  start: 'Same as theme direction',
};

export const RECORD_FORM_DEFAULT_SIDE_PANEL_PLACEMENT: RecordFormSidePanelPlacement = 'end';

export const isRecordFormSidePanelPlacement = (value: unknown): value is RecordFormSidePanelPlacement => (
  value === 'right' || value === 'left' || value === 'end' || value === 'start'
);

export const RECORD_FORM_SIDE_PANEL_WIDTH_PX = 248;

/** Ghost splitter is on by default (hit target only — no painted rail). */
export const RECORD_FORM_DEFAULT_SIDE_PANEL_SPLITTER = true;

export const RECORD_FORM_SIDE_PANEL_BACKGROUNDS = ['theme', 'custom'] as const;

export type RecordFormSidePanelBackground = (typeof RECORD_FORM_SIDE_PANEL_BACKGROUNDS)[number];

export const RECORD_FORM_SIDE_PANEL_BACKGROUND_LABELS: Record<RecordFormSidePanelBackground, string> = {
  theme: 'Current theme',
  custom: 'Specific color',
};

export const RECORD_FORM_DEFAULT_SIDE_PANEL_BACKGROUND: RecordFormSidePanelBackground = 'theme';

/** Fallback when Background is Specific color and the hex is empty or invalid. */
export const RECORD_FORM_DEFAULT_SIDE_PANEL_BACKGROUND_COLOR = '#F1F5F9';

export const RECORD_FORM_SIDE_PANEL_THEME_BACKGROUND = 'var(--app-inspector-rail-bg)';

export const isRecordFormSidePanelBackground = (value: unknown): value is RecordFormSidePanelBackground => (
  value === 'theme' || value === 'custom'
);

export const RECORD_FORM_DIALOG_SUB_HEADER_COUNTS = [0, 1, 2, 3] as const;

export type RecordFormDialogSubHeaderCount = (typeof RECORD_FORM_DIALOG_SUB_HEADER_COUNTS)[number];

export const isRecordFormDialogSubHeaderCount = (value: unknown): value is RecordFormDialogSubHeaderCount => (
  value === 0 || value === 1 || value === 2 || value === 3
);

export const RECORD_FORM_DIALOG_SUB_FOOTER_COUNTS = [0, 1, 2] as const;

export type RecordFormDialogSubFooterCount = (typeof RECORD_FORM_DIALOG_SUB_FOOTER_COUNTS)[number];

export const isRecordFormDialogSubFooterCount = (value: unknown): value is RecordFormDialogSubFooterCount => (
  value === 0 || value === 1 || value === 2
);

/** Physical left = first in a LTR flex row, last in RTL. */
export const recordFormSidePanelPhysicallyLeft = (
  placement: RecordFormSidePanelPlacement,
  isRtl: boolean,
): boolean => {
  switch (placement) {
    case 'left':
      return true;
    case 'right':
      return false;
    case 'start':
      return !isRtl;
    case 'end':
      return isRtl;
  }
};

/** Explicit Edit / View / Create control. `auto` infers from `cellKind` / field name. */
export const CRUD_SET_FORM_CONTROLS = [
  'auto',
  'text',
  'textarea',
  'checkbox',
  'chips',
  'select',
  'password',
  'image',
  'color',
  'html',
  'json',
] as const;

export type CrudSetFormControl = (typeof CRUD_SET_FORM_CONTROLS)[number];

export const CRUD_SET_FORM_CONTROL_LABELS: Record<CrudSetFormControl, string> = {
  auto: 'Auto',
  text: 'Text',
  textarea: 'Textarea',
  checkbox: 'Checkbox',
  chips: 'Chips',
  select: 'Select',
  password: 'Password',
  image: 'Image',
  color: 'Color',
  html: 'HTML',
  json: 'JSON',
};

export const isCrudSetFormControl = (value: unknown): value is CrudSetFormControl => (
  typeof value === 'string' && (CRUD_SET_FORM_CONTROLS as readonly string[]).includes(value)
);

/** Show a form field only when another field equals this text. */
export type CrudSetVisibleWhen = {
  field: string;
  equals: string;
};

export const CRUD_SET_CREATE_LAYOUTS = ['split', 'adjacent'] as const;

export type CrudSetCreateLayout = (typeof CRUD_SET_CREATE_LAYOUTS)[number];

export const CRUD_SET_CREATE_LAYOUT_LABELS: Record<CrudSetCreateLayout, string> = {
  split: 'Dropdown (2+)',
  adjacent: 'Adjacent buttons',
};

export const isCrudSetCreateLayout = (value: unknown): value is CrudSetCreateLayout => (
  value === 'split' || value === 'adjacent'
);

export type CrudSetCreateStep = {
  title: string;
  acceptedFields: string[];
};

export const CRUD_SET_FILTER_OPTIONS_FROM = ['static', 'distinct-rows'] as const;

export type CrudSetFilterOptionsFrom = (typeof CRUD_SET_FILTER_OPTIONS_FROM)[number];

export const CRUD_SET_FILTER_OPTIONS_FROM_LABELS: Record<CrudSetFilterOptionsFrom, string> = {
  static: 'Static options',
  'distinct-rows': 'Distinct values from rows',
};

export const isCrudSetFilterOptionsFrom = (value: unknown): value is CrudSetFilterOptionsFrom => (
  value === 'static' || value === 'distinct-rows'
);

export const CRUD_SET_DISABLED_WHEN_RULES = [
  'never',
  'field-truthy',
  'field-falsy',
  'field-equals',
  'has-children',
  'row-is-self',
] as const;

export type CrudSetDisabledWhenRule = (typeof CRUD_SET_DISABLED_WHEN_RULES)[number];

export const CRUD_SET_DISABLED_WHEN_RULE_LABELS: Record<CrudSetDisabledWhenRule, string> = {
  never: 'Never',
  'field-truthy': 'Field is on',
  'field-falsy': 'Field is off',
  'field-equals': 'Field equals',
  'has-children': 'Row has children',
  'row-is-self': 'Row is the current operator',
};

export const isCrudSetDisabledWhenRule = (value: unknown): value is CrudSetDisabledWhenRule => (
  typeof value === 'string' && (CRUD_SET_DISABLED_WHEN_RULES as readonly string[]).includes(value)
);

export type CrudSetDisabledWhen = {
  rule: CrudSetDisabledWhenRule;
  field?: string;
  equals?: string;
};

export const CRUD_SET_ROW_ACTION_INTERACTIONS = ['host', 'view', 'confirm'] as const;

export type CrudSetRowActionInteraction = (typeof CRUD_SET_ROW_ACTION_INTERACTIONS)[number];

export const CRUD_SET_ROW_ACTION_INTERACTION_LABELS: Record<CrudSetRowActionInteraction, string> = {
  host: 'Host callback',
  view: 'View dialog',
  confirm: 'Confirm then host',
};

export const isCrudSetRowActionInteraction = (value: unknown): value is CrudSetRowActionInteraction => (
  value === 'host' || value === 'view' || value === 'confirm'
);

export const CRUD_SET_ROW_ACTION_INTENTS = ['view', 'edit', 'delete', 'access', 'utility', 'warning'] as const;

export type CrudSetRowActionIntent = (typeof CRUD_SET_ROW_ACTION_INTENTS)[number];

export const CRUD_SET_ROW_ACTION_INTENT_LABELS: Record<CrudSetRowActionIntent, string> = {
  view: 'View',
  edit: 'Edit',
  delete: 'Delete',
  access: 'Access',
  utility: 'Utility',
  warning: 'Warning',
};

export const isCrudSetRowActionIntent = (value: unknown): value is CrudSetRowActionIntent => (
  typeof value === 'string' && (CRUD_SET_ROW_ACTION_INTENTS as readonly string[]).includes(value)
);

/** Extra row chrome that is not a PATCH. Host supplies `onHostAction` for `host` / `confirm`. */
export type CrudSetRowAction = {
  id: string;
  label: string;
  interaction: CrudSetRowActionInteraction;
  intent?: CrudSetRowActionIntent;
  openFromColumnId?: string;
  disabledWhen?: CrudSetDisabledWhen;
  /** `view` only. Empty = all columns. */
  acceptedFields?: string[];
};

export const CRUD_SET_COLLECTION_ACTION_INTENTS = ['secondary', 'utility', 'destructive-soft'] as const;

export type CrudSetCollectionActionIntent = (typeof CRUD_SET_COLLECTION_ACTION_INTENTS)[number];

export const CRUD_SET_COLLECTION_ACTION_INTENT_LABELS: Record<CrudSetCollectionActionIntent, string> = {
  secondary: 'Secondary',
  utility: 'Utility',
  'destructive-soft': 'Destructive',
};

export const isCrudSetCollectionActionIntent = (value: unknown): value is CrudSetCollectionActionIntent => (
  value === 'secondary' || value === 'utility' || value === 'destructive-soft'
);

/** Toolbar action on the whole queried set (Clear all). Not a row PK delete. */
export type CrudSetCollectionAction = {
  id: string;
  label: string;
  intent?: CrudSetCollectionActionIntent;
  /** Default true for `destructive-soft`, false otherwise. */
  confirm?: boolean;
};

export type CrudSetAutoRefreshConfig = {
  /** Default false. */
  enabled?: boolean;
  /** Seconds. Default 5. Minimum 1. */
  seconds?: number;
};

export const CRUD_SET_VIEW_KINDS = ['record-form', 'json', 'thread'] as const;

export type CrudSetViewKind = (typeof CRUD_SET_VIEW_KINDS)[number];

export const CRUD_SET_VIEW_KIND_LABELS: Record<CrudSetViewKind, string> = {
  'record-form': 'Record form',
  json: 'JSON',
  thread: 'Thread',
};

export const isCrudSetViewKind = (value: unknown): value is CrudSetViewKind => (
  value === 'record-form' || value === 'json' || value === 'thread'
);

export const CRUD_SET_DEFAULT_SIDE_PANEL_TITLE = 'Flags';

export const CRUD_SET_FORM_WIDE_FIELD_COUNT = 4;

/** Closed display transforms applied to the dataset field before cell chrome. */
export const CRUD_SET_COLUMN_TRANSFORMS = [
  'none',
  'uppercase',
  'lowercase',
  'title-case',
  'text-truncate',
  'number-grouped',
  'number-compact',
  'number-percent',
  'date',
  'date-year',
  'date-month-year',
  'datetime',
  'date-custom',
  'boolean-yes-no',
  'boolean-on-off',
  'boolean-true-false',
  'link-full',
  'link-domain',
  'link-host',
  'link-path',
  'link-file-name',
  'link-go-to',
  'link-open',
  'link-view',
  'link-external',
  'link-custom-label',
  'link-truncate',
  'link-email',
  'chips-comma',
  'chips-count',
] as const;

export type CrudSetColumnTransform = (typeof CRUD_SET_COLUMN_TRANSFORMS)[number];

export const CRUD_SET_COLUMN_TRANSFORM_LABELS: Record<CrudSetColumnTransform, string> = {
  none: 'Raw value',
  uppercase: 'Uppercase',
  lowercase: 'Lowercase',
  'title-case': 'Title case',
  'text-truncate': 'Truncate with ellipsis',
  'number-grouped': 'Grouped number (1,234.5)',
  'number-compact': 'Compact number (1.2K)',
  'number-percent': 'Percent (value + %)',
  date: 'Date only (YYYY-MM-DD)',
  'date-year': 'Year only',
  'date-month-year': 'Year and month',
  datetime: 'Date and time',
  'date-custom': 'Custom date format',
  'boolean-yes-no': 'Yes / No',
  'boolean-on-off': 'On / Off',
  'boolean-true-false': 'True / False',
  'link-full': 'Full URL',
  'link-domain': 'Domain only',
  'link-host': 'Host (strip www)',
  'link-path': 'Path only',
  'link-file-name': 'File name (last segment)',
  'link-go-to': 'Go to',
  'link-open': 'Open',
  'link-view': 'View',
  'link-external': 'External link',
  'link-custom-label': 'Custom label',
  'link-truncate': 'Truncate URL text',
  'link-email': 'Email address',
  'chips-comma': 'Comma-separated list',
  'chips-count': 'Count only (N items)',
};

export const isCrudSetColumnTransform = (value: unknown): value is CrudSetColumnTransform => (
  typeof value === 'string' && (CRUD_SET_COLUMN_TRANSFORMS as readonly string[]).includes(value)
);

export const CRUD_SET_IMAGE_MASKS = ['none', 'circle'] as const;

export type CrudSetImageMask = (typeof CRUD_SET_IMAGE_MASKS)[number];

export const CRUD_SET_IMAGE_MASK_LABELS: Record<CrudSetImageMask, string> = {
  none: 'Square',
  circle: 'Circle',
};

export const isCrudSetImageMask = (value: unknown): value is CrudSetImageMask => (
  value === 'none' || value === 'circle'
);

export const CRUD_SET_STACK_LAYOUTS = ['none', 'stacked', 'inline'] as const;

export type CrudSetStackLayout = (typeof CRUD_SET_STACK_LAYOUTS)[number];

export const CRUD_SET_STACK_LAYOUT_LABELS: Record<CrudSetStackLayout, string> = {
  none: 'Primary only',
  stacked: 'Secondary under primary',
  inline: 'Primary then secondary',
};

export const isCrudSetStackLayout = (value: unknown): value is CrudSetStackLayout => (
  value === 'none' || value === 'stacked' || value === 'inline'
);

export const CRUD_SET_CONDITIONAL_WHENS = [
  'equals',
  'not-equals',
  'contains',
  'empty',
  'not-empty',
  'truthy',
  'falsy',
] as const;

export type CrudSetConditionalWhen = (typeof CRUD_SET_CONDITIONAL_WHENS)[number];

export const CRUD_SET_CONDITIONAL_WHEN_LABELS: Record<CrudSetConditionalWhen, string> = {
  equals: 'Equals',
  'not-equals': 'Does not equal',
  contains: 'Contains',
  empty: 'Empty',
  'not-empty': 'Not empty',
  truthy: 'Truthy',
  falsy: 'Falsy',
};

export const isCrudSetConditionalWhen = (value: unknown): value is CrudSetConditionalWhen => (
  typeof value === 'string' && (CRUD_SET_CONDITIONAL_WHENS as readonly string[]).includes(value)
);

/** Pale cell fills for the color-picker presets and living-sample rules. */
export const CRUD_SET_CONDITIONAL_BACKGROUND_PRESETS = [
  '#F0F9FF',
  '#ECFDF5',
  '#FFFBEB',
  '#FFF1F2',
  '#F5F3FF',
  '#F1F5F9',
] as const;

export const CRUD_SET_CONDITIONAL_DEFAULT_BACKGROUND = CRUD_SET_CONDITIONAL_BACKGROUND_PRESETS[0];

/** Living-sample fills — pale sky / emerald / slate. */
export const CRUD_SET_CONDITIONAL_SAMPLE_BACKGROUNDS = {
  open: '#F0F9FF',
  approved: '#ECFDF5',
  shipped: '#F1F5F9',
} as const;

const HEX6 = /^#[0-9A-Fa-f]{6}$/;
const HEX3 = /^#[0-9A-Fa-f]{3}$/;
const HEX8 = /^#[0-9A-Fa-f]{8}$/;

export const crudSetNormalizeConditionalBackground = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  const hex = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  if (HEX6.test(hex)) {
    return hex.toUpperCase();
  }
  if (HEX3.test(hex)) {
    const raw = hex.slice(1);
    return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`.toUpperCase();
  }
  if (HEX8.test(hex)) {
    return `#${hex.slice(1, 7)}`.toUpperCase();
  }
  return undefined;
};

export const isCrudSetConditionalBackground = (value: unknown): value is string => (
  crudSetNormalizeConditionalBackground(value) != null
);

export const CRUD_SET_COLUMN_CARD_ROLES = APP_TABLE_GRID_COLUMN_CARD_ROLES;

export type CrudSetColumnCardRole = AppTableGridColumnCardRole;

export const CRUD_SET_COLUMN_CARD_ROLE_LABELS = APP_TABLE_GRID_COLUMN_CARD_ROLE_LABELS;

export const isCrudSetColumnCardRole = isAppTableGridColumnCardRole;

export const CRUD_SET_COLUMN_HIDE_BELOW = ['md', 'lg'] as const;

export type CrudSetColumnHideBelow = (typeof CRUD_SET_COLUMN_HIDE_BELOW)[number];

export const CRUD_SET_COLUMN_HIDE_BELOW_LABELS: Record<CrudSetColumnHideBelow, string> = {
  md: 'Hide below md',
  lg: 'Hide below lg',
};

export const isCrudSetColumnHideBelow = (value: unknown): value is CrudSetColumnHideBelow => (
  value === 'md' || value === 'lg'
);

export const CRUD_SET_COLUMN_PINS = ['none', 'left', 'right'] as const;

export type CrudSetColumnPin = (typeof CRUD_SET_COLUMN_PINS)[number];

export const CRUD_SET_COLUMN_PIN_LABELS: Record<CrudSetColumnPin, string> = {
  none: 'Not pinned',
  left: 'Pin left',
  right: 'Pin right',
};

export const isCrudSetColumnPin = (value: unknown): value is CrudSetColumnPin => (
  value === 'none' || value === 'left' || value === 'right'
);

export type CrudSetConditionalRule = {
  when: CrudSetConditionalWhen;
  /** Compared as text for equals / not-equals / contains. */
  value?: string;
  /** Cell background hex (`#RRGGBB`). Operator-picked. */
  background: string;
};

/**
 * One grid column. Array order on `columns` is left-to-right.
 * `field` is the list-API / dataset key the cell reads. Display chrome, transforms,
 * stacked secondary field, and conditional format are per-column.
 */
export type CrudSetGridColumn = {
  /**
   * Stable column id. Default: `field`. Set when two columns read the same dataset field.
   */
  id?: string;
  /** List-API / dataset field the cell reads. */
  field: string;
  /** Optional second dataset field shown with `stack`. */
  secondaryField?: string;
  /** How to show `secondaryField`. Default `stacked` when that field is set. */
  stack?: CrudSetStackLayout;
  /** Column header. Default: humanize `field`. */
  label?: string;
  /** Cell chrome. Default `text`. */
  cellKind?: CrudSetCellKind;
  /** Image cells only. Default `none`. Suggestion `circle` for avatar-like fields. */
  imageMask?: CrudSetImageMask;
  /** Value transform before chrome. Default `date` when `cellKind` is `date`, else `none`. */
  transform?: CrudSetColumnTransform;
  /** Tokens for `date-custom`: YYYY MM DD HH mm ss. Default `YYYY-MM-DD`. */
  transformFormat?: string;
  /** Default true. `false` disables header sort. */
  sortable?: boolean;
  /** Default true (legacy specs). `false` hides the column filter. */
  filterable?: boolean;
  /** Column width in pixels, or a CSS width string. */
  width?: number | string;
  /** First matching rule wins. Mapped onto AppTableGrid `getCellStyle` as a cell background. */
  conditionalFormat?: CrudSetConditionalRule[];
  /** Card role when presentation is cards/auto. Default: first column `title`, others `field`. */
  cardRole?: CrudSetColumnCardRole;
  /** Optional card field label. Default: column `label`. */
  cardLabel?: string;
  /** Lower number shows first on stacked cards. */
  cardPriority?: number;
  /** Override `cardRole` on phone. */
  phoneRole?: CrudSetColumnCardRole;
  /** Override `cardRole` on tablet. */
  tabletRole?: CrudSetColumnCardRole;
  /** Hide this column below the breakpoint. */
  hideBelow?: CrudSetColumnHideBelow;
  /** Accessibility row header. Default true on the first column. */
  isRowHeader?: boolean;
  /** Column-layout hide. Default true when `grid.enableColumnLayout` is on. */
  hideable?: boolean;
  /** Column resize. Default true. Independent of `grid.enableColumnLayout`. */
  resizable?: boolean;
  /** Column-layout reorder. Default true when layout is on. */
  reorderable?: boolean;
  /** Freeze while the table scrolls horizontally. Default `none`. */
  pinned?: CrudSetColumnPin;
  /**
   * Edit / View form slot. Default `side` for boolean-icon and lock-status, else `main`.
   * Side-panel fields sit under `dialogs.sidePanelTitle`.
   */
  formPlacement?: CrudSetFormPlacement;
  /** Explicit form control. Default `auto` (infer from cellKind / field). */
  formControl?: CrudSetFormControl;
  /** Operator hint on the form label (FieldHintTooltip). */
  formHint?: string;
  /** Textarea row count when `formControl` is textarea, html, or json. Default 3. */
  formTextareaRows?: number;
  /** Force full width on the RecordForm two-column grid. */
  formColumnSpan?: 2;
  /** Hide this field on create/edit/view unless `values[field] === equals`. */
  visibleWhen?: CrudSetVisibleWhen;
};

export type CrudSetCreateApi = {
  id: string;
  /** Toolbar label, e.g. "Add individual". Operator-chosen. */
  label: string;
  endpointId: string;
  /** Why this create exists — minimum fields, extra defaults, invite, … */
  purpose?: string;
  /**
   * Fields shown in the create dialog. Operator-chosen; do not dump every
   * create-API field. Empty = confirm-only create (no form fields).
   */
  acceptedFields: string[];
  /**
   * Wizard steps. When set and length >= 2, create uses StepWizardShell.
   * Each step's acceptedFields must be a subset of `acceptedFields`.
   */
  steps?: CrudSetCreateStep[];
};

export type CrudSetPatchKind = 'content' | 'purpose';

/** How the operator applies a patch. Default `form`. */
export type CrudSetPatchInteraction = 'form' | 'boolean-toggle';

export type CrudSetPatchApi = {
  id: string;
  /** Row-action / dialog title, e.g. "Approve" or "Edit record". */
  label: string;
  endpointId: string;
  /**
   * `content` = the dedicated record-content editor (fields that hold the record).
   * `purpose` = a small targeted update (approve, archive, lock, …).
   */
  kind: CrudSetPatchKind;
  /** Only these fields are editable in the patch dialog (or the one boolean for a toggle). */
  acceptedFields: string[];
  /**
   * `form` (default): read-one dialog, edit `acceptedFields`, confirm.
   * `boolean-toggle`: exactly one boolean field; click inverts the list-row value and PATCHes.
   * No read-one form. Only valid on `kind: 'purpose'`.
   */
  interaction?: CrudSetPatchInteraction;
  /**
   * `boolean-toggle` only. Default `false` = apply on click.
   * `true` = `ConfirmDialogShell` first, then PATCH. Still no read-one form.
   */
  toggleConfirm?: boolean;
  /** Disable this patch for matching rows. */
  disabledWhen?: CrudSetDisabledWhen;
  /**
   * Where a patch opens from.
   * - Omitted on `kind: 'content'`: auto — first display column (title, name, …) or row `id`, else first column.
   * - `'actions'`: keep in the actions column (no column click).
   * - Column id or `field`: click that column opens this patch.
   * Purpose patches default to the actions column when omitted.
   */
  openFromColumnId?: string;
};

/** Sentinel: keep the patch in the actions column instead of a column click. */
export const CRUD_SET_PATCH_OPEN_FROM_ACTIONS = 'actions' as const;

const CRUD_SET_DISPLAY_COLUMN_FIELD_NAMES = [
  'title',
  'name',
  'label',
  'displayname',
  'display_name',
  'fullname',
  'full_name',
  'username',
  'subject',
  'heading',
  'caption',
  'summary',
] as const;

const CRUD_SET_ROW_ID_COLUMN_FIELD_NAMES = ['id', 'uuid', 'key'] as const;

const normalizeCrudSetColumnFieldKey = (field: string): string => (
  field.trim().toLowerCase().replace(/_/g, '')
);

const isCrudSetDisplayColumnField = (field: string): boolean => {
  const key = normalizeCrudSetColumnFieldKey(field);
  return CRUD_SET_DISPLAY_COLUMN_FIELD_NAMES.some((name) => key === normalizeCrudSetColumnFieldKey(name));
};

const isCrudSetRowIdColumnField = (field: string): boolean => {
  const key = normalizeCrudSetColumnFieldKey(field);
  return CRUD_SET_ROW_ID_COLUMN_FIELD_NAMES.some((name) => key === normalizeCrudSetColumnFieldKey(name));
};

const isCrudSetContentPatchColumnCellKind = (column: CrudSetGridColumn): boolean => {
  const kind = crudSetColumnCellKind(column);
  return kind === 'text' || kind === 'link';
};

export const crudSetColumnIsImageColumn = (column: CrudSetGridColumn): boolean => (
  crudSetColumnCellKind(column) === 'image'
);

/** Default column for content-edit when `openFromColumnId` is omitted. */
export const crudSetDefaultContentPatchOpenFromColumnId = (
  spec: Pick<CrudSetSpec, 'columns'>,
): string | undefined => {
  if (spec.columns.length === 0) {
    return undefined;
  }

  const pick = (predicate: (column: CrudSetGridColumn) => boolean): string | undefined => {
    const found = spec.columns.find((column) => (
      !crudSetColumnIsImageColumn(column) && predicate(column)
    ));
    return found ? crudSetColumnId(found) : undefined;
  };

  return (
    pick((column) => column.cardRole === 'title')
    ?? pick((column) => column.isRowHeader === true)
    ?? pick((column) => isCrudSetDisplayColumnField(column.field))
    ?? pick((column) => isCrudSetContentPatchColumnCellKind(column))
    ?? pick((column) => isCrudSetRowIdColumnField(column.field))
    ?? pick(() => true)
  );
};

export const crudSetPatchOpensFromActions = (patch: CrudSetPatchApi): boolean => (
  patch.openFromColumnId?.trim() === CRUD_SET_PATCH_OPEN_FROM_ACTIONS
);

/** Resolved column id/field that opens this patch, or `undefined` when it belongs in actions. */
export const crudSetPatchOpenFromColumnId = (
  patch: CrudSetPatchApi,
  spec: Pick<CrudSetSpec, 'columns'>,
): string | undefined => {
  const explicit = patch.openFromColumnId?.trim();
  if (explicit === CRUD_SET_PATCH_OPEN_FROM_ACTIONS) {
    return undefined;
  }
  if (explicit) {
    return explicit;
  }
  if (patch.kind === 'content') {
    return crudSetDefaultContentPatchOpenFromColumnId(spec);
  }
  return undefined;
};

export const CRUD_SET_EXPORT_FORMATS = ['xlsx', 'csv'] as const;

export type CrudSetExportFormat = (typeof CRUD_SET_EXPORT_FORMATS)[number];

export const isCrudSetExportFormat = (value: unknown): value is CrudSetExportFormat => (
  value === 'xlsx' || value === 'csv'
);

export const CRUD_SET_EXPORT_FORMAT_LABELS: Record<CrudSetExportFormat, string> = {
  xlsx: 'Excel (.xlsx)',
  csv: 'CSV (.csv)',
};

export type CrudSetExportConfig = {
  /** Default true. `false` hides the toolbar Export button. */
  enabled?: boolean;
  /**
   * Formats offered in the export dialog. Default both `xlsx` and `csv`.
   * Do not offer PDF. At least one. Suggestion is both.
   */
  formats?: CrudSetExportFormat[];
  /** Dialog default among `formats`. Default `xlsx` when Excel is offered. */
  defaultFormat?: CrudSetExportFormat;
  /** Dialog default. Default true. */
  defaultIncludeHeader?: boolean;
};

/** Toolbar field-filter control. Users gold: checkbox group, radio group, select. */
export const CRUD_SET_FILTER_BAR_CONTROL_TYPES = [
  'checkbox-group',
  'radio-group',
  'select',
] as const;

export type CrudSetFilterBarControlType = (typeof CRUD_SET_FILTER_BAR_CONTROL_TYPES)[number];

export const CRUD_SET_FILTER_BAR_CONTROL_TYPE_LABELS: Record<CrudSetFilterBarControlType, string> = {
  'checkbox-group': 'Checkbox group',
  'radio-group': 'Radio group',
  select: 'Select',
};

export const isCrudSetFilterBarControlType = (value: unknown): value is CrudSetFilterBarControlType => (
  typeof value === 'string' && (CRUD_SET_FILTER_BAR_CONTROL_TYPES as readonly string[]).includes(value)
);

export type CrudSetFilterMatchLogic = 'or' | 'and';

export const CRUD_SET_FILTER_MATCH_LOGIC: readonly CrudSetFilterMatchLogic[] = ['or', 'and'] as const;

export type CrudSetFilterBarOption = {
  value: string;
  label: string;
};

/**
 * One toolbar filter on the left cluster (after search). Array order is left-to-right.
 * Do not dump every column into the filter bar.
 */
export type CrudSetFilterBarFilter = {
  id: string;
  /** List-API field this filter targets. */
  field: string;
  label: string;
  controlType: CrudSetFilterBarControlType;
  options: CrudSetFilterBarOption[];
  /** Default `static`. `distinct-rows` fills options from the current list rows. */
  optionsFrom?: CrudSetFilterOptionsFrom;
  /** Checkbox-group only. Default `or`. */
  matchLogic?: CrudSetFilterMatchLogic;
  /** Radio / select initial value. Empty = All. */
  defaultValue?: string;
  /** Select only. Several options as a comma-separated value. */
  multiple?: boolean;
};

export type CrudSetFilterBarConfig = {
  /** Default true. `false` hides the whole left toolbar cluster (search and field filters). */
  enabled?: boolean;
  /** Default true. `false` hides `ToolbarSearchInput`. Ignored when `enabled` is false. */
  search?: boolean;
  /** Overrides `Search {name}`. */
  searchPlaceholder?: string;
  /** `ToolbarSearchInput` clear control. Default true. */
  searchClear?: boolean;
  /** 0..n toolbar filters. Omit or [] = search only (when search is on). */
  filters?: CrudSetFilterBarFilter[];
  /**
   * Nested AND/OR list filter (`ListFilterButton` + where builder + summary band).
   * Default true on database-backed CRUD Set lists.
   */
  listWhereFilter?: boolean;
  /** Edge model for query-surface list filters and named presets (server-backed lists). */
  edgeModelId?: string;
};

/** Closed page-size catalog. Same set as `GRID_PAGE_SIZES` / ui-grid. */
export const CRUD_SET_PAGE_SIZES = [50, 100, 500, 1000, 10000] as const;

export type CrudSetPageSize = (typeof CRUD_SET_PAGE_SIZES)[number];

export const isCrudSetPageSize = (value: unknown): value is CrudSetPageSize => (
  typeof value === 'number' && (CRUD_SET_PAGE_SIZES as readonly number[]).includes(value)
);

export const CRUD_SET_PAGING_PATTERNS = ['numbered', 'prev-next'] as const;

export type CrudSetPagingPattern = (typeof CRUD_SET_PAGING_PATTERNS)[number];

export const CRUD_SET_PAGING_PATTERN_LABELS: Record<CrudSetPagingPattern, string> = {
  numbered: 'Numbered pages',
  'prev-next': 'Previous / next',
};

export const isCrudSetPagingPattern = (value: unknown): value is CrudSetPagingPattern => (
  value === 'numbered' || value === 'prev-next'
);

export const CRUD_SET_LIST_MODES = ['paging', 'infinite'] as const;

export type CrudSetListMode = (typeof CRUD_SET_LIST_MODES)[number];

export const CRUD_SET_LIST_MODE_LABELS: Record<CrudSetListMode, string> = {
  paging: 'Paging',
  infinite: 'Infinite',
};

export const isCrudSetListMode = (value: unknown): value is CrudSetListMode => (
  value === 'paging' || value === 'infinite'
);

export const CRUD_SET_SORT_DIRECTIONS = ['asc', 'desc'] as const;

export type CrudSetSortDirection = (typeof CRUD_SET_SORT_DIRECTIONS)[number];

export const CRUD_SET_SORT_DIRECTION_LABELS: Record<CrudSetSortDirection, string> = {
  asc: 'Ascending',
  desc: 'Descending',
};

export const isCrudSetSortDirection = (value: unknown): value is CrudSetSortDirection => (
  value === 'asc' || value === 'desc'
);

/**
 * GridPagingFooter chrome when pagination is on. Ignored for `tree-grid` and when
 * `pagination` is off. Do not invent a second footer.
 */
export type CrudSetPagingConfig = {
  /** Default `numbered`. `prev-next` hides page-number buttons. */
  pattern?: CrudSetPagingPattern;
  /** Default `50`. Must be one of `pageSizes`. */
  defaultPageSize?: number;
  /** Subset of `CRUD_SET_PAGE_SIZES`. Default all. At least one. */
  pageSizes?: number[];
  /** "Showing X–Y of Z". Default true. */
  summary?: boolean;
  /** First / Last nav. Default true. Ignored for `prev-next`. */
  firstLast?: boolean;
  /** Paging / Infinite switch in the footer. Default true. */
  listModeSwitch?: boolean;
  /** Default `paging`. Used even when the switch is off. */
  defaultListMode?: CrudSetListMode;
};

/**
 * List sort. Footer field + direction show when pagination is on and `footer !== false`.
 * `defaultField` / `defaultDirection` apply even when the footer is off.
 * Column-header sort still follows `columns[].sortable`.
 */
export type CrudSetSortingConfig = {
  /** Footer sort field + direction. Default true. */
  footer?: boolean;
  /** Initial sort column. Suggestion: first sortable column. */
  defaultField?: string;
  /** Default `asc`. */
  defaultDirection?: CrudSetSortDirection;
};

export const CRUD_SET_DEFAULT_PAGING: CrudSetPagingConfig = {
  pattern: 'numbered',
  defaultPageSize: 50,
  pageSizes: [...CRUD_SET_PAGE_SIZES],
  summary: true,
  firstLast: true,
  listModeSwitch: true,
  defaultListMode: 'paging',
};

export const CRUD_SET_DEFAULT_SORTING: CrudSetSortingConfig = {
  footer: true,
  defaultDirection: 'asc',
};

/** AppTableGrid chrome. Default `classic` (Users page list). */
export const CRUD_SET_GRID_CHROMES = ['classic', 'hero'] as const;

export type CrudSetGridChrome = (typeof CRUD_SET_GRID_CHROMES)[number];

export const CRUD_SET_GRID_CHROME_LABELS: Record<CrudSetGridChrome, string> = {
  classic: 'Classic',
  hero: 'Hero',
};

/** Matches AppTableGrid hero defaults (`DEFAULT_APP_TABLE_GRID_HERO_*`). */
export const CRUD_SET_GRID_HERO_MARGIN_PX = 4;
export const CRUD_SET_GRID_HERO_BORDER_WIDTH_PX = 5;

export const applyCrudSetGridChrome = (
  grid: CrudSetGridConfig,
  chrome: CrudSetGridChrome,
): CrudSetGridConfig => {
  const isHero = chrome === 'hero';
  return {
    ...grid,
    chrome,
    margin: isHero ? CRUD_SET_GRID_HERO_MARGIN_PX : 0,
    borderWidth: isHero ? CRUD_SET_GRID_HERO_BORDER_WIDTH_PX : 0,
  };
};

export const isCrudSetGridChrome = (value: unknown): value is CrudSetGridChrome => (
  value === 'classic' || value === 'hero'
);

/** Maps onto AppTableGrid `size`: default → `sm`, compact → `xs`. */
export const CRUD_SET_GRID_DENSITIES = ['default', 'compact'] as const;

export type CrudSetGridDensity = (typeof CRUD_SET_GRID_DENSITIES)[number];

export const CRUD_SET_GRID_DENSITY_LABELS: Record<CrudSetGridDensity, string> = {
  default: 'Default',
  compact: 'Compact',
};

export const isCrudSetGridDensity = (value: unknown): value is CrudSetGridDensity => (
  value === 'default' || value === 'compact'
);

export const CRUD_SET_GRID_PRESENTATIONS = ['table', 'auto', 'cards', 'table-scroll'] as const;

export type CrudSetGridPresentation = (typeof CRUD_SET_GRID_PRESENTATIONS)[number];

export const CRUD_SET_GRID_PRESENTATION_LABELS: Record<CrudSetGridPresentation, string> = {
  table: 'Table',
  auto: 'Auto',
  cards: 'Cards',
  'table-scroll': 'Table scroll',
};

export const isCrudSetGridPresentation = (value: unknown): value is CrudSetGridPresentation => (
  typeof value === 'string' && (CRUD_SET_GRID_PRESENTATIONS as readonly string[]).includes(value)
);

export const CRUD_SET_GRID_CARD_BELOW = ['phone', 'tablet', 'desktop'] as const;

export type CrudSetGridCardBelow = (typeof CRUD_SET_GRID_CARD_BELOW)[number];

export const CRUD_SET_GRID_CARD_BELOW_LABELS: Record<CrudSetGridCardBelow, string> = {
  phone: 'Phone',
  tablet: 'Tablet',
  desktop: 'Desktop',
};

export const isCrudSetGridCardBelow = (value: unknown): value is CrudSetGridCardBelow => (
  value === 'phone' || value === 'tablet' || value === 'desktop'
);

export const CRUD_SET_GRID_SELECTION_MODES = ['none', 'single', 'multiple'] as const;

export type CrudSetGridSelectionMode = (typeof CRUD_SET_GRID_SELECTION_MODES)[number];

export const CRUD_SET_GRID_SELECTION_MODE_LABELS: Record<CrudSetGridSelectionMode, string> = {
  none: 'None',
  single: 'Single',
  multiple: 'Multiple',
};

export const isCrudSetGridSelectionMode = (value: unknown): value is CrudSetGridSelectionMode => (
  value === 'none' || value === 'single' || value === 'multiple'
);

export const CRUD_SET_COMPACT_LAYOUTS = ['inherit', 'keep-table', 'table-scroll', 'cards'] as const;

export type CrudSetCompactLayout = (typeof CRUD_SET_COMPACT_LAYOUTS)[number];

export const CRUD_SET_COMPACT_LAYOUT_LABELS: Record<CrudSetCompactLayout, string> = {
  inherit: 'Inherit',
  'keep-table': 'Keep table',
  'table-scroll': 'Table scroll',
  cards: 'Cards',
};

export const isCrudSetCompactLayout = (value: unknown): value is CrudSetCompactLayout => (
  typeof value === 'string' && (CRUD_SET_COMPACT_LAYOUTS as readonly string[]).includes(value)
);

export const CRUD_SET_COMPACT_TRI = ['inherit', 'on', 'off'] as const;

export type CrudSetCompactTri = (typeof CRUD_SET_COMPACT_TRI)[number];

export const CRUD_SET_COMPACT_TRI_LABELS: Record<CrudSetCompactTri, string> = {
  inherit: 'Inherit',
  on: 'On',
  off: 'Off',
};

export const isCrudSetCompactTri = (value: unknown): value is CrudSetCompactTri => (
  value === 'inherit' || value === 'on' || value === 'off'
);

export const CRUD_SET_COMPACT_CARDS_PER_ROW = [1, 2, 3] as const;

export type CrudSetCompactCardsPerRow = (typeof CRUD_SET_COMPACT_CARDS_PER_ROW)[number];

export const isCrudSetCompactCardsPerRow = (value: unknown): value is CrudSetCompactCardsPerRow => (
  value === 1 || value === 2 || value === 3
);

export const CRUD_SET_COMPACT_VISIBLE_FIELD_COUNTS = [1, 2, 3, 4] as const;

export type CrudSetCompactVisibleFieldCount = (typeof CRUD_SET_COMPACT_VISIBLE_FIELD_COUNTS)[number];

export const isCrudSetCompactVisibleFieldCount = (
  value: unknown,
): value is CrudSetCompactVisibleFieldCount => (
  typeof value === 'number' && (CRUD_SET_COMPACT_VISIBLE_FIELD_COUNTS as readonly number[]).includes(value)
);

/**
 * AppTableGrid `compact` policy, flattened like the Grid catalog.
 * `inherit` leaves that knob to AppTableGrid defaults.
 */
export type CrudSetGridCompactConfig = {
  phoneLayout?: CrudSetCompactLayout;
  tabletLayout?: CrudSetCompactLayout;
  tabletCardsPerRow?: CrudSetCompactCardsPerRow;
  freezeFirstColumn?: CrudSetCompactTri;
  collapseExtraFields?: boolean;
  visibleFieldCount?: CrudSetCompactVisibleFieldCount;
  showActions?: boolean;
  showMeta?: boolean;
};

/**
 * AppTableGrid public chrome. The grid body itself is never on/off.
 * Tree-grid omits `table-scroll`, freeze-first, and cards-per-row.
 */
export type CrudSetGridConfig = {
  /** Default `classic`. Hero also paints `GridPagingFooter` as `hero`. */
  chrome?: CrudSetGridChrome;
  /** Default `default` (`sm`). `compact` is AppTableGrid `xs`. */
  density?: CrudSetGridDensity;
  /** Default true. Hug content when false. */
  fillHeight?: boolean;
  /** Default true. */
  stickyHeader?: boolean;
  /** Default `auto`. Tree-grid cannot use `table-scroll`. */
  presentation?: CrudSetGridPresentation;
  /** Smallest viewport that uses cards when presentation is `auto`. Default `tablet`. */
  cardBelow?: CrudSetGridCardBelow;
  /** Default `none`. Selection keys stay on the runtime, not this spec. */
  selection?: CrudSetGridSelectionMode;
  /** Default `No records found.` */
  emptyMessage?: string;
  /** Default `Loading records...` */
  loadingMessage?: string;
  /** Accessible table name. Default: spec `name`. */
  ariaLabel?: string;
  /** Outer inset in px. Default 0. */
  margin?: number;
  /** Outer outline thickness in px. Default 0. */
  borderWidth?: number;
  /** Hide/reorder/pin plus the column-layout menu. Default false. Column resize is on by default. */
  enableColumnLayout?: boolean;
  /** Column-layout control in the grid. Default false. Ignored when layout is off. */
  showColumnLayoutControl?: boolean;
  compact?: CrudSetGridCompactConfig;
};

export const CRUD_SET_MAX_VISIBLE_ACTIONS = [1, 2, 3, 4, 5] as const;

export type CrudSetMaxVisibleActions = (typeof CRUD_SET_MAX_VISIBLE_ACTIONS)[number];

export const isCrudSetMaxVisibleActions = (value: unknown): value is CrudSetMaxVisibleActions => (
  typeof value === 'number' && (CRUD_SET_MAX_VISIBLE_ACTIONS as readonly number[]).includes(value)
);

export const CRUD_SET_ACTIONS_ALIGNS = ['start', 'end', 'center'] as const;

export type CrudSetActionsAlign = (typeof CRUD_SET_ACTIONS_ALIGNS)[number];

export const CRUD_SET_ACTIONS_ALIGN_LABELS: Record<CrudSetActionsAlign, string> = {
  start: 'Start',
  end: 'End',
  center: 'Center',
};

export const isCrudSetActionsAlign = (value: unknown): value is CrudSetActionsAlign => (
  value === 'start' || value === 'end' || value === 'center'
);

/** AppGridRowActions public chrome. The actions column is still appended last. */
export type CrudSetActionsConfig = {
  /** Inline icons before overflow. Default 3. */
  maxVisible?: number;
  /** Default `end`. */
  align?: CrudSetActionsAlign;
};

export const CRUD_SET_FORM_DIALOG_SIZES = ['sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', 'maximized', 'full'] as const;

export type CrudSetFormDialogSize = (typeof CRUD_SET_FORM_DIALOG_SIZES)[number];

export const CRUD_SET_FORM_DIALOG_SIZE_LABELS: Record<CrudSetFormDialogSize, string> = {
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
  xl: 'Extra large',
  '2xl': '2XL',
  '3xl': '3XL',
  '4xl': '4XL',
  maximized: 'Maximized',
  full: 'Full',
};

export const isCrudSetFormDialogSize = (value: unknown): value is CrudSetFormDialogSize => (
  typeof value === 'string' && (CRUD_SET_FORM_DIALOG_SIZES as readonly string[]).includes(value)
);

export const CRUD_SET_CONFIRM_DIALOG_SIZES = ['sm', 'md', 'lg'] as const;

export type CrudSetConfirmDialogSize = (typeof CRUD_SET_CONFIRM_DIALOG_SIZES)[number];

export const CRUD_SET_CONFIRM_DIALOG_SIZE_LABELS: Record<CrudSetConfirmDialogSize, string> = {
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
};

export const isCrudSetConfirmDialogSize = (value: unknown): value is CrudSetConfirmDialogSize => (
  value === 'sm' || value === 'md' || value === 'lg'
);

export const CRUD_SET_DIALOG_BACKDROP_TINTS = ['faint', 'light', 'medium'] as const;

export type CrudSetDialogBackdropTint = (typeof CRUD_SET_DIALOG_BACKDROP_TINTS)[number];

export const CRUD_SET_DIALOG_BACKDROP_TINT_LABELS: Record<CrudSetDialogBackdropTint, string> = {
  faint: 'Faint',
  light: 'Light',
  medium: 'Medium',
};

export const isCrudSetDialogBackdropTint = (value: unknown): value is CrudSetDialogBackdropTint => (
  value === 'faint' || value === 'light' || value === 'medium'
);

export const CRUD_SET_DIALOG_BACKDROP_BLURS = ['soft', 'default'] as const;

export type CrudSetDialogBackdropBlur = (typeof CRUD_SET_DIALOG_BACKDROP_BLURS)[number];

export const CRUD_SET_DIALOG_BACKDROP_BLUR_LABELS: Record<CrudSetDialogBackdropBlur, string> = {
  soft: 'Soft',
  default: 'Default',
};

export const isCrudSetDialogBackdropBlur = (value: unknown): value is CrudSetDialogBackdropBlur => (
  value === 'soft' || value === 'default'
);

export const CRUD_SET_DIALOG_BACKDROP_TRANSPARENCY = ['opaque', 'soft', 'clear'] as const;

export type CrudSetDialogBackdropTransparency = (typeof CRUD_SET_DIALOG_BACKDROP_TRANSPARENCY)[number];

export const CRUD_SET_DIALOG_BACKDROP_TRANSPARENCY_LABELS: Record<CrudSetDialogBackdropTransparency, string> = {
  opaque: 'Opaque',
  soft: 'Soft',
  clear: 'Clear',
};

export const isCrudSetDialogBackdropTransparency = (
  value: unknown,
): value is CrudSetDialogBackdropTransparency => (
  value === 'opaque' || value === 'soft' || value === 'clear'
);

export const CRUD_SET_CONFIRM_INITIAL_FOCUS = ['cancel', 'confirm'] as const;

export type CrudSetConfirmInitialFocus = (typeof CRUD_SET_CONFIRM_INITIAL_FOCUS)[number];

export const CRUD_SET_CONFIRM_INITIAL_FOCUS_LABELS: Record<CrudSetConfirmInitialFocus, string> = {
  cancel: 'Cancel (safer)',
  confirm: 'Confirm',
};

export const isCrudSetConfirmInitialFocus = (value: unknown): value is CrudSetConfirmInitialFocus => (
  value === 'cancel' || value === 'confirm'
);

/**
 * CreateEditModalShell (create, form patch, export) and ConfirmDialogShell
 * (delete, toggle-confirm). Delete tone stays locked `danger`.
 */
export type CrudSetDialogsConfig = {
  /** Create / form-patch / export. Default `lg`. More than 4 fields auto-widen to `2xl` unless maximized/full. */
  formSize?: CrudSetFormDialogSize;
  /** Delete / toggle-confirm. Default `sm`. */
  confirmSize?: CrudSetConfirmDialogSize;
  /** Header close control. Default true. */
  showCloseButton?: boolean;
  /** Escape dismisses. Default true. */
  closeOnEscape?: boolean;
  /** Confirm footer initial focus. Default `cancel`. */
  confirmInitialFocus?: CrudSetConfirmInitialFocus;
  backdropTint?: CrudSetDialogBackdropTint;
  backdropBlur?: CrudSetDialogBackdropBlur;
  backdropTransparency?: CrudSetDialogBackdropTransparency;
  /** Heading on the Edit / View side panel. Default `Flags`. */
  sidePanelTitle?: string;
  /** Side-panel edge. Default `end` (opposite to theme direction). */
  sidePanelPlacement?: RecordFormSidePanelPlacement;
  /** Pin control to collapse / expand the side panel. Default false. */
  sidePanelPinnable?: boolean;
  /** Ghost drag splitter between the main fields and the side panel. Default true. */
  sidePanelSplitter?: boolean;
  /** Show the side-panel title. Default true. */
  sidePanelShowTitle?: boolean;
  /** Put the side-panel title in a header band. Default false (in-body heading). */
  sidePanelTitleInHeader?: boolean;
  /** Side-panel fill. Default `theme` (`--app-inspector-rail-bg`). */
  sidePanelBackground?: RecordFormSidePanelBackground;
  /** Hex fill when `sidePanelBackground` is `custom`. */
  sidePanelBackgroundColor?: string;
  /** CreateEditModalShell primary header. Default true. */
  showHeader?: boolean;
  /** Extra header bands under the primary header (`subtitle` / `metaBand` / `secondaryMetaBand`). Default 0. */
  subHeaderCount?: RecordFormDialogSubHeaderCount;
  /** CreateEditModalShell action footer. Default true. */
  showFooter?: boolean;
  /** Extra footer bands above the action footer (`auxiliaryFooter` / `intermediateFooter`). Default 0. */
  subFooterCount?: RecordFormDialogSubFooterCount;
  /** Designed Create RecordForm component name. Empty = generate from columns. */
  createComponent?: string;
  /** Designed Edit RecordForm component name. Empty = generate from columns. Patches use this. */
  editComponent?: string;
  /** Designed View RecordForm component name. Empty = generate from columns. Read-only, no submit. */
  viewComponent?: string;
  /**
   * View-dialog body. Default `record-form`.
   * `json` shows the row as formatted JSON. `thread` reads an array of {role, body}.
   */
  viewKind?: CrudSetViewKind;
  /** `thread` items field. Default `messages`. */
  threadItemsField?: string;
  /** `thread` role field on each item. Default `role`. */
  threadRoleField?: string;
  /** `thread` body field on each item. Default `body`. */
  threadBodyField?: string;
  /** `json` view field. Empty = whole row. */
  jsonField?: string;
};

export const CRUD_SET_DEFAULT_GRID: CrudSetGridConfig = {
  chrome: 'classic',
  density: 'default',
  fillHeight: true,
  stickyHeader: true,
  presentation: 'auto',
  cardBelow: 'tablet',
  selection: 'none',
  enableColumnLayout: false,
  showColumnLayoutControl: false,
  emptyMessage: 'No records found.',
  loadingMessage: 'Loading records...',
  compact: {
    phoneLayout: 'inherit',
    tabletLayout: 'inherit',
    tabletCardsPerRow: 2,
    freezeFirstColumn: 'inherit',
    collapseExtraFields: false,
    visibleFieldCount: 3,
    showActions: true,
    showMeta: true,
  },
};

export const CRUD_SET_DEFAULT_ACTIONS: CrudSetActionsConfig = {
  maxVisible: 3,
  align: 'end',
};

export const CRUD_SET_DEFAULT_DIALOGS: CrudSetDialogsConfig = {
  formSize: 'lg',
  confirmSize: 'sm',
  showCloseButton: true,
  closeOnEscape: true,
  confirmInitialFocus: 'cancel',
  backdropTint: 'medium',
  backdropBlur: 'default',
  backdropTransparency: 'opaque',
  sidePanelTitle: CRUD_SET_DEFAULT_SIDE_PANEL_TITLE,
};

export type CrudSetSpec = {
  name: string;
  tags?: string[];
  /** Required. Fills, searches, and filters the list (and pages it when pagination is on). */
  listApi: CrudSetApiRef;
  listBody: CrudSetListBodyKind;
  /**
   * Kanban column buckets. Used when `listBody` is `kanban`. Default status field `status`.
   */
  kanban?: CrudSetKanbanConfig;
  /**
   * Pin-map field names. Used when `listBody` is `map`. Default `latitude` / `longitude` / `title`.
   */
  map?: CrudSetMapConfig;
  /**
   * `grid` and `kanban` default `true` = `GridPagingFooter`. `false` = no paging footer.
   * Ignored for `tree-grid` and `map` (those bodies are never paged).
   */
  pagination?: boolean;
  /**
   * Footer chrome when pagination is on. Applies to `grid` and `kanban` when pagination is on.
   */
  paging?: CrudSetPagingConfig;
  /**
   * List sort defaults and footer sort controls.
   * Footer sort is hidden when pagination is off or `sorting.footer` is false.
   */
  sorting?: CrudSetSortingConfig;
  /**
   * Required. List-API fields shown in the grid/tree-grid (and used as kanban card
   * title/description and export columns), in display order.
   * Do not dump every response field. Actions column is appended last (unless a
   * patch uses `openFromColumnId`).
   */
  columns: CrudSetGridColumn[];
  /**
   * Required when any form patch or delete is present.
   * Not required when the only mutations are boolean-toggle patches.
   */
  readOneApi?: CrudSetApiRef;
  /** 0 = no create chrome. 1 = labeled Create. 2+ = layout below. */
  createApis: CrudSetCreateApi[];
  /**
   * How 2+ create buttons render. Default `split` (dropdown).
   * `adjacent` is two labeled Create buttons (identity Individual/Company).
   */
  createLayout?: CrudSetCreateLayout;
  /** 0..n. Include at most one `kind: 'content'` patch. */
  patches: CrudSetPatchApi[];
  deleteApi?: CrudSetApiRef;
  /** Disable delete for matching rows. */
  deleteDisabledWhen?: CrudSetDisabledWhen;
  /** Extra row actions (view / host / confirm). Not PATCH. */
  rowActions?: CrudSetRowAction[];
  /** Toolbar actions on the queried set (Clear all). */
  collectionActions?: CrudSetCollectionAction[];
  /** Auto-refresh checkbox next to Refresh. Default off. */
  autoRefresh?: CrudSetAutoRefreshConfig;
  /**
   * Toolbar Export. Omitted = enabled with dialog defaults.
   * `{ enabled: false }` hides the button.
   */
  export?: CrudSetExportConfig;
  /**
   * Left toolbar cluster (Users gold). Omitted = enabled, search on, no extra field filters.
   * `enabled: false` hides the whole cluster. Search and field filters are each on/off inside it.
   */
  filterBar?: CrudSetFilterBarConfig;
  /**
   * Toolbar Refresh. Default true. `false` hides `ToolbarRefreshButton`.
   * When create, export, refresh, search, and field filters are all off, the toolbar is omitted.
   */
  refresh?: boolean;
  /**
   * AppTableGrid public chrome. Omitted = Users gold (classic, fill, sticky, auto cards).
   */
  grid?: CrudSetGridConfig;
  /**
   * Actions column (`AppGridRowActions`). Omitted = maxVisible 3, align end.
   */
  actions?: CrudSetActionsConfig;
  /**
   * CreateEditModalShell + ConfirmDialogShell public chrome.
   * Delete tone stays locked danger. Omitted = form lg, confirm sm, close+escape on.
   */
  dialogs?: CrudSetDialogsConfig;
  /**
   * Record-event History on Edit/View and row actions. Omit when the model is not tracked.
   */
  history?: CrudSetHistoryConfig;
};

export type CrudSetHistoryConfig = {
  subjectKind: string;
  subjectIdField?: string;
  fieldMap?: Record<string, string>;
  trackedFields?: string[];
  restore?: boolean;
};

export const isBooleanTogglePatch = (patch: Pick<CrudSetPatchApi, 'interaction' | 'kind' | 'acceptedFields'>): boolean => (
  patch.interaction === 'boolean-toggle'
  && patch.kind === 'purpose'
  && patch.acceptedFields.length === 1
);

export const crudSetRequiresReadOne = (spec: Pick<CrudSetSpec, 'patches' | 'deleteApi'>): boolean => (
  Boolean(spec.deleteApi)
  || spec.patches.some((patch) => !isBooleanTogglePatch(patch))
);

export const crudSetGridColumnFields = (spec: Pick<CrudSetSpec, 'columns'>): string[] => (
  spec.columns.map((column) => column.field)
);

export const crudSetHumanizeField = (field: string): string => {
  const spaced = field
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!spaced) {
    return field;
  }
  return spaced.replace(/\b\w/g, (character) => character.toUpperCase());
};

export const crudSetColumnLabel = (column: CrudSetGridColumn): string => {
  const label = column.label?.trim();
  return label || crudSetHumanizeField(column.field);
};

export const crudSetColumnCellKind = (column: CrudSetGridColumn): CrudSetCellKind => (
  toCrudSetCellKind(column.cellKind)
);

export const crudSetColumnSortable = (column: CrudSetGridColumn): boolean => (
  column.sortable !== false
);

export const crudSetColumnFilterable = (column: CrudSetGridColumn): boolean => (
  column.filterable !== false
);

export const crudSetColumnWidth = (
  column: CrudSetGridColumn,
  columnIndex: number,
): number | string => column.width ?? (columnIndex === 0 ? 180 : 140);

export const crudSetColumnId = (column: CrudSetGridColumn): string => {
  const id = column.id?.trim();
  return id || column.field;
};

export const allocateCrudSetColumnId = (
  columns: readonly CrudSetGridColumn[],
  field: string,
): string => {
  const used = new Set(columns.map(crudSetColumnId));
  if (!used.has(field)) {
    return field;
  }
  let suffix = 2;
  while (used.has(`${field}-${suffix}`)) {
    suffix += 1;
  }
  return `${field}-${suffix}`;
};

/** Dataset keys offered as add-column chips in the living Columns list. */
export const CRUD_SET_SUGGESTED_COLUMN_FIELDS = [
  'code',
  'title',
  'subtitle',
  'parentTitle',
  'status',
  'owner',
  'city',
  'detailNote',
  'latitude',
  'longitude',
  'tags',
  'comments',
  'locked',
  'active',
  'photo',
  'website',
  'createdAt',
  'createdBy',
  'updatedAt',
  'updatedBy',
  'approvedAt',
  'approvedBy',
  'lockedAt',
  'lockedBy',
  'unlockedAt',
  'unlockedBy',
] as const;

const CRUD_SET_DATE_COLUMN_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'approvedAt',
  'lockedAt',
  'unlockedAt',
]);

/** One living-sample column from a dataset field — Base Components and Designer share this. */
export const crudSetColumnFromField = (
  field: string,
  existing: readonly CrudSetGridColumn[] = [],
): CrudSetGridColumn => ({
  field,
  label: crudSetHumanizeField(field),
  cellKind: field === 'photo'
    ? 'image'
    : field === 'locked'
      ? 'lock-status'
      : field === 'active'
        ? 'boolean-icon'
        : field === 'website'
          ? 'link'
          : field === 'status'
            ? 'badge'
            : field === 'tags' || field === 'comments'
              ? 'chips'
              : CRUD_SET_DATE_COLUMN_FIELDS.has(field)
                ? 'date'
                : 'text',
  ...(field === 'photo' ? { imageMask: 'circle' as const } : {}),
  ...(CRUD_SET_DATE_COLUMN_FIELDS.has(field) ? { transform: 'date' as const } : {}),
  ...(field === 'website' ? { transform: 'link-domain' as const } : {}),
  ...(field === 'locked' || field === 'active' ? { formPlacement: 'side' as const } : {}),
  id: allocateCrudSetColumnId(existing, field),
});

export const crudSetColumnTransform = (column: CrudSetGridColumn): CrudSetColumnTransform => {
  if (isCrudSetColumnTransform(column.transform)) {
    return column.transform;
  }
  const kind = crudSetColumnCellKind(column);
  if (kind === 'date' || kind === 'audit') {
    return 'date';
  }
  if (kind === 'link') {
    return 'link-domain';
  }
  return 'none';
};

const parseCrudSetTransformLimit = (column: CrudSetGridColumn, fallback: number): number => {
  const parsed = Number(column.transformFormat?.trim());
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const truncateCrudSetText = (text: string, max: number): string => (
  text.length <= max ? text : `${text.slice(0, Math.max(1, max - 1))}…`
);

const toTitleCase = (text: string): string => (
  text
    .toLowerCase()
    .replace(/\b[a-z]/g, (char) => char.toUpperCase())
);

const parseCrudSetUrl = (raw: string): URL | null => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const href = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(href);
  } catch {
    return null;
  }
};

/** Functional href for link cells. Display text may differ via transform. */
export const resolveCrudSetLinkHref = (value: unknown): string => {
  const raw = stringifyCrudSetValue(value).trim();
  if (!raw) {
    return '';
  }
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(raw)) {
    return raw;
  }
  if (raw.includes('@') && !raw.includes(' ')) {
    return `mailto:${raw}`;
  }
  return `https://${raw}`;
};

const formatCrudSetLinkLabel = (column: CrudSetGridColumn, value: unknown): string => {
  const raw = stringifyCrudSetValue(value).trim();
  if (!raw) {
    return '';
  }
  const transform = crudSetColumnTransform(column);
  const parsed = parseCrudSetUrl(raw);
  switch (transform) {
    case 'link-full':
    case 'none':
      return raw;
    case 'link-domain':
      return parsed ? parsed.hostname.replace(/^www\./i, '') : raw;
    case 'link-host':
      return parsed ? parsed.host.replace(/^www\./i, '') : raw;
    case 'link-path': {
      if (parsed) {
        const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
        return path === '/' ? '/' : path;
      }
      return raw;
    }
    case 'link-file-name': {
      if (parsed) {
        const segments = parsed.pathname.split('/').filter(Boolean);
        return segments[segments.length - 1] ?? raw;
      }
      const fallbackSegments = raw.split('/').filter(Boolean);
      return fallbackSegments[fallbackSegments.length - 1] ?? raw;
    }
    case 'link-go-to':
      return 'Go to';
    case 'link-open':
      return 'Open';
    case 'link-view':
      return 'View';
    case 'link-external':
      return 'External link';
    case 'link-custom-label': {
      const label = column.transformFormat?.trim() || column.label?.trim() || column.cardLabel?.trim();
      return label || 'Link';
    }
    case 'link-truncate':
      return truncateCrudSetText(raw, parseCrudSetTransformLimit(column, 40));
    case 'link-email': {
      if (parsed?.protocol === 'mailto:') {
        return parsed.pathname;
      }
      if (raw.includes('@')) {
        return raw.replace(/^mailto:/i, '');
      }
      return raw;
    }
    default:
      return raw;
  }
};

export const crudSetColumnImageMask = (column: CrudSetGridColumn): CrudSetImageMask => (
  column.imageMask === 'circle' ? 'circle' : 'none'
);

export const crudSetColumnSecondaryField = (column: CrudSetGridColumn): string => (
  column.secondaryField?.trim() ?? ''
);

export const crudSetColumnStack = (column: CrudSetGridColumn): CrudSetStackLayout => {
  if (!crudSetColumnSecondaryField(column)) {
    return 'none';
  }
  return isCrudSetStackLayout(column.stack) && column.stack !== 'none' ? column.stack : 'stacked';
};

/** Body cell text alignment for AppTableGrid. Pair with `crudSetColumnHeaderClassName`. */
export const crudSetColumnCellClassName = (column: CrudSetGridColumn): string | undefined => {
  if (crudSetColumnIsImageColumn(column)) {
    return 'text-center';
  }
  const kind = crudSetColumnCellKind(column);
  if (kind === 'date' && crudSetColumnSecondaryField(column)) {
    return 'text-start';
  }
  if (kind === 'date' || kind === 'boolean-icon') {
    return 'text-center';
  }
  return 'text-start';
};

/** Header alignment matching `crudSetColumnCellClassName` for the same column. */
export const crudSetColumnHeaderClassName = (column: CrudSetGridColumn): string | undefined => {
  if (crudSetColumnIsImageColumn(column)) {
    return 'text-center';
  }
  return crudSetColumnCellClassName(column);
};

export const crudSetColumnTransformFormat = (column: CrudSetGridColumn): string => {
  const format = column.transformFormat?.trim();
  return format || 'YYYY-MM-DD';
};

export const crudSetColumnConditionalRules = (
  column: CrudSetGridColumn,
): CrudSetConditionalRule[] => (
  (column.conditionalFormat ?? []).filter((rule) => (
    isCrudSetConditionalWhen(rule.when) && isCrudSetConditionalBackground(rule.background)
  )).map((rule) => ({
    ...rule,
    background: crudSetNormalizeConditionalBackground(rule.background) ?? CRUD_SET_CONDITIONAL_DEFAULT_BACKGROUND,
  }))
);

type CrudSetDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const pad2 = (value: number): string => String(value).padStart(2, '0');

const parseCrudSetDateParts = (value: unknown): CrudSetDateParts | null => {
  if (value == null || value === '') {
    return null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
      day: value.getUTCDate(),
      hour: value.getUTCHours(),
      minute: value.getUTCMinutes(),
      second: value.getUTCSeconds(),
    };
  }
  const text = String(value);
  const match = text.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (match) {
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      hour: Number(match[4] ?? 0),
      minute: Number(match[5] ?? 0),
      second: Number(match[6] ?? 0),
    };
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return {
    year: parsed.getUTCFullYear(),
    month: parsed.getUTCMonth() + 1,
    day: parsed.getUTCDate(),
    hour: parsed.getUTCHours(),
    minute: parsed.getUTCMinutes(),
    second: parsed.getUTCSeconds(),
  };
};

const applyDateFormatTokens = (parts: CrudSetDateParts, format: string): string => (
  format
    .replaceAll('YYYY', String(parts.year))
    .replaceAll('MM', pad2(parts.month))
    .replaceAll('DD', pad2(parts.day))
    .replaceAll('HH', pad2(parts.hour))
    .replaceAll('mm', pad2(parts.minute))
    .replaceAll('ss', pad2(parts.second))
);

const stringifyCrudSetValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return String(value);
};

const asCrudSetBoolean = (value: unknown): boolean | null => {
  if (value == null || value === '') {
    return null;
  }
  if (value === true || value === 1 || value === '1' || value === 'true') {
    return true;
  }
  if (value === false || value === 0 || value === '0' || value === 'false') {
    return false;
  }
  return null;
};

/** Transformed text for display and export. Empty when the source value is empty. */
export const formatCrudSetColumnText = (column: CrudSetGridColumn, value: unknown): string => {
  const transform = crudSetColumnTransform(column);
  if (transform === 'date'
    || transform === 'date-year'
    || transform === 'date-month-year'
    || transform === 'datetime'
    || transform === 'date-custom') {
    const parts = parseCrudSetDateParts(value);
    if (!parts) {
      return stringifyCrudSetValue(value);
    }
    if (transform === 'date-year') {
      return String(parts.year);
    }
    if (transform === 'date-month-year') {
      return `${parts.year}-${pad2(parts.month)}`;
    }
    if (transform === 'datetime') {
      return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)} ${pad2(parts.hour)}:${pad2(parts.minute)}`;
    }
    if (transform === 'date-custom') {
      return applyDateFormatTokens(parts, crudSetColumnTransformFormat(column));
    }
    return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
  }
  if (transform === 'boolean-yes-no' || transform === 'boolean-on-off' || transform === 'boolean-true-false') {
    const flag = asCrudSetBoolean(value);
    if (flag == null) {
      return '';
    }
    if (transform === 'boolean-on-off') {
      return flag ? 'On' : 'Off';
    }
    if (transform === 'boolean-true-false') {
      return flag ? 'True' : 'False';
    }
    return flag ? 'Yes' : 'No';
  }
  if (crudSetColumnCellKind(column) === 'link' || transform.startsWith('link-')) {
    return formatCrudSetLinkLabel(column, value);
  }
  if (transform === 'number-grouped' || transform === 'number-compact' || transform === 'number-percent') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return stringifyCrudSetValue(value);
    }
    if (transform === 'number-percent') {
      return `${numeric}%`;
    }
    if (transform === 'number-compact') {
      return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(numeric);
    }
    return new Intl.NumberFormat('en-US').format(numeric);
  }
  const text = stringifyCrudSetValue(value);
  if (transform === 'uppercase') {
    return text.toUpperCase();
  }
  if (transform === 'lowercase') {
    return text.toLowerCase();
  }
  if (transform === 'title-case') {
    return toTitleCase(text);
  }
  if (transform === 'text-truncate') {
    return truncateCrudSetText(text, parseCrudSetTransformLimit(column, 60));
  }
  if (transform === 'chips-comma') {
    if (Array.isArray(value)) {
      return value.map((item) => stringifyCrudSetValue(item)).filter(Boolean).join(', ');
    }
    return text;
  }
  if (transform === 'chips-count') {
    if (Array.isArray(value)) {
      const count = value.length;
      return count === 1 ? '1 item' : `${count} items`;
    }
    if (!text) {
      return '';
    }
    const count = text.includes(',') ? text.split(',').filter(Boolean).length : 1;
    return count === 1 ? '1 item' : `${count} items`;
  }
  return text;
};

export const formatCrudSetColumnExportValue = (
  column: CrudSetGridColumn,
  row: Record<string, unknown>,
): string => {
  const primary = formatCrudSetColumnText(column, row[column.field]);
  const secondaryField = crudSetColumnSecondaryField(column);
  if (!secondaryField || crudSetColumnStack(column) === 'none') {
    return primary;
  }
  const secondary = stringifyCrudSetValue(row[secondaryField]);
  if (!secondary) {
    return primary;
  }
  if (!primary) {
    return secondary;
  }
  return crudSetColumnStack(column) === 'inline'
    ? `${primary} ${secondary}`
    : `${primary} / ${secondary}`;
};

export const matchesCrudSetConditionalRule = (
  rule: CrudSetConditionalRule,
  value: unknown,
): boolean => {
  const text = stringifyCrudSetValue(value);
  const expected = rule.value ?? '';
  switch (rule.when) {
    case 'equals':
      return text.toLowerCase() === expected.toLowerCase();
    case 'not-equals':
      return text.toLowerCase() !== expected.toLowerCase();
    case 'contains':
      return expected.length > 0 && text.toLowerCase().includes(expected.toLowerCase());
    case 'empty':
      return text.length === 0;
    case 'not-empty':
      return text.length > 0;
    case 'truthy':
      return asCrudSetBoolean(value) === true || (asCrudSetBoolean(value) == null && text.length > 0);
    case 'falsy':
      return asCrudSetBoolean(value) === false || text.length === 0;
    default:
      return false;
  }
};

export const crudSetColumnConditionalBackground = (
  column: CrudSetGridColumn,
  value: unknown,
): string | undefined => {
  const matched = crudSetColumnConditionalRules(column).find((rule) => (
    matchesCrudSetConditionalRule(rule, value)
  ));
  return matched?.background;
};

export const crudSetFilterBarEnabled = (spec: Pick<CrudSetSpec, 'filterBar'>): boolean => (
  spec.filterBar?.enabled !== false
);

export const crudSetFilterBarSearchEnabled = (spec: Pick<CrudSetSpec, 'filterBar'>): boolean => (
  crudSetFilterBarEnabled(spec) && spec.filterBar?.search !== false
);

export const crudSetFilterOptionsFrom = (
  filter: Pick<CrudSetFilterBarFilter, 'optionsFrom'>,
): CrudSetFilterOptionsFrom => (
  isCrudSetFilterOptionsFrom(filter.optionsFrom) ? filter.optionsFrom : 'static'
);

const filterHasStaticOptions = (filter: CrudSetFilterBarFilter): boolean => (
  filter.options.some((option) => option.value.trim())
);

export const crudSetFilterBarFilters = (spec: Pick<CrudSetSpec, 'filterBar'>): CrudSetFilterBarFilter[] => (
  crudSetFilterBarEnabled(spec)
    ? (spec.filterBar?.filters ?? []).filter((filter) => (
      filter.field.trim()
      && (crudSetFilterOptionsFrom(filter) === 'distinct-rows' || filterHasStaticOptions(filter))
    ))
    : []
);

export const resolveCrudSetFilterBarOptions = (
  filter: CrudSetFilterBarFilter,
  rows: readonly Record<string, unknown>[],
): CrudSetFilterBarOption[] => {
  if (crudSetFilterOptionsFrom(filter) !== 'distinct-rows') {
    return filter.options.filter((option) => option.value.trim());
  }
  const seen = new Map<string, string>();
  for (const option of filter.options) {
    const value = option.value.trim();
    if (value) {
      seen.set(value, option.label.trim() || value);
    }
  }
  for (const row of rows) {
    const raw = row[filter.field];
    const values = Array.isArray(raw)
      ? raw.map((entry) => String(entry).trim()).filter(Boolean)
      : [stringifyCrudSetValue(raw).trim()].filter(Boolean);
    for (const value of values) {
      if (!seen.has(value)) {
        seen.set(value, value);
      }
    }
  }
  return [...seen.entries()]
    .sort((left, right) => left[0].localeCompare(right[0], undefined, { numeric: true }))
    .map(([value, label]) => ({ value, label }));
};

/** Toolbar filters for the active list body. Kanban omits the status bucket field — columns replace that filter. */
export const crudSetFilterBarFiltersForBody = (
  spec: Pick<CrudSetSpec, 'listBody' | 'filterBar' | 'kanban'>,
): CrudSetFilterBarFilter[] => {
  const filters = crudSetFilterBarFilters(spec);
  if (spec.listBody !== 'kanban') {
    return filters;
  }
  const statusField = crudSetKanbanStatusField(spec);
  return filters.filter((filter) => filter.field !== statusField);
};

export const crudSetKanbanStatusColumns = (
  spec: Pick<CrudSetSpec, 'kanban' | 'filterBar'>,
): { value: string; label: string }[] => (
  (spec.kanban?.statusColumns ?? [])
    .map((column) => ({
      value: column.value.trim(),
      label: column.label?.trim() || column.value.trim(),
    }))
    .filter((column) => column.value)
);

export const deriveCrudSetKanbanStatusColumns = (
  spec: Pick<CrudSetSpec, 'kanban' | 'filterBar'>,
  rows: readonly Record<string, unknown>[],
): { value: string; label: string }[] => {
  const configured = crudSetKanbanStatusColumns(spec);
  if (configured.length > 0) {
    return configured;
  }
  const statusField = crudSetKanbanStatusField(spec);
  const fromFilter = (spec.filterBar?.filters ?? [])
    .find((filter) => filter.field === statusField)
    ?.options
    .map((option) => ({
      value: option.value.trim(),
      label: option.label?.trim() || option.value.trim(),
    }))
    .filter((column) => column.value) ?? [];
  if (fromFilter.length > 0) {
    return fromFilter;
  }
  const values = new Set<string>();
  for (const row of rows) {
    const value = stringifyCrudSetValue(row[statusField]).trim();
    if (value) {
      values.add(value);
    }
  }
  return [...values]
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
    .map((value) => ({ value, label: value }));
};

/** When switching to kanban, move the status toolbar filter into `kanban.statusColumns` and drop it from the filter bar. */
export const migrateCrudSetSpecForKanbanBody = (
  spec: Pick<CrudSetSpec, 'kanban' | 'filterBar'>,
): Pick<CrudSetSpec, 'kanban' | 'filterBar'> => {
  const statusField = crudSetKanbanStatusField(spec);
  const statusFilter = (spec.filterBar?.filters ?? []).find((filter) => filter.field === statusField);
  const statusColumns = crudSetKanbanStatusColumns(spec);
  const nextKanban: CrudSetKanbanConfig = {
    ...spec.kanban,
    statusColumns: statusColumns.length > 0
      ? spec.kanban?.statusColumns
      : statusFilter?.options
        .map((option) => ({
          value: option.value.trim(),
          label: option.label?.trim() || option.value.trim(),
        }))
        .filter((column) => column.value) ?? spec.kanban?.statusColumns,
  };
  return {
    kanban: nextKanban,
    filterBar: {
      ...spec.filterBar,
      filters: (spec.filterBar?.filters ?? []).filter((filter) => filter.field !== statusField),
    },
  };
};

export const crudSetFilterBarSearchPlaceholder = (spec: Pick<CrudSetSpec, 'name' | 'filterBar'>): string => {
  const placeholder = spec.filterBar?.searchPlaceholder?.trim();
  return placeholder || `Search ${spec.name}`;
};

export const crudSetFilterMatchLogic = (
  filter: CrudSetFilterBarFilter,
  override?: CrudSetFilterMatchLogic,
): CrudSetFilterMatchLogic => (
  override === 'and' || override === 'or'
    ? override
    : (filter.matchLogic === 'and' ? 'and' : 'or')
);

const readCrudSetFilterValues = (row: Record<string, unknown>, field: string): string[] => {
  const value = row[field];
  if (value == null || value === '') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim().toUpperCase()).filter(Boolean);
  }
  if (typeof value === 'boolean') {
    return [value ? 'TRUE' : 'FALSE'];
  }
  return String(value)
    .split(',')
    .map((entry) => entry.trim().toUpperCase())
    .filter(Boolean);
};

export type CrudSetFilterBarRuntimeState = {
  searchText: string;
  checkboxSelections: Record<string, Record<string, boolean>>;
  radioSelections: Record<string, string>;
  matchLogicByFilterId: Record<string, CrudSetFilterMatchLogic>;
};

/** Active list query passed to `onFetchExportRows` so the host can fetch every page. */
export type CrudSetExportQuery = CrudSetFilterBarRuntimeState & {
  sortBy: string;
  sortDirection: 'asc' | 'desc';
};

const compareCrudSetExportRows = (
  left: Record<string, unknown>,
  right: Record<string, unknown>,
  sortBy: string,
  sortDirection: 'asc' | 'desc',
): number => {
  const compared = String(left[sortBy] ?? '').localeCompare(
    String(right[sortBy] ?? ''),
    undefined,
    { numeric: true },
  );
  return sortDirection === 'asc' ? compared : -compared;
};

/** Apply the same search, toolbar filters, and sort the list uses before export. */
export const applyCrudSetExportQuery = <TRow extends Record<string, unknown>>(
  rows: readonly TRow[],
  spec: Pick<CrudSetSpec, 'columns' | 'filterBar' | 'name' | 'listBody' | 'kanban'>,
  query: CrudSetExportQuery,
): TRow[] => {
  const filtered = applyCrudSetFilterBar(rows, spec, query);
  const next = [...filtered];
  next.sort((left, right) => compareCrudSetExportRows(left, right, query.sortBy, query.sortDirection));
  return next;
};

/** Client-side search + toolbar field filters. Export uses this same queried set. */
export const applyCrudSetFilterBar = <TRow extends Record<string, unknown>>(
  rows: readonly TRow[],
  spec: Pick<CrudSetSpec, 'columns' | 'filterBar' | 'name' | 'listBody' | 'kanban'>,
  state: CrudSetFilterBarRuntimeState,
): TRow[] => {
  let result = [...rows];
  if (crudSetFilterBarSearchEnabled(spec)) {
    const query = state.searchText.trim().toLowerCase();
    if (query) {
      result = result.filter((row) => spec.columns.some((column) => {
        const value = row[column.field];
        if (value == null) {
          return false;
        }
        if (Array.isArray(value)) {
          return value.some((entry) => String(entry).toLowerCase().includes(query));
        }
        return String(value).toLowerCase().includes(query);
      }));
    }
  }

  for (const filter of crudSetFilterBarFiltersForBody(spec)) {
    if (filter.controlType === 'checkbox-group') {
      const selection = state.checkboxSelections[filter.id] ?? {};
      const activeValues = Object.entries(selection)
        .filter(([, checked]) => checked)
        .map(([value]) => value.trim().toUpperCase())
        .filter(Boolean);
      if (activeValues.length === 0) {
        continue;
      }
      const logic = crudSetFilterMatchLogic(filter, state.matchLogicByFilterId[filter.id]);
      result = result.filter((row) => {
        const rowValues = readCrudSetFilterValues(row, filter.field);
        return logic === 'and'
          ? activeValues.every((value) => rowValues.includes(value))
          : activeValues.some((value) => rowValues.includes(value));
      });
      continue;
    }

    const selected = state.radioSelections[filter.id]?.trim() ?? '';
    if (!selected) {
      continue;
    }
    const selectedValues = selected
      .split(',')
      .map((entry) => entry.trim().toUpperCase())
      .filter(Boolean);
    if (selectedValues.length === 0) {
      continue;
    }
    result = result.filter((row) => {
      const rowValues = readCrudSetFilterValues(row, filter.field);
      return selectedValues.some((value) => rowValues.includes(value));
    });
  }

  return result;
};

export const crudSetExportEnabled = (spec: Pick<CrudSetSpec, 'export'>): boolean => (
  spec.export?.enabled !== false
);

/** Formats shown in the export dialog. Default both Excel and CSV. Never PDF. */
export const crudSetExportFormats = (spec: Pick<CrudSetSpec, 'export'>): CrudSetExportFormat[] => {
  const requested = (spec.export?.formats ?? CRUD_SET_EXPORT_FORMATS)
    .filter(isCrudSetExportFormat);
  const unique = CRUD_SET_EXPORT_FORMATS.filter((format) => requested.includes(format));
  return unique.length > 0 ? [...unique] : [...CRUD_SET_EXPORT_FORMATS];
};

export const crudSetExportDefaultFormat = (spec: Pick<CrudSetSpec, 'export'>): CrudSetExportFormat => {
  const formats = crudSetExportFormats(spec);
  const preferred = spec.export?.defaultFormat;
  if (preferred && formats.includes(preferred)) {
    return preferred;
  }
  return formats.includes('xlsx') ? 'xlsx' : formats[0]!;
};

export const toggleCrudSetExportFormat = (
  current: readonly CrudSetExportFormat[],
  format: CrudSetExportFormat,
  enabled: boolean,
): CrudSetExportFormat[] => {
  const selected = new Set(
    CRUD_SET_EXPORT_FORMATS.filter((item) => (
      current.length === 0 ? true : current.includes(item)
    )),
  );
  if (enabled) {
    selected.add(format);
  } else if (selected.size > 1) {
    selected.delete(format);
  }
  return CRUD_SET_EXPORT_FORMATS.filter((item) => selected.has(item));
};

/** Paging footer. Default on for `grid` and `kanban`. Always off for `tree-grid` and `map`. */
export const crudSetPaginationEnabled = (
  spec: Pick<CrudSetSpec, 'listBody' | 'pagination'>,
): boolean => (
  (spec.listBody === 'grid' || spec.listBody === 'kanban') && spec.pagination !== false
);

export const crudSetKanbanStatusField = (
  spec: Pick<CrudSetSpec, 'kanban'>,
): string => spec.kanban?.statusField?.trim() || CRUD_SET_DEFAULT_KANBAN.statusField;

export const crudSetKanbanTitleField = (
  spec: Pick<CrudSetSpec, 'kanban' | 'columns'>,
): string => {
  const requested = spec.kanban?.titleField?.trim();
  if (requested) return requested;
  const titled = spec.columns.find((column) => column.field === 'title' || column.cardRole === 'title');
  return titled?.field || spec.columns[0]?.field || CRUD_SET_DEFAULT_KANBAN.titleField;
};

export const crudSetKanbanDescriptionField = (
  spec: Pick<CrudSetSpec, 'kanban'>,
): string => spec.kanban?.descriptionField?.trim() || CRUD_SET_DEFAULT_KANBAN.descriptionField;

export const isCrudSetKanbanHeight = (value: string): value is CrudSetKanbanHeight => (
  (CRUD_SET_KANBAN_HEIGHTS as readonly string[]).includes(value)
);

export const isCrudSetKanbanColumnWidth = (value: string): value is CrudSetKanbanColumnWidth => (
  (CRUD_SET_KANBAN_COLUMN_WIDTHS as readonly string[]).includes(value)
);

export const isCrudSetKanbanColumnLayout = (value: string): value is CrudSetKanbanColumnLayout => (
  (CRUD_SET_KANBAN_COLUMN_LAYOUTS as readonly string[]).includes(value)
);

export const isCrudSetKanbanDensity = (value: string): value is CrudSetKanbanDensity => (
  (CRUD_SET_KANBAN_DENSITIES as readonly string[]).includes(value)
);

export const isCrudSetKanbanTone = (value: string): value is CrudSetKanbanTone => (
  (CRUD_SET_KANBAN_TONES as readonly string[]).includes(value)
);

export const crudSetKanbanHeight = (
  spec: Pick<CrudSetSpec, 'kanban'>,
): CrudSetKanbanHeight => (
  isCrudSetKanbanHeight(spec.kanban?.height ?? '') ? spec.kanban!.height! : CRUD_SET_DEFAULT_KANBAN.height
);

export const crudSetKanbanColumnWidth = (
  spec: Pick<CrudSetSpec, 'kanban'>,
): CrudSetKanbanColumnWidth => (
  isCrudSetKanbanColumnWidth(spec.kanban?.columnWidth ?? '')
    ? spec.kanban!.columnWidth!
    : CRUD_SET_DEFAULT_KANBAN.columnWidth
);

export const crudSetKanbanColumnLayout = (
  spec: Pick<CrudSetSpec, 'kanban'>,
): CrudSetKanbanColumnLayout => (
  isCrudSetKanbanColumnLayout(spec.kanban?.columnLayout ?? '')
    ? spec.kanban!.columnLayout!
    : CRUD_SET_DEFAULT_KANBAN.columnLayout
);

export const crudSetKanbanDensity = (
  spec: Pick<CrudSetSpec, 'kanban'>,
): CrudSetKanbanDensity => (
  isCrudSetKanbanDensity(spec.kanban?.density ?? '') ? spec.kanban!.density! : CRUD_SET_DEFAULT_KANBAN.density
);

export const crudSetKanbanShowCardCount = (
  spec: Pick<CrudSetSpec, 'kanban'>,
): boolean => spec.kanban?.showCardCount ?? CRUD_SET_DEFAULT_KANBAN.showCardCount;

export const crudSetKanbanShowDescriptions = (
  spec: Pick<CrudSetSpec, 'kanban'>,
): boolean => spec.kanban?.showDescriptions ?? CRUD_SET_DEFAULT_KANBAN.showDescriptions;

export const crudSetKanbanTone = (
  spec: Pick<CrudSetSpec, 'kanban'>,
): CrudSetKanbanTone => (
  isCrudSetKanbanTone(spec.kanban?.tone ?? '') ? spec.kanban!.tone! : CRUD_SET_DEFAULT_KANBAN.tone
);

export const crudSetKanbanColoredColumns = (
  spec: Pick<CrudSetSpec, 'kanban'>,
): boolean => spec.kanban?.coloredColumns ?? CRUD_SET_DEFAULT_KANBAN.coloredColumns;

export const crudSetKanbanInteractive = (
  spec: Pick<CrudSetSpec, 'kanban'>,
): boolean => spec.kanban?.interactive ?? CRUD_SET_DEFAULT_KANBAN.interactive;

export const crudSetKanbanEnableKeyboardMove = (
  spec: Pick<CrudSetSpec, 'kanban'>,
): boolean => spec.kanban?.enableKeyboardMove ?? CRUD_SET_DEFAULT_KANBAN.enableKeyboardMove;

export const crudSetKanbanHideEmptyColumns = (
  spec: Pick<CrudSetSpec, 'kanban'>,
): boolean => spec.kanban?.hideEmptyColumns ?? CRUD_SET_DEFAULT_KANBAN.hideEmptyColumns;

export const crudSetKanbanWipLimit = (
  spec: Pick<CrudSetSpec, 'kanban'>,
): number => {
  const limit = spec.kanban?.wipLimit;
  return typeof limit === 'number' && Number.isFinite(limit) && limit > 0
    ? Math.floor(limit)
    : CRUD_SET_DEFAULT_KANBAN.wipLimit;
};

export const CRUD_SET_KANBAN_COLUMN_TONES: readonly CrudSetKanbanTone[] = [
  'amber',
  'cyan',
  'emerald',
  'indigo',
  'violet',
];

export const crudSetKanbanColumnTone = (
  index: number,
  spec: Pick<CrudSetSpec, 'kanban'>,
): CrudSetKanbanTone | undefined => (
  crudSetKanbanColoredColumns(spec)
    ? CRUD_SET_KANBAN_COLUMN_TONES[index % CRUD_SET_KANBAN_COLUMN_TONES.length]
    : undefined
);

export const crudSetMapLatField = (
  spec: Pick<CrudSetSpec, 'map'>,
): string => spec.map?.latField?.trim() || CRUD_SET_DEFAULT_MAP.latField;

export const crudSetMapLngField = (
  spec: Pick<CrudSetSpec, 'map'>,
): string => spec.map?.lngField?.trim() || CRUD_SET_DEFAULT_MAP.lngField;

export const crudSetMapLabelField = (
  spec: Pick<CrudSetSpec, 'map'>,
): string => spec.map?.labelField?.trim() || CRUD_SET_DEFAULT_MAP.labelField;

export const crudSetPagingPattern = (
  spec: Pick<CrudSetSpec, 'paging'>,
): CrudSetPagingPattern => (
  isCrudSetPagingPattern(spec.paging?.pattern) ? spec.paging.pattern : 'numbered'
);

export const crudSetPagingPageSizes = (
  spec: Pick<CrudSetSpec, 'paging'>,
): CrudSetPageSize[] => {
  const requested = (spec.paging?.pageSizes ?? CRUD_SET_PAGE_SIZES)
    .filter(isCrudSetPageSize);
  const unique = CRUD_SET_PAGE_SIZES.filter((size) => requested.includes(size));
  return unique.length > 0 ? [...unique] : [...CRUD_SET_PAGE_SIZES];
};

export const crudSetPagingDefaultPageSize = (
  spec: Pick<CrudSetSpec, 'paging'>,
): CrudSetPageSize => {
  const sizes = crudSetPagingPageSizes(spec);
  const preferred = spec.paging?.defaultPageSize;
  if (typeof preferred === 'number' && sizes.includes(preferred as CrudSetPageSize)) {
    return preferred as CrudSetPageSize;
  }
  return sizes.includes(50) ? 50 : sizes[0]!;
};

export const toggleCrudSetPageSize = (
  current: readonly number[],
  size: CrudSetPageSize,
  enabled: boolean,
): CrudSetPageSize[] => {
  const selected = new Set(
    CRUD_SET_PAGE_SIZES.filter((item) => (
      current.length === 0 ? true : current.includes(item)
    )),
  );
  if (enabled) {
    selected.add(size);
  } else if (selected.size > 1) {
    selected.delete(size);
  }
  return CRUD_SET_PAGE_SIZES.filter((item) => selected.has(item));
};

export const crudSetPagingSummaryEnabled = (spec: Pick<CrudSetSpec, 'paging'>): boolean => (
  spec.paging?.summary !== false
);

export const crudSetPagingFirstLastEnabled = (spec: Pick<CrudSetSpec, 'paging'>): boolean => (
  crudSetPagingPattern(spec) === 'numbered' && spec.paging?.firstLast !== false
);

export const crudSetPagingPageNumbersEnabled = (spec: Pick<CrudSetSpec, 'paging'>): boolean => (
  crudSetPagingPattern(spec) === 'numbered'
);

export const crudSetPagingListModeSwitchEnabled = (spec: Pick<CrudSetSpec, 'paging'>): boolean => (
  spec.paging?.listModeSwitch !== false
);

export const crudSetPagingDefaultListMode = (
  spec: Pick<CrudSetSpec, 'paging'>,
): CrudSetListMode => (
  isCrudSetListMode(spec.paging?.defaultListMode) ? spec.paging.defaultListMode : 'paging'
);

export const crudSetSortingFooterEnabled = (
  spec: Pick<CrudSetSpec, 'listBody' | 'pagination' | 'sorting'>,
): boolean => crudSetPaginationEnabled(spec) && spec.sorting?.footer !== false;

export const crudSetSortingDefaultDirection = (
  spec: Pick<CrudSetSpec, 'sorting'>,
): CrudSetSortDirection => (
  isCrudSetSortDirection(spec.sorting?.defaultDirection) ? spec.sorting.defaultDirection : 'asc'
);

export const crudSetSortingFooterFields = (
  spec: Pick<CrudSetSpec, 'columns'>,
): CrudSetGridColumn[] => spec.columns.filter((column) => column.field.trim());

export const crudSetSortingDefaultField = (
  spec: Pick<CrudSetSpec, 'columns' | 'sorting'>,
): string => {
  const requested = spec.sorting?.defaultField?.trim();
  if (requested && spec.columns.some((column) => column.field === requested)) {
    return requested;
  }
  const sortable = spec.columns.filter((column) => crudSetColumnSortable(column) && column.field.trim());
  return (sortable[0] ?? spec.columns[0])?.field ?? 'id';
};

export const crudSetRefreshEnabled = (spec: Pick<CrudSetSpec, 'refresh'>): boolean => (
  spec.refresh !== false
);

export const crudSetWriteChangeReasonRoute = (
  spec: Pick<CrudSetSpec, 'createApis' | 'patches' | 'deleteApi'>,
): { method: string; path: string } | null => {
  const parseEndpoint = (value: string | undefined, fallbackMethod: string): { method: string; path: string } | null => {
    const trimmed = value?.trim() ?? '';
    const withMethod = trimmed.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(\/.+)$/i);
    if (withMethod) {
      const path = withMethod[2]?.split('?')[0] ?? '';
      return path.startsWith('/') ? { method: withMethod[1].toUpperCase(), path } : null;
    }
    const path = trimmed.split('?')[0] ?? '';
    if (!path.startsWith('/')) return null;
    return { method: fallbackMethod, path };
  };
  const content = spec.patches.find((patch) => patch.kind === 'content');
  const patch = content ?? spec.patches[0];
  return parseEndpoint(patch?.endpointId, 'PATCH')
    ?? parseEndpoint(spec.deleteApi?.endpointId, 'DELETE');
};

export const crudSetCreateLayout = (
  spec: Pick<CrudSetSpec, 'createLayout' | 'createApis'>,
): CrudSetCreateLayout => {
  if (spec.createApis.length < 2) {
    return 'split';
  }
  return isCrudSetCreateLayout(spec.createLayout) ? spec.createLayout : 'split';
};

export const crudSetCreateSteps = (create: CrudSetCreateApi): CrudSetCreateStep[] => {
  const steps = (create.steps ?? [])
    .map((step) => ({
      title: step.title.trim(),
      acceptedFields: step.acceptedFields.filter((field) => create.acceptedFields.includes(field)),
    }))
    .filter((step) => step.title && step.acceptedFields.length > 0);
  return steps.length >= 2 ? steps : [];
};

export const crudSetAutoRefreshEnabled = (
  spec: Pick<CrudSetSpec, 'autoRefresh' | 'refresh'>,
): boolean => crudSetRefreshEnabled(spec) && spec.autoRefresh?.enabled === true;

export const crudSetAutoRefreshSeconds = (
  spec: Pick<CrudSetSpec, 'autoRefresh'>,
): number => {
  const seconds = spec.autoRefresh?.seconds;
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 1
    ? Math.floor(seconds)
    : 5;
};

export const crudSetCollectionActions = (
  spec: Pick<CrudSetSpec, 'collectionActions'>,
): CrudSetCollectionAction[] => (
  (spec.collectionActions ?? []).filter((action) => action.id.trim() && action.label.trim())
);

export const crudSetCollectionActionIntent = (
  action: CrudSetCollectionAction,
): CrudSetCollectionActionIntent => (
  isCrudSetCollectionActionIntent(action.intent) ? action.intent : 'secondary'
);

export const crudSetCollectionActionConfirm = (action: CrudSetCollectionAction): boolean => (
  typeof action.confirm === 'boolean'
    ? action.confirm
    : crudSetCollectionActionIntent(action) === 'destructive-soft'
);

export const crudSetRowActions = (
  spec: Pick<CrudSetSpec, 'rowActions'>,
): CrudSetRowAction[] => (
  (spec.rowActions ?? []).filter((action) => action.id.trim() && action.label.trim())
);

const asCrudSetTruthy = (value: unknown): boolean => (
  value === true || value === 1 || value === '1' || value === 'true'
);

export const crudSetRowHasChildren = (row: Record<string, unknown>): boolean => (
  asCrudSetTruthy(row.hasChildren) || asCrudSetTruthy(row.has_children)
);

export const crudSetDisabledWhenMatches = (
  disabledWhen: CrudSetDisabledWhen | undefined,
  row: Record<string, unknown>,
  currentRowKey?: string,
  resolveRowKey?: (row: Record<string, unknown>) => string,
): boolean => {
  const rule = disabledWhen?.rule;
  if (!rule || rule === 'never' || !isCrudSetDisabledWhenRule(rule)) {
    return false;
  }
  if (rule === 'has-children') {
    return crudSetRowHasChildren(row);
  }
  if (rule === 'row-is-self') {
    const key = resolveRowKey?.(row) ?? String(row.id ?? '');
    return Boolean(currentRowKey) && key === currentRowKey;
  }
  const field = disabledWhen?.field?.trim();
  if (!field) {
    return false;
  }
  const value = row[field];
  if (rule === 'field-truthy') {
    return asCrudSetTruthy(value);
  }
  if (rule === 'field-falsy') {
    return !asCrudSetTruthy(value);
  }
  return stringifyCrudSetValue(value) === (disabledWhen?.equals ?? '');
};

export const crudSetViewKind = (
  spec: Pick<CrudSetSpec, 'dialogs'>,
): CrudSetViewKind => (
  isCrudSetViewKind(spec.dialogs?.viewKind) ? spec.dialogs.viewKind : 'record-form'
);

export const crudSetThreadItemsField = (spec: Pick<CrudSetSpec, 'dialogs'>): string => (
  spec.dialogs?.threadItemsField?.trim() || 'messages'
);

export const crudSetThreadRoleField = (spec: Pick<CrudSetSpec, 'dialogs'>): string => (
  spec.dialogs?.threadRoleField?.trim() || 'role'
);

export const crudSetThreadBodyField = (spec: Pick<CrudSetSpec, 'dialogs'>): string => (
  spec.dialogs?.threadBodyField?.trim() || 'body'
);

export const crudSetJsonViewField = (spec: Pick<CrudSetSpec, 'dialogs'>): string => (
  spec.dialogs?.jsonField?.trim() || ''
);

export type CrudSetThreadMessage = {
  role: string;
  body: string;
};

export const crudSetThreadMessages = (
  row: Record<string, unknown>,
  spec: Pick<CrudSetSpec, 'dialogs'>,
): CrudSetThreadMessage[] => {
  const items = row[crudSetThreadItemsField(spec)];
  if (!Array.isArray(items)) {
    return [];
  }
  const roleField = crudSetThreadRoleField(spec);
  const bodyField = crudSetThreadBodyField(spec);
  return items.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return [];
    }
    const record = item as Record<string, unknown>;
    const body = stringifyCrudSetValue(record[bodyField]).trim();
    if (!body) {
      return [];
    }
    return [{
      role: stringifyCrudSetValue(record[roleField]).trim() || 'assistant',
      body,
    }];
  });
};

export const crudSetJsonViewText = (
  row: Record<string, unknown>,
  spec: Pick<CrudSetSpec, 'dialogs'>,
): string => {
  const field = crudSetJsonViewField(spec);
  const value = field ? row[field] : row;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return trimmed;
    }
  }
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return '';
  }
};

export const crudSetColumnFormControl = (column: CrudSetGridColumn): CrudSetFormControl => {
  if (isCrudSetFormControl(column.formControl) && column.formControl !== 'auto') {
    return column.formControl;
  }
  const kind = crudSetColumnCellKind(column);
  if (kind === 'boolean-icon' || kind === 'lock-status') {
    return 'checkbox';
  }
  if (kind === 'chips') {
    return 'chips';
  }
  if (kind === 'image') {
    return 'image';
  }
  const field = column.field.trim();
  if (/password|secret/i.test(field)) {
    return 'password';
  }
  if (/color|accent/i.test(field)) {
    return 'color';
  }
  if (/^(html|markup|uiHtml)$/i.test(field)) {
    return 'html';
  }
  if (/^(json|payload|metadata)$/i.test(field)) {
    return 'json';
  }
  if (/^(subtitle|website|description|note|body|detailNote|comments)$/i.test(field)) {
    return 'textarea';
  }
  return 'auto';
};

export const crudSetFieldVisibleWhen = (
  column: CrudSetGridColumn | undefined,
  values: Record<string, unknown>,
): boolean => {
  const rule = column?.visibleWhen;
  const field = rule?.field?.trim();
  if (!field) {
    return true;
  }
  return stringifyCrudSetValue(values[field]) === (rule.equals ?? '');
};

export const crudSetFilterBarSearchClearEnabled = (
  spec: Pick<CrudSetSpec, 'filterBar'>,
): boolean => crudSetFilterBarSearchEnabled(spec) && spec.filterBar?.searchClear !== false;

export const crudSetGridChrome = (spec: Pick<CrudSetSpec, 'grid'>): CrudSetGridChrome => (
  isCrudSetGridChrome(spec.grid?.chrome) ? spec.grid.chrome : 'classic'
);

export const crudSetGridDensity = (spec: Pick<CrudSetSpec, 'grid'>): CrudSetGridDensity => (
  isCrudSetGridDensity(spec.grid?.density) ? spec.grid.density : 'default'
);

export const crudSetGridFillHeight = (spec: Pick<CrudSetSpec, 'grid'>): boolean => (
  spec.grid?.fillHeight !== false
);

export const crudSetGridStickyHeader = (spec: Pick<CrudSetSpec, 'grid'>): boolean => (
  spec.grid?.stickyHeader !== false
);

export const crudSetGridPresentationsForBody = (
  listBody: CrudSetListBodyKind,
): CrudSetGridPresentation[] => (
  listBody === 'tree-grid'
    ? CRUD_SET_GRID_PRESENTATIONS.filter((item) => item !== 'table-scroll')
    : [...CRUD_SET_GRID_PRESENTATIONS]
);

export const crudSetGridPresentation = (
  spec: Pick<CrudSetSpec, 'listBody' | 'grid'>,
): CrudSetGridPresentation => {
  const requested = spec.grid?.presentation;
  const allowed = crudSetGridPresentationsForBody(spec.listBody ?? 'grid');
  if (isCrudSetGridPresentation(requested) && allowed.includes(requested)) {
    return requested;
  }
  return 'auto';
};

export const crudSetGridCardBelow = (spec: Pick<CrudSetSpec, 'grid'>): CrudSetGridCardBelow => (
  isCrudSetGridCardBelow(spec.grid?.cardBelow) ? spec.grid.cardBelow : 'tablet'
);

/** True when any path can show cards (presentation auto/cards or compact layout cards). */
export const crudSetGridUsesCardPresentation = (
  spec: Pick<CrudSetSpec, 'grid' | 'listBody'>,
): boolean => {
  const presentation = crudSetGridPresentation(spec);
  if (presentation === 'cards' || presentation === 'auto') {
    return true;
  }
  const compact = crudSetGridCompact(spec);
  return appTableGridUsesCardPresentation({
    presentation,
    compactPhoneLayout: compact.phoneLayout,
    compactTabletLayout: compact.tabletLayout,
  });
};

export const crudSetGridSelection = (
  spec: Pick<CrudSetSpec, 'grid'>,
): CrudSetGridSelectionMode => (
  isCrudSetGridSelectionMode(spec.grid?.selection) ? spec.grid.selection : 'none'
);

export const crudSetGridEmptyMessage = (
  spec: Pick<CrudSetSpec, 'grid'>,
): string => spec.grid?.emptyMessage?.trim() || 'No records found.';

export const crudSetGridLoadingMessage = (
  spec: Pick<CrudSetSpec, 'grid'>,
): string => spec.grid?.loadingMessage?.trim() || 'Loading records...';

export const crudSetGridAriaLabel = (
  spec: Pick<CrudSetSpec, 'name' | 'grid'>,
): string => spec.grid?.ariaLabel?.trim() || spec.name;

export const crudSetListPreferenceKey = (spec: Pick<CrudSetSpec, 'name'>): string => {
  const slug = spec.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '') || 'list';
  return `crud-set:${slug}`;
};

export const crudSetGridMargin = (spec: Pick<CrudSetSpec, 'grid'>): number | undefined => (
  typeof spec.grid?.margin === 'number' && Number.isFinite(spec.grid.margin)
    ? Math.max(0, spec.grid.margin)
    : undefined
);

export const crudSetGridBorderWidth = (spec: Pick<CrudSetSpec, 'grid'>): number | undefined => (
  typeof spec.grid?.borderWidth === 'number' && Number.isFinite(spec.grid.borderWidth)
    ? Math.max(0, spec.grid.borderWidth)
    : undefined
);

/** Configurator display / docs — effective inset after hero defaults. */
export const crudSetGridEffectiveMargin = (spec: Pick<CrudSetSpec, 'grid'>): number => (
  crudSetGridMargin(spec)
  ?? (crudSetGridChrome(spec) === 'hero' ? CRUD_SET_GRID_HERO_MARGIN_PX : 0)
);

export const crudSetGridEffectiveBorderWidth = (spec: Pick<CrudSetSpec, 'grid'>): number => (
  crudSetGridBorderWidth(spec)
  ?? (crudSetGridChrome(spec) === 'hero' ? CRUD_SET_GRID_HERO_BORDER_WIDTH_PX : 0)
);

export const crudSetGridColumnLayoutEnabled = (spec: Pick<CrudSetSpec, 'grid'>): boolean => (
  spec.grid?.enableColumnLayout === true
);

export const crudSetGridShowColumnLayoutControl = (
  spec: Pick<CrudSetSpec, 'grid'>,
): boolean => crudSetGridColumnLayoutEnabled(spec) && spec.grid?.showColumnLayoutControl === true;

export const crudSetGridCompact = (
  spec: Pick<CrudSetSpec, 'grid'>,
): CrudSetGridCompactConfig => spec.grid?.compact ?? {};

/** Flat Designer keys for `parseGridCompactFromProps`. */
export const crudSetGridCompactPropBag = (
  spec: Pick<CrudSetSpec, 'listBody' | 'grid'>,
): Record<string, unknown> => {
  const compact = crudSetGridCompact(spec);
  const tree = spec.listBody === 'tree-grid';
  return {
    compactPhoneLayout: isCrudSetCompactLayout(compact.phoneLayout) ? compact.phoneLayout : 'inherit',
    compactTabletLayout: isCrudSetCompactLayout(compact.tabletLayout)
      && !(tree && compact.tabletLayout === 'table-scroll')
      ? compact.tabletLayout
      : 'inherit',
    compactTabletCardsPerRow: tree
      ? 'inherit'
      : (isCrudSetCompactCardsPerRow(compact.tabletCardsPerRow) ? compact.tabletCardsPerRow : 2),
    compactFreezeFirstColumn: tree
      ? 'inherit'
      : (isCrudSetCompactTri(compact.freezeFirstColumn) ? compact.freezeFirstColumn : 'inherit'),
    compactCollapseExtraFields: compact.collapseExtraFields ? 'on' : 'inherit',
    compactVisibleFieldCount: compact.collapseExtraFields && isCrudSetCompactVisibleFieldCount(compact.visibleFieldCount)
      ? compact.visibleFieldCount
      : 'inherit',
    compactShowActions: compact.showActions === false ? 'off' : 'inherit',
    compactShowMeta: compact.showMeta === false ? 'off' : 'inherit',
  };
};

export const crudSetActionsMaxVisible = (
  spec: Pick<CrudSetSpec, 'actions'>,
): CrudSetMaxVisibleActions => (
  isCrudSetMaxVisibleActions(spec.actions?.maxVisible) ? spec.actions.maxVisible : 3
);

export const crudSetActionsAlign = (
  spec: Pick<CrudSetSpec, 'actions'>,
): CrudSetActionsAlign => (
  isCrudSetActionsAlign(spec.actions?.align) ? spec.actions.align : 'end'
);

export const crudSetDialogFormSize = (
  spec: Pick<CrudSetSpec, 'dialogs'>,
): CrudSetFormDialogSize => (
  isCrudSetFormDialogSize(spec.dialogs?.formSize) ? spec.dialogs.formSize : 'lg'
);

/** Widen create/edit/view when more than four fields unless the operator locked maximized/full. */
export const crudSetDialogFormSizeForFieldCount = (
  spec: Pick<CrudSetSpec, 'dialogs'>,
  fieldCount: number,
): CrudSetFormDialogSize => {
  const configured = crudSetDialogFormSize(spec);
  if (configured === 'maximized' || configured === 'full') {
    return configured;
  }
  if (fieldCount > CRUD_SET_FORM_WIDE_FIELD_COUNT) {
    return '4xl';
  }
  return configured;
};

export const crudSetDialogSidePanelTitle = (
  spec: Pick<CrudSetSpec, 'dialogs'>,
): string => {
  const title = spec.dialogs?.sidePanelTitle?.trim();
  return title || CRUD_SET_DEFAULT_SIDE_PANEL_TITLE;
};

export const crudSetDialogSidePanelPlacement = (
  spec: Pick<CrudSetSpec, 'dialogs'>,
): RecordFormSidePanelPlacement => (
  isRecordFormSidePanelPlacement(spec.dialogs?.sidePanelPlacement)
    ? spec.dialogs.sidePanelPlacement
    : RECORD_FORM_DEFAULT_SIDE_PANEL_PLACEMENT
);

export const crudSetDialogSidePanelPinnable = (
  spec: Pick<CrudSetSpec, 'dialogs'>,
): boolean => spec.dialogs?.sidePanelPinnable === true;

export const crudSetDialogSidePanelSplitter = (
  spec: Pick<CrudSetSpec, 'dialogs'>,
): boolean => spec.dialogs?.sidePanelSplitter !== false;

export const crudSetDialogSidePanelShowTitle = (
  spec: Pick<CrudSetSpec, 'dialogs'>,
): boolean => spec.dialogs?.sidePanelShowTitle !== false;

export const crudSetDialogSidePanelTitleInHeader = (
  spec: Pick<CrudSetSpec, 'dialogs'>,
): boolean => spec.dialogs?.sidePanelTitleInHeader === true;

export const crudSetDialogSidePanelBackground = (
  spec: Pick<CrudSetSpec, 'dialogs'>,
): RecordFormSidePanelBackground => (
  isRecordFormSidePanelBackground(spec.dialogs?.sidePanelBackground)
    ? spec.dialogs.sidePanelBackground
    : RECORD_FORM_DEFAULT_SIDE_PANEL_BACKGROUND
);

export const crudSetDialogSidePanelBackgroundColor = (
  spec: Pick<CrudSetSpec, 'dialogs'>,
): string => {
  const raw = spec.dialogs?.sidePanelBackgroundColor?.trim();
  if (!raw) {
    return RECORD_FORM_DEFAULT_SIDE_PANEL_BACKGROUND_COLOR;
  }
  const hex = raw.startsWith('#') ? raw : `#${raw}`;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(hex)
    ? hex.toUpperCase()
    : RECORD_FORM_DEFAULT_SIDE_PANEL_BACKGROUND_COLOR;
};

export const resolveRecordFormSidePanelBackgroundColor = (
  source: RecordFormSidePanelBackground,
  customHex?: string,
): string => {
  if (source === 'custom') {
    const hex = crudSetDialogSidePanelBackgroundColor({ dialogs: { sidePanelBackgroundColor: customHex } });
    return hex;
  }
  return RECORD_FORM_SIDE_PANEL_THEME_BACKGROUND;
};

export const crudSetDialogShowHeader = (
  spec: Pick<CrudSetSpec, 'dialogs'>,
): boolean => spec.dialogs?.showHeader !== false;

export const crudSetDialogSubHeaderCount = (
  spec: Pick<CrudSetSpec, 'dialogs'>,
): RecordFormDialogSubHeaderCount => (
  isRecordFormDialogSubHeaderCount(spec.dialogs?.subHeaderCount)
    ? spec.dialogs.subHeaderCount
    : 0
);

export const crudSetDialogShowFooter = (
  spec: Pick<CrudSetSpec, 'dialogs'>,
): boolean => spec.dialogs?.showFooter !== false;

export const crudSetDialogSubFooterCount = (
  spec: Pick<CrudSetSpec, 'dialogs'>,
): RecordFormDialogSubFooterCount => (
  isRecordFormDialogSubFooterCount(spec.dialogs?.subFooterCount)
    ? spec.dialogs.subFooterCount
    : 0
);

export const recordFormSidePanelPropsFromDialogs = (spec: Pick<CrudSetSpec, 'dialogs'>) => ({
  sidePanelTitle: crudSetDialogSidePanelTitle(spec),
  sidePanelPlacement: crudSetDialogSidePanelPlacement(spec),
  sidePanelPinnable: crudSetDialogSidePanelPinnable(spec),
  sidePanelSplitter: crudSetDialogSidePanelSplitter(spec),
  sidePanelShowTitle: crudSetDialogSidePanelShowTitle(spec),
  sidePanelTitleInHeader: crudSetDialogSidePanelTitleInHeader(spec),
  sidePanelBackground: crudSetDialogSidePanelBackground(spec),
  sidePanelBackgroundColor: crudSetDialogSidePanelBackgroundColor(spec),
});

export const crudSetDialogComponentName = (
  spec: Pick<CrudSetSpec, 'dialogs'>,
  slot: 'create' | 'edit' | 'view',
): string => {
  const raw = slot === 'create'
    ? spec.dialogs?.createComponent
    : slot === 'edit'
      ? spec.dialogs?.editComponent
      : spec.dialogs?.viewComponent;
  return raw?.trim() ?? '';
};

export const crudSetDialogConfirmSize = (
  spec: Pick<CrudSetSpec, 'dialogs'>,
): CrudSetConfirmDialogSize => (
  isCrudSetConfirmDialogSize(spec.dialogs?.confirmSize) ? spec.dialogs.confirmSize : 'sm'
);

export const crudSetDialogShowCloseButton = (
  spec: Pick<CrudSetSpec, 'dialogs'>,
): boolean => spec.dialogs?.showCloseButton !== false;

export const crudSetDialogCloseOnEscape = (
  spec: Pick<CrudSetSpec, 'dialogs'>,
): boolean => spec.dialogs?.closeOnEscape !== false;

export const crudSetDialogConfirmInitialFocus = (
  spec: Pick<CrudSetSpec, 'dialogs'>,
): CrudSetConfirmInitialFocus => (
  isCrudSetConfirmInitialFocus(spec.dialogs?.confirmInitialFocus)
    ? spec.dialogs.confirmInitialFocus
    : 'cancel'
);

export const crudSetDialogBackdropTint = (
  spec: Pick<CrudSetSpec, 'dialogs'>,
): CrudSetDialogBackdropTint => (
  isCrudSetDialogBackdropTint(spec.dialogs?.backdropTint) ? spec.dialogs.backdropTint : 'medium'
);

export const crudSetDialogBackdropBlur = (
  spec: Pick<CrudSetSpec, 'dialogs'>,
): CrudSetDialogBackdropBlur => (
  isCrudSetDialogBackdropBlur(spec.dialogs?.backdropBlur) ? spec.dialogs.backdropBlur : 'default'
);

export const crudSetDialogBackdropTransparency = (
  spec: Pick<CrudSetSpec, 'dialogs'>,
): CrudSetDialogBackdropTransparency => (
  isCrudSetDialogBackdropTransparency(spec.dialogs?.backdropTransparency)
    ? spec.dialogs.backdropTransparency
    : 'opaque'
);

export const crudSetColumnCardRole = (
  column: CrudSetGridColumn,
  columns: readonly CrudSetGridColumn[],
  columnIndex: number,
): CrudSetColumnCardRole => {
  const stubs: AppTableGridColumnDef<Record<string, unknown>>[] = columns.map((entry) => ({
    id: crudSetColumnId(entry),
    label: crudSetColumnLabel(entry),
    renderCell: () => null,
    card: isCrudSetColumnCardRole(entry.cardRole)
      ? { role: entry.cardRole }
      : crudSetColumnIsImageColumn(entry)
        ? { role: 'media' }
        : undefined,
  }));
  return resolveColumnCardRole(stubs[columnIndex], stubs);
};

export const crudSetColumnHideBelow = (
  column: CrudSetGridColumn,
): CrudSetColumnHideBelow | undefined => (
  isCrudSetColumnHideBelow(column.hideBelow) ? column.hideBelow : undefined
);

export const crudSetColumnIsRowHeader = (
  column: CrudSetGridColumn,
  columnIndex: number,
): boolean => (
  typeof column.isRowHeader === 'boolean' ? column.isRowHeader : columnIndex === 0
);

export const crudSetColumnPinned = (column: CrudSetGridColumn): CrudSetColumnPin => (
  isCrudSetColumnPin(column.pinned) ? column.pinned : 'none'
);

export const crudSetSuggestedFormPlacement = (column: Pick<CrudSetGridColumn, 'cellKind'>): CrudSetFormPlacement => {
  const kind = crudSetColumnCellKind(column);
  return kind === 'boolean-icon' || kind === 'lock-status' ? 'side' : 'main';
};

export const crudSetColumnFormPlacement = (column: CrudSetGridColumn): CrudSetFormPlacement => (
  isCrudSetFormPlacement(column.formPlacement)
    ? column.formPlacement
    : crudSetSuggestedFormPlacement(column)
);

export const recordFormFieldsIncludeSidePanel = (
  columns: readonly CrudSetGridColumn[],
  fields: readonly string[],
): boolean => {
  const byField = new Map(columns.map((column) => [column.field, column]));
  return fields.some((field) => (
    crudSetColumnFormPlacement(byField.get(field) ?? { field }) === 'side'
  ));
};

export const crudSetOmittedUi = (spec: CrudSetSpec): {
  create: boolean;
  patches: boolean;
  delete: boolean;
  export: boolean;
  paging: boolean;
  filterBar: boolean;
  refresh: boolean;
  collection: boolean;
  autoRefresh: boolean;
  rowActions: boolean;
} => ({
  create: spec.createApis.length === 0,
  patches: spec.patches.length === 0,
  delete: !spec.deleteApi,
  export: !crudSetExportEnabled(spec),
  paging: !crudSetPaginationEnabled(spec),
  filterBar: !crudSetFilterBarEnabled(spec),
  refresh: !crudSetRefreshEnabled(spec),
  collection: crudSetCollectionActions(spec).length === 0,
  autoRefresh: !crudSetAutoRefreshEnabled(spec),
  rowActions: crudSetRowActions(spec).length === 0,
});

/** Locked suffix shown next to the filename input. Operator cannot change it. */
export const crudSetLockedExportExtension = (format: CrudSetExportFormat): `.${CrudSetExportFormat}` => (
  `.${format}`
);

/**
 * Prefill for the export-dialog filename stem (no extension).
 * Operator may edit the stem; the locked extension always comes from the chosen format.
 */
export const crudSetSuggestedExportFilename = (
  spec: Pick<CrudSetSpec, 'name'>,
  now: Date = new Date(),
): string => {
  const slug = spec.name.trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, '-')
    || 'export';
  const date = now.toISOString().slice(0, 10);
  return `${slug}-${date}`;
};

/** Live Designer / catalog palette id for the unified `CrudSet` node. */
export const CRUD_SET_PALETTE_ITEM_ID = 'heroui.crud-set';

export const serializeCrudSetSpec = (spec: CrudSetSpec): string => JSON.stringify(spec, null, 2);

const isApiRef = (value: unknown): value is CrudSetApiRef => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
  && typeof (value as CrudSetApiRef).endpointId === 'string'
);

export const isCrudSetSpec = (value: unknown): value is CrudSetSpec => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const spec = value as CrudSetSpec;
  return typeof spec.name === 'string'
    && isApiRef(spec.listApi)
    && isCrudSetListBodyKind(spec.listBody)
    && Array.isArray(spec.columns)
    && Array.isArray(spec.createApis)
    && Array.isArray(spec.patches);
};

/** Reads `node.props.spec` (JSON string or object) into a `CrudSetSpec`. */
export const parseCrudSetSpec = (value: unknown): CrudSetSpec | null => {
  if (isCrudSetSpec(value)) {
    return value;
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return isCrudSetSpec(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const isGridColumn = (value: unknown): value is CrudSetGridColumn => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
  && typeof (value as CrudSetGridColumn).field === 'string'
  && (value as CrudSetGridColumn).field.trim().length > 0
);

/** Reads Edit / View `spec` (JSON string or `{ columns }`) into grid columns. */
export const parseRecordFormColumns = (value: unknown): CrudSetGridColumn[] => {
  const parsed = ((): unknown => {
    if (typeof value !== 'string') {
      return value;
    }
    if (value.trim().length === 0) {
      return null;
    }
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  })();
  if (Array.isArray(parsed)) {
    return parsed.filter(isGridColumn);
  }
  if (!parsed || typeof parsed !== 'object') {
    return [];
  }
  const columns = (parsed as { columns?: unknown }).columns;
  return Array.isArray(columns) ? columns.filter(isGridColumn) : [];
};

export const CRUD_SET_DEFAULT_SPEC: CrudSetSpec = {
  name: 'CRUD Set',
  listApi: { endpointId: '' },
  listBody: 'grid',
  pagination: true,
  columns: [{ field: 'id', label: 'Id' }],
  createApis: [],
  patches: [],
  export: { enabled: true, formats: ['xlsx', 'csv'], defaultFormat: 'xlsx', defaultIncludeHeader: true },
  filterBar: { enabled: true, search: true, filters: [] },
  refresh: true,
  paging: { ...CRUD_SET_DEFAULT_PAGING },
  sorting: { ...CRUD_SET_DEFAULT_SORTING },
  grid: { ...CRUD_SET_DEFAULT_GRID },
  actions: { ...CRUD_SET_DEFAULT_ACTIONS },
  dialogs: { ...CRUD_SET_DEFAULT_DIALOGS },
};
