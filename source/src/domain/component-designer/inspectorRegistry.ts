import { getPaletteItemById, paletteItemHasCapability } from './catalog';
import { compileInspectorForPaletteItem } from './compileInspectorFromCatalog';
import { getCompileComponentId } from './designerCatalogIdentity';
import {
  HEROUI_PALETTE_PROP_FIELD_MAP,
  PALETTE_CONTENT_FIELDS,
  PALETTE_TAG_EXTENSION_FIELDS,
  PALETTE_TAILWIND_FIELD_KEY_MAP,
} from './inspectorPaletteFields';
import { INSPECTOR_CONTAINER_LAYOUT_FIELD_KEYS } from './paletteCapabilities';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from './propRegistry';
import type { DesignerNode } from './types';

export { DESIGNER_PALETTE_ITEM_ID_PROP } from './propRegistry';

export type InspectorFieldType = 'string' | 'number' | 'boolean' | 'select' | 'option-items' | 'static-list-items' | 'data-grid-columns' | 'app-table-grid-columns' | 'app-table-grid-sort-options' | 'app-table-grid-aggregation' | 'app-table-grid-toolbar' | 'layout-grid-column-widths' | 'icon-picker' | 'content-records';

export type InspectorFieldGroup = 'content' | 'global' | 'tag' | 'tailwind' | 'heroui' | 'html-extra';

/** A single sub-field within one record of a `content-records` array (e.g. one Team Member's Name/Role/Bio). */
export type ContentRecordFieldDef = {
  key: string;
  label: string;
  /** Defaults to a single-line text input. 'checkbox' persists the string "true"/"false". */
  control?: 'text' | 'textarea' | 'checkbox';
  placeholder?: string;
};

/** Column value type for an `arrayEditorColumns`-driven field (see `InspectorJsonArrayListField`). */
export type InspectorArrayEditorColumnType = 'string' | 'number' | 'color';

/** One typed column of an array-of-fixed-shape-object field (e.g. gauge thresholds' `value`/`color`). */
export type InspectorArrayEditorColumn = {
  key: string;
  label: string;
  type: InspectorArrayEditorColumnType;
  placeholder?: string;
};

export type InspectorFieldSchema = {
  key: string;
  label: string;
  type: InspectorFieldType;
  group: InspectorFieldGroup;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  /** `content-records` only: the shape editors show per array item. */
  recordFields?: ContentRecordFieldDef[];
  /** `content-records` only: singular noun for buttons/headings, e.g. "member", "post". */
  recordItemLabel?: string;
  /** `content-records` only: whether records carry an auto-generated `id` (default true). */
  recordHasId?: boolean;
  /** `string` fields only: edit via a large monospace dialog with JSON.parse validation feedback. */
  jsonEditor?: boolean;
  /**
   * `string` fields only, storing a JSON-encoded array of fixed-shape objects: render a visual
   * repeating row editor (`InspectorJsonArrayListField`) instead of the raw-JSON dialog. Takes
   * priority over `jsonEditor` when both are set.
   */
  arrayEditorColumns?: InspectorArrayEditorColumn[];
  /** `arrayEditorColumns` only: singular noun for the Add button / per-row heading, e.g. "threshold". */
  arrayEditorItemLabel?: string;
  /** p-103 — compiled from Base Components catalog. */
  catalogOptionId?: string;
  /** Living-sample family heading (Body / Paging / Dialogs / …). */
  catalogGroup?: string;
  propPath?: string;
  catalogControl?: string;
  catalogAxis?: string;
  catalogDefaultValue?: unknown;
  catalogVisibleWhen?: unknown;
  catalogEnabledWhen?: unknown;
};

export type TailwindInspectorField = InspectorFieldSchema & {
  group: 'tailwind';
  utilityPrefix: string;
  conflictPattern: RegExp;
};

/** Progressive-disclosure tiers for the Properties panel (T1-11a / spec 03 §1). */
export type InspectorTierId = 'content' | 'style' | 'advanced';

export type InspectorFieldSection = {
  id: InspectorTierId;
  title: string;
  fields: InspectorFieldSchema[];
};

export const DESIGNER_INTERNAL_PROP_KEYS = new Set<string>([DESIGNER_PALETTE_ITEM_ID_PROP]);

const selectOptions = (options: Array<{ value: string; label: string }>): InspectorFieldSchema['options'] => options;

