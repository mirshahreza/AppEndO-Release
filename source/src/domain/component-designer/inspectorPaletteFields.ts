import {
  DESIGNER_MASK_INPUT_KIND_OPTIONS,
  DESIGNER_MASK_INPUT_PRESET_OPTIONS,
  toDesignerMaskInputSelectOptions,
} from '../../shared/lib/designerMaskInputConfig';
import {
  DESIGNER_DATE_PICKER_BOUNDARY_VALUE_OPTIONS,
  DESIGNER_DATE_PICKER_FIRST_DAY_OPTIONS,
  DESIGNER_DATE_PICKER_GRANULARITY_OPTIONS,
  DESIGNER_DATE_PICKER_HOUR_CYCLE_OPTIONS,
  DESIGNER_DATE_PICKER_LOCALE_OPTIONS,
  DESIGNER_DATE_PICKER_PAGE_BEHAVIOR_OPTIONS,
  DESIGNER_DATE_PICKER_PLACEHOLDER_VALUE_OPTIONS,
  DESIGNER_DATE_PICKER_TIMEZONE_OPTIONS,
  DESIGNER_DATE_PICKER_VALUE_OPTIONS,
  DESIGNER_DATE_PICKER_VISIBLE_MONTHS_OPTIONS,
  toDesignerDatePickerSelectOptions,
} from '../../shared/lib/designerDatePickerConfig';

/** A single sub-field within one record of a `content-records` array (e.g. one Team Member's Name/Role/Bio). */
export type ContentRecordFieldDef = {
  key: string;
  label: string;
  /**
   * Defaults to a single-line text input. 'checkbox' persists the string "true"/"false" (the
   * shared per-record storage model is `Record<string, string>`) — real-boolean readers (e.g.
   * DesignerUniversalPricingTable's `featured`) must accept both the string and real-boolean
   * form for backward compatibility with pre-existing JSON documents.
   */
  control?: 'text' | 'textarea' | 'checkbox';
  placeholder?: string;
};

type InspectorFieldSchema = {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'option-items' | 'static-list-items' | 'data-grid-columns' | 'app-table-grid-columns' | 'app-table-grid-sort-options' | 'app-table-grid-aggregation' | 'app-table-grid-toolbar' | 'layout-grid-column-widths' | 'icon-picker' | 'content-records';
  group: 'content' | 'global' | 'tag' | 'tailwind' | 'heroui' | 'html-extra';
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
};

const selectOptions = (options: Array<{ value: string; label: string }>): InspectorFieldSchema['options'] => options;

const field = (
  key: string,
  label: string,
  type: InspectorFieldSchema['type'],
  group: InspectorFieldSchema['group'],
  extra?: Partial<InspectorFieldSchema>,
): InspectorFieldSchema => ({
  key,
  label,
  type,
  group,
  ...extra,
});

const SIZE_OPTIONS = selectOptions([
  { value: 'sm', label: 'sm' },
  { value: 'md', label: 'md' },
  { value: 'lg', label: 'lg' },
]);

const COLOR_OPTIONS = selectOptions([
  { value: 'default', label: 'default' },
  { value: 'primary', label: 'primary' },
  { value: 'secondary', label: 'secondary' },
  { value: 'success', label: 'success' },
  { value: 'warning', label: 'warning' },
  { value: 'danger', label: 'danger' },
  { value: 'accent', label: 'accent' },
]);

const VARIANT_OPTIONS = selectOptions([
  { value: 'primary', label: 'primary' },
  { value: 'secondary', label: 'secondary' },
  { value: 'tertiary', label: 'tertiary' },
  { value: 'outline', label: 'outline' },
  { value: 'ghost', label: 'ghost' },
  { value: 'danger', label: 'danger' },
  { value: 'danger-soft', label: 'danger-soft' },
]);

const LINK_TARGET_OPTIONS = selectOptions([
  { value: '', label: '(default)' },
  { value: '_self', label: '_self' },
  { value: '_blank', label: '_blank' },
]);

const INPUT_TYPE_OPTIONS = selectOptions([
  { value: 'text', label: 'text' },
  { value: 'email', label: 'email' },
  { value: 'password', label: 'password' },
  { value: 'search', label: 'search' },
  { value: 'tel', label: 'tel' },
  { value: 'url', label: 'url' },
  { value: 'number', label: 'number' },
]);

// Bug found: this previously also offered xl/2xl/3xl/4xl/5xl — @heroui/react's modalVariants
// size variant (modal.styles.js) only actually defines xs/sm/md/lg/full ('cover' also exists but
// isn't exposed here); picking any of the removed values silently applied no size class at all
// in canvas, preview, or export.
const MODAL_SIZE_OPTIONS = selectOptions([
  { value: 'xs', label: 'xs' },
  { value: 'sm', label: 'sm' },
  { value: 'md', label: 'md' },
  { value: 'lg', label: 'lg' },
  { value: 'full', label: 'full' },
]);

const OBJECT_FIT_OPTIONS = selectOptions([
  { value: '', label: '(default)' },
  { value: 'contain', label: 'contain' },
  { value: 'cover', label: 'cover' },
  { value: 'fill', label: 'fill' },
  { value: 'none', label: 'none' },
  { value: 'scale-down', label: 'scale-down' },
]);

const INPUT_MODE_OPTIONS = selectOptions([
  { value: 'text', label: 'text' },
  { value: 'numeric', label: 'numeric' },
  { value: 'email', label: 'email' },
  { value: 'tel', label: 'tel' },
  { value: 'url', label: 'url' },
]);

const OVERLAY_BACKDROP_OPTIONS = selectOptions([
  { value: 'transparent', label: 'transparent' },
  { value: 'opaque', label: 'opaque' },
  { value: 'blur', label: 'blur' },
]);

const OVERLAY_SCROLL_BEHAVIOR_OPTIONS = selectOptions([
  { value: 'inside', label: 'inside' },
  { value: 'outside', label: 'outside' },
]);

const HEROUI_INPUT_ADORNMENT_UX_FIELDS: InspectorFieldSchema[] = [
  field('startContent', 'Start Content', 'string', 'heroui', { placeholder: 'Icon name or text' }),
  field('endContent', 'End Content', 'string', 'heroui', { placeholder: 'Icon name or text' }),
  field('description', 'Description', 'string', 'heroui', { placeholder: 'Helper text below the field' }),
  field('isClearable', 'Clearable', 'boolean', 'heroui'),
  field('autoFocus', 'Auto Focus', 'boolean', 'heroui'),
  field('inputMode', 'Input Mode', 'select', 'heroui', { options: INPUT_MODE_OPTIONS }),
];

const HEROUI_MENU_ASYNC_FIELDS: InspectorFieldSchema[] = [
  field('isLoading', 'Loading', 'boolean', 'heroui'),
  // Bug found (parity audit item 47, re-verified): a prior pass renamed this field's emitted
  // attribute from `closeOnSelect` to `shouldCloseOnSelect`, believing that was the real
  // react-stately prop name. Re-checked directly against the installed
  // `@heroui/react/node_modules/react-aria-components` (v1.19.0) type defs: `shouldCloseOnSelect`
  // is real only on `Menu`/`MenuItem` and `DatePicker`/`DateRangePicker` — `Select.d.ts`,
  // `Autocomplete.d.ts`, and `ComboBox.d.ts` have zero mentions of it, and the compiled
  // `select.js`/`autocomplete.js` bundles never reference "close" at all. HeroUI's
  // `AutocompleteRoot` spreads props straight onto react-aria-components' `Select`, which always
  // closes its popover on selection with no override. So the renamed prop was just as inert as
  // the old name on `heroui.select`/`heroui.autocomplete`/`heroui.entity-picker` — removed
  // entirely rather than left decorative, matching the `allowCustomValue` precedent (item 92).
];

const HEROUI_OVERLAY_BEHAVIOR_FIELDS: InspectorFieldSchema[] = [
  field('backdrop', 'Backdrop', 'select', 'heroui', { options: OVERLAY_BACKDROP_OPTIONS }),
  field('scrollBehavior', 'Scroll Behavior', 'select', 'heroui', { options: OVERLAY_SCROLL_BEHAVIOR_OPTIONS }),
  field('isKeyboardDismissDisabled', 'Disable Keyboard Dismiss', 'boolean', 'heroui'),
];

const HEROUI_SIZE = field('size', 'Size', 'select', 'heroui', { options: SIZE_OPTIONS });
const HEROUI_DISABLED = field('isDisabled', 'Disabled', 'boolean', 'heroui');
const HEROUI_REQUIRED = field('isRequired', 'Required', 'boolean', 'heroui');
const HEROUI_ARIA = field('ariaLabel', 'Aria Label', 'string', 'heroui');

const HEROUI_INPUT_VALIDATION_FIELDS: InspectorFieldSchema[] = [
  field('isInvalid', 'Invalid', 'boolean', 'heroui'),
  field('errorMessage', 'Error Message', 'string', 'heroui'),
  field('pattern', 'Pattern', 'string', 'heroui', { placeholder: '^[A-Za-z]+$' }),
  field('maxLength', 'Max Length', 'number', 'heroui'),
  field('minLength', 'Min Length', 'number', 'heroui'),
  field('validationRule', 'Validation Rule', 'string', 'heroui', { placeholder: 'value == data.password' }),
  field('validationErrorMessage', 'Validation Error Message', 'string', 'heroui'),
];

const PAGE_GUIDE_HINT_FIELD = field('hint', 'Page Guide Hint', 'string', 'heroui', {
  placeholder: 'Plain-language sentence the page guide reads',
});

const HEROUI_INPUT_FIELDS: InspectorFieldSchema[] = [
  field('label', 'Label', 'string', 'heroui'),
  PAGE_GUIDE_HINT_FIELD,
  field('aiAssist', 'AI Assist', 'select', 'heroui', {
    options: [
      { value: '', label: 'Default (on)' },
      { value: 'true', label: 'Text assist' },
      { value: 'voice', label: 'Voice (published)' },
      { value: 'false', label: 'Off' },
    ],
  }),
  field('placeholder', 'Placeholder', 'string', 'heroui'),
  field('value', 'Value', 'string', 'heroui'),
  field('type', 'Type', 'select', 'heroui', { options: INPUT_TYPE_OPTIONS }),
  ...HEROUI_INPUT_ADORNMENT_UX_FIELDS,
  HEROUI_REQUIRED,
  HEROUI_DISABLED,
  HEROUI_SIZE,
  ...HEROUI_INPUT_VALIDATION_FIELDS,
];

const HEROUI_NUMBER_INPUT_FIELDS: InspectorFieldSchema[] = [
  field('label', 'Label', 'string', 'heroui'),
  PAGE_GUIDE_HINT_FIELD,
  field('placeholder', 'Placeholder', 'string', 'heroui'),
  field('value', 'Value', 'string', 'heroui'),
  field('min', 'Min', 'string', 'heroui'),
  field('max', 'Max', 'string', 'heroui'),
  field('step', 'Step', 'string', 'heroui'),
  ...HEROUI_INPUT_ADORNMENT_UX_FIELDS,
  HEROUI_REQUIRED,
  HEROUI_DISABLED,
  HEROUI_SIZE,
  ...HEROUI_INPUT_VALIDATION_FIELDS,
];

const HEROUI_TEXTAREA_FIELDS: InspectorFieldSchema[] = [
  field('label', 'Label', 'string', 'heroui'),
  PAGE_GUIDE_HINT_FIELD,
  field('aiAssist', 'AI Assist', 'select', 'heroui', {
    options: [
      { value: '', label: 'Default (on)' },
      { value: 'true', label: 'Text assist' },
      { value: 'voice', label: 'Voice (published)' },
      { value: 'false', label: 'Off' },
    ],
  }),
  field('semanticRubricKind', 'Semantic rubric', 'select', 'heroui', {
    options: [
      { value: '', label: 'Off' },
      { value: 'static', label: 'Static text' },
      { value: 'cultureKey', label: 'Culture key' },
    ],
  }),
  field('semanticRubricStatic', 'Semantic rubric text', 'string', 'heroui', {
    placeholder: 'LLM validation instructions when rubric is static',
  }),
  field('semanticRubricCultureKey', 'Semantic rubric culture key', 'string', 'heroui', {
    placeholder: 'Culture key resolving to rubric text',
  }),
  field('semanticUserGuidance', 'Semantic user guidance', 'string', 'heroui', {
    placeholder: 'Banner shown above the field (optional)',
  }),
  field('semanticReasonsLanguage', 'Semantic reasons language', 'string', 'heroui', {
    placeholder: 'ar (default) · BCP-47 hint for failure reasons',
  }),
  field('placeholder', 'Placeholder', 'string', 'heroui'),
  field('value', 'Value', 'string', 'heroui'),
  field('minRows', 'Min Rows', 'number', 'heroui'),
  field('maxRows', 'Max Rows', 'number', 'heroui'),
  ...HEROUI_INPUT_ADORNMENT_UX_FIELDS,
  HEROUI_REQUIRED,
  HEROUI_DISABLED,
  HEROUI_SIZE,
  ...HEROUI_INPUT_VALIDATION_FIELDS,
];

const HEROUI_OPTION_ITEMS_FIELD = field('items', 'Options', 'option-items', 'heroui');

const HEROUI_SELECT_FIELDS: InspectorFieldSchema[] = [
  field('label', 'Label', 'string', 'heroui'),
  PAGE_GUIDE_HINT_FIELD,
  field('placeholder', 'Placeholder', 'string', 'heroui'),
  HEROUI_OPTION_ITEMS_FIELD,
  field('selectedKeys', 'Selected Keys', 'string', 'heroui', { placeholder: 'key1,key2' }),
  ...HEROUI_MENU_ASYNC_FIELDS,
  HEROUI_DISABLED,
  HEROUI_REQUIRED,
  HEROUI_SIZE,
  ...HEROUI_INPUT_VALIDATION_FIELDS,
];

