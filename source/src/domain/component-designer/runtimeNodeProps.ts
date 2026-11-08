import type { CSSProperties } from 'react';
import { parseHtmlExtraAttrs } from './domProps';
import {
  shouldPassthroughRuntimePropKey,
  JSX_ATTRIBUTE_NAME_OVERRIDES,
  toJsxAttributeName,
} from './propRegistry';
import type { DesignerNode } from './types';
import { getNodePaletteItemId, readBoolean, readNumber, readString } from './runtimeShared';
import { isRegionColumnBindingDefinition } from './bindingRegionEngine';
import { parseDesignerDatePickerValue } from '../../shared/lib/designerDatePickerConfig';
import type { RuntimeRenderOptions } from './runtimeTypes';

export type RuntimeComponentPropsOptions = {
  excludeKeys?: ReadonlySet<string>;
  /** When true, maps HTML-style disabled/required to library boolean prop names. */
  libraryComponent?: boolean;
};

const LIBRARY_PROP_ALIASES: Record<string, string> = {
  ariaLabel: 'aria-label',
  disabled: 'isDisabled',
  inputType: 'type',
  isLoading: 'isPending',
};

/**
 * HeroUI v3 does not consume these; spreading them reaches native DOM and triggers React
 * warnings. `fallbackSrc` added (parity audit item 21) — @heroui/react's real `Avatar.Image`
 * declares no such prop at all, so a leftover value on an older saved document would otherwise
 * spread onto the real component and leak through to the underlying DOM element.
 */
const LIBRARY_BLOCKED_PASSTHROUGH_KEYS = new Set<string>(['isReadOnly', 'isRequired', 'fallbackSrc']);

const isEmptyRuntimePropValue = (value: unknown): boolean =>
  value === undefined || value === null || value === '';

export const nodeHasRegionColumnBinding = (node: DesignerNode): boolean =>
  Object.values(node.binding).some((definition) => definition && isRegionColumnBindingDefinition(definition));

export const resolveRegionFormFieldNameProps = (node: DesignerNode): { name?: string } => {
  if (!nodeHasRegionColumnBinding(node)) {
    return {};
  }

  return { name: node.id };
};

export const resolveRuntimeComponentProps = (
  node: DesignerNode,
  options: RuntimeComponentPropsOptions = {},
): Record<string, unknown> => {
  const excludeKeys = options.excludeKeys ?? new Set<string>();
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(node.props)) {
    if (!shouldPassthroughRuntimePropKey(key, excludeKeys)) {
      continue;
    }

    if (options.libraryComponent && LIBRARY_BLOCKED_PASSTHROUGH_KEYS.has(key)) {
      continue;
    }

    if (isEmptyRuntimePropValue(value)) {
      continue;
    }

    if (typeof value === 'string' && value.trim().length === 0) {
      continue;
    }

    const paletteItemId = getNodePaletteItemId(node);
    const mappedKey = options.libraryComponent
      ? (LIBRARY_PROP_ALIASES[key] ?? toJsxAttributeName(key, paletteItemId))
      : toJsxAttributeName(key, paletteItemId);

    resolved[mappedKey] = value;
  }

  if (options.libraryComponent) {
    if (node.props.isDisabled === true || node.props.disabled === true) {
      resolved.isDisabled = true;
    }
    if (node.props.isRequired === true || node.props.required === true) {
      resolved.required = true;
    }
    if (node.props.isLoading === true) {
      resolved.isPending = true;
    }
    if (node.props.isReadOnly === true || node.props.readOnly === true) {
      resolved.readOnly = true;
    }
    if (typeof node.props.ariaLabel === 'string' && node.props.ariaLabel.trim().length > 0) {
      resolved['aria-label'] = node.props.ariaLabel.trim();
    }

    // Parity with buildNodeJsxAttributes: these keys are RUNTIME_SPECIAL_MERGE (skipped in the
    // generic loop) and must be re-applied — same as TSX_SPECIAL_MERGE on the codegen path.
    const extraAttrs = parseHtmlExtraAttrs(node.props.htmlExtraAttrs);
    for (const [attrKey, attrValue] of Object.entries(extraAttrs)) {
      if (attrKey in resolved) {
        continue;
      }
      resolved[attrKey] = attrValue;
    }
    if (typeof node.props.dataTestId === 'string' && node.props.dataTestId.trim().length > 0) {
      resolved['data-testid'] = node.props.dataTestId.trim();
    }
  }

  return resolved;
};