export const GLOBAL_INSPECTOR_FIELDS: InspectorFieldSchema[] = [
  { key: 'className', label: 'Class Name', type: 'string', group: 'global', placeholder: 'Tailwind / CSS classes' },
  { key: 'style', label: 'Inline Style', type: 'string', group: 'global', placeholder: 'color: red; padding: 8px' },
  { key: 'id', label: 'ID', type: 'string', group: 'global' },
  { key: 'title', label: 'Title', type: 'string', group: 'global' },
  { key: 'lang', label: 'Lang', type: 'string', group: 'global', placeholder: 'en' },
  {
    key: 'dir',
    label: 'Dir',
    type: 'select',
    group: 'global',
    options: selectOptions([
      { value: '', label: '(none)' },
      { value: 'ltr', label: 'ltr' },
      { value: 'rtl', label: 'rtl' },
      { value: 'auto', label: 'auto' },
    ]),
  },
  { key: 'tabIndex', label: 'Tab Index', type: 'number', group: 'global' },
  { key: 'role', label: 'Role', type: 'string', group: 'global' },
  { key: 'ariaLabel', label: 'Aria Label', type: 'string', group: 'global' },
  { key: 'dataTestId', label: 'Data Test ID', type: 'string', group: 'global', placeholder: 'my-element' },
  {
    key: 'minViewport',
    label: 'Min Viewport',
    type: 'select',
    group: 'global',
    options: selectOptions([
      { value: '', label: 'Always (adapt)' },
      { value: 'tablet', label: 'Tablet and up' },
      { value: 'desktop', label: 'Desktop only' },
    ]),
  },
  {
    key: 'belowMin',
    label: 'Below Minimum',
    type: 'select',
    group: 'global',
    options: selectOptions([
      { value: '', label: 'Continue (adapt)' },
      { value: 'hide', label: 'Hide' },
      { value: 'placeholder', label: 'Desktop only message' },
    ]),
  },
];

export const HTML_EXTRA_ATTR_FIELDS: InspectorFieldSchema[] = [
  { key: 'htmlExtraAttrs', label: 'Extra Attributes (JSON)', type: 'string', group: 'html-extra', placeholder: '{"data-id":"1","aria-describedby":"hint"}' },
];

const TRANSLATABLE_TEXT_CONTENT_FIELDS: InspectorFieldSchema[] = [
  {
    key: 'textContentMode',
    label: 'Text Mode',
    type: 'select',
    group: 'content',
    options: selectOptions([
      { value: 'literal', label: 'Literal' },
      { value: 'translation', label: 'Translation key' },
    ]),
  },
  { key: 'text', label: 'Text', type: 'string', group: 'content', required: true },
  {
    key: 'translationKey',
    label: 'Translation Key',
    type: 'string',
    group: 'content',
    placeholder: 'page.dashboard.title',
  },
];

export const NODE_CONTENT_FIELDS: Record<string, InspectorFieldSchema[]> = {
  text: TRANSLATABLE_TEXT_CONTENT_FIELDS,
  heading: TRANSLATABLE_TEXT_CONTENT_FIELDS,
  link: [{ key: 'text', label: 'Text', type: 'string', group: 'content', required: true }],
  'list-item': [{ key: 'text', label: 'Text', type: 'string', group: 'content', required: true }],
};

export const NODE_TAG_FIELDS: Record<string, InspectorFieldSchema[]> = {
  link: [
    { key: 'href', label: 'Href', type: 'string', group: 'tag', required: true },
    {
      key: 'target',
      label: 'Target',
      type: 'select',
      group: 'tag',
      options: selectOptions([
        { value: '', label: '(default)' },
        { value: '_self', label: '_self' },
        { value: '_blank', label: '_blank' },
        { value: '_parent', label: '_parent' },
        { value: '_top', label: '_top' },
      ]),
    },
    { key: 'rel', label: 'Rel', type: 'string', group: 'tag' },
    { key: 'download', label: 'Download', type: 'string', group: 'tag' },
    {
      key: 'referrerPolicy',
      label: 'Referrer Policy',
      type: 'select',
      group: 'tag',
      options: selectOptions([
        { value: '', label: '(default)' },
        { value: 'no-referrer', label: 'no-referrer' },
        { value: 'no-referrer-when-downgrade', label: 'no-referrer-when-downgrade' },
        { value: 'origin', label: 'origin' },
        { value: 'origin-when-cross-origin', label: 'origin-when-cross-origin' },
        { value: 'same-origin', label: 'same-origin' },
        { value: 'strict-origin', label: 'strict-origin' },
        { value: 'strict-origin-when-cross-origin', label: 'strict-origin-when-cross-origin' },
        { value: 'unsafe-url', label: 'unsafe-url' },
      ]),
    },
  ],
  image: [
    { key: 'src', label: 'Source', type: 'string', group: 'tag', required: true },
    // Not `required`: an empty alt is the correct, deliberate HTML pattern for a decorative
    // image (tells screen readers to skip it) — not a missing value. Flagging it as a "required
    // prop missing" error made every freshly-dropped image (which defaults to alt: '') show a
    // scary "Render issue" the instant it was placed, before the user had touched anything.
    { key: 'alt', label: 'Alt Text', type: 'string', group: 'tag' },
    { key: 'width', label: 'HTML Width', type: 'string', group: 'tag' },
    { key: 'height', label: 'HTML Height', type: 'string', group: 'tag' },
    {
      key: 'loading',
      label: 'Loading',
      type: 'select',
      group: 'tag',
      options: selectOptions([
        { value: '', label: '(default)' },
        { value: 'lazy', label: 'lazy' },
        { value: 'eager', label: 'eager' },
      ]),
    },
    {
      key: 'decoding',
      label: 'Decoding',
      type: 'select',
      group: 'tag',
      options: selectOptions([
        { value: '', label: '(default)' },
        { value: 'async', label: 'async' },
        { value: 'sync', label: 'sync' },
        { value: 'auto', label: 'auto' },
      ]),
    },
    { key: 'srcSet', label: 'Src Set', type: 'string', group: 'tag' },
    { key: 'sizes', label: 'Sizes', type: 'string', group: 'tag' },
    { key: 'fallbackSrc', label: 'Fallback Source', type: 'string', group: 'tag' },
  ],
};

