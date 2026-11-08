import type { CSSProperties } from 'react';
import { mergeCssProperties, parseHtmlExtraAttrs, parseInlineStyleValue } from './domProps';
import { resolveCustomSizeDomStyle } from './customSizeStyle';
import { resolveLayoutGridDomStyle } from './layoutGridColumnWidths';
import {
  BOOLEAN_JSX_ATTRIBUTES,
  EMPTY_STRING_JSX_ATTRIBUTES,
  NUMERIC_JSX_ATTRIBUTES,
  shouldSkipTsxPropKey,
  toJsxAttributeName,
} from './propRegistry';
import type { DesignerNode } from './types';
import type { TsxBindingRenderContext } from './bindingCodegen';
import { getNodeRegionDataSourceRef, isDataRegionEligibleContainer } from './bindingRegionEngine';
import { isTsxBindingRawExpression, TSX_BINDING_RAW_EXPRESSION, resolveBoundAttributeForNodeProp, resolveBoundEventAttribute } from './bindingCodegen';
import { getNodePaletteItemId, designerNodePageGuideProps } from './runtimeShared';

export type TsxPropMapperOptions = {
  excludeKeys?: ReadonlySet<string>;
  childrenPropKeys?: ReadonlySet<string>;
  structuralPropKeys?: ReadonlySet<string>;
};

export type BuildNodeJsxAttributesOptions = TsxPropMapperOptions & {
  /** Component-template defaults/computed values — applied only when AST props did not already set the JSX attribute. */
  reservedAttributes?: Record<string, unknown>;
};

const DEFAULT_CHILDREN_PROP_KEYS = new Set<string>(['text', 'label', 'placeholder']);

export { shouldSkipTsxPropKey, toJsxAttributeName } from './propRegistry';

/**
 * JSX double-quoted attribute values are NOT JavaScript string literals: a `"`
 * terminates the value and `\` is treated literally. When a value would require
 * escaping (contains quotes, backslashes, control characters, etc.) it must be
 * emitted inside an expression container so the JS string literal escaping is
 * honored. Returns the right-hand side of an attribute (e.g. `"foo"` or `{"a\"b"}`).
 */
export const jsxAttributeStringValue = (value: string): string => {
  const serialized = JSON.stringify(value);
  const isSafeDoubleQuoted = serialized.slice(1, -1) === value;
  return isSafeDoubleQuoted ? serialized : `{${serialized}}`;
};

/** Escapes a raw string so it is safe to embed as JSX element text content. */
export const escapeJsxTextContent = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;');

export const renderStyleJsxAttribute = (value: unknown): string => {
  const styleObject = parseInlineStyleValue(value);
  if (!styleObject) {
    return '';
  }

  const entries = Object.entries(styleObject).map(([key, rawValue]) => {
    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      return `${key}: ${rawValue}`;
    }

    const stringValue = String(rawValue).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `${key}: '${stringValue}'`;
  });

  return entries.length > 0 ? ` style={{ ${entries.join(', ')} }}` : '';
};

const renderBooleanJsxAttribute = (attributeName: string, value: unknown): string => {
  if (value === true) {
    return ` ${attributeName}`;
  }

  if (value === false) {
    return ` ${attributeName}={false}`;
  }

  return '';
};

const renderStringJsxAttribute = (attributeName: string, value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return '';
  }

  return ` ${attributeName}=${jsxAttributeStringValue(normalized)}`;
};

const renderNumberJsxAttribute = (attributeName: string, value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return ` ${attributeName}={${value}}`;
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (normalized.length === 0) {
      return '';
    }

    if (/^[-+]?\d+(?:\.\d+)?$/.test(normalized)) {
      return ` ${attributeName}={${normalized}}`;
    }
  }

  return '';
};

