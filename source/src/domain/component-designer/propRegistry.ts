/**
 * Canonical prop-mapping policy for inspector, runtime canvas, TSX codegen, and reverse JSX parse.
 * Single source of truth for internal-key denylist and DOM/aria attribute naming.
 */

export const DESIGNER_PALETTE_ITEM_ID_PROP = '_designerPaletteItemId';

const DESIGNER_INTERNAL_PROP_KEYS = new Set<string>([
  DESIGNER_PALETTE_ITEM_ID_PROP,
  'textContentMode',
  'translationKey',
  'labelTranslationKey',
  'placeholderTranslationKey',
  'textTranslationKey',
  'titleTranslationKey',
  'loadingMessageTranslationKey',
  'emptyContentTranslationKey',
  'errorContentTranslationKey',
  'searchPlaceholderTranslationKey',
  'refreshLabelTranslationKey',
  'minViewport',
  'belowMin',
]);

/** Sidecar for the studio page guide — consumed by wrap hosts, never a control prop. */
const DESIGNER_PAGE_GUIDE_SIDECAR_PROP_KEYS = new Set<string>(['hint']);

/** Keys stored on nodes for designer metadata — never emitted to production JSX/DOM passthrough. */
export const isDesignerSystemMetadataPropKey = (key: string): boolean =>
  key.startsWith('_');

/** Tailwind inspector utilities compiled into className — not separate JSX attributes. */
const isDesignerTailwindStoragePropKey = (key: string): boolean =>
  key.startsWith('tw');

/** Layout grid column sizing stored in className — not separate JSX attributes. */
const isDesignerLayoutStoragePropKey = (key: string): boolean =>
  key === 'layoutGridColumnWidths' || key === 'layoutGridDirection';

export const isDesignerInternalPropKey = (key: string): boolean =>
  DESIGNER_INTERNAL_PROP_KEYS.has(key)
  || DESIGNER_PAGE_GUIDE_SIDECAR_PROP_KEYS.has(key)
  || isDesignerTailwindStoragePropKey(key)
  || isDesignerLayoutStoragePropKey(key);

/** Keys handled through dedicated merge paths rather than generic prop iteration. */
const TSX_SPECIAL_MERGE_PROP_KEYS = new Set<string>(['htmlExtraAttrs', 'dataTestId']);

const RUNTIME_SPECIAL_MERGE_PROP_KEYS = new Set<string>([
  'className',
  'style',
  'htmlExtraAttrs',
  'dataTestId',
]);

/** JSX attributes that must emit even when the stored value is an empty string. */
export const EMPTY_STRING_JSX_ATTRIBUTES = new Set<string>([
  'alt',
  'data-page-guide',
  'data-page-guide-surface',
]);

/** Designer-only metadata attrs embedded in generated TSX for lossless reverse parse. */
const isDesignerCodegenMetadataPropKey = (key: string): boolean =>
  key === 'dataDesignerColumns'
  || key === 'dataDesignerItems'
  || key === 'dataDesignerPaletteId'
  || key === 'data-designer-columns'
  || key === 'data-designer-items'
  || key === 'data-designer-palette-id';

export const shouldSkipTsxPropKey = (key: string): boolean =>
  isDesignerInternalPropKey(key)
  || isDesignerSystemMetadataPropKey(key)
  || isDesignerCodegenMetadataPropKey(key)
  || TSX_SPECIAL_MERGE_PROP_KEYS.has(key);

export const shouldPassthroughRuntimePropKey = (
  key: string,
  excludeKeys: ReadonlySet<string> = new Set<string>(),
): boolean =>
  !isDesignerInternalPropKey(key)
  && !isDesignerSystemMetadataPropKey(key)
  && !isDesignerCodegenMetadataPropKey(key)
  && !RUNTIME_SPECIAL_MERGE_PROP_KEYS.has(key)
  && !excludeKeys.has(key);

/** Global HTML/React attributes that must never be dropped by denylist filters. */
const GLOBAL_WEB_ATTRIBUTE_KEYS = new Set<string>([
  'id',
  'title',
  'lang',
  'dir',
  'tabIndex',
  'role',
  'hidden',
  'className',
  'style',
  'ariaLabel',
  'htmlFor',
  'autoComplete',
  'name',
  'encType',
  'enctype',
  'noValidate',
  'readOnly',
  'referrerPolicy',
  'srcSet',
  'inputMode',
  'autoFocus',
  'maxLength',
  'minLength',
  'pattern',
  'errorMessage',
  'validationRule',
  'validationErrorMessage',
  'fallbackSrc',
  'selectionMode',
  'selectedKeys',
  'description',
  'startContent',
  'endContent',
  'isClearable',
  'closeOnSelect',
  'allowCustomValue',
  'backdrop',
  'scrollBehavior',
  'isKeyboardDismissDisabled',
  'isStriped',
  'isHeaderSticky',
  'emptyContent',
  'errorContent',
  'columns',
  'gridQueryMode',
  'pageSize',
  'page',
  'total',
  'entityRef',
  'searchParam',
  'defaultSplit',
  'direction',
  'dock',
  'placement',
  'alignment',
  'width',
  'variant',
  'visualMode',
  'panelAttachment',
  'overflow',
  'defaultSelectedKey',
  'isOpen',
  'isLoaded',
  'min',
  'max',
  'step',
  'accept',
  'multiple',
  'href',
  'target',
  'rel',
]);