const HEROUI_AUTOCOMPLETE_FIELDS: InspectorFieldSchema[] = [
  field('label', 'Label', 'string', 'heroui'),
  PAGE_GUIDE_HINT_FIELD,
  field('placeholder', 'Placeholder', 'string', 'heroui'),
  HEROUI_OPTION_ITEMS_FIELD,
  ...HEROUI_MENU_ASYNC_FIELDS,
  // Bug found (parity audit item 92): `allowCustomValue` removed — HeroUI Autocomplete is a
  // Select wrapper (not ComboBox); typed custom values never worked in any path.
  HEROUI_DISABLED,
  HEROUI_SIZE,
  ...HEROUI_INPUT_VALIDATION_FIELDS,
];

const HEROUI_LISTBOX_FIELDS: InspectorFieldSchema[] = [
  HEROUI_OPTION_ITEMS_FIELD,
  field('selectedKeys', 'Selected Keys', 'string', 'heroui', { placeholder: 'key1,key2' }),
  HEROUI_DISABLED,
  // Bug found (parity audit item 25): "Size" removed — @heroui/react's real ListBox
  // (`listboxVariants` in @heroui/styles) defines only a `variant` (default/danger) variant, no
  // `size` at all. Never read in the live canvas/preview (DesignerRuntimeListbox) either — fully
  // inert in both paths.
];

const HEROUI_DROPDOWN_FIELDS: InspectorFieldSchema[] = [
  field('label', 'Label', 'string', 'heroui'),
  HEROUI_OPTION_ITEMS_FIELD,
  field('startIcon', 'Start Icon', 'icon-picker', 'heroui'),
  field('endIcon', 'End Icon', 'icon-picker', 'heroui'),
  HEROUI_DISABLED,
];

const IFRAME_LOADING_OPTIONS = selectOptions([
  { value: 'lazy', label: 'lazy' },
  { value: 'eager', label: 'eager' },
]);

const PALETTE_IFRAME_FIELDS: InspectorFieldSchema[] = [
  field('src', 'Source URL', 'string', 'tag', { required: true }),
  field('title', 'Title', 'string', 'tag'),
  field('width', 'Width', 'string', 'tag', { placeholder: '100%' }),
  field('height', 'Height', 'string', 'tag', { placeholder: '360' }),
  field('allowFullScreen', 'Allow Full Screen', 'boolean', 'tag'),
  field('sandbox', 'Sandbox', 'string', 'tag', { placeholder: 'allow-scripts allow-same-origin' }),
  field('loading', 'Loading', 'select', 'tag', { options: IFRAME_LOADING_OPTIONS }),
];

const PALETTE_FILE_UPLOAD_FIELDS: InspectorFieldSchema[] = [
  field('accept', 'Accept', 'string', 'tag', { placeholder: 'image/*,.pdf' }),
  field('multiple', 'Multiple Files', 'boolean', 'tag'),
  field('maxFileSizeMb', 'Max File Size (MB)', 'number', 'tag', { placeholder: '5' }),
  field('maxFiles', 'Max Files', 'number', 'tag', { placeholder: '3' }),
  field('showPreview', 'Show Preview List', 'boolean', 'tag'),
  field('dragDropZone', 'Enable Drag & Drop', 'boolean', 'tag'),
  field('uploadDestination', 'Upload Destination', 'string', 'tag', {
    placeholder: '/api/packages/builder/workspace-assets/upload',
  }),
  field('invalidTypeMessage', 'Invalid Type Message', 'string', 'tag', {
    placeholder: 'Selected file type is not allowed for this upload destination.',
  }),
  field('invalidSizeMessage', 'Invalid Size Message', 'string', 'tag', {
    placeholder: 'Selected file exceeds the allowed size limit.',
  }),
  field('invalidCountMessage', 'Invalid Count Message', 'string', 'tag', {
    placeholder: 'Too many files were selected.',
  }),
];

const HEROUI_TABLE_FIELDS: InspectorFieldSchema[] = [
  HEROUI_SIZE,
  field('selectionMode', 'Selection Mode', 'select', 'heroui', {
    options: selectOptions([
      { value: 'none', label: 'none' },
      { value: 'single', label: 'single' },
      { value: 'multiple', label: 'multiple' },
    ]),
  }),
  field('selectedKeys', 'Selected Keys', 'string', 'heroui', { placeholder: 'row-1,row-2' }),
  field('isStriped', 'Striped Rows', 'boolean', 'heroui'),
  field('isHeaderSticky', 'Sticky Header', 'boolean', 'heroui'),
  field('isLoading', 'Loading', 'boolean', 'heroui'),
  field('emptyContent', 'Empty Content', 'string', 'heroui', { placeholder: 'No records found' }),
  field('errorContent', 'Error Content', 'string', 'heroui', { placeholder: 'Could not load records' }),
];

export const PALETTE_IMAGE_FIELDS: InspectorFieldSchema[] = [
  field('objectFit', 'Object Fit', 'select', 'tag', { options: OBJECT_FIT_OPTIONS }),
  field('fallbackSrc', 'Fallback Source', 'string', 'tag'),
];

export const PALETTE_CONTENT_FIELDS: Record<string, InspectorFieldSchema[]> = {
  'tailwind.badge-pill': [field('text', 'Text', 'string', 'content', { required: true })],
  'tailwind.card': [
    field('title', 'Title', 'string', 'content'),
    field('description', 'Description', 'string', 'content'),
  ],
  'tailwind.card-glass': [
    field('title', 'Title', 'string', 'content'),
    field('description', 'Description', 'string', 'content'),
    field('imageSrc', 'Image Source', 'string', 'content'),
  ],
  'tailwind.stat-block': [
    field('label', 'Label', 'string', 'content'),
    field('value', 'Value', 'string', 'content'),
    field('trend', 'Trend', 'string', 'content'),
    field('trendDirection', 'Trend Direction', 'select', 'content', {
      options: selectOptions([
        { value: 'up', label: 'Up' },
        { value: 'down', label: 'Down' },
      ]),
    }),
  ],
  'tailwind.pricing': [
    field('planName', 'Plan Name', 'string', 'content'),
    field('price', 'Price', 'string', 'content'),
    field('billingPeriod', 'Billing Period', 'string', 'content', { placeholder: '/mo' }),
    field('features', 'Features (comma-separated)', 'string', 'content'),
    field('isHighlighted', 'Highlighted', 'boolean', 'content'),
    field('ctaLabel', 'CTA Label', 'string', 'content'),
  ],
  'tailwind.alert': [
    field('title', 'Title', 'string', 'content'),
    field('message', 'Message', 'string', 'content'),
    field('variant', 'Variant', 'select', 'content', {
      options: selectOptions([
        { value: 'info', label: 'Info' },
        { value: 'success', label: 'Success' },
        { value: 'warning', label: 'Warning' },
        { value: 'danger', label: 'Danger' },
      ]),
    }),
    field('dismissible', 'Dismissible', 'boolean', 'content'),
  ],
  'tailwind.hero': [
    field('heading', 'Heading', 'string', 'content'),
    field('subheading', 'Subheading', 'string', 'content'),
    field('primaryCta', 'Primary CTA', 'string', 'content'),
    field('secondaryCta', 'Secondary CTA', 'string', 'content'),
    field('backgroundImage', 'Background Image URL', 'string', 'content'),
  ],
  'tailwind.image-overlay': [
    field('imageSrc', 'Image Source', 'string', 'content'),
    field('overlayText', 'Overlay Text', 'string', 'content'),
    field('overlayOpacity', 'Overlay Opacity', 'number', 'content'),
  ],
  'heroui.button-solid': [field('text', 'Label', 'string', 'content', { required: true })],
  'heroui.button-outline': [field('text', 'Label', 'string', 'content', { required: true })],
  'heroui.link': [field('text', 'Label', 'string', 'content', { required: true })],
  'heroui.chip': [field('text', 'Label', 'string', 'content', { required: true })],
  // Bug found: the trigger's visible label (`text`) and the tooltip bubble's own message were
  // the same prop — the renderer just echoed `text` into both places, so there was never an
  // actual way to configure "what the tooltip says" separately from "what the trigger shows".
  // `tooltipText` is the real hover message; DesignerRuntimeTooltipTrigger falls back to `text`
  // for documents saved before this field existed.
  'heroui.tooltip-trigger': [
    field('text', 'Trigger Label', 'string', 'content', { required: true }),
    field('tooltipText', 'Tooltip Text', 'string', 'content', { placeholder: 'Shown when hovering the trigger' }),
  ],
  'heroui.typography-lead': [field('text', 'Text', 'string', 'content', { required: true })],
  'heroui.card': [
    field('title', 'Title', 'string', 'content'),
    field('description', 'Description', 'string', 'content'),
  ],
  'heroui.accordion-item': [field('title', 'Title', 'string', 'content')],
  'heroui.modal': [field('title', 'Title', 'string', 'content')],
  'heroui.alert-dialog': [field('title', 'Title', 'string', 'content')],
  'heroui.drawer': [field('title', 'Title', 'string', 'content')],
  'heroui.avatar': [field('text', 'Fallback', 'string', 'content')],
  // Bug found: the runtime (renderDesignerDocumentPreview) and codegen (tsxNodeRenderer) both
  // render node.props.label as the <fieldset><legend> text, and a dedicated test proved it works
  // when set programmatically — but no Inspector field ever exposed `label` for this item, so a
  // real user could never set a Field Container's legend text through the Designer UI at all.
  'heroui.field-container': [field('label', 'Legend / Label', 'string', 'content')],
  'html.list': [field('_listItems', 'List Items', 'static-list-items', 'content')],
  'logic.repeater': [
    field('dataPath', 'Data Path', 'string', 'content', { required: true, placeholder: 'products or store.filters.items' }),
    field('itemAlias', 'Item Alias', 'string', 'content', { placeholder: 'item (JS identifier)' }),
    field('indexAlias', 'Index Alias', 'string', 'content', { placeholder: 'index (JS identifier)' }),
  ],
  'platform.slot.core.shell.header': [
    field('showLogo', 'Show Logo', 'boolean', 'content'),
    field('showBreadcrumb', 'Show Breadcrumb', 'boolean', 'content'),
    field('showActions', 'Show Actions', 'boolean', 'content'),
  ],
};

const HEADING_LEVEL_OPTIONS = selectOptions([
  { value: 'h1', label: 'h1' },
  { value: 'h2', label: 'h2' },
  { value: 'h3', label: 'h3' },
  { value: 'h4', label: 'h4' },
  { value: 'h5', label: 'h5' },
  { value: 'h6', label: 'h6' },
]);

export const PALETTE_TAG_EXTENSION_FIELDS: Record<string, InspectorFieldSchema[]> = {
  'html.heading': [field('level', 'Level', 'select', 'tag', { options: HEADING_LEVEL_OPTIONS })],
  'html.image': PALETTE_IMAGE_FIELDS,
  'html.iframe': PALETTE_IFRAME_FIELDS,
  'html.file-upload': PALETTE_FILE_UPLOAD_FIELDS,
  'heroui.link': [
    field('href', 'Href', 'string', 'tag', { required: true }),
    field('target', 'Target', 'select', 'tag', { options: LINK_TARGET_OPTIONS }),
    field('rel', 'Rel', 'string', 'tag'),
  ],
  'heroui.button-solid': [
    field('href', 'Href', 'string', 'tag'),
    field('target', 'Target', 'select', 'tag', { options: LINK_TARGET_OPTIONS }),
  ],
  'heroui.button-outline': [
    field('href', 'Href', 'string', 'tag'),
    field('target', 'Target', 'select', 'tag', { options: LINK_TARGET_OPTIONS }),
  ],
  'heroui.tooltip-trigger': [
    field('href', 'Href', 'string', 'tag'),
    field('target', 'Target', 'select', 'tag', { options: LINK_TARGET_OPTIONS }),
  ],
  // Bug found (parity audit item 21): "Fallback Source" removed — @heroui/react's real
  // `Avatar.Image` (AvatarImageProps) doesn't declare any `fallbackSrc` prop at all, so it was
  // always fully inert in both the canvas/live preview and the exported app. The real fallback
  // UI is `Avatar.Fallback`, already driven by the separate, working `text` field.
  'heroui.avatar': [
    field('src', 'Image Source', 'string', 'tag'),
    field('alt', 'Alt Text', 'string', 'tag'),
  ],
};

const HEROUI_BUTTON_FIELDS: InspectorFieldSchema[] = [
  field('variant', 'Variant', 'select', 'heroui', { options: VARIANT_OPTIONS }),
  HEROUI_SIZE,
  field('startIcon', 'Start Icon', 'icon-picker', 'heroui'),
  field('endIcon', 'End Icon', 'icon-picker', 'heroui'),
  field('isIconOnly', 'Icon Only', 'boolean', 'heroui'),
  HEROUI_DISABLED,
  field('isLoading', 'Loading', 'boolean', 'heroui'),
];

const HEROUI_DATA_GRID_FIELDS: InspectorFieldSchema[] = [
  field('columns', 'Columns', 'data-grid-columns', 'heroui'),
  field('gridQueryMode', 'Query Mode', 'select', 'heroui', {
    options: selectOptions([
      { value: 'client', label: 'client' },
      { value: 'server', label: 'server' },
    ]),
  }),
  field('pageSize', 'Page Size', 'number', 'heroui'),
  field('page', 'Page', 'number', 'heroui'),
  field('total', 'Total Records', 'number', 'heroui'),
  field('selectionMode', 'Selection Mode', 'select', 'heroui', {
    options: selectOptions([
      { value: 'none', label: 'none' },
      { value: 'single', label: 'single' },
      { value: 'multiple', label: 'multiple' },
    ]),
  }),
  field('selectionStorePath', 'Selection Store Path', 'string', 'heroui', {
    placeholder: 'gridSelection.selectedKeys',
  }),
  field('toolbarConfig', 'Page Toolbar / Bulk Actions', 'app-table-grid-toolbar', 'heroui'),
  ...HEROUI_TABLE_FIELDS.filter((item) => !['selectionMode', 'selectedKeys'].includes(item.key)),
];