export const PALETTE_TAG_FIELDS: Record<string, InspectorFieldSchema[]> = {
  'html.form': [
    { key: 'action', label: 'Action', type: 'string', group: 'tag' },
    {
      key: 'method',
      label: 'Method',
      type: 'select',
      group: 'tag',
      options: selectOptions([
        { value: 'get', label: 'GET' },
        { value: 'post', label: 'POST' },
        { value: 'dialog', label: 'DIALOG' },
      ]),
    },
    {
      key: 'enctype',
      label: 'Enctype',
      type: 'select',
      group: 'tag',
      options: selectOptions([
        { value: '', label: '(default)' },
        { value: 'application/x-www-form-urlencoded', label: 'urlencoded' },
        { value: 'multipart/form-data', label: 'multipart/form-data' },
        { value: 'text/plain', label: 'text/plain' },
      ]),
    },
    {
      key: 'target',
      label: 'Target',
      type: 'select',
      group: 'tag',
      options: selectOptions([
        { value: '', label: '(default)' },
        { value: '_self', label: '_self' },
        { value: '_blank', label: '_blank' },
      ]),
    },
    {
      key: 'autocomplete',
      label: 'Autocomplete',
      type: 'select',
      group: 'tag',
      options: selectOptions([
        { value: '', label: '(default)' },
        { value: 'on', label: 'on' },
        { value: 'off', label: 'off' },
      ]),
    },
    { key: 'noValidate', label: 'No Validate', type: 'boolean', group: 'tag' },
    { key: 'name', label: 'Name', type: 'string', group: 'tag' },
  ],
  // Type/Value/Placeholder/Required/Disabled are owned by the HeroUI Props
  // section for this component; only the native-only attributes live here.
  'heroui.input-text': [
    { key: 'name', label: 'Name', type: 'string', group: 'tag' },
    { key: 'readOnly', label: 'Read Only', type: 'boolean', group: 'tag' },
    { key: 'autoComplete', label: 'Autocomplete', type: 'string', group: 'tag' },
  ],
  // Value/Placeholder/Min/Max/Step/Required/Disabled are owned by the HeroUI
  // Props section for this component; only the native-only attributes live here.
  'heroui.number-input': [
    { key: 'name', label: 'Name', type: 'string', group: 'tag' },
    { key: 'readOnly', label: 'Read Only', type: 'boolean', group: 'tag' },
  ],
};

export const HEROUI_PALETTE_PROP_FIELDS: Record<string, InspectorFieldSchema[]> = {
  ...HEROUI_PALETTE_PROP_FIELD_MAP,
};

const tw = (field: Omit<TailwindInspectorField, 'group'>): TailwindInspectorField => ({ ...field, group: 'tailwind' });