const renderExpressionJsxAttribute = (attributeName: string, value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return ` ${attributeName}={${value}}`;
  }

  if (typeof value === 'boolean') {
    return renderBooleanJsxAttribute(attributeName, value);
  }

  if (typeof value === 'string') {
    return renderStringJsxAttribute(attributeName, value);
  }

  if (value === null || value === undefined) {
    return '';
  }

  return ` ${attributeName}={${JSON.stringify(value)}}`;
};

export const renderJsxAttribute = (
  propKey: string,
  value: unknown,
  paletteItemId?: string | null,
): string => {
  if (propKey === 'style') {
    return renderStyleJsxAttribute(value);
  }

  const attributeName = toJsxAttributeName(propKey, paletteItemId);

  if (BOOLEAN_JSX_ATTRIBUTES.has(attributeName) || BOOLEAN_JSX_ATTRIBUTES.has(propKey)) {
    return renderBooleanJsxAttribute(attributeName, value);
  }

  if (NUMERIC_JSX_ATTRIBUTES.has(attributeName) || NUMERIC_JSX_ATTRIBUTES.has(propKey)) {
    const numeric = renderNumberJsxAttribute(attributeName, value);
    if (numeric.length > 0) {
      return numeric;
    }
  }

  return renderExpressionJsxAttribute(attributeName, value);
};

const jsxAttributeNameForPropKey = (propKey: string, paletteItemId?: string | null): string =>
  propKey.includes('-') ? propKey : toJsxAttributeName(propKey, paletteItemId);

const renderRawExpressionJsxAttribute = (attributeName: string, expression: string): string =>
  ` ${attributeName}={${expression}}`;

const resolveMergedCodegenStyle = (
  node: DesignerNode,
  reservedStyle?: unknown,
): CSSProperties => mergeCssProperties(
  resolveLayoutGridDomStyle(node),
  resolveCustomSizeDomStyle(node),
  parseInlineStyleValue(node.props.style) as CSSProperties | null,
  parseInlineStyleValue(reservedStyle) as CSSProperties | null,
);

const claimJsxAttribute = (
  attributeMap: Map<string, string>,
  propKey: string,
  value: unknown,
  paletteItemId?: string | null,
): void => {
  const jsxName = jsxAttributeNameForPropKey(propKey, paletteItemId);

  if (value === undefined || value === null) {
    return;
  }

  if (typeof value === 'string' && value.length === 0) {
    if (EMPTY_STRING_JSX_ATTRIBUTES.has(jsxName)) {
      attributeMap.set(jsxName, ` ${jsxName}=""`);
    }
    return;
  }

  if (typeof value === 'string' && value.trim().length === 0) {
    if (EMPTY_STRING_JSX_ATTRIBUTES.has(jsxName)) {
      attributeMap.set(jsxName, ` ${jsxName}=""`);
    }
    return;
  }

  if (attributeMap.has(jsxName)) {
    return;
  }

  if (isTsxBindingRawExpression(value)) {
    attributeMap.set(jsxName, renderRawExpressionJsxAttribute(jsxName, value[TSX_BINDING_RAW_EXPRESSION]));
    return;
  }

  const fragment = renderJsxAttribute(propKey, value, paletteItemId);
  if (fragment.length > 0) {
    attributeMap.set(jsxName, fragment);
  }
};