const HEROUI_APP_TABLE_GRID_FIELDS: InspectorFieldSchema[] = [
  field('columns', 'Columns', 'app-table-grid-columns', 'heroui'),
  field('gridQueryMode', 'Query Mode', 'select', 'heroui', {
    options: selectOptions([
      { value: 'client', label: 'client' },
      { value: 'server', label: 'server' },
    ]),
  }),
  field('presentation', 'Presentation', 'select', 'heroui', {
    options: selectOptions([
      { value: 'auto', label: 'auto (responsive)' },
      { value: 'table', label: 'table (keep grid)' },
      { value: 'cards', label: 'cards' },
      { value: 'table-scroll', label: 'table scroll' },
    ]),
  }),
  field('cardBelow', 'Card view from', 'select', 'heroui', {
    options: selectOptions([
      { value: 'phone', label: 'phone' },
      { value: 'tablet', label: 'tablet' },
      { value: 'desktop', label: 'desktop (all sizes)' },
    ]),
  }),
  field('fillHeight', 'Height', 'select', 'heroui', {
    options: selectOptions([
      { value: 'true', label: '100%' },
      { value: 'false', label: 'content' },
    ]),
  }),
  field('chrome', 'Chrome', 'select', 'heroui', {
    options: selectOptions([
      { value: 'classic', label: 'classic (page list)' },
      { value: 'hero', label: 'hero (joined card)' },
    ]),
  }),
  field('density', 'Density', 'select', 'heroui', {
    options: selectOptions([
      { value: 'default', label: 'default' },
      { value: 'compact', label: 'compact' },
    ]),
  }),
  field('compactPhoneLayout', 'Phone Layout', 'select', 'heroui', {
    options: selectOptions([
      { value: 'inherit', label: 'inherit' },
      { value: 'keep-table', label: 'keep table' },
      { value: 'table-scroll', label: 'table scroll' },
      { value: 'cards', label: 'cards' },
    ]),
  }),
  field('compactTabletLayout', 'Tablet Layout', 'select', 'heroui', {
    options: selectOptions([
      { value: 'inherit', label: 'inherit' },
      { value: 'keep-table', label: 'keep table' },
      { value: 'table-scroll', label: 'table scroll' },
      { value: 'cards', label: 'cards' },
    ]),
  }),
  field('compactTabletCardsPerRow', 'Tablet Cards Per Row', 'select', 'heroui', {
    options: selectOptions([
      { value: '1', label: '1' },
      { value: '2', label: '2' },
      { value: '3', label: '3' },
    ]),
  }),
  field('compactFreezeFirstColumn', 'Freeze First Column', 'select', 'heroui', {
    options: selectOptions([
      { value: 'inherit', label: 'auto' },
      { value: 'on', label: 'on' },
      { value: 'off', label: 'off' },
    ]),
  }),
  field('compactCollapseExtraFields', 'Collapse Extra Fields', 'boolean', 'heroui'),
  field('compactVisibleFieldCount', 'Visible Field Count', 'number', 'heroui'),
  field('compactShowActions', 'Show Card Actions', 'boolean', 'heroui'),
  field('compactShowMeta', 'Show Card Meta', 'boolean', 'heroui'),
  field('rowKeyField', 'Row Key Field', 'string', 'heroui', { placeholder: 'id' }),
  field('pageSize', 'Page Size', 'number', 'heroui'),
  field('page', 'Page', 'number', 'heroui'),
  field('total', 'Total Records', 'number', 'heroui', {
    placeholder: '0 = use API totalPath or page heuristic',
  }),
  field('listMode', 'List Mode', 'select', 'heroui', {
    options: selectOptions([
      { value: 'paging', label: 'paging' },
      { value: 'infinite', label: 'infinite' },
    ]),
  }),
  field('defaultSortBy', 'Default Sort Field', 'string', 'heroui', { placeholder: 'created_at' }),
  field('sortOptions', 'Sort Options', 'app-table-grid-sort-options', 'heroui'),
  field('gridAggregationConfig', 'Aggregation / Grouping', 'app-table-grid-aggregation', 'heroui'),
  field('toolbarConfig', 'Page Toolbar', 'app-table-grid-toolbar', 'heroui'),
  field('selectionMode', 'Selection Mode', 'select', 'heroui', {
    options: selectOptions([
      { value: 'none', label: 'none' },
      { value: 'single', label: 'single' },
      { value: 'multiple', label: 'multiple' },
    ]),
  }),
  field('selectionStorePath', 'Selection Store Path', 'string', 'heroui', {
    placeholder: 'gridSelection.selectedKeys',
  }),
  field('enableColumnLayout', 'Column Layout', 'boolean', 'heroui'),
  field('gridId', 'Grid ID', 'string', 'heroui', { placeholder: 'users' }),
  field('gridColumnLayoutStorePath', 'Layout Store Path', 'string', 'heroui', {
    placeholder: 'gridColumnLayouts',
  }),
  field('showSortControls', 'Footer Sort Controls', 'boolean', 'heroui'),
  field('showListModeControls', 'Footer List Mode', 'boolean', 'heroui'),
  field('showPagingFooter', 'Paging Footer', 'boolean', 'heroui'),
  field('loadingMessage', 'Loading Message', 'string', 'heroui'),
  ...HEROUI_TABLE_FIELDS.filter((item) => !['selectionMode', 'selectedKeys', 'isHeaderSticky'].includes(item.key)),
];

const HEROUI_ENTITY_PICKER_FIELDS: InspectorFieldSchema[] = [
  field('label', 'Label', 'string', 'heroui'),
  field('placeholder', 'Placeholder', 'string', 'heroui'),
  field('entityRef', 'Entity API Root', 'string', 'heroui', { placeholder: '/api/users' }),
  field('searchParam', 'Search Param', 'string', 'heroui', { placeholder: 'search' }),
  // Bug found (parity audit items 46/90): LOV field names were hard-coded (id/value +
  // textValue/label/name). Expose remappable columns so real APIs with different keys work.
  field('returnField', 'Return Field', 'string', 'heroui', { placeholder: 'id' }),
  field('displayField', 'Display Field', 'string', 'heroui', { placeholder: 'label' }),
  ...HEROUI_MENU_ASYNC_FIELDS,
  HEROUI_DISABLED,
  HEROUI_SIZE,
  ...HEROUI_INPUT_VALIDATION_FIELDS,
];

const FORM_DATE_RANGE_FIELDS: InspectorFieldSchema[] = [
  field('label', 'Label', 'string', 'heroui'),
  // Bug found: the old single `value` field was never actually read by the renderer (decorative
  // only). A date range is two related dates — expose them as two separately bindable ISO date
  // fields instead of one flat string, consistent with how Tree View exposes multi-part state.
  field('startValue', 'Start Date', 'string', 'heroui', { placeholder: '2026-01-15' }),
  field('endValue', 'End Date', 'string', 'heroui', { placeholder: '2026-01-20' }),
  field('presets', 'Range Presets', 'content-records', 'heroui', {
    recordItemLabel: 'preset',
    recordFields: [
      { key: 'label', label: 'Label', placeholder: 'Last 7 days' },
      {
        key: 'rangeFn',
        label: 'Preset',
        placeholder: 'last7Days',
      },
    ],
  }),
  field('timeZone', 'Time Zone', 'select', 'heroui', {
    options: selectOptions(toDesignerDatePickerSelectOptions(DESIGNER_DATE_PICKER_TIMEZONE_OPTIONS)),
  }),
  // Bug found (parity audit items 57/60): date-range lacked validation + library-supported
  // constraints that heroui.date-picker already exposes.
  field('granularity', 'Granularity', 'select', 'heroui', {
    options: selectOptions(toDesignerDatePickerSelectOptions(DESIGNER_DATE_PICKER_GRANULARITY_OPTIONS)),
  }),
  field('minValue', 'Min Value', 'select', 'heroui', {
    options: selectOptions(toDesignerDatePickerSelectOptions(DESIGNER_DATE_PICKER_BOUNDARY_VALUE_OPTIONS)),
  }),
  field('maxValue', 'Max Value', 'select', 'heroui', {
    options: selectOptions(toDesignerDatePickerSelectOptions(DESIGNER_DATE_PICKER_BOUNDARY_VALUE_OPTIONS)),
  }),
  field('isReadOnly', 'Read Only', 'boolean', 'heroui'),
  HEROUI_REQUIRED,
  HEROUI_DISABLED,
  HEROUI_SIZE,
];

const MONACO_LANGUAGE_OPTIONS = selectOptions([
  { value: 'typescript', label: 'typescript' },
  { value: 'javascript', label: 'javascript' },
  { value: 'json', label: 'json' },
  { value: 'css', label: 'css' },
  { value: 'sql', label: 'sql' },
  { value: 'markdown', label: 'markdown' },
  { value: 'xml', label: 'xml' },
  { value: 'yaml', label: 'yaml' },
]);

const MONACO_THEME_OPTIONS = selectOptions([
  { value: 'vs', label: 'vs (light)' },
  { value: 'vs-dark', label: 'vs-dark' },
  { value: 'hc-black', label: 'hc-black' },
]);

const FORM_MONACO_EDITOR_FIELDS: InspectorFieldSchema[] = [
  field('label', 'Label', 'string', 'heroui'),
  field('value', 'Value', 'string', 'heroui'),
  field('placeholder', 'Placeholder', 'string', 'heroui'),
  field('language', 'Language', 'select', 'heroui', { options: MONACO_LANGUAGE_OPTIONS }),
  field('theme', 'Theme', 'select', 'heroui', { options: MONACO_THEME_OPTIONS }),
  field('editorHeight', 'Editor Height (px)', 'number', 'heroui', { placeholder: '180' }),
  field('lineNumbers', 'Line Numbers', 'boolean', 'heroui'),
  field('wordWrap', 'Word Wrap', 'boolean', 'heroui'),
  field('readOnly', 'Read Only', 'boolean', 'heroui'),
  field('minimap', 'Minimap', 'boolean', 'heroui'),
  field('tabSize', 'Tab Size', 'number', 'heroui'),
  field('fontSize', 'Font Size', 'number', 'heroui'),
  ...HEROUI_INPUT_ADORNMENT_UX_FIELDS.filter((item) => item.key !== 'inputMode'),
  HEROUI_REQUIRED,
  HEROUI_DISABLED,
  HEROUI_SIZE,
  ...HEROUI_INPUT_VALIDATION_FIELDS,
];

const FORM_HTML_EDITOR_FIELDS: InspectorFieldSchema[] = [
  field('label', 'Label', 'string', 'heroui'),
  field('value', 'Value (HTML)', 'string', 'heroui'),
  field('placeholder', 'Placeholder', 'string', 'heroui'),
  field('editorHeight', 'Editor Height (px)', 'number', 'heroui', { placeholder: '160' }),
  field('fontSize', 'Font Size (px)', 'number', 'heroui', { placeholder: '14' }),
  field('showToolbar', 'Show Toolbar', 'boolean', 'heroui'),
  field('enableUndoRedo', 'Toolbar: Undo / Redo', 'boolean', 'heroui'),
  field('enableBold', 'Toolbar: Bold', 'boolean', 'heroui'),
  field('enableItalic', 'Toolbar: Italic', 'boolean', 'heroui'),
  field('enableUnderline', 'Toolbar: Underline', 'boolean', 'heroui'),
  field('enableStrike', 'Toolbar: Strikethrough', 'boolean', 'heroui'),
  field('enableInlineCode', 'Toolbar: Inline Code', 'boolean', 'heroui'),
  field('enableSubscript', 'Toolbar: Subscript', 'boolean', 'heroui'),
  field('enableSuperscript', 'Toolbar: Superscript', 'boolean', 'heroui'),
  field('enableTextColor', 'Toolbar: Text Color', 'boolean', 'heroui'),
  field('enableHighlight', 'Toolbar: Highlight', 'boolean', 'heroui'),
  field('enableHeading', 'Toolbar: Headings (H1–H3)', 'boolean', 'heroui'),
  field('enableBulletList', 'Toolbar: Bullet List', 'boolean', 'heroui'),
  field('enableOrderedList', 'Toolbar: Numbered List', 'boolean', 'heroui'),
  field('enableTaskList', 'Toolbar: Task List', 'boolean', 'heroui'),
  field('enableIndent', 'Toolbar: Indent / Outdent', 'boolean', 'heroui'),
  field('enableBlockquote', 'Toolbar: Blockquote', 'boolean', 'heroui'),
  field('enableCodeBlock', 'Toolbar: Code Block', 'boolean', 'heroui'),
  field('enableHorizontalRule', 'Toolbar: Horizontal Rule', 'boolean', 'heroui'),
  field('enableTextAlign', 'Toolbar: Text Align', 'boolean', 'heroui'),
  field('enableTextDirection', 'Toolbar: Text Direction', 'boolean', 'heroui'),
  field('enableLink', 'Toolbar: Link', 'boolean', 'heroui'),
  field('enableImage', 'Toolbar: Image', 'boolean', 'heroui'),
  field('enableTable', 'Toolbar: Table', 'boolean', 'heroui'),
  field('enableClearFormatting', 'Toolbar: Clear Formatting', 'boolean', 'heroui'),
  field('readOnly', 'Read Only', 'boolean', 'heroui'),
  ...HEROUI_INPUT_ADORNMENT_UX_FIELDS.filter((item) => item.key !== 'inputMode'),
  HEROUI_REQUIRED,
  HEROUI_DISABLED,
  HEROUI_SIZE,
  ...HEROUI_INPUT_VALIDATION_FIELDS,
];

const FORM_COLOR_EDITOR_FIELDS: InspectorFieldSchema[] = [
  field('label', 'Label', 'string', 'heroui'),
  field('value', 'Value', 'string', 'heroui', { placeholder: '#RRGGBB' }),
  field('placeholder', 'Placeholder', 'string', 'heroui', { placeholder: '#RRGGBB' }),
  field('showAlpha', 'Show Alpha', 'boolean', 'heroui'),
  field('presetColors', 'Preset Colors (JSON)', 'string', 'heroui', { placeholder: '["#3B82F6","#EF4444"]' }),
  ...HEROUI_INPUT_ADORNMENT_UX_FIELDS.filter((item) => item.key !== 'inputMode'),
  HEROUI_REQUIRED,
  HEROUI_DISABLED,
  HEROUI_SIZE,
  ...HEROUI_INPUT_VALIDATION_FIELDS,
];