export const TAILWIND_INSPECTOR_FIELDS: TailwindInspectorField[] = [
  tw({
    key: 'twDisplay',
    label: 'Display',
    type: 'select',
    utilityPrefix: 'display',
    conflictPattern: /^(?:[a-z0-9-]+:)?(block|inline-block|inline|flex|inline-flex|grid|inline-grid|hidden|contents|table|table-row|table-cell)$/,
    options: selectOptions([
      { value: '', label: '(none)' },
      { value: 'block', label: 'block' },
      { value: 'inline-block', label: 'inline-block' },
      { value: 'inline', label: 'inline' },
      { value: 'flex', label: 'flex' },
      { value: 'inline-flex', label: 'inline-flex' },
      { value: 'grid', label: 'grid' },
      { value: 'inline-grid', label: 'inline-grid' },
      { value: 'hidden', label: 'hidden' },
    ]),
  }),
  tw({
    key: 'twPosition',
    label: 'Position',
    type: 'select',
    utilityPrefix: 'position',
    conflictPattern: /^(?:[a-z0-9-]+:)?(static|fixed|absolute|relative|sticky)$/,
    options: selectOptions([
      { value: '', label: '(none)' },
      { value: 'static', label: 'static' },
      { value: 'relative', label: 'relative' },
      { value: 'absolute', label: 'absolute' },
      { value: 'fixed', label: 'fixed' },
      { value: 'sticky', label: 'sticky' },
    ]),
  }),
  tw({
    key: 'twOverflow',
    label: 'Overflow',
    type: 'select',
    utilityPrefix: 'overflow',
    conflictPattern: /^(?:[a-z0-9-]+:)?overflow-(?:auto|hidden|clip|visible|scroll|x-auto|x-hidden|x-clip|x-visible|x-scroll|y-auto|y-hidden|y-clip|y-visible|y-scroll)$/,
    options: selectOptions([
      { value: '', label: '(none)' },
      { value: 'overflow-auto', label: 'auto' },
      { value: 'overflow-hidden', label: 'hidden' },
      { value: 'overflow-visible', label: 'visible' },
      { value: 'overflow-scroll', label: 'scroll' },
    ]),
  }),
  tw({
    key: 'twPadding',
    label: 'Padding',
    type: 'select',
    utilityPrefix: 'padding',
    conflictPattern: /^(?:[a-z0-9-]+:)?!?p(?:x|y|t|r|b|l|s|e)?-(?:0|0\.5|1|1\.5|2|2\.5|3|3\.5|4|5|6|7|8|9|10|11|12|14|16|20|24|28|32|36|40|44|48|52|56|60|64|72|80|96)$/,
    options: selectOptions([
      { value: '', label: '(none)' },
      { value: 'p-0', label: 'p-0' },
      { value: 'p-1', label: 'p-1' },
      { value: 'p-2', label: 'p-2' },
      { value: 'p-3', label: 'p-3' },
      { value: 'p-4', label: 'p-4' },
      { value: 'p-6', label: 'p-6' },
      { value: 'p-8', label: 'p-8' },
      { value: 'px-4', label: 'px-4' },
      { value: 'py-4', label: 'py-4' },
    ]),
  }),
  tw({
    key: 'twMargin',
    label: 'Margin',
    type: 'select',
    utilityPrefix: 'margin',
    conflictPattern: /^(?:[a-z0-9-]+:)?m(?:x|y|t|r|b|l|s|e)?-(?:0|0\.5|1|1\.5|2|2\.5|3|3\.5|4|5|6|7|8|9|10|11|12|14|16|20|24|28|32|36|40|44|48|52|56|60|64|72|80|96|auto)$/,
    options: selectOptions([
      { value: '', label: '(none)' },
      { value: 'm-0', label: 'm-0' },
      { value: 'm-2', label: 'm-2' },
      { value: 'm-4', label: 'm-4' },
      { value: 'mx-auto', label: 'mx-auto' },
      { value: 'my-4', label: 'my-4' },
    ]),
  }),
  tw({
    key: 'twWidth',
    label: 'Width',
    type: 'select',
    utilityPrefix: 'width',
    conflictPattern: /^(?:[a-z0-9-]+:)?(?:w|min-w|max-w)-(?:full|screen|auto|min|max|fit|\d+\/\d+|\d+(?:\.\d+)?|\[[^\]]+\])$/,
    options: selectOptions([
      { value: '', label: '(none)' },
      { value: 'w-full', label: 'w-full' },
      { value: 'w-auto', label: 'w-auto' },
      { value: 'w-1/2', label: 'w-1/2' },
      { value: 'max-w-sm', label: 'max-w-sm' },
      { value: 'max-w-md', label: 'max-w-md' },
      { value: 'max-w-lg', label: 'max-w-lg' },
      { value: 'max-w-xl', label: 'max-w-xl' },
      { value: 'max-w-5xl', label: 'max-w-5xl' },
    ]),
  }),
  tw({
    key: 'twHeight',
    label: 'Height',
    type: 'select',
    utilityPrefix: 'height',
    conflictPattern: /^(?:[a-z0-9-]+:)?!?(?:h|min-h|max-h)-(?:full|screen|auto|min|max|fit|\d+\/\d+|\d+(?:\.\d+)?|\[[^\]]+\])$/,
    options: selectOptions([
      { value: '', label: '(none)' },
      { value: 'h-auto', label: 'h-auto' },
      { value: 'h-full', label: 'h-full' },
      { value: 'h-8', label: 'h-8' },
      { value: 'min-h-24', label: 'min-h-24' },
      { value: 'max-h-64', label: 'max-h-64' },
    ]),
  }),
  tw({
    key: 'twFlexDirection',
    label: 'Flex Direction',
    type: 'select',
    utilityPrefix: 'flex-direction',
    conflictPattern: /^(?:[a-z0-9-]+:)?flex-(?:row|row-reverse|col|col-reverse)$/,
    options: selectOptions([
      { value: '', label: '(none)' },
      { value: 'flex-row', label: 'flex-row' },
      { value: 'flex-col', label: 'flex-col' },
    ]),
  }),
  tw({
    key: 'twItems',
    label: 'Align Items',
    type: 'select',
    utilityPrefix: 'items',
    conflictPattern: /^(?:[a-z0-9-]+:)?items-(?:start|end|center|baseline|stretch)$/,
    options: selectOptions([
      { value: '', label: '(none)' },
      { value: 'items-start', label: 'items-start' },
      { value: 'items-center', label: 'items-center' },
      { value: 'items-end', label: 'items-end' },
      { value: 'items-stretch', label: 'items-stretch' },
    ]),
  }),
  tw({
    key: 'twJustify',
    label: 'Justify Content',
    type: 'select',
    utilityPrefix: 'justify',
    conflictPattern: /^(?:[a-z0-9-]+:)?justify-(?:start|end|center|between|around|evenly|normal|stretch)$/,
    options: selectOptions([
      { value: '', label: '(none)' },
      { value: 'justify-start', label: 'justify-start' },
      { value: 'justify-center', label: 'justify-center' },
      { value: 'justify-end', label: 'justify-end' },
      { value: 'justify-between', label: 'justify-between' },
    ]),
  }),
  tw({
    key: 'twGap',
    label: 'Gap',
    type: 'select',
    utilityPrefix: 'gap',
    conflictPattern: /^(?:[a-z0-9-]+:)?gap-(?:x|y)?(?:0|0\.5|1|1\.5|2|2\.5|3|3\.5|4|5|6|7|8|9|10|11|12|14|16|20|24|28|32|36|40|44|48|52|56|60|64|72|80|96)$/,
    options: selectOptions([
      { value: '', label: '(none)' },
      { value: 'gap-1', label: 'gap-1' },
      { value: 'gap-2', label: 'gap-2' },
      { value: 'gap-3', label: 'gap-3' },
      { value: 'gap-4', label: 'gap-4' },
      { value: 'gap-6', label: 'gap-6' },
    ]),
  }),
  tw({
    key: 'twGridCols',
    label: 'Grid Columns',
    type: 'select',
    utilityPrefix: 'grid-cols',
    conflictPattern: /^(?:[a-z0-9-]+:)?grid-cols-(?:1|2|3|4|5|6|7|8|9|10|11|12|none|subgrid)$/,
    options: selectOptions([
      { value: '', label: '(none)' },
      ...Array.from({ length: 12 }, (_, index) => {
        const value = `grid-cols-${index + 1}`;
        return { value, label: value };
      }),
    ]),
  }),
  tw({
    key: 'twTextSize',
    label: 'Text Size',
    type: 'select',
    utilityPrefix: 'text-size',
    conflictPattern: /^(?:[a-z0-9-]+:)?!?text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/,
    options: selectOptions([
      { value: '', label: '(none)' },
      { value: 'text-xs', label: 'text-xs' },
      { value: 'text-sm', label: 'text-sm' },
      { value: 'text-base', label: 'text-base' },
      { value: 'text-lg', label: 'text-lg' },
      { value: 'text-xl', label: 'text-xl' },
      { value: 'text-2xl', label: 'text-2xl' },
    ]),
  }),
  tw({
    key: 'twFontWeight',
    label: 'Font Weight',
    type: 'select',
    utilityPrefix: 'font-weight',
    conflictPattern: /^(?:[a-z0-9-]+:)?font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/,
    options: selectOptions([
      { value: '', label: '(none)' },
      { value: 'font-normal', label: 'font-normal' },
      { value: 'font-medium', label: 'font-medium' },
      { value: 'font-semibold', label: 'font-semibold' },
      { value: 'font-bold', label: 'font-bold' },
    ]),
  }),
  tw({
    key: 'twTextAlign',
    label: 'Text Align',
    type: 'select',
    utilityPrefix: 'text-align',
    conflictPattern: /^(?:[a-z0-9-]+:)?text-(?:left|center|right|justify|start|end)$/,
    options: selectOptions([
      { value: '', label: '(none)' },
      { value: 'text-left', label: 'text-left' },
      { value: 'text-center', label: 'text-center' },
      { value: 'text-right', label: 'text-right' },
      { value: 'text-justify', label: 'text-justify' },
    ]),
  }),
  tw({
    key: 'twRounded',
    label: 'Border Radius',
    type: 'select',
    utilityPrefix: 'rounded',
    conflictPattern: /^(?:[a-z0-9-]+:)?!?rounded(?:-(?:none|sm|md|lg|xl|2xl|3xl|full|t|r|b|l|s|e|tl|tr|br|bl|ss|se|ee|es))?$/,
    options: selectOptions([
      { value: '', label: '(none)' },
      { value: 'rounded-none', label: 'rounded-none' },
      { value: 'rounded-sm', label: 'rounded-sm' },
      { value: 'rounded-md', label: 'rounded-md' },
      { value: 'rounded-lg', label: 'rounded-lg' },
      { value: 'rounded-xl', label: 'rounded-xl' },
      { value: 'rounded-full', label: 'rounded-full' },
    ]),
  }),
  tw({
    key: 'twShadow',
    label: 'Shadow',
    type: 'select',
    utilityPrefix: 'shadow',
    conflictPattern: /^(?:[a-z0-9-]+:)?shadow(?:-(?:sm|md|lg|xl|2xl|inner|none))?$/,
    options: selectOptions([
      { value: '', label: '(none)' },
      { value: 'shadow-sm', label: 'shadow-sm' },
      { value: 'shadow-md', label: 'shadow-md' },
      { value: 'shadow-lg', label: 'shadow-lg' },
      { value: 'shadow-xl', label: 'shadow-xl' },
      { value: 'shadow-2xl', label: 'shadow-2xl' },
    ]),
  }),
  tw({
    key: 'twOpacity',
    label: 'Opacity',
    type: 'select',
    utilityPrefix: 'opacity',
    conflictPattern: /^(?:[a-z0-9-]+:)?opacity-(?:0|5|10|20|25|30|40|50|60|70|75|80|90|95|100)$/,
    options: selectOptions([
      { value: '', label: '(none)' },
      { value: 'opacity-0', label: 'opacity-0' },
      { value: 'opacity-50', label: 'opacity-50' },
      { value: 'opacity-75', label: 'opacity-75' },
      { value: 'opacity-100', label: 'opacity-100' },
    ]),
  }),
];