export const resolveImageObjectFitStyle = (node: DesignerNode): CSSProperties | undefined => {
  const objectFit = node.props.objectFit;
  if (
    objectFit === 'contain'
    || objectFit === 'cover'
    || objectFit === 'fill'
    || objectFit === 'none'
    || objectFit === 'scale-down'
  ) {
    return { objectFit };
  }

  return undefined;
};

export const resolveInputValidationProps = (
  node: DesignerNode,
  previewFieldErrors?: Record<string, string>,
): Record<string, unknown> => {
  const props: Record<string, unknown> = {};
  const previewError = previewFieldErrors?.[node.id];

  if (previewError) {
    props.isInvalid = true;
    props.errorMessage = previewError;
  } else if (readBoolean(node.props.isInvalid)) {
    props.isInvalid = true;
  }

  if (!previewError) {
    const errorMessage = readString(node.props.errorMessage);
    if (errorMessage) {
      props.errorMessage = errorMessage;
    }
  }

  const pattern = readString(node.props.pattern);
  if (pattern) {
    props.pattern = pattern;
  }

  const maxLength = readNumber(node.props.maxLength, Number.NaN);
  if (Number.isFinite(maxLength)) {
    props.maxLength = maxLength;
  }

  const minLength = readNumber(node.props.minLength, Number.NaN);
  if (Number.isFinite(minLength)) {
    props.minLength = minLength;
  }

  return props;
};

const INPUT_MODE_VALUES = new Set(['text', 'numeric', 'email', 'tel', 'url']);

export const resolveInputUxProps = (node: DesignerNode): Record<string, unknown> => {
  const props: Record<string, unknown> = {};

  const description = readString(node.props.description);
  if (description) {
    props.description = description;
  }

  const startContent = readString(node.props.startContent);
  if (startContent) {
    props.startContent = startContent;
  }

  const endContent = readString(node.props.endContent);
  if (endContent) {
    props.endContent = endContent;
  }

  if (readBoolean(node.props.isClearable)) {
    props.isClearable = true;
  }

  if (readBoolean(node.props.autoFocus)) {
    props.autoFocus = true;
  }

  const inputMode = readString(node.props.inputMode);
  if (INPUT_MODE_VALUES.has(inputMode)) {
    props.inputMode = inputMode;
  }

  return props;
};

export const resolveSelectMenuProps = (node: DesignerNode): Record<string, unknown> => {
  const props: Record<string, unknown> = {};

  if (readBoolean(node.props.isLoading)) {
    props.isLoading = true;
    props.isPending = true;
  }

  // Bug found (parity audit item 47, re-verified): a prior pass forwarded
  // `shouldCloseOnSelect` here believing it was the real react-stately/HeroUI Select prop name
  // (renamed from the Inspector's `closeOnSelect`). Re-checked directly against the installed
  // `@heroui/react/node_modules/react-aria-components` type defs: `shouldCloseOnSelect` only
  // exists on `Menu`/`MenuItem` and `DatePicker`/`DateRangePicker` — `Select.d.ts` and
  // `Autocomplete.d.ts` have no such prop, and HeroUI's `AutocompleteRoot`/`SelectRoot` spread
  // straight onto react-aria-components' `Select`, which always closes its popover on selection
  // with no override. Forwarding this prop (under either name) was inert on the real component
  // in every path — dropped rather than kept decorative (the field itself was removed from
  // Inspector, see inspectorPaletteFields.ts).

  return props;
};

export const resolveAutocompleteMenuProps = (node: DesignerNode): Record<string, unknown> => {
  // Bug found (parity audit item 92): `allowCustomValue` removed — HeroUI Autocomplete is Select-based
  // (not ComboBox), so custom-value entry never existed. Legacy document values are ignored.
  return resolveSelectMenuProps(node);
};

const OVERLAY_BACKDROP_VALUES = new Set(['transparent', 'opaque', 'blur']);
const OVERLAY_SCROLL_BEHAVIOR_VALUES = new Set(['inside', 'outside']);

export const resolveOverlayBehaviorProps = (node: DesignerNode): Record<string, unknown> => {
  const props: Record<string, unknown> = {};

  const backdrop = readString(node.props.backdrop);
  if (OVERLAY_BACKDROP_VALUES.has(backdrop)) {
    props.backdrop = backdrop;
  }

  const scrollBehavior = readString(node.props.scrollBehavior);
  if (OVERLAY_SCROLL_BEHAVIOR_VALUES.has(scrollBehavior)) {
    props.scrollBehavior = scrollBehavior;
  }

  if (readBoolean(node.props.isKeyboardDismissDisabled)) {
    props.isKeyboardDismissDisabled = true;
  }

  if (node.props.isDismissable === false) {
    props.isDismissable = false;
  }

  const placement = readString(node.props.placement);
  if (placement) {
    props.placement = placement;
  }

  return props;
};

