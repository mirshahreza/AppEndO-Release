import { z } from 'zod';

/**
 * Form display widget for a relation (studio-meta associationMeta).
 * Unset means infer from association kind (belongsTo → select, hasMany → related grid, …).
 *
 * Widgets are kind-specific — do not share has-many (owned children) with
 * belongs-to-many (attach existing) or belongs-to (pick one FK).
 */
export const RELATION_FORM_WIDGET_VALUES = [
  // belongsTo / physical — pick one existing record
  'select',
  'typeahead',
  'dropdownButton',
  'lookup',
  'radio',
  'buttonGroup',
  // hasOne — nest / edit at most one owned child
  'nestedCard',
  'nestedForm',
  // hasMany — manage owned child collection (create / edit / remove)
  'relatedGrid',
  'cardList',
  'repeater',
  // belongsToMany — attach / detach existing peers via through table
  'checkboxList',
  'tagsList',
  'tags',
  'dualList',
  // any kind
  'hidden',
] as const;

export type RelationFormWidget = (typeof RELATION_FORM_WIDGET_VALUES)[number];

export const relationFormWidgetSchema = z.enum(RELATION_FORM_WIDGET_VALUES);

/** UiSelect sentinel for Auto; map to '' / omit before persisting. */
export const RELATION_FORM_WIDGET_AUTO_SELECT_VALUE = 'auto' as const;

export type RelationWidgetKindHint =
  | 'belongsTo'
  | 'hasOne'
  | 'hasMany'
  | 'belongsToMany'
  | 'physical';

export type RelationFormWidgetOption = {
  value: RelationFormWidget;
  label: string;
  description: string;
  /** Relation kinds this widget is valid for. */
  kinds: readonly RelationWidgetKindHint[];
};

/** Operator-facing catalog for Relation Properties (and Column Properties belongs-to). */
export const RELATION_FORM_WIDGET_OPTIONS: readonly RelationFormWidgetOption[] = [
  {
    value: 'select',
    label: 'Select',
    description: 'Compact closed select (`UiSelect`) — pick from a short fixed list (no typing).',
    kinds: ['belongsTo', 'physical'],
  },
  {
    value: 'typeahead',
    label: 'Typeahead',
    description: 'Type inside the field to filter, then pick one related record.',
    kinds: ['belongsTo', 'physical'],
  },
  {
    value: 'dropdownButton',
    label: 'Dropdown button',
    description:
      'Button shows the selected label; click opens a list (prefers below, flips above when space is tight).',
    kinds: ['belongsTo', 'physical'],
  },
  {
    value: 'lookup',
    label: 'Lookup',
    description:
      'Selected label + Search/Clear — Search opens a dialog whose grid fills the remaining space and always paginates (or a compact list).',
    kinds: ['belongsTo', 'physical'],
  },
  {
    value: 'radio',
    label: 'Radio list',
    description: 'Always-visible radio buttons — vertical or horizontal; one option selected at a time.',
    kinds: ['belongsTo', 'physical'],
  },
  {
    value: 'buttonGroup',
    label: 'Button group',
    description: 'Single choice as buttons — horizontal wrap or vertical stack.',
    kinds: ['belongsTo', 'physical'],
  },
  {
    value: 'nestedCard',
    label: 'Nested card',
    description: 'Compact inline card with fields for the single related record (has-one).',
    kinds: ['hasOne'],
  },
  {
    value: 'nestedForm',
    label: 'Nested form',
    description: 'Full nested field section for creating/editing the related record (has-one).',
    kinds: ['hasOne'],
  },
  {
    value: 'relatedGrid',
    label: 'Related grid',
    description:
      'Child-record grid with add / delete. Edit mode: Direct edit, Row edit, or Dialog edit.',
    kinds: ['hasMany'],
  },
  {
    value: 'cardList',
    label: 'Card list',
    description:
      'Card view of owned children with add / delete. Edit mode: Direct edit, Row edit, or Dialog edit.',
    kinds: ['hasMany'],
  },
  {
    value: 'repeater',
    label: 'Repeater',
    description:
      'Stacked field groups for owned children with add / delete. Edit mode: Direct edit, Row edit, or Dialog edit.',
    kinds: ['hasMany'],
  },
  {
    value: 'checkboxList',
    label: 'Checkbox list',
    description:
      'Attach many existing peers as checkboxes — vertical or horizontal (belongs-to-many).',
    kinds: ['belongsToMany'],
  },
  {
    value: 'tagsList',
    label: 'Tags list',
    description:
      'Selected peers as removable tags plus add control — inline typeahead, or select above/below (belongs-to-many).',
    kinds: ['belongsToMany'],
  },
  {
    value: 'tags',
    label: 'Tags',
    description: 'Toggle chip tags for attaching peers (belongs-to-many).',
    kinds: ['belongsToMany'],
  },
  {
    value: 'dualList',
    label: 'Dual list',
    description: 'Available ↔ selected transfer lists for attaching peers (belongs-to-many).',
    kinds: ['belongsToMany'],
  },
  {
    value: 'hidden',
    label: 'Hidden',
    description: 'Loaded for the API but not shown on the form.',
    kinds: ['belongsTo', 'hasOne', 'hasMany', 'belongsToMany', 'physical'],
  },
];

export const RELATION_FORM_WIDGET_LABEL_BY_VALUE: Record<RelationFormWidget, string> = (
  Object.fromEntries(
    RELATION_FORM_WIDGET_OPTIONS.map((option) => [option.value, option.label]),
  ) as Record<RelationFormWidget, string>
);