const tailwindFieldByKey = new Map<string, TailwindInspectorField>(
  TAILWIND_INSPECTOR_FIELDS.map((field) => [field.key, field]),
);

/** Palette-specific Tailwind utility subsets (full list used when not configured). */
export const PALETTE_TAILWIND_FIELD_KEYS: Record<string, readonly string[]> = {
  ...PALETTE_TAILWIND_FIELD_KEY_MAP,
};

const LAYOUT_GRID_EXTRA_INSPECTOR_FIELDS: Record<string, InspectorFieldSchema> = {
  layoutGridDirection: {
    key: 'layoutGridDirection',
    label: 'Direction',
    type: 'select',
    group: 'tailwind',
    options: selectOptions([
      { value: 'row', label: 'Row (side by side)' },
      { value: 'column', label: 'Column (stacked)' },
    ]),
  },
  layoutGridColumnWidths: {
    key: 'layoutGridColumnWidths',
    label: 'Column Sizes',
    type: 'layout-grid-column-widths',
    group: 'tailwind',
  },
};

export const resolveTailwindInspectorFields = (paletteItemId?: string): InspectorFieldSchema[] => {
  let fields: InspectorFieldSchema[];
  if (paletteItemId && PALETTE_TAILWIND_FIELD_KEYS[paletteItemId]) {
    fields = PALETTE_TAILWIND_FIELD_KEYS[paletteItemId]
      .map((key) => tailwindFieldByKey.get(key) ?? LAYOUT_GRID_EXTRA_INSPECTOR_FIELDS[key])
      .filter((field): field is InspectorFieldSchema => Boolean(field));
  } else {
    fields = [...TAILWIND_INSPECTOR_FIELDS];
  }

  // T1-11e: container Layout/Grid controls only when the palette item has `container`.
  const paletteItem = paletteItemId ? getPaletteItemById(paletteItemId) : undefined;
  if (!paletteItemHasCapability(paletteItem, 'container')) {
    fields = fields.filter((field) => !INSPECTOR_CONTAINER_LAYOUT_FIELD_KEYS.has(field.key));
  }

  return fields;
};