export const buildNodeJsxAttributes = (
  node: DesignerNode,
  options: BuildNodeJsxAttributesOptions = {},
): string => {
  const attributeMap = new Map<string, string>();
  const excludeKeys = options.excludeKeys ?? new Set<string>();
  const childrenPropKeys = options.childrenPropKeys ?? DEFAULT_CHILDREN_PROP_KEYS;
  const structuralPropKeys = options.structuralPropKeys ?? new Set<string>();
  const paletteItemId = getNodePaletteItemId(node);

  for (const [key, value] of Object.entries(node.props)) {
    if (
      key === 'style'
      || shouldSkipTsxPropKey(key)
      || excludeKeys.has(key)
      || childrenPropKeys.has(key)
      || structuralPropKeys.has(key)
    ) {
      continue;
    }

    claimJsxAttribute(attributeMap, key, value, paletteItemId);
  }

  if (options.reservedAttributes) {
    for (const [key, value] of Object.entries(options.reservedAttributes)) {
      if (key === 'style') {
        continue;
      }

      claimJsxAttribute(attributeMap, key, value, paletteItemId);
    }
  }

  const mergedStyleAttr = renderStyleJsxAttribute(
    resolveMergedCodegenStyle(node, options.reservedAttributes?.style),
  );
  if (mergedStyleAttr.length > 0) {
    attributeMap.set('style', mergedStyleAttr);
  }

  const extraAttrs = parseHtmlExtraAttrs(node.props.htmlExtraAttrs);
  if (typeof node.props.dataTestId === 'string' && node.props.dataTestId.trim().length > 0) {
    extraAttrs['data-testid'] = node.props.dataTestId.trim();
  }

  for (const [key, value] of Object.entries(extraAttrs)) {
    if (attributeMap.has(key)) {
      continue;
    }

    attributeMap.set(key, ` ${key}=${jsxAttributeStringValue(String(value))}`);
  }

  for (const [key, value] of Object.entries(designerNodePageGuideProps(node))) {
    if (attributeMap.has(key) || excludeKeys.has(key)) {
      continue;
    }
    claimJsxAttribute(attributeMap, key, value, paletteItemId);
  }

  return Array.from(attributeMap.values()).join('');
};

export const renderJsxAttributesFromProps = (
  props: Record<string, unknown>,
  options: TsxPropMapperOptions = {},
): string => {
  const attributeMap = new Map<string, string>();
  const excludeKeys = options.excludeKeys ?? new Set<string>();
  const childrenPropKeys = options.childrenPropKeys ?? DEFAULT_CHILDREN_PROP_KEYS;
  const structuralPropKeys = options.structuralPropKeys ?? new Set<string>();

  for (const [key, value] of Object.entries(props)) {
    if (shouldSkipTsxPropKey(key) || excludeKeys.has(key) || childrenPropKeys.has(key) || structuralPropKeys.has(key)) {
      continue;
    }

    claimJsxAttribute(attributeMap, key, value);
  }

  return Array.from(attributeMap.values()).join('');
};

export const renderHtmlExtraJsxAttributes = (node: DesignerNode): string => {
  const extraAttrs = parseHtmlExtraAttrs(node.props.htmlExtraAttrs);

  if (typeof node.props.dataTestId === 'string' && node.props.dataTestId.trim().length > 0) {
    extraAttrs['data-testid'] = node.props.dataTestId.trim();
  }

  return Object.entries(extraAttrs)
    .map(([key, value]) => ` ${key}=${jsxAttributeStringValue(String(value))}`)
    .join('');
};

export const renderNodeJsxAttributes = (
  node: DesignerNode,
  options: BuildNodeJsxAttributesOptions = {},
): string => buildNodeJsxAttributes(node, options);

export const resolveRegionFormFieldNameAttribute = (
  nodeId: string,
  context: TsxBindingRenderContext,
): string => {
  const hasRegionColumnBinding = context.plan.regionPlan.regionColumnBindings.some(
    (binding) => binding.nodeId === nodeId,
  );

  if (!hasRegionColumnBinding) {
    return '';
  }

  return ` name=${JSON.stringify(nodeId)}`;
};