const FORM_MASK_INPUT_FIELDS: InspectorFieldSchema[] = [
  field('label', 'Label', 'string', 'heroui'),
  field('placeholder', 'Placeholder (optional override)', 'string', 'heroui'),
  field('value', 'Value', 'string', 'heroui'),
  field('maskKind', 'Mask Kind', 'select', 'heroui', {
    options: selectOptions(toDesignerMaskInputSelectOptions(DESIGNER_MASK_INPUT_KIND_OPTIONS)),
  }),
  field('maskPreset', 'Mask Preset', 'select', 'heroui', {
    options: selectOptions(toDesignerMaskInputSelectOptions(DESIGNER_MASK_INPUT_PRESET_OPTIONS)),
  }),
  field('maskPattern', 'Custom Pattern', 'string', 'heroui', { placeholder: '0000-0000-0000 · 0=digit · a=letter' }),
  field('maskRegExp', 'RegExp Source (mask kind = RegExp)', 'string', 'heroui', { placeholder: '/^[A-Za-z0-9_-]*$/' }),
  field('maskEnum', 'Enum Values (mask kind = Enum)', 'string', 'heroui', { placeholder: 'yes,no,maybe' }),
  field('maskDefinitions', 'Pattern Definitions JSON', 'string', 'heroui', { placeholder: '{"#":"[1-9]","H":"[0-9A-Fa-f]"}' }),
  field('maskBlocks', 'Dynamic Blocks JSON (mask kind = Dynamic)', 'string', 'heroui', { placeholder: '[{"mask":"000-0000"},{"mask":"(000) 000-0000"}]' }),
  field('maskOptionsJson', 'Custom IMask JSON (mask kind = Custom)', 'string', 'heroui', { placeholder: '{"mask":"/^\\\\d+$/"} or {"mask":"0000"}' }),
  field('maskPlaceholderChar', 'Empty Slot Character', 'select', 'heroui', {
    options: selectOptions([
      { value: '_', label: '_ (underscore)' },
      { value: ' ', label: 'space' },
      { value: '0', label: '0' },
      { value: '.', label: '.' },
    ]),
  }),
  field('showMaskFormatHint', 'Show Format Preview', 'boolean', 'heroui'),
  field('maskLazy', 'Lazy (format on focus)', 'boolean', 'heroui'),
  field('maskEager', 'Eager (always show format)', 'boolean', 'heroui'),
  field('maskOverwrite', 'Overwrite Mode', 'boolean', 'heroui'),
  field('maskAutofix', 'Autofix Invalid Input', 'boolean', 'heroui'),
  field('unmask', 'Return Unmasked Value', 'boolean', 'heroui'),
  field('maskNumberScale', 'Number Scale (mask kind = Number)', 'string', 'heroui', { placeholder: '2' }),
  field('maskNumberRadix', 'Number Radix', 'select', 'heroui', {
    options: selectOptions([
      { value: '.', label: '. (dot)' },
      { value: ',', label: ', (comma)' },
    ]),
  }),
  field('maskNumberThousandsSeparator', 'Thousands Separator', 'select', 'heroui', {
    options: selectOptions([
      { value: ',', label: ', (comma)' },
      { value: '.', label: '. (dot)' },
      { value: ' ', label: 'space' },
      { value: '', label: '(none)' },
    ]),
  }),
  field('maskNumberMin', 'Number Min', 'string', 'heroui'),
  field('maskNumberMax', 'Number Max', 'string', 'heroui'),
  field('maskNumberPadFractionalZeros', 'Pad Fractional Zeros', 'boolean', 'heroui'),
  field('maskNumberNormalizeZeros', 'Normalize Zeros', 'boolean', 'heroui'),
  field('maskDatePattern', 'Date Pattern (mask kind = Date)', 'select', 'heroui', {
    options: selectOptions([
      { value: 'Y-m-d', label: 'Y-m-d (2024-03-07)' },
      { value: 'd/m/Y', label: 'd/m/Y (07/03/2024)' },
      { value: 'm/d/Y', label: 'm/d/Y (03/07/2024)' },
      { value: 'd.m.Y', label: 'd.m.Y (07.03.2024)' },
    ]),
  }),
  ...HEROUI_INPUT_ADORNMENT_UX_FIELDS.filter((item) => item.key !== 'inputMode'),
  HEROUI_REQUIRED,
  HEROUI_DISABLED,
  HEROUI_SIZE,
  ...HEROUI_INPUT_VALIDATION_FIELDS,
];

const FORM_CALCULATOR_FIELDS: InspectorFieldSchema[] = [
  field('label', 'Label', 'string', 'heroui'),
  field('placeholder', 'Placeholder', 'string', 'heroui'),
  field('value', 'Value', 'string', 'heroui'),
  field('min', 'Min', 'string', 'heroui'),
  field('max', 'Max', 'string', 'heroui'),
  field('step', 'Step', 'string', 'heroui'),
  field('decimalPlaces', 'Decimal Places', 'number', 'heroui'),
  field('showKeypad', 'Show Keypad', 'boolean', 'heroui'),
  field('keypadMode', 'Keypad Mode', 'select', 'heroui', {
    options: selectOptions([
      { value: 'basic', label: 'basic' },
      { value: 'scientific', label: 'scientific' },
    ]),
  }),
  field('allowManualInput', 'Allow Manual Input', 'boolean', 'heroui'),
  ...HEROUI_INPUT_ADORNMENT_UX_FIELDS.filter((item) => item.key !== 'inputMode'),
  HEROUI_REQUIRED,
  HEROUI_DISABLED,
  HEROUI_SIZE,
  ...HEROUI_INPUT_VALIDATION_FIELDS,
];

const LAYOUT_SPLIT_PANE_FIELDS: InspectorFieldSchema[] = [
  field('direction', 'Direction', 'select', 'tag', {
    options: selectOptions([
      { value: 'horizontal', label: 'horizontal' },
      { value: 'vertical', label: 'vertical' },
    ]),
  }),
  field('defaultSplit', 'Default Split (%)', 'number', 'tag'),
];

const LAYOUT_DOCK_PANE_FIELDS: InspectorFieldSchema[] = [
  field('dock', 'Dock', 'select', 'tag', {
    options: selectOptions([
      { value: 'left', label: 'Left' },
      { value: 'right', label: 'Right' },
      { value: 'top', label: 'Top' },
      { value: 'bottom', label: 'Bottom' },
    ]),
  }),
];

const HEROUI_DATE_PICKER_FIELDS: InspectorFieldSchema[] = [
  field('label', 'Label', 'string', 'heroui'),
  field('placeholder', 'Trigger Label', 'string', 'heroui'),
  field('calendarSystem', 'Calendar', 'select', 'heroui', {
    options: selectOptions([
      { value: 'gregorian', label: 'Gregorian' },
      { value: 'jalali', label: 'Jalali' },
      { value: 'hijri', label: 'Hijri' },
      { value: 'hebrew', label: 'Hebrew' },
    ]),
  }),
  field('locale', 'Locale', 'select', 'heroui', {
    options: selectOptions(toDesignerDatePickerSelectOptions(DESIGNER_DATE_PICKER_LOCALE_OPTIONS)),
  }),
  field('granularity', 'Granularity', 'select', 'heroui', {
    options: selectOptions(toDesignerDatePickerSelectOptions(DESIGNER_DATE_PICKER_GRANULARITY_OPTIONS)),
  }),
  field('hourCycle', 'Hour Cycle', 'select', 'heroui', {
    options: selectOptions(toDesignerDatePickerSelectOptions(DESIGNER_DATE_PICKER_HOUR_CYCLE_OPTIONS)),
  }),
  field('timeZone', 'Time Zone', 'select', 'heroui', {
    options: selectOptions(toDesignerDatePickerSelectOptions(DESIGNER_DATE_PICKER_TIMEZONE_OPTIONS)),
  }),
  field('value', 'Value', 'select', 'heroui', {
    options: selectOptions(toDesignerDatePickerSelectOptions(DESIGNER_DATE_PICKER_VALUE_OPTIONS)),
  }),
  field('minValue', 'Min Value', 'select', 'heroui', {
    options: selectOptions(toDesignerDatePickerSelectOptions(DESIGNER_DATE_PICKER_BOUNDARY_VALUE_OPTIONS)),
  }),
  field('maxValue', 'Max Value', 'select', 'heroui', {
    options: selectOptions(toDesignerDatePickerSelectOptions(DESIGNER_DATE_PICKER_BOUNDARY_VALUE_OPTIONS)),
  }),
  field('placeholderValue', 'Placeholder Value', 'select', 'heroui', {
    options: selectOptions(toDesignerDatePickerSelectOptions(DESIGNER_DATE_PICKER_PLACEHOLDER_VALUE_OPTIONS)),
  }),
  field('firstDayOfWeek', 'First Day of Week', 'select', 'heroui', {
    options: selectOptions(toDesignerDatePickerSelectOptions(DESIGNER_DATE_PICKER_FIRST_DAY_OPTIONS)),
  }),
  field('visibleMonths', 'Visible Months', 'select', 'heroui', {
    options: selectOptions(toDesignerDatePickerSelectOptions(DESIGNER_DATE_PICKER_VISIBLE_MONTHS_OPTIONS)),
  }),
  field('pageBehavior', 'Page Behavior', 'select', 'heroui', {
    options: selectOptions(toDesignerDatePickerSelectOptions(DESIGNER_DATE_PICKER_PAGE_BEHAVIOR_OPTIONS)),
  }),
  field('hideTimeZone', 'Hide Time Zone', 'boolean', 'heroui'),
  field('shouldForceLeadingZeros', 'Force Leading Zeros', 'boolean', 'heroui'),
  field('isReadOnly', 'Read Only', 'boolean', 'heroui'),
  field('autoFocus', 'Auto Focus', 'boolean', 'heroui'),
  ...HEROUI_INPUT_ADORNMENT_UX_FIELDS.filter((item) => item.key !== 'inputMode'),
  HEROUI_DISABLED,
  HEROUI_REQUIRED,
  HEROUI_SIZE,
  ...HEROUI_INPUT_VALIDATION_FIELDS,
];

const HEROUI_TAGS_INPUT_FIELDS: InspectorFieldSchema[] = [
  field('label', 'Label', 'string', 'heroui'),
  PAGE_GUIDE_HINT_FIELD,
  field('value', 'Value', 'string', 'heroui', { placeholder: 'tag-one,tag-two or ["tag-one","tag-two"]' }),
  field('placeholder', 'Placeholder', 'string', 'heroui'),
  HEROUI_DISABLED,
  HEROUI_REQUIRED,
  ...HEROUI_INPUT_VALIDATION_FIELDS,
];

const HEROUI_CHECKBOX_GROUP_FIELDS: InspectorFieldSchema[] = [
  field('label', 'Label', 'string', 'heroui'),
  PAGE_GUIDE_HINT_FIELD,
  field('optionsSource', 'Options Source', 'select', 'heroui', {
    options: selectOptions([
      { value: 'static', label: 'Static list' },
      { value: 'lov', label: 'LOV registry' },
      { value: 'apiRef', label: 'API endpoint' },
    ]),
  }),
  HEROUI_OPTION_ITEMS_FIELD,
  field('isSelected', 'Selected', 'string', 'heroui', { placeholder: 'option-1,option-2' }),
  HEROUI_DISABLED,
  // Bug found (parity audit item 53): size/color are not real props on CheckboxGroup
  // (checkbox-groupVariants only has variant primary/secondary). Removed rather than left decorative.
];

const HEROUI_RADIO_GROUP_FIELDS: InspectorFieldSchema[] = [
  field('label', 'Label', 'string', 'heroui'),
  PAGE_GUIDE_HINT_FIELD,
  field('sectionTone', 'Section tone', 'select', 'heroui', {
    options: selectOptions([
      { value: 'indigo', label: 'indigo' },
      { value: 'violet', label: 'violet' },
      { value: 'cyan', label: 'cyan' },
      { value: 'emerald', label: 'emerald' },
      { value: 'amber', label: 'amber' },
      { value: 'rose', label: 'rose' },
      { value: 'slate', label: 'slate' },
    ]),
  }),
  field('sectionDivided', 'Section divided', 'boolean', 'heroui'),
  HEROUI_OPTION_ITEMS_FIELD,
  field('isSelected', 'Selected', 'string', 'heroui', { placeholder: 'option-1' }),
  HEROUI_DISABLED,
  // Bug found (parity audit item 53): size/color are not real props on RadioGroup
  // (radio-groupVariants only has variant primary/secondary). Removed rather than left decorative.
];

const HEROUI_CHIP_FIELDS: InspectorFieldSchema[] = [
  field('variant', 'Variant', 'select', 'heroui', {
    options: selectOptions([
      { value: 'primary', label: 'primary' },
      { value: 'secondary', label: 'secondary' },
      { value: 'tertiary', label: 'tertiary' },
      { value: 'soft', label: 'soft' },
    ]),
  }),
  field('color', 'Color', 'select', 'heroui', { options: COLOR_OPTIONS }),
  HEROUI_SIZE,
  field('startIcon', 'Start Icon', 'icon-picker', 'heroui'),
  field('endIcon', 'End Icon', 'icon-picker', 'heroui'),
];

const chartEnumOptions = (values: readonly (string | number)[]) =>
  selectOptions(values.map((value) => ({ value: String(value), label: String(value) })));