/** Legacy group labels (source taxonomy inside schemas). */
export const INSPECTOR_SECTION_TITLES: Record<InspectorFieldGroup, string> = {
  content: 'Content',
  global: 'Global Attributes',
  tag: 'Tag Attributes',
  tailwind: 'Tailwind Utilities',
  heroui: 'HeroUI Props',
  'html-extra': 'Extra HTML Attributes',
};

export const INSPECTOR_TIER_TITLES: Record<InspectorTierId, string> = {
  content: 'Content',
  style: 'Style',
  advanced: 'Advanced',
};

/** Content + Style stay visible; Advanced is behind a text link. */
export const INSPECTOR_DEFAULT_OPEN_SECTIONS = new Set<InspectorTierId>(['content', 'style']);

/**
 * First-use Content tier keys (spec 03 §1) — pulled out of HeroUI/Tag flat lists.
 * Remaining non-style fields land in Advanced.
 */
export const INSPECTOR_CONTENT_TIER_KEYS = new Set<string>([
  'text',
  'label',
  'hint',
  'placeholder',
  'value',
  'src',
  'href',
  'items',
  'textContentMode',
  'translationKey',
  'alt',
  '_listItems',
  'type',
  'dataPath',
  'itemAlias',
  'indexAlias',
  'actionLabel',
  'showLogo',
  'showBreadcrumb',
  'showActions',
  // Phase 3 — grid configuration lives in Content (not global Advanced catch-all).
  'columns',
  'toolbarConfig',
  'sortOptions',
  'gridAggregationConfig',
]);

export const isContentTierField = (field: InspectorFieldSchema): boolean => {
  if (INSPECTOR_CONTENT_TIER_KEYS.has(field.key)) {
    return true;
  }

  // Card / modal / accordion titles living in the content group stay in Content.
  // Helper `description` on form inputs (heroui) stays Advanced.
  if (field.group === 'content') {
    return true;
  }

  if (field.key === 'title' && field.group === 'heroui') {
    return true;
  }

  // p-103: Base Components production options are the component Properties.
  // Do not bury listBody / grid / paging in Advanced — they must match the lab.
  if (field.catalogOptionId) {
    return true;
  }

  return false;
};