export const buildNodeJsxAttributesWithBindings = (
  node: DesignerNode,
  bindingContext?: TsxBindingRenderContext,
  options: BuildNodeJsxAttributesOptions = {},
): string => {
  const nodeStoreReadBindings = bindingContext?.plan.storeReadBindings.filter(
    (binding) => binding.nodeId === node.id,
  ) ?? [];
  const nodeRegionColumnBindings = bindingContext?.plan.regionPlan.regionColumnBindings.filter(
    (binding) => binding.nodeId === node.id,
  ) ?? [];
  const boundPropKeys = new Set<string>([
    ...(bindingContext?.plan.propertyBindings
      .filter((binding) => binding.nodeId === node.id)
      .map((binding) => binding.targetProp) ?? []),
    // Store-bound props (e.g. html.image `src` bound to a Store path) must also be
    // excluded from the static attribute pass below — otherwise the generic per-prop
    // codegen path (used by simple HTML primitives) never emits the bound expression at
    // all, since resolveNodePropertyBindingExpression is only ever reached for props this
    // function decides to iterate (see CLAUDE-FULL-AUDIT-LOG-cluster-A doc, html.image).
    ...nodeStoreReadBindings.map((binding) => binding.targetProp),
    // Region-column-bound props (e.g. a form input's `value` bound to a loaded record's
    // column) must also be excluded from the static/reserved attribute pass — see the
    // bound-attribute loop below, which is the only place these are actually emitted.
    ...nodeRegionColumnBindings.map((binding) => binding.targetProp),
  ]);
  const hasRegionColumnBinding = nodeRegionColumnBindings.length > 0;
  const excludeKeys = new Set<string>([...(options.excludeKeys ?? []), ...boundPropKeys]);
  // Region-bound fields get their `name` attribute from the region form-field name
  // (the node id) so the submit handler can collect them; never emit the author's
  // own `name` prop as well, which would produce a duplicate JSX attribute.
  if (hasRegionColumnBinding) {
    excludeKeys.add('name');
  }
  let attrs = buildNodeJsxAttributes(node, { ...options, excludeKeys });

  if (!bindingContext) {
    return attrs;
  }

  for (const binding of bindingContext.plan.propertyBindings.filter((item) => item.nodeId === node.id)) {
    attrs += resolveBoundAttributeForNodeProp(node.id, binding.targetProp, bindingContext);
  }

  for (const binding of nodeStoreReadBindings) {
    attrs += resolveBoundAttributeForNodeProp(node.id, binding.targetProp, bindingContext);
  }

  // Bug found (section 2.2 — binding architecture review): region-column value bindings
  // (`sourceType: 'regionColumn'`, e.g. a form input's `value` bound to a loaded record's
  // column via the Region binding wizard) are deliberately excluded from
  // `plan.propertyBindings` by `collectNodePropertyBindings` — they're tracked separately in
  // `plan.regionPlan.regionColumnBindings` instead. This function's bound-attribute loop
  // previously only ever iterated `plan.propertyBindings`/store-read bindings, so a
  // region-bound value was never emitted as a JSX attribute at all in exported/published
  // code — every Region-bound form field (the flagship "Region" binding capability) silently
  // rendered without its loaded value in the published app, while preview (a separate
  // resolution path in designerRuntimePreview.tsx) already resolved it correctly.
  // `resolveNodePropertyBindingExpression`/`resolveBoundAttributeForNodeProp` already handled
  // region-column bindings correctly when called directly — this loop just never called them.
  for (const binding of nodeRegionColumnBindings) {
    attrs += resolveBoundAttributeForNodeProp(node.id, binding.targetProp, bindingContext);
  }

  for (const binding of bindingContext.plan.eventBindings.filter((item) => item.nodeId === node.id)) {
    attrs += resolveBoundEventAttribute(node.id, binding.targetEvent, bindingContext);
  }

  if (hasRegionColumnBinding) {
    attrs += ` name=${JSON.stringify(node.id)}`;
  }

  if (isDataRegionEligibleContainer(node) && getNodeRegionDataSourceRef(node)) {
    attrs += ` data-designer-node-id=${JSON.stringify(node.id)}`;
  }

  return attrs;
};

export const renderJsxTextContent = (value: unknown, fallback = ''): string => {
  const text = typeof value === 'string' && value.length > 0 ? value : fallback;
  return JSON.stringify(text).slice(1, -1);
};

export const indentJsxBlock = (input: string, spaces: number): string => {
  const indent = ' '.repeat(spaces);
  return input
    .split('\n')
    .map((line) => `${indent}${line}`)
    .join('\n');
};