/** CD-O13 — unified chart inspector fields shared by all viz.chart-* palette items. */
const VIZ_CHART_ECHARTS_FIELDS: InspectorFieldSchema[] = [
  field('showTitle', 'Chart Title', 'boolean', 'heroui'),
  field('titleText', 'Title Text', 'string', 'heroui'),
  field('titleSubtext', 'Title Subtext', 'string', 'heroui'),
  field('titleLeft', 'Title Left', 'select', 'heroui', { options: chartEnumOptions(['auto', 'left', 'center', 'right']) }),
  field('titleTop', 'Title Top', 'select', 'heroui', { options: chartEnumOptions(['auto', 'top', 'middle', 'bottom']) }),
  field('showLabels', 'Value Labels', 'boolean', 'heroui'),
  field('showTooltip', 'Tooltip', 'boolean', 'heroui'),
  field('tooltipTrigger', 'Tooltip Trigger', 'select', 'heroui', {
    options: chartEnumOptions(['axis', 'item', 'none']),
  }),
  field('tooltipTriggerOn', 'Tooltip Trigger On', 'select', 'heroui', {
    options: chartEnumOptions(['mousemove', 'click', 'mousemove|click', 'none']),
  }),
  field('tooltipConfine', 'Tooltip Confine', 'boolean', 'heroui'),
  field('axisPointer', 'Axis Pointer', 'select', 'heroui', {
    options: chartEnumOptions(['line', 'shadow', 'cross', 'none']),
  }),
  field('legendPosition', 'Legend Position', 'select', 'heroui', {
    options: chartEnumOptions(['bottom', 'top', 'left', 'right']),
  }),
  field('legendType', 'Legend Type', 'select', 'heroui', {
    options: chartEnumOptions(['plain', 'scroll']),
  }),
  field('legendSelectedMode', 'Legend Select', 'select', 'heroui', {
    options: chartEnumOptions(['multiple', 'single', 'off']),
  }),
  field('xAxisName', 'X Axis Name', 'string', 'heroui'),
  field('yAxisName', 'Y Axis Name', 'string', 'heroui'),
  field('axisInverse', 'Inverse Axis', 'boolean', 'heroui'),
  field('axisSplitArea', 'Split Area', 'boolean', 'heroui'),
  field('axisLabelRotate', 'Label Rotate', 'select', 'heroui', {
    options: chartEnumOptions([0, 30, 45, 90]),
  }),
  field('gridContainLabel', 'Contain Label', 'boolean', 'heroui'),
  field('dataZoom', 'Data Zoom', 'boolean', 'heroui'),
  field('dataZoomType', 'Zoom Type', 'select', 'heroui', {
    options: chartEnumOptions(['inside', 'slider', 'both']),
  }),
  field('visualMap', 'Visual Map', 'boolean', 'heroui'),
  field('visualMapType', 'Visual Map Type', 'select', 'heroui', {
    options: chartEnumOptions(['continuous', 'piecewise']),
  }),
  field('brush', 'Brush', 'boolean', 'heroui'),
  field('showToolbox', 'Toolbox', 'boolean', 'heroui'),
  field('toolboxMagicType', 'Toolbox Magic Type', 'boolean', 'heroui'),
  field('toolboxDataView', 'Toolbox Data View', 'boolean', 'heroui'),
  field('showMarkPoint', 'Mark Max / Min', 'boolean', 'heroui'),
  field('showMarkLine', 'Mark Average', 'boolean', 'heroui'),
  field('showMarkArea', 'Mark Area', 'boolean', 'heroui'),
  field('lineStep', 'Line Step', 'select', 'heroui', {
    options: chartEnumOptions(['none', 'start', 'middle', 'end']),
  }),
  field('showSymbol', 'Show Symbols', 'boolean', 'heroui'),
  field('roseType', 'Rose Type', 'select', 'heroui', {
    options: chartEnumOptions(['off', 'radius', 'area']),
  }),
  field('emphasisFocus', 'Emphasis Focus', 'select', 'heroui', {
    options: chartEnumOptions(['none', 'self', 'series']),
  }),
  field('animation', 'Animation', 'boolean', 'heroui'),
  field('animationDuration', 'Animation Duration', 'select', 'heroui', {
    options: chartEnumOptions([300, 1000, 2000]),
  }),
  field('animationEasing', 'Animation Easing', 'select', 'heroui', {
    options: chartEnumOptions(['cubicOut', 'linear', 'quadraticOut', 'elasticOut', 'bounceOut']),
  }),
  field('darkMode', 'Dark Mode', 'boolean', 'heroui'),
  field('background', 'Background', 'select', 'heroui', {
    options: chartEnumOptions(['transparent', 'white', 'slate']),
  }),
  field('ariaEnabled', 'Aria', 'boolean', 'heroui'),
  field('ariaDecal', 'Aria Decal', 'boolean', 'heroui'),
  field('renderer', 'Renderer', 'select', 'heroui', {
    options: chartEnumOptions(['canvas', 'svg']),
  }),
];

const VIZ_CHART_SHARED_FIELDS: InspectorFieldSchema[] = [
  field('title', 'Title', 'string', 'heroui'),
  field('data', 'Chart Data (JSON)', 'string', 'heroui', { placeholder: '[{"label":"Jan","revenue":100}]' }),
  field('seriesKeys', 'Series Keys', 'string', 'heroui', { placeholder: 'revenue,cost' }),
  field('xAxisKey', 'X Axis Key', 'string', 'heroui', { placeholder: 'label' }),
  field('showLegend', 'Show Legend', 'boolean', 'heroui'),
  field('showGrid', 'Show Grid', 'boolean', 'heroui'),
  field('height', 'Height (px)', 'number', 'heroui'),
  ...VIZ_CHART_ECHARTS_FIELDS,
];

const VIZ_DATA_STATE_FIELDS: InspectorFieldSchema[] = [
  field('isLoading', 'Loading', 'boolean', 'heroui'),
  field('emptyContent', 'Empty Content', 'string', 'heroui', {
    placeholder: 'No data — check the connected field mapping.',
  }),
  field('errorContent', 'Error Content', 'string', 'heroui', {
    placeholder: 'Could not load visualization data.',
  }),
];

const VIZ_CHART_BAR_FIELDS: InspectorFieldSchema[] = [
  ...VIZ_CHART_SHARED_FIELDS,
  ...VIZ_DATA_STATE_FIELDS,
  field('orientation', 'Orientation', 'select', 'heroui', {
    options: selectOptions([
      { value: 'vertical', label: 'column' },
      { value: 'horizontal', label: 'bar' },
    ]),
  }),
  field('grouped', 'Grouped', 'boolean', 'heroui'),
];

const VIZ_CHART_LINE_FIELDS: InspectorFieldSchema[] = [
  ...VIZ_CHART_SHARED_FIELDS,
  ...VIZ_DATA_STATE_FIELDS,
  field('chartVariant', 'Variant', 'select', 'heroui', {
    options: selectOptions([
      { value: 'line', label: 'line' },
      { value: 'area', label: 'area' },
    ]),
  }),
];

const VIZ_CHART_PIE_FIELDS: InspectorFieldSchema[] = [
  ...VIZ_CHART_SHARED_FIELDS,
  ...VIZ_DATA_STATE_FIELDS,
  field('chartVariant', 'Variant', 'select', 'heroui', {
    options: selectOptions([
      { value: 'pie', label: 'pie' },
      { value: 'donut', label: 'donut' },
      { value: 'gauge', label: 'gauge' },
    ]),
  }),
  field('valueKey', 'Value Key', 'string', 'heroui', { placeholder: 'revenue' }),
  field('gaugeMin', 'Gauge Min', 'number', 'heroui', { placeholder: '0' }),
  field('gaugeMax', 'Gauge Max', 'number', 'heroui', { placeholder: '100' }),
  field('gaugeThresholds', 'Gauge Thresholds', 'string', 'heroui', {
    placeholder: '[{"value":70,"color":"#f59e0b"},{"value":90,"color":"#ef4444"}]',
    jsonEditor: true,
    arrayEditorColumns: [
      { key: 'value', label: 'Value', type: 'number', placeholder: '70' },
      { key: 'color', label: 'Color', type: 'color', placeholder: '#f59e0b' },
    ],
    arrayEditorItemLabel: 'threshold',
  }),
];

const VIZ_CHART_SPARKLINE_FIELDS: InspectorFieldSchema[] = [
  field('data', 'Chart Data (JSON)', 'string', 'heroui'),
  field('seriesKeys', 'Series Key', 'string', 'heroui'),
  field('xAxisKey', 'X Axis Key', 'string', 'heroui'),
  ...VIZ_DATA_STATE_FIELDS,
  field('chartVariant', 'Variant', 'select', 'heroui', {
    options: selectOptions([
      { value: 'line', label: 'line' },
      { value: 'bar', label: 'bar' },
    ]),
  }),
  field('height', 'Height (px)', 'number', 'heroui'),
  field('showTooltip', 'Tooltip', 'boolean', 'heroui'),
  field('animation', 'Animation', 'boolean', 'heroui'),
  field('darkMode', 'Dark Mode', 'boolean', 'heroui'),
  field('renderer', 'Renderer', 'select', 'heroui', {
    options: selectOptions([
      { value: 'canvas', label: 'canvas' },
      { value: 'svg', label: 'svg' },
    ]),
  }),
];

/** Phase 52 — unified advanced statistical chart (scatter/radar/heatmap/…). */
const VIZ_CHART_ADVANCED_FIELDS: InspectorFieldSchema[] = [
  ...VIZ_CHART_SHARED_FIELDS,
  ...VIZ_DATA_STATE_FIELDS,
  field('chartType', 'Chart Type', 'select', 'heroui', {
    options: selectOptions([
      { value: 'scatter', label: 'scatter' },
      { value: 'radar', label: 'radar' },
      { value: 'heatmap', label: 'heatmap' },
      { value: 'funnel', label: 'funnel' },
      { value: 'waterfall', label: 'waterfall' },
      { value: 'treemap', label: 'treemap' },
      { value: 'sunburst', label: 'sunburst' },
      { value: 'sankey', label: 'sankey' },
      { value: 'candlestick', label: 'candlestick' },
      { value: 'boxplot', label: 'boxplot' },
    ]),
  }),
  field('yAxisKey', 'Y Axis Key', 'string', 'heroui', { placeholder: 'y' }),
  field('valueKey', 'Value Key', 'string', 'heroui', { placeholder: 'value' }),
  field('sizeKey', 'Size Key (bubble)', 'string', 'heroui', { placeholder: 'size' }),
  field('colorKey', 'Color Key', 'string', 'heroui', { placeholder: 'color' }),
  field('showTrendline', 'Show Trendline', 'boolean', 'heroui'),
  field('showConversionRate', 'Show Conversion Rate', 'boolean', 'heroui'),
  field('showConnectors', 'Show Connectors', 'boolean', 'heroui'),
  field('showVolume', 'Show Volume', 'boolean', 'heroui'),
  field('maxValue', 'Radar Max Value', 'number', 'heroui', { placeholder: '100' }),
];

const VIZ_MAP_PIN_FIELDS: InspectorFieldSchema[] = [
  field('title', 'Title', 'string', 'heroui'),
  field('data', 'Pins', 'string', 'heroui', {
    placeholder: '[{"lat":35.6,"lng":51.4,"label":"HQ"}]',
    jsonEditor: true,
    arrayEditorColumns: [
      { key: 'lat', label: 'Latitude', type: 'number', placeholder: '35.6' },
      { key: 'lng', label: 'Longitude', type: 'number', placeholder: '51.4' },
      { key: 'label', label: 'Label', type: 'string', placeholder: 'HQ' },
    ],
    arrayEditorItemLabel: 'pin',
  }),
  field('defaultCenter', 'Default Center [lat,lng]', 'string', 'heroui', {
    placeholder: '[32.4279,53.688]',
  }),
  field('defaultZoom', 'Default Zoom', 'number', 'heroui'),
  field('clusterMarkers', 'Fit Bounds / Cluster View', 'boolean', 'heroui'),
  field('tileProvider', 'Tile Provider', 'select', 'heroui', {
    options: selectOptions([
      { value: 'osm', label: 'OpenStreetMap (default)' },
      { value: 'mapbox', label: 'Mapbox (token required)' },
      { value: 'google', label: 'Google (falls back to OSM)' },
    ]),
  }),
  field('mapboxAccessToken', 'Mapbox Access Token', 'string', 'heroui'),
  field('height', 'Height (px)', 'number', 'heroui'),
  ...VIZ_DATA_STATE_FIELDS,
];

const VIZ_MAP_CHOROPLETH_FIELDS: InspectorFieldSchema[] = [
  field('title', 'Title', 'string', 'heroui'),
  field('data', 'Regions', 'string', 'heroui', {
    placeholder: '[{"regionCode":"TEH","value":120,"label":"Tehran"}]',
    jsonEditor: true,
    arrayEditorColumns: [
      { key: 'regionCode', label: 'Region Code', type: 'string', placeholder: 'TEH' },
      { key: 'value', label: 'Value', type: 'number', placeholder: '120' },
      { key: 'label', label: 'Label', type: 'string', placeholder: 'Tehran' },
    ],
    arrayEditorItemLabel: 'region',
  }),
  field('regionLevel', 'Region Level', 'select', 'heroui', {
    options: selectOptions([
      { value: 'country', label: 'country' },
      { value: 'province', label: 'province' },
      { value: 'city', label: 'city' },
    ]),
  }),
  field('colorScale', 'Color Scale [low,high]', 'string', 'heroui', {
    placeholder: '["#dbeafe","#1d4ed8"]',
  }),
  field('geoJsonSource', 'GeoJSON Source URL', 'string', 'heroui', {
    placeholder: '/geo/provinces.json',
  }),
  field('defaultCenter', 'Default Center [lat,lng]', 'string', 'heroui', {
    placeholder: '[32.4279,53.688]',
  }),
  field('defaultZoom', 'Default Zoom', 'number', 'heroui'),
  field('tileProvider', 'Tile Provider', 'select', 'heroui', {
    options: selectOptions([
      { value: 'osm', label: 'OpenStreetMap (default)' },
      { value: 'mapbox', label: 'Mapbox (token required)' },
      { value: 'google', label: 'Google (falls back to OSM)' },
    ]),
  }),
  field('mapboxAccessToken', 'Mapbox Access Token', 'string', 'heroui'),
  field('height', 'Height (px)', 'number', 'heroui'),
  ...VIZ_DATA_STATE_FIELDS,
];

const DASHBOARD_FILTER_BAR_FIELDS: InspectorFieldSchema[] = [
  field('filterBarConfig', 'Filter Bar Config (JSON)', 'string', 'heroui', {
    placeholder: '{"filters":[{"id":"category","label":"Category","type":"select","storePath":"dashboardFilters.category","apiParam":"category","options":[]}]}',
    jsonEditor: true,
  }),
];

const VIZ_TREE_SELECTION_MODE_OPTIONS = selectOptions([
  { value: 'single', label: 'Single (highlight, no checkbox)' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'none', label: 'None' },
]);