export const isStyleTierField = (field: InspectorFieldSchema): boolean =>
  field.group === 'tailwind'
  || field.key === 'className'
  || field.key === 'style'
  || field.key === 'surfaceToken';

/** Stable Style-section order: visual utilities → structural → surface → className/style pair. */
const STYLE_FIELD_ORDER: readonly string[] = [
  'twDisplay',
  'twPosition',
  'twOverflow',
  'twPadding',
  'twMargin',
  'twWidth',
  'twHeight',
  'twFlexDirection',
  'twItems',
  'twJustify',
  'twGap',
  'twGridCols',
  'twTextSize',
  'twFontWeight',
  'twTextAlign',
  'twRounded',
  'twShadow',
  'twOpacity',
  'layoutGridDirection',
  'layoutGridColumnWidths',
  'surfaceToken',
  'className',
  'style',
];

const sortStyleTierFields = (fields: InspectorFieldSchema[]): InspectorFieldSchema[] => {
  const rank = new Map(STYLE_FIELD_ORDER.map((key, index) => [key, index]));
  return [...fields].sort((left, right) => {
    const leftRank = rank.get(left.key) ?? STYLE_FIELD_ORDER.length;
    const rightRank = rank.get(right.key) ?? STYLE_FIELD_ORDER.length;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.key.localeCompare(right.key);
  });
};

export const isInspectorSectionOpenByDefault = (sectionId: InspectorTierId): boolean =>
  INSPECTOR_DEFAULT_OPEN_SECTIONS.has(sectionId);

/**
 * Keys that represent the same setting under different names.
 * Compiled catalog fields yield to an existing hand-written field with the same key or alias
 * so lab composition toggles (e.g. showHint → `hint`) do not steal Designer content props.
 */
const INSPECTOR_SEMANTIC_FIELD_ALIASES: Record<string, string> = {
  disabled: 'disabled',
  isDisabled: 'disabled',
  required: 'required',
  isRequired: 'required',
  readOnly: 'readonly',
  isReadOnly: 'readonly',
  inputType: 'type',
  type: 'type',
};

const inspectorFieldSemantic = (key: string): string =>
  INSPECTOR_SEMANTIC_FIELD_ALIASES[key] ?? key;

const resolveHeroUiInspectorFields = (
  paletteItemId: string | undefined,
): InspectorFieldSchema[] => {
  if (!paletteItemId) {
    return [];
  }

  const compiledFields = compileInspectorForPaletteItem(paletteItemId) ?? [];
  const handWritten = HEROUI_PALETTE_PROP_FIELDS[paletteItemId] ?? [];

  if (compiledFields.length === 0) {
    return handWritten;
  }

  const catalogOwnsSpec = compiledFields.some((field) => field.propPath.startsWith('spec.'));
  const componentId = getCompileComponentId(paletteItemId);
  const catalogIsSource = catalogOwnsSpec
    || handWritten.length === 0
    || componentId === 'crud-set'
    || componentId === 'edit-view';

  // One catalog section can back several palette items (choice-fields →
  // checkbox-group + select). Dumping every section option onto every item
  // reintroduces dead HeroUI props. Living samples with one identity
  // (CRUD Set, Edit / View) and items with no Designer map read the catalog.
  if (!catalogIsSource) {
    return handWritten;
  }

  const claimedKeys = new Set(compiledFields.map((field) => field.key));
  const claimedSemantics = new Set(compiledFields.map((field) => inspectorFieldSemantic(field.key)));
  const leftover = handWritten.filter((field) => {
    if (catalogOwnsSpec && field.key === 'spec' && field.jsonEditor) {
      return false;
    }
    if (claimedKeys.has(field.key) || claimedSemantics.has(inspectorFieldSemantic(field.key))) {
      return false;
    }
    return true;
  });
  return [...compiledFields, ...leftover];
};

export const resolveDesignerPaletteItemId = (node: DesignerNode): string | undefined => {
  const stored = node.props[DESIGNER_PALETTE_ITEM_ID_PROP];
  if (typeof stored === 'string' && stored.length > 0) {
    return stored;
  }

  return undefined;
};