export const resolveModalOverlayPartProps = (node: DesignerNode): {
  backdrop: Record<string, unknown>;
  container: Record<string, unknown>;
} => {
  const backdrop: Record<string, unknown> = {};
  const container: Record<string, unknown> = {};

  const backdropVariant = readString(node.props.backdrop);
  if (OVERLAY_BACKDROP_VALUES.has(backdropVariant)) {
    backdrop.variant = backdropVariant;
  } else {
    backdrop.variant = 'blur';
  }

  const scrollBehavior = readString(node.props.scrollBehavior);
  if (OVERLAY_SCROLL_BEHAVIOR_VALUES.has(scrollBehavior)) {
    container.scroll = scrollBehavior;
  }

  if (readBoolean(node.props.isKeyboardDismissDisabled)) {
    backdrop.isKeyboardDismissDisabled = true;
  }

  if (node.props.isDismissable === false) {
    backdrop.isDismissable = false;
  }

  const placement = readString(node.props.placement);
  if (placement) {
    container.placement = placement;
  }

  return { backdrop, container };
};

export const resolveTableStructureProps = (node: DesignerNode): Record<string, unknown> => {
  const props: Record<string, unknown> = {};

  if (readBoolean(node.props.isStriped)) {
    props.isStriped = true;
  }

  if (readBoolean(node.props.isHeaderSticky)) {
    props.isHeaderSticky = true;
  }

  const emptyContent = readString(node.props.emptyContent);
  if (emptyContent) {
    props.emptyContent = emptyContent;
  }

  return props;
};

export const resolveTableSelectionProps = (node: DesignerNode): Record<string, unknown> => {
  const props: Record<string, unknown> = {};
  const selectionMode = readString(node.props.selectionMode);

  if (selectionMode === 'none' || selectionMode === 'single' || selectionMode === 'multiple') {
    props.selectionMode = selectionMode;
  }

  const selectedKeysRaw = readString(node.props.selectedKeys);
  if (selectedKeysRaw) {
    const keys = selectedKeysRaw.split(',').map((key) => key.trim()).filter((key) => key.length > 0);
    if (keys.length > 0) {
      props.selectedKeys = selectionMode === 'single' ? keys[0] : keys;
    }
  }

  return props;
};

export const resolveTableProps = (node: DesignerNode): Record<string, unknown> => ({
  ...resolveTableSelectionProps(node),
  ...resolveTableStructureProps(node),
});

export const resolveDataGridProps = (node: DesignerNode): Record<string, unknown> => ({
  ...resolveTableStructureProps(node),
});

export const resolveDataGridPagingProps = (node: DesignerNode): Record<string, unknown> => {
  const props: Record<string, unknown> = {};
  const gridQueryMode = readString(node.props.gridQueryMode);
  if (gridQueryMode === 'client' || gridQueryMode === 'server') {
    props.gridQueryMode = gridQueryMode;
  }

  const pageSize = readNumber(node.props.pageSize, Number.NaN);
  if (Number.isFinite(pageSize)) {
    props.pageSize = pageSize;
  }

  const page = readNumber(node.props.page, Number.NaN);
  if (Number.isFinite(page)) {
    props.page = page;
  }

  const total = readNumber(node.props.total, Number.NaN);
  if (Number.isFinite(total)) {
    props.total = total;
  }

  return props;
};

export const resolveEntityPickerProps = (node: DesignerNode): Record<string, unknown> => {
  const props: Record<string, unknown> = {};

  const label = readString(node.props.label);
  if (label) {
    props.label = label;
  }

  // Bug found (parity audit item 27): `entityRef`/`searchParam` removed from this spread —
  // they're Designer-internal bookkeeping (which API endpoint / query param to search with),
  // never real props on the real `@heroui/react` Autocomplete (AutocompleteRootProps declares
  // no such props at all) — they always leaked as unrecognized DOM attributes. The values are
  // still read directly from `node.props` wherever they're actually needed (e.g.
  // bindingEntityPickerCodegen.ts's real search-endpoint resolution), independent of this prop
  // spread.

  if (readBoolean(node.props.isLoading)) {
    props.isLoading = true;
    props.isPending = true;
  }

  return {
    ...props,
    ...resolveSelectMenuProps(node),
  };
};