const VIZ_TREE_DATA_FIELDS: InspectorFieldSchema[] = [
  field('data', 'Tree Data (JSON)', 'string', 'heroui', {
    jsonEditor: true,
    placeholder: '[{"id":"1","label":"Node","children":[]}]',
  }),
  ...VIZ_DATA_STATE_FIELDS,
  field('selectionMode', 'Selection Mode', 'select', 'heroui', {
    options: VIZ_TREE_SELECTION_MODE_OPTIONS,
  }),
  field('showIcons', 'Show Node Icons', 'boolean', 'heroui'),
  field('selectedKey', 'Selected Node ID', 'string', 'heroui', {
    placeholder: 'Bind to load/send the highlighted node (Single mode)',
  }),
  field('checkedKeys', 'Checked Node IDs', 'string', 'heroui', {
    placeholder: 'Bind to load/send checked nodes, comma-separated (Checkbox mode)',
  }),
];

// Tree Select / Cascader / Tree Combobox are hierarchical pickers — they intentionally do NOT
// get HEROUI_OPTION_ITEMS_FIELD (the flat Select/Autocomplete "Options" LOV wizard). That field
// used to sit here and would silently override the correct hierarchical `data`/API binding the
// moment a user touched it, and a flat list can never represent parent/child nesting anyway.
// `data` (hand-authored JSON, JSON-dialog editor) and the Viz "Connect to API" wizard (tree-kind
// field mapping: idField/labelField/parentIdField) are the only two data sources for these three.
const VIZ_TREE_PICKER_DATA_FIELD = field('data', 'Tree Data (JSON)', 'string', 'heroui', {
  jsonEditor: true,
  placeholder: '[{"id":"1","label":"Node","children":[]}]',
});

const VIZ_TREE_PICKER_BASE_FIELDS: InspectorFieldSchema[] = [
  field('label', 'Label', 'string', 'heroui'),
  field('placeholder', 'Placeholder', 'string', 'heroui'),
  VIZ_TREE_PICKER_DATA_FIELD,
  ...VIZ_DATA_STATE_FIELDS,
  field('selectedKey', 'Selected Node ID', 'string', 'heroui', {
    placeholder: 'Bind to load/send the picked node',
  }),
];

const VIZ_TREE_FORM_FIELDS: InspectorFieldSchema[] = [...VIZ_TREE_PICKER_BASE_FIELDS];

const VIZ_TREE_SELECT_FIELDS: InspectorFieldSchema[] = [
  ...VIZ_TREE_PICKER_BASE_FIELDS,
  field('multiple', 'Multiple (checkboxes)', 'boolean', 'heroui'),
  field('selectedKeys', 'Selected Node IDs', 'string', 'heroui', {
    placeholder: 'Bind to load/send picked nodes, comma-separated (Multiple mode)',
  }),
];

const VIZ_TIMELINE_FIELDS: InspectorFieldSchema[] = [
  field('title', 'Title', 'string', 'heroui'),
  field('data', 'Events (JSON)', 'string', 'heroui'),
  ...VIZ_DATA_STATE_FIELDS,
];

const VIZ_GANTT_FIELDS: InspectorFieldSchema[] = [
  field('title', 'Title', 'string', 'heroui'),
  field('data', 'Tasks (JSON)', 'string', 'heroui'),
  ...VIZ_DATA_STATE_FIELDS,
  field('viewMode', 'View Mode', 'select', 'heroui', {
    options: selectOptions([
      { value: 'day', label: 'day' },
      { value: 'week', label: 'week' },
      { value: 'month', label: 'month' },
    ]),
  }),
  field('dependencies', 'Dependencies', 'string', 'heroui', {
    placeholder: '[{"fromTaskId":"task-1","toTaskId":"task-2"}]',
    jsonEditor: true,
    arrayEditorColumns: [
      { key: 'fromTaskId', label: 'From Task ID', type: 'string', placeholder: 'task-1' },
      { key: 'toTaskId', label: 'To Task ID', type: 'string', placeholder: 'task-2' },
    ],
    arrayEditorItemLabel: 'dependency',
  }),
  field('milestones', 'Milestones', 'string', 'heroui', {
    placeholder: '[{"taskId":"task-2","label":"Launch"}]',
    jsonEditor: true,
    arrayEditorColumns: [
      { key: 'taskId', label: 'Task ID', type: 'string', placeholder: 'task-2' },
      { key: 'label', label: 'Label', type: 'string', placeholder: 'Launch' },
    ],
    arrayEditorItemLabel: 'milestone',
  }),
  field('allowTaskDrag', 'Allow Task Drag', 'boolean', 'heroui'),
];

const VIZ_SHEET_FIELDS: InspectorFieldSchema[] = [
  field('title', 'Title', 'string', 'heroui'),
  field('data', 'Sheet Data (JSON)', 'string', 'heroui'),
  ...VIZ_DATA_STATE_FIELDS,
];

const VIZ_KANBAN_FIELDS: InspectorFieldSchema[] = [
  field('title', 'Title', 'string', 'heroui'),
  field('data', 'Board Data (JSON)', 'string', 'heroui'),
  ...VIZ_DATA_STATE_FIELDS,
];

const UNIVERSAL_ALERT_BANNER_FIELDS: InspectorFieldSchema[] = [
  field('title', 'Title', 'string', 'content'),
  field('message', 'Message', 'string', 'content'),
  field('variant', 'Variant', 'select', 'content', {
    options: selectOptions([
      { value: 'info', label: 'Info' },
      { value: 'success', label: 'Success' },
      { value: 'warning', label: 'Warning' },
      { value: 'danger', label: 'Danger' },
    ]),
  }),
];

const UNIVERSAL_RESULT_FIELDS: InspectorFieldSchema[] = [
  field('title', 'Title', 'string', 'content'),
  field('description', 'Description', 'string', 'content'),
  field('status', 'Status', 'select', 'content', {
    options: selectOptions([
      { value: 'success', label: 'Success' },
      { value: 'error', label: 'Error' },
    ]),
  }),
];

const UNIVERSAL_EMPTY_STATE_FIELDS: InspectorFieldSchema[] = [
  field('title', 'Title', 'string', 'content'),
  field('description', 'Description', 'string', 'content'),
  field('actionLabel', 'Action Label', 'string', 'content'),
];

const UNIVERSAL_LAYOUT_ASPECT_RATIO_FIELDS: InspectorFieldSchema[] = [
  field('ratio', 'Aspect Ratio', 'string', 'content'),
];

const UNIVERSAL_LAYOUT_STICKY_FIELDS: InspectorFieldSchema[] = [
  field('offset', 'Sticky Offset (px)', 'number', 'content'),
];

const UNIVERSAL_LAYOUT_OVERLAY_FIELDS: InspectorFieldSchema[] = [
  field('overlayLabel', 'Overlay Label', 'string', 'content'),
];

const UNIVERSAL_VISIBILITY_CONTAINER_FIELDS: InspectorFieldSchema[] = [
  field('visibleCondition', 'Visible When', 'string', 'content'),
];

const UNIVERSAL_SPLIT_MEDIA_FIELDS: InspectorFieldSchema[] = [
  field('title', 'Title', 'string', 'content'),
  field('mediaSide', 'Media Side', 'select', 'content', {
    options: selectOptions([
      { value: 'left', label: 'Left' },
      { value: 'right', label: 'Right' },
    ]),
  }),
  field('mediaType', 'Media Type', 'select', 'content', {
    options: selectOptions([
      { value: 'image', label: 'Image' },
      { value: 'video', label: 'Video' },
      { value: 'audio', label: 'Audio' },
      { value: 'lottie', label: 'Lottie' },
    ]),
  }),
  field('mediaSrc', 'Media Source (URL)', 'string', 'content'),
];

const UNIVERSAL_VIDEO_PLAYER_FIELDS: InspectorFieldSchema[] = [
  field('src', 'Source URL', 'string', 'content'),
  field('poster', 'Poster URL', 'string', 'content'),
  field('aspectRatio', 'Aspect Ratio', 'string', 'content', { placeholder: '16 / 9' }),
  field('autoplay', 'Autoplay', 'boolean', 'content'),
  field('loop', 'Loop', 'boolean', 'content'),
  field('muted', 'Muted', 'boolean', 'content'),
  field('controls', 'Show Controls', 'boolean', 'content'),
  field('showCaptions', 'Show Captions', 'boolean', 'content'),
  field('captionsSrc', 'Captions VTT URL', 'string', 'content'),
];

const UNIVERSAL_AUDIO_PLAYER_FIELDS: InspectorFieldSchema[] = [
  field('src', 'Source URL', 'string', 'content'),
  field('autoplay', 'Autoplay', 'boolean', 'content'),
  field('loop', 'Loop', 'boolean', 'content'),
  field('showWaveform', 'Show Waveform', 'boolean', 'content'),
  field('playbackSpeedControl', 'Playback Speed Control', 'boolean', 'content'),
];

const UNIVERSAL_QR_CODE_FIELDS: InspectorFieldSchema[] = [
  field('value', 'Value', 'string', 'content'),
  field('size', 'Size (px)', 'number', 'content'),
  field('errorCorrectionLevel', 'Error Correction', 'select', 'content', {
    options: selectOptions([
      { value: 'L', label: 'L (7%)' },
      { value: 'M', label: 'M (15%)' },
      { value: 'Q', label: 'Q (25%)' },
      { value: 'H', label: 'H (30%)' },
    ]),
  }),
  field('logoOverlay', 'Logo Overlay URL', 'string', 'content'),
  field('downloadable', 'Downloadable', 'boolean', 'content'),
];

const UNIVERSAL_BARCODE_FIELDS: InspectorFieldSchema[] = [
  field('value', 'Value', 'string', 'content'),
  field('format', 'Format', 'select', 'content', {
    options: selectOptions([
      { value: 'CODE128', label: 'CODE128' },
      { value: 'EAN13', label: 'EAN13' },
      { value: 'UPC', label: 'UPC' },
    ]),
  }),
  field('showValue', 'Show Value', 'boolean', 'content'),
  field('size', 'Bar Width', 'number', 'content'),
];

const PLATFORM_CHROME_COMMAND_PALETTE_FIELDS: InspectorFieldSchema[] = [
  field('hotkey', 'Hotkey', 'string', 'content', { placeholder: 'mod+k' }),
  field('searchScopes', 'Search Scopes (CSV)', 'string', 'content', { placeholder: 'pages,records,actions' }),
  field('recentItemsCount', 'Recent Items Count', 'number', 'content'),
  field('items', 'Command Items (JSON)', 'string', 'content'),
];

const PLATFORM_CHROME_NOTIFICATION_BELL_FIELDS: InspectorFieldSchema[] = [
  field('unreadCount', 'Unread Count', 'number', 'content'),
  field('maxItemsShown', 'Max Items Shown', 'number', 'content'),
  field('items', 'Notifications (JSON)', 'string', 'content'),
];

const PLATFORM_CHROME_USER_MENU_FIELDS: InspectorFieldSchema[] = [
  field('displayName', 'Display Name', 'string', 'content'),
  field('avatarUrl', 'Avatar URL', 'string', 'content'),
  field('menuItems', 'Menu Items (JSON)', 'string', 'content'),
];

const HEROUI_CHAT_WIDGET_FIELDS: InspectorFieldSchema[] = [
  field('channelRef', 'Channel Ref', 'string', 'content'),
  field('messagesDataSource', 'Messages Data Source Id', 'string', 'content'),
  field('showTypingIndicator', 'Show Typing Indicator', 'boolean', 'content'),
];

const UNIVERSAL_SEPARATOR_FIELDS: InspectorFieldSchema[] = [
  field('orientation', 'Orientation', 'select', 'content', {
    options: selectOptions([
      { value: 'horizontal', label: 'Horizontal' },
      { value: 'vertical', label: 'Vertical' },
    ]),
  }),
];

const UNIVERSAL_SPACER_FIELDS: InspectorFieldSchema[] = [
  field('size', 'Size (px)', 'number', 'content'),
  field('axis', 'Axis', 'select', 'content', {
    options: selectOptions([
      { value: 'vertical', label: 'Vertical' },
      { value: 'horizontal', label: 'Horizontal' },
    ]),
  }),
];

const UNIVERSAL_ICON_FIELDS: InspectorFieldSchema[] = [
  field('iconName', 'Lucide Icon', 'icon-picker', 'content'),
  field('size', 'Size (px)', 'number', 'content'),
];

// Bug found (parity audit item P3.20): all four widgets below previously shared one
// UNIVERSAL_FORM_EXTRA_FIELDS array with both 'max' and 'length', but each widget's real
// renderer (DesignerRuntimeUniversalWidgets.tsx + designerUniversalRuntime.tsx, and the
// matching export codegen in tsxUniversalPalette.ts) only ever reads ONE of the two, or
// neither — the others were always fully dead in both preview and export. Split into the
// exact field set each widget's real component actually consumes.
const UNIVERSAL_FORM_LABEL_VALUE_FIELDS: InspectorFieldSchema[] = [
  field('label', 'Label', 'string', 'heroui'),
  field('value', 'Value', 'string', 'heroui'),
];

const TIME_INPUT_STEP_OPTIONS = selectOptions([
  { value: '1', label: '1 second' },
  { value: '60', label: '1 minute' },
  { value: '300', label: '5 minutes' },
  { value: '600', label: '10 minutes' },
  { value: '900', label: '15 minutes' },
  { value: '3600', label: '1 hour' },
]);

/** Shared enrichment for form.time-input / form.datetime-input (phase 40). */
const UNIVERSAL_FORM_TIME_DATETIME_SHARED_FIELDS: InspectorFieldSchema[] = [
  field('granularity', 'Granularity', 'select', 'heroui', {
    options: selectOptions([
      { value: 'hour', label: 'hour' },
      { value: 'minute', label: 'minute' },
      { value: 'second', label: 'second' },
    ]),
  }),
  field('step', 'Step (seconds)', 'select', 'heroui', { options: TIME_INPUT_STEP_OPTIONS }),
  field('hourCycle', 'Hour Cycle', 'select', 'heroui', {
    options: selectOptions(toDesignerDatePickerSelectOptions(DESIGNER_DATE_PICKER_HOUR_CYCLE_OPTIONS)),
  }),
  HEROUI_REQUIRED,
  HEROUI_DISABLED,
  HEROUI_SIZE,
  field('isInvalid', 'Invalid', 'boolean', 'heroui'),
  field('errorMessage', 'Error Message', 'string', 'heroui'),
];