export const isGlobalWebAttributeKey = (key: string): boolean =>
  GLOBAL_WEB_ATTRIBUTE_KEYS.has(key)
  || key.startsWith('aria')
  || key.includes('aria-');

export const JSX_ATTRIBUTE_NAME_OVERRIDES: Record<string, string> = {
  ariaLabel: 'aria-label',
  dataTestId: 'data-testid',
  htmlFor: 'htmlFor',
  autoComplete: 'autoComplete',
  encType: 'encType',
  enctype: 'encType',
  autocomplete: 'autoComplete',
  noValidate: 'noValidate',
  readOnly: 'readOnly',
  tabIndex: 'tabIndex',
  className: 'className',
  referrerPolicy: 'referrerPolicy',
  srcSet: 'srcSet',
  inputMode: 'inputMode',
  autoFocus: 'autoFocus',
  maxLength: 'maxLength',
  minLength: 'minLength',
};

/**
 * Palette-scoped Inspector→JSX renames. Must NOT go into the global map: e.g. `min`/`max` on
 * `heroui.number-input` are real HTML attrs, while on `heroui.slider` they must become
 * `minValue`/`maxValue` (react-stately RangeInputBase).
 * Bug found (parity audit items 54).
 */
const PALETTE_JSX_ATTRIBUTE_NAME_OVERRIDES: Record<string, Record<string, string>> = {
  'heroui.slider': {
    min: 'minValue',
    max: 'maxValue',
  },
};

const JSX_ATTRIBUTE_REVERSE_OVERRIDES: Record<string, string> = Object.fromEntries(
  Object.entries(JSX_ATTRIBUTE_NAME_OVERRIDES).map(([propKey, jsxName]) => [jsxName, propKey]),
);

export const BOOLEAN_JSX_ATTRIBUTES = new Set<string>([
  'hidden',
  'disabled',
  'isDisabled',
  'isInvalid',
  'isRequired',
  'required',
  'isSelected',
  'isOpen',
  'isPending',
  'isLoading',
  'isDismissable',
  'isReadOnly',
  'readOnly',
  'noValidate',
  'checked',
  'defaultChecked',
  'multiple',
  'autoFocus',
  'allowFlip',
  'allowFullScreen',
  'shouldCloseOnBlur',
  'isClearable',
  'closeOnSelect',
  'shouldCloseOnSelect',
  'allowCustomValue',
  'isKeyboardDismissDisabled',
  'isStriped',
  'isHeaderSticky',
  'isLoaded',
]);

export const NUMERIC_JSX_ATTRIBUTES = new Set<string>([
  'tabIndex',
  'rows',
  'cols',
  'width',
  'height',
  'minRows',
  'maxRows',
  'maxLength',
  'minLength',
  'value',
  'defaultValue',
  'min',
  'max',
  'minValue',
  'maxValue',
  'step',
  'pageSize',
  'page',
  'total',
  'defaultSplit',
]);

const kebabToCamelCase = (value: string): string =>
  value.replace(/-([a-z])/g, (_match, char: string) => char.toUpperCase());

export const toJsxAttributeName = (propKey: string, paletteItemId?: string | null): string => {
  if (propKey.includes('-')) {
    return propKey;
  }

  if (paletteItemId) {
    const scoped = PALETTE_JSX_ATTRIBUTE_NAME_OVERRIDES[paletteItemId]?.[propKey];
    if (scoped) {
      return scoped;
    }
  }

  return JSX_ATTRIBUTE_NAME_OVERRIDES[propKey] ?? propKey;
};

const DESIGNER_PROP_REVERSE_ALIASES: Record<string, string> = {
  dataSplitDirection: 'direction',
  dataDefaultSplit: 'defaultSplit',
};

export const fromJsxAttributeName = (attributeName: string): string => {
  const reversed = JSX_ATTRIBUTE_REVERSE_OVERRIDES[attributeName];
  if (reversed) {
    return reversed;
  }

  if (attributeName.startsWith('aria-')) {
    const suffix = attributeName.slice(5);
    if (suffix.length === 0) {
      return attributeName;
    }

    return `aria${suffix.charAt(0).toUpperCase()}${kebabToCamelCase(suffix.slice(1))}`;
  }

  if (attributeName.startsWith('data-') && attributeName !== 'data-testid') {
    const suffix = attributeName.slice(5);
    if (suffix.length === 0) {
      return attributeName;
    }

    const camelKey = `data${suffix.charAt(0).toUpperCase()}${kebabToCamelCase(suffix.slice(1))}`;
    return DESIGNER_PROP_REVERSE_ALIASES[camelKey] ?? camelKey;
  }

  return attributeName;
};