export const resolveDateRangeProps = (
  node: DesignerNode,
  options?: Pick<RuntimeRenderOptions, 'previewBindings'>,
): Record<string, unknown> => {
  const props: Record<string, unknown> = {};
  const granularity = readString(node.props.granularity, 'day');

  // Bug found (parity audit item 59): startValue/endValue Property Bindings were ignored in
  // interactive Preview because this resolver never consulted options.previewBindings — Export
  // already resolved them correctly via resolveNodePropertyBindingExpression.
  const startRaw = options?.previewBindings?.resolveTextProp?.(node, 'startValue', '')
    ?? readString(node.props.startValue);
  const endRaw = options?.previewBindings?.resolveTextProp?.(node, 'endValue', '')
    ?? readString(node.props.endValue);
  const label = options?.previewBindings?.resolveTextProp?.(node, 'label', '')
    ?? readString(node.props.label);
  if (label) {
    props.label = label;
  }

  if (readBoolean(node.props.isDisabled) || readBoolean(node.props.disabled)) {
    props.isDisabled = true;
  }

  if (readBoolean(node.props.isRequired) || readBoolean(node.props.required)) {
    props.isRequired = true;
  }

  if (readBoolean(node.props.isReadOnly) || readBoolean(node.props.readOnly)) {
    props.isReadOnly = true;
  }

  if (granularity === 'day' || granularity === 'hour' || granularity === 'minute' || granularity === 'second') {
    props.granularity = granularity;
  }

  const timeZone = readString(node.props.timeZone);
  if (timeZone) {
    props.timeZone = timeZone;
  }

  // Bug found (parity audit item 60): minValue/maxValue/granularity/isReadOnly were supported by
  // DateRangePicker (same DateRangePickerStateOptions as date-picker) but never exposed or wired.
  const minValue = parseDesignerDatePickerValue(readString(node.props.minValue), granularity);
  const maxValue = parseDesignerDatePickerValue(readString(node.props.maxValue), granularity);
  if (minValue) {
    props.minValue = minValue;
  }
  if (maxValue) {
    props.maxValue = maxValue;
  }

  // Bug found: `value` was never read at all — Date Range's binding was entirely decorative.
  // startValue/endValue are bindable ISO date strings; combine into the {start,end} RangeValue
  // HeroUI's react-aria-based DateRangePicker expects for value/defaultValue.
  const start = parseDesignerDatePickerValue(startRaw, granularity);
  const end = parseDesignerDatePickerValue(endRaw, granularity);
  if (start && end) {
    props.defaultValue = { start, end };
  }

  return props;
};

/** Pure check for date-range end ≥ start (parity audit item 58). ISO day strings compare lexicographically. */
export const validateDateRangeOrdering = (startValue: string, endValue: string): string | null => {
  const start = startValue.trim().slice(0, 10);
  const end = endValue.trim().slice(0, 10);
  if (!start || !end) {
    return null;
  }
  if (end < start) {
    return 'End date must be on or after the start date.';
  }
  return null;
};

export const resolveSplitPaneProps = (node: DesignerNode): Record<string, unknown> => {
  const props: Record<string, unknown> = {};

  const direction = readString(node.props.direction);
  if (direction === 'horizontal' || direction === 'vertical') {
    props.direction = direction;
  }

  const defaultSplit = readNumber(node.props.defaultSplit, Number.NaN);
  if (Number.isFinite(defaultSplit)) {
    props.defaultSplit = defaultSplit;
  }

  return props;
};

export const resolveMediaFallbackSrc = (node: DesignerNode): string | undefined => {
  const fallbackSrc = readString(node.props.fallbackSrc);
  return fallbackSrc || undefined;
};

/** Inspector may store lowercase HTML aliases (enctype, autocomplete); React expects camelCase. */
export const readNodePropForReactDomAttribute = (
  props: Record<string, unknown>,
  reactAttributeName: string,
): string | undefined => {
  const keysToCheck = new Set<string>([reactAttributeName]);

  for (const [propKey, jsxName] of Object.entries(JSX_ATTRIBUTE_NAME_OVERRIDES)) {
    if (jsxName === reactAttributeName) {
      keysToCheck.add(propKey);
    }
  }

  for (const key of keysToCheck) {
    const value = readString(props[key]);
    if (value.length > 0) {
      return value;
    }
  }

  return undefined;
};