const UNIVERSAL_FORM_TIME_INPUT_FIELDS: InspectorFieldSchema[] = [
  ...UNIVERSAL_FORM_LABEL_VALUE_FIELDS,
  field('min', 'Min Time', 'string', 'heroui', { placeholder: '09:00' }),
  field('max', 'Max Time', 'string', 'heroui', { placeholder: '17:00' }),
  ...UNIVERSAL_FORM_TIME_DATETIME_SHARED_FIELDS,
];

const UNIVERSAL_FORM_DATETIME_INPUT_FIELDS: InspectorFieldSchema[] = [
  ...UNIVERSAL_FORM_LABEL_VALUE_FIELDS,
  field('min', 'Min Date & Time', 'string', 'heroui', { placeholder: '2026-01-01T09:00' }),
  field('max', 'Max Date & Time', 'string', 'heroui', { placeholder: '2026-12-31T17:00' }),
  field('timeZone', 'Time Zone', 'select', 'heroui', {
    options: selectOptions(toDesignerDatePickerSelectOptions(DESIGNER_DATE_PICKER_TIMEZONE_OPTIONS)),
  }),
  ...UNIVERSAL_FORM_TIME_DATETIME_SHARED_FIELDS,
];

const UNIVERSAL_FORM_RATING_FIELDS: InspectorFieldSchema[] = [
  ...UNIVERSAL_FORM_LABEL_VALUE_FIELDS,
  field('max', 'Max', 'number', 'heroui'),
];

const UNIVERSAL_FORM_OTP_FIELDS: InspectorFieldSchema[] = [
  ...UNIVERSAL_FORM_LABEL_VALUE_FIELDS,
  field('length', 'Length', 'number', 'heroui'),
];

const assignFields = (fields: InspectorFieldSchema[], ...paletteItemIds: string[]): Record<string, InspectorFieldSchema[]> =>
  Object.fromEntries(paletteItemIds.map((id) => [id, fields]));