/** Preferred order for belongs-to / physical FK pickers. */
const BELONGS_TO_WIDGET_ORDER: readonly RelationFormWidget[] = [
  'select',
  'typeahead',
  'dropdownButton',
  'lookup',
  'radio',
  'buttonGroup',
  'hidden',
];

/** Preferred order for has-one nested editors. */
const HAS_ONE_WIDGET_ORDER: readonly RelationFormWidget[] = [
  'nestedCard',
  'nestedForm',
  'hidden',
];

/** Preferred order for has-many owned-child managers. */
const HAS_MANY_WIDGET_ORDER: readonly RelationFormWidget[] = [
  'relatedGrid',
  'cardList',
  'repeater',
  'hidden',
];

/** Preferred order for belongs-to-many attach pickers. */
const BELONGS_TO_MANY_WIDGET_ORDER: readonly RelationFormWidget[] = [
  'checkboxList',
  'tagsList',
  'tags',
  'dualList',
  'hidden',
];

/** Default form widget for belongs-to / physical FK columns (Select). */
export const DEFAULT_BELONGS_TO_FORM_WIDGET: RelationFormWidget = 'select';

const widgetOrderForKind = (
  kind: RelationWidgetKindHint,
): readonly RelationFormWidget[] => {
  switch (kind) {
    case 'hasOne':
      return HAS_ONE_WIDGET_ORDER;
    case 'hasMany':
      return HAS_MANY_WIDGET_ORDER;
    case 'belongsToMany':
      return BELONGS_TO_MANY_WIDGET_ORDER;
    case 'belongsTo':
    case 'physical':
    default:
      return BELONGS_TO_WIDGET_ORDER;
  }
};

const sortRelationWidgetOptions = (
  options: readonly RelationFormWidgetOption[],
  preferredOrder: readonly RelationFormWidget[],
): RelationFormWidgetOption[] => {
  const rank = new Map(preferredOrder.map((value, index) => [value, index]));
  return [...options].sort((left, right) => {
    const leftRank = rank.get(left.value) ?? preferredOrder.length;
    const rightRank = rank.get(right.value) ?? preferredOrder.length;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.label.localeCompare(right.label);
  });
};

/**
 * Options shown for a relation kind (Auto is added by the UI when applicable).
 * Same catalog as Sandbox → Relations (`RelationFormWidgetGallery` filtered by kind).
 */
export const relationFormWidgetOptionsForKind = (
  kind: RelationWidgetKindHint,
): readonly RelationFormWidgetOption[] => {
  const filtered = RELATION_FORM_WIDGET_OPTIONS.filter((option) => (
    option.kinds.includes(kind)
  ));
  return sortRelationWidgetOptions(filtered, widgetOrderForKind(kind));
};

/** Whether a widget id is selectable for this relation kind (Sandbox → Relations catalog). */
export const isRelationFormWidgetAllowedForKind = (
  kind: RelationWidgetKindHint,
  formWidget: RelationFormWidget | '' | null | undefined,
): boolean => (
  Boolean(
    formWidget
    && relationFormWidgetOptionsForKind(kind).some((item) => item.value === formWidget),
  )
);

/**
 * Keep a persisted widget only when it belongs to this kind’s Sandbox catalog.
 * Otherwise return '' (Auto).
 */
export const resolveRelationFormWidgetForKind = (
  kind: RelationWidgetKindHint,
  formWidget: RelationFormWidget | '' | null | undefined,
): RelationFormWidget | '' => (
  isRelationFormWidgetAllowedForKind(kind, formWidget)
    ? (formWidget as RelationFormWidget)
    : ''
);

export const defaultRelationFormWidgetLabel = (kind: RelationWidgetKindHint): string => {
  switch (kind) {
    case 'hasOne':
      return 'Nested card';
    case 'hasMany':
      return 'Related grid';
    case 'belongsToMany':
      return 'Checkbox list';
    case 'belongsTo':
    case 'physical':
    default:
      return 'Select';
  }
};

/** Resolve persisted or default widget for a belongs-to FK column. */
export const resolveBelongsToFormWidget = (
  formWidget: RelationFormWidget | '' | null | undefined,
): RelationFormWidget => (
  isRelationFormWidgetAllowedForKind('belongsTo', formWidget)
    ? (formWidget as RelationFormWidget)
    : DEFAULT_BELONGS_TO_FORM_WIDGET
);

/**
 * Legacy / renamed widget ids coerced when loading studio-meta.
 * Greenfield: only bridge short-lived draft values from the prior catalog.
 *
 * Naming contract (belongs-to):
 * - `select` — compact `UiSelect` (legacy draft id `dropdown` still coerces here)
 * - `dropdownButton` — button trigger + floating option list (selected label on the button)
 * - removed `selectList` coerces to `radio`
 */
export const coerceRelationFormWidget = (
  value: string | null | undefined,
): RelationFormWidget | undefined => {
  if (!value) return undefined;
  if (value === 'dropdown') {
    return 'select';
  }
  if (value === 'selectList') {
    return 'radio';
  }
  if (value === 'relatedList' || value === 'inlineTable') {
    return 'relatedGrid';
  }
  if (value === 'multiSelect' || value === 'attachList') {
    return 'tagsList';
  }
  if ((RELATION_FORM_WIDGET_VALUES as readonly string[]).includes(value)) {
    return value as RelationFormWidget;
  }
  return undefined;
};