export const resolveInspectorFieldSections = (node: DesignerNode): InspectorFieldSection[] => {
  if (node.type === 'root') {
    return [];
  }

  const paletteItemId = resolveDesignerPaletteItemId(node);
  const sections = new Map<InspectorFieldGroup, InspectorFieldSchema[]>();

  const pushFields = (group: InspectorFieldGroup, fields: InspectorFieldSchema[]) => {
    if (fields.length === 0) {
      return;
    }
    const current = sections.get(group) ?? [];
    const seen = new Set(current.map((field) => field.key));
    const merged = [...current];
    for (const field of fields) {
      if (seen.has(field.key)) {
        continue;
      }
      seen.add(field.key);
      merged.push(field);
    }
    sections.set(group, merged);
  };

  pushFields('content', NODE_CONTENT_FIELDS[node.type] ?? []);
  if (paletteItemId && PALETTE_CONTENT_FIELDS[paletteItemId]) {
    pushFields('content', PALETTE_CONTENT_FIELDS[paletteItemId]);
  }

  const isShellNode = paletteItemId?.startsWith('shell.chrome.');
  const paletteItem = paletteItemId ? getPaletteItemById(paletteItemId) : undefined;
  const isLayoutContainer = paletteItemHasCapability(paletteItem, 'container')
    || ((node.type === 'container' || node.type === 'section') && !paletteItem);
  if (isShellNode || isLayoutContainer) {
    pushFields('global', [SURFACE_TOKEN_FIELD, ...GLOBAL_INSPECTOR_FIELDS]);
  } else {
    pushFields('global', GLOBAL_INSPECTOR_FIELDS);
  }

  pushFields('tag', NODE_TAG_FIELDS[node.type] ?? []);

  if (paletteItemId && PALETTE_TAG_FIELDS[paletteItemId]) {
    pushFields('tag', PALETTE_TAG_FIELDS[paletteItemId]);
  }

  if (paletteItemId && PALETTE_TAG_EXTENSION_FIELDS[paletteItemId]) {
    pushFields('tag', PALETTE_TAG_EXTENSION_FIELDS[paletteItemId]);
  }

  pushFields('heroui', resolveHeroUiInspectorFields(paletteItemId));

  pushFields('tailwind', resolveTailwindInspectorFields(paletteItemId));
  pushFields('html-extra', HTML_EXTRA_ATTR_FIELDS);

  // Cross-section de-duplication: every prop key must surface in exactly one
  // source group. Generic global HTML attributes yield to the more specific
  // contextual groups so the same setting never appears twice.
  const ownershipPriority: InspectorFieldGroup[] = ['content', 'tag', 'heroui', 'tailwind', 'html-extra', 'global'];
  const claimedKeys = new Set<string>();
  for (const group of ownershipPriority) {
    const groupFields = sections.get(group);
    if (!groupFields || groupFields.length === 0) {
      continue;
    }
    const deduped = groupFields.filter((field) => {
      if (claimedKeys.has(field.key)) {
        return false;
      }
      claimedKeys.add(field.key);
      return true;
    });
    sections.set(group, deduped);
  }

  // Flatten source groups, then rematerialize into Progressive Disclosure tiers
  // (Content / Style / Advanced) per inspector redesign spec §1.
  const sourceOrder: InspectorFieldGroup[] = ['content', 'global', 'tag', 'heroui', 'tailwind', 'html-extra'];
  const flatFields: InspectorFieldSchema[] = [];
  for (const group of sourceOrder) {
    flatFields.push(...(sections.get(group) ?? []));
  }

  const tiers = new Map<InspectorTierId, InspectorFieldSchema[]>([
    ['content', []],
    ['style', []],
    ['advanced', []],
  ]);

  for (const field of flatFields) {
    if (isContentTierField(field)) {
      tiers.get('content')!.push(field);
    } else if (isStyleTierField(field)) {
      tiers.get('style')!.push(field);
    } else {
      tiers.get('advanced')!.push(field);
    }
  }

  const tierOrder: InspectorTierId[] = ['content', 'style', 'advanced'];

  return tierOrder
    .map((tier) => ({
      id: tier,
      title: INSPECTOR_TIER_TITLES[tier],
      fields: tier === 'style'
        ? sortStyleTierFields(tiers.get(tier) ?? [])
        : (tiers.get(tier) ?? []),
    }))
    .filter((section) => section.fields.length > 0);
};

/** Count fields in default-open accordion sections (Content + Style). */
export const countDefaultVisibleInspectorFields = (node: DesignerNode): number => {
  const resolved = resolveInspectorFieldSections(node);
  let count = 0;
  for (const section of resolved) {
    if (!isInspectorSectionOpenByDefault(section.id)) {
      continue;
    }
    count += section.fields.length;
  }
  return count;
};

export const resolvePaletteItemForNode = (node: DesignerNode) => {
  const paletteItemId = resolveDesignerPaletteItemId(node);
  if (paletteItemId) {
    return getPaletteItemById(paletteItemId);
  }

  return undefined;
};

export const NODE_ALIGN_LAYOUT_FIELD: InspectorFieldSchema = {
  key: 'align',
  label: 'Align',
  type: 'select',
  group: 'global',
  options: selectOptions([
    { value: 'start', label: 'Start' },
    { value: 'center', label: 'Center' },
    { value: 'end', label: 'End' },
    { value: 'stretch', label: 'Stretch' },
  ]),
};

export const SURFACE_TOKEN_FIELD: InspectorFieldSchema = {
  key: 'surfaceToken',
  label: 'Surface Token',
  type: 'select',
  group: 'global',
  options: selectOptions([
    { value: '', label: '(none)' },
    { value: 'workspace', label: 'Workspace' },
    { value: 'elevated', label: 'Elevated' },
    { value: 'shell', label: 'Shell' },
    { value: 'transparent', label: 'Transparent' },
    { value: 'menu', label: 'Menu' },
    { value: 'header', label: 'Header' },
  ]),
};