export const HEROUI_PALETTE_PROP_FIELD_MAP: Record<string, InspectorFieldSchema[]> = {
  ...assignFields(HEROUI_BUTTON_FIELDS, 'heroui.button-solid', 'heroui.button-outline'),
  ...assignFields(HEROUI_CHIP_FIELDS, 'heroui.chip'),
  // Bug found (parity audit item 20): @heroui/react's real Link component (`linkVariants` in
  // @heroui/styles) defines ZERO variants at all — no `size`, no `color`, nothing. Both fields
  // were always fully inert in the canvas, live preview, and exported app alike. Removed rather
  // than left decorative.
  ...assignFields([], 'heroui.link'),
  ...assignFields([HEROUI_SIZE], 'heroui.avatar', 'heroui.spinner'),
  // Bug found (parity audit item 22): "Loaded" (`isLoaded`) removed — @heroui/react's real
  // Skeleton (SkeletonRootProps) has no such prop at all, so it was always fully inert in both
  // the canvas/live preview and the exported app. Replaced with the real, working `animationType`
  // prop (none/pulse/shimmer — the component's only actual variant), previously not exposed
  // anywhere in the Inspector.
  ...assignFields([
    field('animationType', 'Animation Type', 'select', 'heroui', {
      options: selectOptions([
        { value: 'shimmer', label: 'shimmer' },
        { value: 'pulse', label: 'pulse' },
        { value: 'none', label: 'none' },
      ]),
    }),
  ], 'heroui.skeleton'),
  ...assignFields(HEROUI_INPUT_FIELDS, 'heroui.input-text'),
  ...assignFields(HEROUI_NUMBER_INPUT_FIELDS, 'heroui.number-input'),
  ...assignFields(HEROUI_TEXTAREA_FIELDS, 'heroui.textarea'),
  ...assignFields(HEROUI_SELECT_FIELDS, 'heroui.select'),
  ...assignFields(HEROUI_AUTOCOMPLETE_FIELDS, 'heroui.autocomplete'),
  ...assignFields(HEROUI_CHECKBOX_GROUP_FIELDS, 'heroui.checkbox-group'),
  ...assignFields(HEROUI_RADIO_GROUP_FIELDS, 'heroui.radio-group'),
  ...assignFields([
    field('label', 'Label', 'string', 'heroui'),
    PAGE_GUIDE_HINT_FIELD,
    field('isSelected', 'Selected', 'boolean', 'heroui'),
    HEROUI_DISABLED,
    // Bug found (parity audit item 93): SwitchRootProps / switchVariants expose size sm/md/lg,
    // but Inspector never offered it — capability was hidden rather than a dead field.
    HEROUI_SIZE,
    HEROUI_ARIA,
  ], 'heroui.switch'),
  ...assignFields([
    field('sliderMode', 'Mode', 'select', 'heroui', {
      options: selectOptions([
        { value: 'single', label: 'single' },
        { value: 'range', label: 'range' },
      ]),
    }),
    field('value', 'Value', 'number', 'heroui'),
    field('minValue', 'Range Min Value', 'number', 'heroui'),
    field('maxValue', 'Range Max Value', 'number', 'heroui'),
    field('min', 'Min', 'number', 'heroui'),
    field('max', 'Max', 'number', 'heroui'),
    field('step', 'Step', 'number', 'heroui'),
    field('showTooltip', 'Show Tooltip', 'boolean', 'heroui'),
    HEROUI_ARIA,
    HEROUI_DISABLED,
    // Bug found (parity audit item 55): sliderVariants defines slots only — no size variant.
  ], 'heroui.slider'),
  ...assignFields([
    field('value', 'Value', 'number', 'heroui'),
    HEROUI_ARIA,
    HEROUI_SIZE,
  ], 'heroui.progress'),
  ...assignFields([
    field('isOpen', 'Open', 'boolean', 'heroui'),
    field('size', 'Size', 'select', 'heroui', { options: MODAL_SIZE_OPTIONS }),
    field('placement', 'Placement', 'select', 'heroui', {
      options: selectOptions([
        { value: 'auto', label: 'auto' },
        { value: 'top', label: 'top' },
        { value: 'center', label: 'center' },
        { value: 'bottom', label: 'bottom' },
      ]),
    }),
    field('isDismissable', 'Dismissable', 'boolean', 'heroui'),
    ...HEROUI_OVERLAY_BEHAVIOR_FIELDS,
  ], 'heroui.modal'),
  ...assignFields([
    field('isOpen', 'Open', 'boolean', 'heroui'),
    field('size', 'Size', 'select', 'heroui', { options: MODAL_SIZE_OPTIONS }),
    field('tone', 'Header tone', 'select', 'heroui', {
      options: selectOptions([
        { value: 'danger', label: 'danger (destructive)' },
        { value: 'default', label: 'default (confirm)' },
      ]),
    }),
    field('placement', 'Placement', 'select', 'heroui', {
      options: selectOptions([
        { value: 'auto', label: 'auto' },
        { value: 'top', label: 'top' },
        { value: 'center', label: 'center' },
        { value: 'bottom', label: 'bottom' },
      ]),
    }),
    field('isDismissable', 'Dismissable', 'boolean', 'heroui'),
    ...HEROUI_OVERLAY_BEHAVIOR_FIELDS,
  ], 'heroui.alert-dialog'),
  ...assignFields([
    field('isOpen', 'Open', 'boolean', 'heroui'),
    // Bug found: Drawer had a "Size" field reusing MODAL_SIZE_OPTIONS, but @heroui/react's
    // Drawer has no `size` prop/variant at all (drawer.styles.js only defines `placement`/
    // `variant`) — every value was 100% dead in canvas, preview, and export alike. Replaced
    // with the real, working `placement` prop (which edge the drawer slides from) that was
    // previously not exposed anywhere.
    field('placement', 'Placement', 'select', 'heroui', {
      options: selectOptions([
        { value: 'right', label: 'right' },
        { value: 'left', label: 'left' },
        { value: 'top', label: 'top' },
        { value: 'bottom', label: 'bottom' },
      ]),
    }),
    field('isDismissable', 'Dismissable', 'boolean', 'heroui'),
    ...HEROUI_OVERLAY_BEHAVIOR_FIELDS,
  ], 'heroui.drawer'),
  ...assignFields(HEROUI_DATE_PICKER_FIELDS, 'heroui.date-picker'),
  ...assignFields(HEROUI_DROPDOWN_FIELDS, 'heroui.dropdown'),
  ...assignFields(HEROUI_TAGS_INPUT_FIELDS, 'heroui.tags-input'),
  // Bug found (parity audit item 66): Color on heroui.typography-lead was fully dead in all
  // three paths — the element renders as a raw `<p>` (tsxComponentRegistry / runtimeRenderer),
  // not HeroUI Typography, and even real typographyVariants.color only accepts default/muted
  // (not the seven COLOR_OPTIONS values). Removed rather than wiring a fake color map.
  ...assignFields([], 'heroui.typography-lead'),
  ...assignFields(FORM_COLOR_EDITOR_FIELDS, 'heroui.color-control'),
  ...assignFields(FORM_MONACO_EDITOR_FIELDS, 'form.code-editor'),
  ...assignFields(FORM_HTML_EDITOR_FIELDS, 'form.html-editor'),
  ...assignFields(
    FORM_HTML_EDITOR_FIELDS.map((item) => (
      item.key === 'value' ? { ...item, label: 'Value (Markdown)' } : item
    )),
    'form.markdown-editor',
  ),
  ...assignFields(FORM_MASK_INPUT_FIELDS, 'form.mask-input'),
  ...assignFields(FORM_CALCULATOR_FIELDS, 'form.calculator'),
  ...assignFields([
    HEROUI_SIZE,
    field('page', 'Page', 'number', 'heroui'),
    field('total', 'Total', 'number', 'heroui'),
  ], 'heroui.pagination'),
  // Bug found (cluster D — heroui-data-display): 'heroui.card' and 'heroui.accordion-item'
  // previously exposed a "Size" Inspector field here too, but neither @heroui/react's
  // <Card> (CardRootProps: only `variant`) nor its <Accordion> (AccordionRootProps: only
  // `variant`/`hideSeparator`) has ANY size prop or size style variant — the runtime
  // renderers for both (runtimeRenderer.tsx renderHeroUiStructuralNode) never read
  // node.props.size at all (accordion-item doesn't even spread passthrough props; card's
  // passthrough silently drops `size` since the underlying primitive filters non-DOM props).
  // Proved via a direct DOM diff: rendering heroui.card with size="lg" vs size="sm" produced
  // byte-identical HTML. Removed for these two here.
  //
  // Follow-up (Navigation & Overlays audit, same session): confirmed the identical dead-field
  // bug for 'heroui.tabs' (tabsVariants only defines `variant`), 'heroui.breadcrumbs'
  // (breadcrumbsVariants has zero variants at all), and 'heroui.toolbar' (toolbarVariants only
  // defines `isAttached`/`orientation`) — none of these HeroUI components have a size variant
  // either, so this field was equally dead for all three. 'heroui.field-container' renders as a
  // plain `<fieldset>` (tsxNodeRenderer.ts), not a HeroUI variant-driven component at all, so it
  // has no size concept either — removed for all four now.
  ...assignFields([
    field('items', 'Tab Items', 'content-records', 'heroui', {
      recordFields: [
        { key: 'key', label: 'Key', placeholder: 'tab-0' },
        { key: 'label', label: 'Label', placeholder: 'Tab 1' },
      ],
      recordItemLabel: 'tab',
      recordHasId: false,
    }),
    field('placement', 'Placement', 'select', 'content', {
      options: selectOptions([
        { value: 'top', label: 'Top' },
        { value: 'start', label: 'Start (left in LTR)' },
        { value: 'end', label: 'End (right in LTR)' },
      ]),
    }),
    field('alignment', 'Header alignment', 'select', 'content', {
      options: selectOptions([
        { value: 'start', label: 'Start' },
        { value: 'center', label: 'Center' },
        { value: 'end', label: 'End' },
      ]),
    }),
    field('width', 'Header width', 'select', 'content', {
      options: selectOptions([
        { value: 'fit', label: 'Fit' },
        { value: 'equal', label: 'Equal (fill row)' },
      ]),
    }),
    field('variant', 'Variant', 'select', 'content', {
      options: selectOptions([
        { value: 'line', label: 'Line' },
        { value: 'contained', label: 'Contained (rounded)' },
      ]),
    }),
    field('panelAttachment', 'Panel attachment', 'select', 'content', {
      options: selectOptions([
        { value: 'integrated', label: 'Integrated' },
        { value: 'separated', label: 'Separated' },
      ]),
    }),
    field('overflow', 'Overflow', 'select', 'content', {
      options: selectOptions([
        { value: 'scroll', label: 'Scroll' },
        { value: 'menu', label: 'Menu' },
      ]),
    }),
    field('defaultSelectedKey', 'Active tab', 'string', 'content', { placeholder: 'tab-0' }),
  ], 'heroui.tabs'),
  ...assignFields([
    field('items', 'Breadcrumb Items', 'content-records', 'heroui', {
      recordFields: [
        { key: 'label', label: 'Label', placeholder: 'Home' },
        { key: 'href', label: 'Href', placeholder: '/' },
        { key: 'isCurrent', label: 'Is Current', control: 'checkbox' },
      ],
      recordItemLabel: 'crumb',
      recordHasId: false,
    }),
  ], 'heroui.breadcrumbs'),
  ...assignFields([], 'heroui.field-container', 'heroui.toolbar'),
  ...assignFields(HEROUI_LISTBOX_FIELDS, 'heroui.listbox'),
  ...assignFields(HEROUI_DATA_GRID_FIELDS, 'heroui.data-grid', 'heroui.table'),
  ...assignFields(HEROUI_APP_TABLE_GRID_FIELDS, 'heroui.app-table-grid'),
  ...assignFields([
    field('spec', 'CRUD Set Spec', 'string', 'heroui', {
      jsonEditor: true,
      placeholder: '{"name":"Records","listApi":{"endpointId":"/api/records"},"listBody":"grid","columns":[{"field":"id","label":"Id","cellKind":"text","sortable":true,"filterable":true}],"createApis":[],"patches":[]}',
    }),
  ], 'heroui.crud-set'),
  ...assignFields([
    field('mode', 'Mode', 'enum', 'heroui', {
      options: [
        { value: 'create', label: 'Create' },
        { value: 'edit', label: 'Edit' },
        { value: 'view', label: 'View' },
      ],
    }),
    field('sidePanelPlacement', 'Side panel placement', 'select', 'heroui', {
      options: [
        { value: 'right', label: 'Right' },
        { value: 'left', label: 'Left' },
        { value: 'end', label: 'Opposite to theme direction' },
        { value: 'start', label: 'Same as theme direction' },
      ],
    }),
    field('sidePanelPinnable', 'Pin button', 'boolean', 'heroui'),
    field('sidePanelSplitter', 'Splitter', 'boolean', 'heroui'),
    field('sidePanelBackground', 'Side panel background', 'select', 'heroui', {
      options: [
        { value: 'theme', label: 'Current theme' },
        { value: 'custom', label: 'Specific color' },
      ],
    }),
    field('sidePanelBackgroundColor', 'Side panel color', 'string', 'heroui', { placeholder: '#F1F5F9' }),
    field('sidePanelShowTitle', 'Side panel title', 'boolean', 'heroui'),
    field('sidePanelTitleInHeader', 'Title in header', 'boolean', 'heroui'),
    field('sidePanelTitle', 'Side panel header', 'string', 'heroui', { placeholder: 'Flags' }),
    field('spec', 'Columns spec', 'string', 'heroui', {
      jsonEditor: true,
      placeholder: '{"columns":[{"field":"title","label":"Title","formPlacement":"main"}]}',
    }),
  ], 'heroui.record-form'),
  ...assignFields(HEROUI_ENTITY_PICKER_FIELDS, 'heroui.entity-picker'),
  ...assignFields(FORM_DATE_RANGE_FIELDS, 'form.date-range'),
  // Split Pane dividers are draggable on the live canvas (Interact), in Preview, and in Export
  // via `UiSplitPane`. Disabled was never wired to that handle and is not reintroduced.
  ...assignFields(LAYOUT_SPLIT_PANE_FIELDS, 'layout.split-pane'),
  ...assignFields(LAYOUT_DOCK_PANE_FIELDS, 'layout.dock-pane'),
  // Bug found (parity audit item 23): "Aria Label" removed — it's never read anywhere in either
  // the live preview (DesignerRuntimeParityPalette.tsx) or export (tsxParityPalette.ts); it would
  // only ever land on `Tooltip.Root`/`TooltipTrigger`, a logical react-aria wrapper with no real
  // DOM element, so it was always fully inert and never reached the actual trigger button/link.
  ...assignFields([HEROUI_DISABLED], 'heroui.tooltip-trigger'),
  ...assignFields(VIZ_CHART_BAR_FIELDS, 'viz.chart-bar'),
  ...assignFields(VIZ_CHART_LINE_FIELDS, 'viz.chart-line'),
  ...assignFields(VIZ_CHART_PIE_FIELDS, 'viz.chart-pie'),
  ...assignFields(VIZ_CHART_SPARKLINE_FIELDS, 'viz.chart-sparkline'),
  ...assignFields(VIZ_CHART_ADVANCED_FIELDS, 'viz.chart'),
  ...assignFields(VIZ_MAP_PIN_FIELDS, 'viz.map-pin'),
  ...assignFields(VIZ_MAP_CHOROPLETH_FIELDS, 'viz.map-choropleth'),
  ...assignFields(DASHBOARD_FILTER_BAR_FIELDS, 'dashboard.filter-bar'),
  ...assignFields(VIZ_TREE_DATA_FIELDS, 'viz.tree-view'),
  ...assignFields(VIZ_TREE_SELECT_FIELDS, 'viz.tree-select'),
  ...assignFields(VIZ_TREE_FORM_FIELDS, 'viz.cascader', 'viz.tree-combobox'),
  ...assignFields(VIZ_TIMELINE_FIELDS, 'viz.timeline'),
  ...assignFields(VIZ_GANTT_FIELDS, 'viz.gantt'),
  ...assignFields(VIZ_SHEET_FIELDS, 'viz.sheet'),
  ...assignFields(VIZ_KANBAN_FIELDS, 'viz.kanban'),
  ...assignFields(UNIVERSAL_SEPARATOR_FIELDS, 'layout.separator'),
  ...assignFields(UNIVERSAL_SPACER_FIELDS, 'layout.spacer'),
  ...assignFields(UNIVERSAL_ALERT_BANNER_FIELDS, 'feedback.alert', 'feedback.banner'),
  ...assignFields(UNIVERSAL_RESULT_FIELDS, 'feedback.result'),
  ...assignFields(UNIVERSAL_EMPTY_STATE_FIELDS, 'feedback.empty-state'),
  ...assignFields([
    field('steps', 'Steps (comma-separated)', 'string', 'content'),
    field('activeStep', 'Active Step Index', 'number', 'content'),
  ], 'content.stepper'),
  ...assignFields([
    field('title', 'Title', 'string', 'content'),
    field('slides', 'Slides', 'content-records', 'content', {
      recordItemLabel: 'slide',
      recordFields: [
        { key: 'name', label: 'Name' },
        { key: 'quote', label: 'Quote', control: 'textarea' },
      ],
    }),
  ], 'content.carousel'),
  ...assignFields(UNIVERSAL_ICON_FIELDS, 'content.icon'),
  ...assignFields([
    field('crossFieldValidationRules', 'Cross-Field Validation Rules', 'content-records', 'heroui', {
      recordItemLabel: 'rule',
      recordFields: [
        { key: 'fields', label: 'Fields (comma-separated names)', placeholder: 'password,confirmPassword' },
        { key: 'rule', label: 'Rule (equals/notEquals/greaterThan/lessThan/expression)', placeholder: 'equals' },
        { key: 'expression', label: 'Expression (when rule=expression)', placeholder: 'data.endDate > data.startDate' },
        { key: 'errorMessageKey', label: 'Error Message', placeholder: 'Passwords must match.' },
        { key: 'appliesTo', label: 'Error Target Field', placeholder: 'confirmPassword' },
      ],
    }),
  ], 'html.form'),
  ...assignFields(UNIVERSAL_FORM_RATING_FIELDS, 'form.rating'),
  ...assignFields(UNIVERSAL_FORM_OTP_FIELDS, 'form.otp-input'),
  ...assignFields(UNIVERSAL_FORM_TIME_INPUT_FIELDS, 'form.time-input'),
  ...assignFields(UNIVERSAL_FORM_DATETIME_INPUT_FIELDS, 'form.datetime-input'),
  // Bug found (parity audit item P4.21, UX-quality — not a correctness bug): unlike sibling
  // Dual-Mode widgets (content.feature-grid, content.blog-card, content.team-member,
  // content.description-list, content.carousel), these three shared UNIVERSAL_JSON_DATA_FIELDS
  // — the only way to edit their structured data was a raw JSON text field. Replaced with the
  // same structured content-records editor sibling widgets already have, matching each
  // widget's real field shape (see universalMockFixtures.ts / DesignerRuntimeUniversalWidgets.tsx).
  ...assignFields([
    field('title', 'Title', 'string', 'content'),
    field('data', 'Questions', 'content-records', 'content', {
      recordItemLabel: 'question',
      recordFields: [
        { key: 'question', label: 'Question' },
        { key: 'answer', label: 'Answer', control: 'textarea' },
      ],
    }),
  ], 'marketing.faq-accordion'),
  ...assignFields([
    field('title', 'Title', 'string', 'content'),
    field('data', 'Testimonials', 'content-records', 'content', {
      recordItemLabel: 'testimonial',
      recordFields: [
        { key: 'name', label: 'Name' },
        { key: 'role', label: 'Role' },
        { key: 'quote', label: 'Quote', control: 'textarea' },
        { key: 'avatar', label: 'Avatar (URL)' },
      ],
    }),
  ], 'marketing.testimonial-carousel'),
  ...assignFields([
    field('title', 'Title', 'string', 'content'),
    field('data', 'Pricing tiers', 'content-records', 'content', {
      recordItemLabel: 'tier',
      recordFields: [
        { key: 'name', label: 'Name' },
        { key: 'price', label: 'Price', placeholder: '$19' },
        { key: 'period', label: 'Period', placeholder: '/mo' },
        { key: 'features', label: 'Features (comma-separated)', control: 'textarea' },
        { key: 'cta', label: 'Call to Action', placeholder: 'Choose plan' },
        { key: 'featured', label: 'Featured', control: 'checkbox' },
      ],
    }),
  ], 'marketing.pricing-table'),
  ...assignFields([
    field('title', 'Title', 'string', 'content'),
    field('data', 'Rows', 'content-records', 'content', {
      recordItemLabel: 'row',
      recordHasId: false,
      recordFields: [
        { key: 'term', label: 'Term' },
        { key: 'detail', label: 'Detail' },
      ],
    }),
  ], 'content.description-list'),
  ...assignFields([
    field('title', 'Title', 'string', 'content'),
    field('data', 'Features', 'content-records', 'content', {
      recordItemLabel: 'feature',
      recordFields: [
        { key: 'title', label: 'Title' },
        { key: 'description', label: 'Description', control: 'textarea' },
      ],
    }),
  ], 'content.feature-grid'),
  ...assignFields([
    field('title', 'Title', 'string', 'content'),
    field('data', 'Posts', 'content-records', 'content', {
      recordItemLabel: 'post',
      recordFields: [
        { key: 'title', label: 'Title' },
        { key: 'summary', label: 'Summary', control: 'textarea' },
        { key: 'date', label: 'Date', placeholder: '2026-07-01' },
      ],
    }),
  ], 'content.blog-card'),
  ...assignFields([
    field('title', 'Title', 'string', 'content'),
    field('data', 'Team members', 'content-records', 'content', {
      recordItemLabel: 'member',
      recordFields: [
        { key: 'name', label: 'Name' },
        { key: 'role', label: 'Role' },
        { key: 'bio', label: 'Bio', control: 'textarea' },
      ],
    }),
  ], 'content.team-member'),
  ...assignFields([
    field('label', 'Label', 'string', 'content'),
    field('value', 'Value', 'string', 'content'),
    field('trend', 'Trend', 'string', 'content'),
    field('trendDirection', 'Trend Direction', 'select', 'content', {
      options: selectOptions([
        { value: 'up', label: 'Up' },
        { value: 'down', label: 'Down' },
      ]),
    }),
  ], 'content.stat-trend'),
  ...assignFields(UNIVERSAL_LAYOUT_ASPECT_RATIO_FIELDS, 'layout.aspect-ratio'),
  ...assignFields(UNIVERSAL_LAYOUT_STICKY_FIELDS, 'layout.sticky'),
  ...assignFields(UNIVERSAL_LAYOUT_OVERLAY_FIELDS, 'layout.overlay'),
  ...assignFields(UNIVERSAL_VISIBILITY_CONTAINER_FIELDS, 'logic.visibility-container'),
  ...assignFields(UNIVERSAL_SPLIT_MEDIA_FIELDS, 'content.split-media'),
  ...assignFields(UNIVERSAL_VIDEO_PLAYER_FIELDS, 'content.video-player'),
  ...assignFields(UNIVERSAL_AUDIO_PLAYER_FIELDS, 'content.audio-player'),
  ...assignFields(UNIVERSAL_QR_CODE_FIELDS, 'content.qr-code'),
  ...assignFields(UNIVERSAL_BARCODE_FIELDS, 'content.barcode'),
  ...assignFields(PLATFORM_CHROME_COMMAND_PALETTE_FIELDS, 'platform-navigation.command-palette'),
  ...assignFields(PLATFORM_CHROME_NOTIFICATION_BELL_FIELDS, 'platform-navigation.notification-bell'),
  ...assignFields(PLATFORM_CHROME_USER_MENU_FIELDS, 'platform-navigation.user-menu'),
  ...assignFields(HEROUI_CHAT_WIDGET_FIELDS, 'heroui.chat-widget'),
  ...assignFields([
    HEROUI_OPTION_ITEMS_FIELD,
    field('options', 'Options (comma-separated, legacy)', 'string', 'content'),
    field('selected', 'Selected', 'string', 'content'),
  ], 'content.segmented-control'),
  ...assignFields([
    field('title', 'Title', 'string', 'content'),
    field('subtitle', 'Subtitle', 'string', 'content'),
    field('primaryCta', 'Primary CTA', 'string', 'content'),
    field('secondaryCta', 'Secondary CTA', 'string', 'content'),
  ], 'marketing.hero-cta'),
  ...assignFields([
    field('title', 'Title', 'string', 'content'),
    field('placeholder', 'Placeholder', 'string', 'content'),
    field('buttonLabel', 'Button Label', 'string', 'content'),
  ], 'marketing.newsletter-signup'),
  ...assignFields([
    field('title', 'Title', 'string', 'content'),
    field('description', 'Description', 'string', 'content'),
    field('actionLabel', 'Action Label', 'string', 'content'),
  ], 'content.cta-banner'),
};

export const PALETTE_TAILWIND_FIELD_KEY_MAP: Record<string, readonly string[]> = {
  'layout.flex-row': ['twFlexDirection', 'twItems', 'twJustify', 'twGap'],
  'layout.flex-column': ['twFlexDirection', 'twItems', 'twJustify', 'twGap'],
  'layout.grid-2': ['layoutGridDirection', 'twGridCols', 'layoutGridColumnWidths', 'twGap'],
  'layout.grid-3': ['layoutGridDirection', 'twGridCols', 'layoutGridColumnWidths', 'twGap'],
  'layout.columns': ['layoutGridDirection', 'twGridCols', 'layoutGridColumnWidths', 'twGap'],
  'layout.center': ['twItems', 'twJustify', 'twGap'],
  'layout.wrapper': ['twWidth', 'twPadding'],
  'layout.scroll': ['twOverflow', 'twHeight'],
  'layout.sticky-bar': ['twPosition', 'twPadding'],
  'layout.dock-pane': ['twWidth', 'twHeight', 'twFlexDirection', 'twGap', 'twPadding'],
  'layout.split-pane': ['twWidth', 'twHeight', 'twFlexDirection', 'twGap'],
};
