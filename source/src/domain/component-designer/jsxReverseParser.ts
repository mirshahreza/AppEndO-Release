import ts from 'typescript';
import { DESIGNER_PALETTE, getPaletteItemById } from './catalog';
import {
  extractDataContextPathFromExpression,
  extractFetchScopedPathFromExpression,
  extractScopedBindingPathFromExpression,
  parseDataContextBindingFromJsxAttribute,
  resolveContentBindingTargetProp,
  type JsxBindingContext,
} from './bindingExpressionParser';
import { parseLogicJsxExpression } from './jsxLogicReverseParser';
import { propertyBindingKeyForProp, createPropertyBindingDefinition } from './bindingEngine';
import { findLovRefByEndpointAndColumns } from './bindingLovRegistry';
import { createStoreReadBindingDefinition } from './bindingStoreEngine';
import { DESIGNER_PALETTE_ITEM_ID_PROP, fromJsxAttributeName } from './propRegistry';
import { applyDesignerCodegenMetadataProps } from './designerCodegenMetadata';
import type { DesignerBindingDefinition, DesignerBindingDefinitions, DesignerDocument } from './types';
import {
  attachParsedNodeSignatures,
  computeJsxStructureFingerprint,
  reconcileParsedJsxTree,
  type ParsedDesignerNodeDraft,
} from './jsxNodeReconciler';
import { extractCultureTranslationKeyFromExpression } from './translatableTextContentAst';
import {
  TEXT_CONTENT_MODE_PROP,
  TEXT_CONTENT_MODE_TRANSLATION,
  TRANSLATION_KEY_PROP,
} from './translatableTextContent';
import { isDesignerGeneratedRootClass } from './designerGeneratedRoot';

const GENERATED_COMPONENT_NAME = 'GeneratedComponent';

const HTML_TAG_TO_PALETTE: Record<string, { type: string; paletteItemId: string }> = {
  div: { type: 'container', paletteItemId: 'html.container' },
  section: { type: 'container', paletteItemId: 'html.section' },
  article: { type: 'container', paletteItemId: 'html.article' },
  figure: { type: 'container', paletteItemId: 'html.figure' },
  form: { type: 'container', paletteItemId: 'html.form' },
  p: { type: 'text', paletteItemId: 'html.text' },
  h1: { type: 'heading', paletteItemId: 'html.heading' },
  h2: { type: 'heading', paletteItemId: 'html.heading' },
  h3: { type: 'heading', paletteItemId: 'html.heading' },
  h4: { type: 'heading', paletteItemId: 'html.heading' },
  h5: { type: 'heading', paletteItemId: 'html.heading' },
  h6: { type: 'heading', paletteItemId: 'html.heading' },
  a: { type: 'link', paletteItemId: 'html.link' },
  img: { type: 'image', paletteItemId: 'html.image' },
  ul: { type: 'list', paletteItemId: 'html.list' },
  ol: { type: 'list', paletteItemId: 'html.list' },
  li: { type: 'list-item', paletteItemId: 'html.list-item' },
};

const HEROUI_TAG_TO_PALETTE: Record<string, string> = {
  Button: 'heroui.button-solid',
  Link: 'heroui.link',
  Chip: 'heroui.chip',
  Spinner: 'heroui.spinner',
  Skeleton: 'heroui.skeleton',
  Avatar: 'heroui.avatar',
  Switch: 'heroui.switch',
  ProgressBar: 'heroui.progress',
  Slider: 'heroui.slider',
  Input: 'heroui.input-text',
  UiInput: 'heroui.input-text',
  TextArea: 'heroui.textarea',
  UiTextarea: 'heroui.textarea',
  SemanticAssistTextarea: 'heroui.textarea',
  Select: 'heroui.select',
  Card: 'heroui.card',
  Tabs: 'heroui.tabs',
  UiTabs: 'heroui.tabs',
  Accordion: 'heroui.accordion-item',
  Modal: 'heroui.modal',
  CreateEditModalShell: 'heroui.modal',
  ConfirmDialogShell: 'heroui.alert-dialog',
  Drawer: 'heroui.drawer',
  Table: 'heroui.table',
  DatePicker: 'heroui.date-picker',
  DesignerDatePickerField: 'heroui.date-picker',
  DateRangePicker: 'form.date-range',
  DesignerDateRangeField: 'form.date-range',
  DesignerCodeEditorField: 'form.code-editor',
  DesignerHtmlEditorField: 'form.html-editor',
  DesignerMarkdownEditorField: 'form.markdown-editor',
  DesignerCalculatorField: 'form.calculator',
  DesignerMaskInputField: 'form.mask-input',
  DesignerColorEditorField: 'heroui.color-control',
  Autocomplete: 'heroui.autocomplete',
  UiAutocomplete: 'heroui.autocomplete',
  UiSelect: 'heroui.select',
  UiSplitPane: 'layout.split-pane',
  UiDockPane: 'layout.dock-pane',
  CheckboxGroup: 'heroui.checkbox-group',
  RadioGroup: 'heroui.radio-group',
  Dropdown: 'heroui.dropdown',
  Breadcrumbs: 'heroui.breadcrumbs',
  Pagination: 'heroui.pagination',
  TagsInput: 'heroui.tags-input',
  TagGroup: 'heroui.tags-input',
  Toast: 'heroui.toast',
  Toolbar: 'heroui.toolbar',
  ListBox: 'heroui.listbox',
};

const HEROUI_CONTENT_TAGS = new Set([
  'Card.Content',
  'Modal.Body',
  'Drawer.Body',
  'Accordion.Panel',
  'Tabs.Panel',
  'Table.Body',
  'Table.Content',
  'Table.ScrollContainer',
  'Table.Header',
  'Table.Column',
  'Table.Row',
  'Table.Cell',
  'Pagination.Summary',
  'Pagination.Content',
  'Pagination.Item',
  'Pagination.Link',
  'Pagination.Previous',
  'Pagination.Next',
  'DateRangePicker.Trigger',
  'DateRangePicker.RangeSeparator',
  'DateRangePicker.TriggerIndicator',
  'DateRangePicker.Popover',
]);

const HEROUI_SKIP_TAGS = new Set([
  'Card.Header',
  'Card.Title',
  'Card.Description',
  'Card.Footer',
  'Modal.Header',
  'Modal.Heading',
  'Modal.Dialog',
  'Modal.Container',
  'Drawer.Header',
  'Drawer.Heading',
  'Drawer.Dialog',
  'Drawer.Content',
  'Accordion.Heading',
  'Accordion.Trigger',
  'Accordion.Indicator',
  'Accordion.Item',
  'Tabs.ListContainer',
  'Tabs.List',
  'Tabs.Tab',
  'Tabs.Indicator',
  'Select.Trigger',
  'Select.Value',
  'Select.Indicator',
  'Select.Popover',
  'ListBox',
  'ListBox.Item',
  'Switch.Control',
  'Switch.Thumb',
  'ProgressBar.Track',
  'ProgressBar.Fill',
  'Slider.Track',
  'Slider.Fill',
  'Slider.Thumb',
  'Avatar.Image',
  'Avatar.Fallback',
]);

const formatParserDiagnostic = (diagnostic: ts.Diagnostic): string => {
  if (diagnostic.file && typeof diagnostic.start === 'number') {
    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
    return `JSX syntax error at line ${line + 1}, column ${character + 1}: ${message}`;
  }

  return `JSX syntax error: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`;
};

const getJsxTagName = (name: ts.JsxTagNameExpression): string => {
  if (ts.isIdentifier(name)) {
    return name.text;
  }

  if (ts.isPropertyAccessExpression(name)) {
    const left = getJsxTagName(name.expression as ts.JsxTagNameExpression);
    return left ? `${left}.${name.name.text}` : name.name.text;
  }

  return '';
};

const unwrapExpression = (expression: ts.Expression): ts.Expression => {
  if (ts.isParenthesizedExpression(expression)) {
    return unwrapExpression(expression.expression);
  }

  return expression;
};

const readStringLiteral = (node: ts.Expression | undefined): string | undefined => {
  if (!node) {
    return undefined;
  }

  const expression = unwrapExpression(node);

  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text;
  }

  if (ts.isNumericLiteral(expression)) {
    return expression.text;
  }

  if (expression.kind === ts.SyntaxKind.TrueKeyword) {
    return 'true';
  }

  if (expression.kind === ts.SyntaxKind.FalseKeyword) {
    return 'false';
  }

  if (ts.isTemplateExpression(expression) && expression.templateSpans.length === 0) {
    return expression.head.text;
  }

  return undefined;
};

const readBooleanLiteral = (node: ts.Expression | undefined): boolean | undefined => {
  if (!node) {
    return undefined;
  }

  const expression = unwrapExpression(node);
  if (expression.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }

  if (expression.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }

  return undefined;
};

const readNumberLiteral = (node: ts.Expression | undefined): number | undefined => {
  if (!node) {
    return undefined;
  }

  const expression = unwrapExpression(node);
  if (ts.isNumericLiteral(expression)) {
    return Number(expression.text);
  }

  if (ts.isPrefixUnaryExpression(expression) && expression.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(expression.operand)) {
    return -Number(expression.operand.text);
  }

  return undefined;
};

const styleObjectToProp = (node: ts.ObjectLiteralExpression): string => {
  const parts: string[] = [];

  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }

    const key = ts.isIdentifier(property.name)
      ? property.name.text
      : ts.isStringLiteral(property.name)
        ? property.name.text
        : null;
    if (!key) {
      continue;
    }

    const value = readStringLiteral(property.initializer) ?? readNumberLiteral(property.initializer)?.toString();
    if (value !== undefined) {
      parts.push(`${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`);
    }
  }

  return parts.join('; ');
};

type ParsedJsxAttributes = {
  props: Record<string, unknown>;
  bindings: Record<string, DesignerBindingDefinition>;
};

const getJsxAttributeNameText = (name: ts.JsxAttributeName): string => {
  if (ts.isJsxNamespacedName(name)) {
    return `${name.namespace.text}:${name.name.text}`;
  }

  return name.text;
};

const readJsxLiteralAttributeValue = (
  attribute: ts.JsxAttribute,
): { key: string; value: unknown } | null => {
  const key = getJsxAttributeNameText(attribute.name);
  const initializer = attribute.initializer;

  if (!initializer) {
    return { key, value: true };
  }

  if (ts.isStringLiteral(initializer)) {
    return { key, value: initializer.text };
  }

  if (ts.isJsxExpression(initializer)) {
    const expression = initializer.expression;
    if (!expression) {
      return null;
    }

    if (key === 'style' && ts.isObjectLiteralExpression(expression)) {
      return { key, value: styleObjectToProp(expression) };
    }

    const booleanValue = readBooleanLiteral(expression);
    if (booleanValue !== undefined) {
      return { key, value: booleanValue };
    }

    const numberValue = readNumberLiteral(expression);
    if (numberValue !== undefined) {
      return { key, value: numberValue };
    }

    const stringValue = readStringLiteral(expression);
    if (stringValue !== undefined) {
      return { key, value: stringValue };
    }
  }

  return null;
};

const readJsxLiteralAttributes = (attributes: ts.JsxAttributes): Record<string, unknown> => {
  const props: Record<string, unknown> = {};

  for (const attributeLike of attributes.properties) {
    if (!ts.isJsxAttribute(attributeLike)) {
      continue;
    }

    const parsed = readJsxLiteralAttributeValue(attributeLike);
    if (!parsed) {
      continue;
    }

    props[mapDomAttributeToPropKey(parsed.key)] = parsed.value;
  }

  return props;
};

const resolveJsxBindingContext = (
  tagName: string,
  literalProps: Record<string, unknown>,
): JsxBindingContext => {
  const heroUiPaletteId = resolveHeroUiPaletteId(tagName, literalProps);
  if (heroUiPaletteId) {
    const paletteItem = getPaletteItemById(heroUiPaletteId);
    return {
      paletteItemId: heroUiPaletteId,
      nodeType: paletteItem?.nodeType,
    };
  }

  const htmlMapping = resolveHtmlMapping(tagName, literalProps);
  return {
    paletteItemId: htmlMapping.paletteItemId,
    nodeType: htmlMapping.type,
  };
};

const readJsxAttributesWithBindings = (
  attributes: ts.JsxAttributes,
  tagName: string,
): ParsedJsxAttributes => {
  const literalProps = readJsxLiteralAttributes(attributes);
  const bindingContext = resolveJsxBindingContext(tagName, literalProps);
  const props: Record<string, unknown> = { ...literalProps };
  const bindings: Record<string, DesignerBindingDefinition> = {};

  for (const attributeLike of attributes.properties) {
    if (!ts.isJsxAttribute(attributeLike)) {
      continue;
    }

    const jsxAttrName = getJsxAttributeNameText(attributeLike.name);
    const initializer = attributeLike.initializer;

    if (!initializer || !ts.isJsxExpression(initializer) || !initializer.expression) {
      continue;
    }

    const parsedBinding = parseDataContextBindingFromJsxAttribute(
      jsxAttrName,
      initializer.expression,
      bindingContext,
    );

    if (!parsedBinding) {
      continue;
    }

    bindings[parsedBinding.bindingKey] = parsedBinding.definition;
  }

  return { props, bindings };
};

const readJsxAttributes = (attributes: ts.JsxAttributes, tagName = 'div'): Record<string, unknown> =>
  readJsxAttributesWithBindings(attributes, tagName).props;

const mapDomAttributeToPropKey = (attributeName: string): string => fromJsxAttributeName(attributeName);

const extractChildContentBinding = (
  children: ts.NodeArray<ts.JsxChild>,
  bindingContext: JsxBindingContext,
): Record<string, DesignerBindingDefinition> => {
  const targetProp = resolveContentBindingTargetProp(bindingContext);

  for (const child of children) {
    if (!ts.isJsxExpression(child) || !child.expression) {
      continue;
    }

    const scoped = extractScopedBindingPathFromExpression(child.expression);
    if (!scoped) {
      continue;
    }

    if (scoped.kind === 'store') {
      const storeBinding = createStoreReadBindingDefinition(targetProp, scoped.path);
      return {
        [storeBinding.bindingKey]: storeBinding.definition,
      };
    }

    return {
      [propertyBindingKeyForProp(targetProp)]: createPropertyBindingDefinition(targetProp, scoped.path),
    };
  }

  return {};
};

const readJsxTextContent = (node: ts.JsxChild): string => {
  if (ts.isJsxText(node)) {
    return node.text.replace(/\s+/g, ' ').trim();
  }

  if (ts.isJsxExpression(node) && node.expression) {
    if (extractDataContextPathFromExpression(node.expression)) {
      return '';
    }

    return readStringLiteral(node.expression) ?? '';
  }

  return '';
};

const readJsxTranslationContent = (node: ts.JsxChild): { translationKey: string } | null => {
  if (!ts.isJsxExpression(node) || !node.expression) {
    return null;
  }

  const translationKey = extractCultureTranslationKeyFromExpression(node.expression);
  if (!translationKey) {
    return null;
  }

  return { translationKey };
};

const collectJsxTextContent = (children: ts.NodeArray<ts.JsxChild>): string => {
  const chunks: string[] = [];

  for (const child of children) {
    if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child) || ts.isJsxFragment(child)) {
      continue;
    }

    const text = readJsxTextContent(child);
    if (text.length > 0) {
      chunks.push(text);
    }
  }

  return chunks.join(' ').trim();
};

const collectJsxTranslationContent = (children: ts.NodeArray<ts.JsxChild>): { translationKey: string } | null => {
  for (const child of children) {
    const translation = readJsxTranslationContent(child);
    if (translation) {
      return translation;
    }
  }

  return null;
};

const resolveTranslatableTextProps = (
  children: ts.NodeArray<ts.JsxChild>,
  htmlMappingType: string,
): Record<string, unknown> => {
  const translation = collectJsxTranslationContent(children);
  if (
    translation
    && (htmlMappingType === 'text' || htmlMappingType === 'heading')
  ) {
    return {
      [TEXT_CONTENT_MODE_PROP]: TEXT_CONTENT_MODE_TRANSLATION,
      [TRANSLATION_KEY_PROP]: translation.translationKey,
    };
  }

  const textContent = collectJsxTextContent(children);
  return textContent ? { text: textContent } : {};
};

const extractUseDataFetchVarEndpoints = (tsxCode: string): Map<string, string> => {
  const endpoints = new Map<string, string>();
  const pattern = /const\s*\{\s*data:\s*([A-Za-z_][\w]*)\b[^}]*\}\s*=\s*useDataFetch[\s\S]*?resolveBindingUrl\(\s*"([^"]+)"/g;

  for (const match of tsxCode.matchAll(pattern)) {
    const dataVar = match[1];
    const endpoint = match[2];
    if (dataVar && endpoint) {
      endpoints.set(dataVar, endpoint);
    }
  }

  return endpoints;
};

const unwrapJsxExpression = (expression: ts.Expression): ts.Expression => {
  if (ts.isParenthesizedExpression(expression)) {
    return unwrapJsxExpression(expression.expression);
  }

  return expression;
};

const extractSelectItemsBindingFromExpression = (
  expression: ts.Expression,
  fetchEndpoints: Map<string, string>,
  bindingDefinitions: DesignerBindingDefinitions,
): Record<string, DesignerBindingDefinition> => {
  let current = unwrapJsxExpression(expression);

  if (
    ts.isCallExpression(current)
    && ts.isPropertyAccessExpression(current.expression)
    && current.expression.name.text === 'map'
  ) {
    current = unwrapJsxExpression(current.expression.expression);
  }

  if (!ts.isCallExpression(current)) {
    return {};
  }

  const callee = unwrapJsxExpression(current.expression);
  const sourceExpression = current.arguments[0];
  const scopedPath = extractFetchScopedPathFromExpression(sourceExpression);
  if (!scopedPath) {
    return {};
  }

  const fetchEndpoint = fetchEndpoints.get(scopedPath.rootVar);

  if (ts.isIdentifier(callee) && callee.text === 'mapDesignerLovItems') {
    const returnColumn = current.arguments[1] && ts.isStringLiteral(current.arguments[1])
      ? current.arguments[1].text
      : 'id';
    const displayColumn = current.arguments[2] && ts.isStringLiteral(current.arguments[2])
      ? current.arguments[2].text
      : 'label';
    const lovRef = fetchEndpoint
      ? findLovRefByEndpointAndColumns(bindingDefinitions, fetchEndpoint, returnColumn, displayColumn)
      : undefined;

    const definition = createPropertyBindingDefinition(
      'items',
      scopedPath.path || 'items',
      lovRef
        ? { lovRef }
        : fetchEndpoint
          ? { fetchEndpoint }
          : undefined,
    );

    return {
      [propertyBindingKeyForProp('items')]: definition,
    };
  }

  if (!ts.isIdentifier(callee) || callee.text !== 'mapDesignerListBoxItems') {
    return {};
  }

  const definition = createPropertyBindingDefinition(
    'items',
    scopedPath.path || 'items',
    fetchEndpoint ? { fetchEndpoint } : undefined,
  );

  return {
    [propertyBindingKeyForProp('items')]: definition,
  };
};

const extractSelectItemsBindingFromChildren = (
  children: ts.NodeArray<ts.JsxChild>,
  fetchEndpoints: Map<string, string>,
  bindingDefinitions: DesignerBindingDefinitions,
): Record<string, DesignerBindingDefinition> => {
  for (const child of children) {
    if (!ts.isJsxExpression(child) || !child.expression) {
      continue;
    }

    const binding = extractSelectItemsBindingFromExpression(child.expression, fetchEndpoints, bindingDefinitions);
    if (Object.keys(binding).length > 0) {
      return binding;
    }
  }

  return {};
};

let activeFetchEndpointMap = new Map<string, string>();
let activeBindingDefinitions: DesignerBindingDefinitions = {
  definitions: {},
  storeSegments: {},
  dataSources: {},
  lovs: {},
};

const resolveHtmlMapping = (
  tagName: string,
  props: Record<string, unknown>,
): { type: string; paletteItemId: string } => {
  const designerPaletteId = typeof props[DESIGNER_PALETTE_ITEM_ID_PROP] === 'string'
    ? props[DESIGNER_PALETTE_ITEM_ID_PROP]
    : typeof props['data-designer-palette-id'] === 'string'
      ? props['data-designer-palette-id']
      : typeof props.dataDesignerPaletteId === 'string'
        ? props.dataDesignerPaletteId
        : undefined;
  if (designerPaletteId) {
    const paletteItem = getPaletteItemById(designerPaletteId);
    if (paletteItem) {
      return {
        type: paletteItem.nodeType,
        paletteItemId: designerPaletteId,
      };
    }
  }

  const dataNodeType = typeof props['data-node-type'] === 'string' ? props['data-node-type'] : undefined;
  if (dataNodeType) {
    const paletteItem = DESIGNER_PALETTE.find((item) => item.nodeType === dataNodeType);
    return {
      type: dataNodeType,
      paletteItemId: paletteItem?.id ?? 'html.container',
    };
  }

  return HTML_TAG_TO_PALETTE[tagName.toLowerCase()] ?? {
    type: 'container',
    paletteItemId: 'html.container',
  };
};

const resolveHeroUiPaletteId = (tagName: string, props: Record<string, unknown>): string | null => {
  const rootTag = tagName.split('.')[0];
  const mapped = HEROUI_TAG_TO_PALETTE[rootTag];
  if (!mapped) {
    return null;
  }

  if (rootTag === 'Button') {
    return props.variant === 'outline' || props.variant === 'secondary' ? 'heroui.button-outline' : 'heroui.button-solid';
  }

  if (rootTag === 'Input') {
    return props.type === 'number' ? 'heroui.number-input' : 'heroui.input-text';
  }

  if (rootTag === 'Autocomplete' && typeof props.entityRef === 'string' && props.entityRef.trim().length > 0) {
    return 'heroui.entity-picker';
  }

  if (rootTag === 'Modal' && props.role === 'alertdialog') {
    return 'heroui.alert-dialog';
  }

  return mapped;
};

const applyPaletteDefaults = (paletteItemId: string, props: Record<string, unknown>): Record<string, unknown> => {
  const paletteItem = getPaletteItemById(paletteItemId);
  if (!paletteItem) {
    return props;
  }

  return {
    ...paletteItem.defaultProps,
    ...props,
    [DESIGNER_PALETTE_ITEM_ID_PROP]: paletteItemId,
  };
};

const normalizeReversePropsForPalette = (
  paletteItemId: string,
  props: Record<string, unknown>,
): Record<string, unknown> => {
  const next = applyDesignerCodegenMetadataProps(paletteItemId, { ...props });

  if (paletteItemId === 'heroui.button-solid' || paletteItemId === 'heroui.button-outline') {
    if ('isPending' in next && !('isLoading' in next)) {
      next.isLoading = next.isPending;
      delete next.isPending;
    }
  }

  if (paletteItemId === 'heroui.textarea') {
    if ('rows' in next && !('minRows' in next)) {
      next.minRows = next.rows;
      delete next.rows;
    }
  }

  if (paletteItemId === 'heroui.select') {
    if ('defaultSelectedKey' in next && !('selectedKeys' in next)) {
      next.selectedKeys = String(next.defaultSelectedKey ?? '');
      delete next.defaultSelectedKey;
    }
    if ('defaultValue' in next && !('selectedKeys' in next)) {
      next.selectedKeys = String(next.defaultValue ?? '');
      delete next.defaultValue;
    }
  }

  if (paletteItemId === 'heroui.slider') {
    if ('defaultValue' in next && !('value' in next)) {
      next.value = next.defaultValue;
      delete next.defaultValue;
    }
  }

  delete next['data-designer-palette-id'];

  return next;
};

const createDraftFromJsx = (
  tagName: string,
  props: Record<string, unknown>,
  children: ParsedDesignerNodeDraft[],
  bindings: Record<string, DesignerBindingDefinition> = {},
): ParsedDesignerNodeDraft => {
  const heroUiPaletteId = resolveHeroUiPaletteId(tagName, props);
  if (heroUiPaletteId) {
    const paletteItem = getPaletteItemById(heroUiPaletteId);
    const textContent = collectJsxTextContentFromDrafts(children);
    const contentTargetProp = resolveContentBindingTargetProp({
      paletteItemId: heroUiPaletteId,
      nodeType: paletteItem?.nodeType,
    });
    const hasContentBinding = Boolean(bindings[propertyBindingKeyForProp(contentTargetProp)]);
    const mergedProps = applyPaletteDefaults(heroUiPaletteId, normalizeReversePropsForPalette(heroUiPaletteId, {
      ...props,
      ...(textContent && paletteItem && !paletteItem.canHaveChildren && !hasContentBinding ? { text: textContent } : {}),
    }));

    if (hasContentBinding) {
      delete mergedProps[contentTargetProp];
    }

    return attachParsedNodeSignatures({
      type: paletteItem?.nodeType ?? 'container',
      paletteItemId: heroUiPaletteId,
      props: mergedProps,
      layout: {},
      binding: bindings,
      children: paletteItem?.canHaveChildren ? children : [],
      signature: '',
    });
  }

  const htmlMapping = resolveHtmlMapping(tagName, props);
  const textContent = collectJsxTextContentFromDrafts(children);
  const contentTargetProp = resolveContentBindingTargetProp({
    paletteItemId: htmlMapping.paletteItemId,
    nodeType: htmlMapping.type,
  });
  const hasContentBinding = Boolean(bindings[propertyBindingKeyForProp(contentTargetProp)]);
  const translationMode = props[TEXT_CONTENT_MODE_PROP] === TEXT_CONTENT_MODE_TRANSLATION;
  const headingLevelFromTag = htmlMapping.type === 'heading' && /^h[1-6]$/i.test(tagName) ? tagName.toLowerCase() : undefined;
  const mergedProps = applyPaletteDefaults(htmlMapping.paletteItemId, normalizeReversePropsForPalette(htmlMapping.paletteItemId, {
    ...props,
    ...(headingLevelFromTag ? { level: headingLevelFromTag } : {}),
    ...(htmlMapping.type === 'text' || htmlMapping.type === 'heading' || htmlMapping.type === 'link' || htmlMapping.type === 'list-item'
      ? {
          ...(hasContentBinding || translationMode
            ? {}
            : { text: textContent || (typeof props.text === 'string' ? props.text : '') }),
        }
      : {}),
    ...(tagName.includes('.') || !HTML_TAG_TO_PALETTE[tagName.toLowerCase()]
      ? { _jsxSourceTag: tagName }
      : {}),
  }));

  if (hasContentBinding) {
    delete mergedProps[contentTargetProp];
  }

  const canHaveChildren = htmlMapping.type === 'container' || htmlMapping.type === 'list';

  return attachParsedNodeSignatures({
    type: htmlMapping.type,
    paletteItemId: htmlMapping.paletteItemId,
    props: mergedProps,
    layout: {},
    binding: bindings,
    children: canHaveChildren ? children : [],
    signature: '',
  });
};

const collectJsxTextContentFromDrafts = (children: ParsedDesignerNodeDraft[]): string => {
  if (children.length === 0) {
    return '';
  }

  if (children.length === 1 && (children[0].type === 'text' || children[0].type === 'heading')) {
    return typeof children[0].props.text === 'string' ? children[0].props.text : '';
  }

  return children
    .map((child) => (typeof child.props.text === 'string' ? child.props.text : ''))
    .filter((value) => value.length > 0)
    .join(' ')
    .trim();
};

const parseJsxChildren = (children: ts.NodeArray<ts.JsxChild>): ParsedDesignerNodeDraft[] => {
  const drafts: ParsedDesignerNodeDraft[] = [];

  for (const child of children) {
    const parsed = parseJsxNode(child);
    if (parsed) {
      if (Array.isArray(parsed)) {
        drafts.push(...parsed);
      } else {
        drafts.push(parsed);
      }
    }
  }

  return drafts;
};

const findDirectChildElementByRootTag = (
  children: ts.NodeArray<ts.JsxChild>,
  rootTag: string,
): ts.JsxElement | null => {
  for (const child of children) {
    if (!ts.isJsxElement(child)) {
      continue;
    }

    const tagName = getJsxTagName(child.openingElement.tagName);
    if (tagName === rootTag || tagName.startsWith(`${rootTag}.`)) {
      return child;
    }
  }

  return null;
};

const tryParseDesignerCompositeDivDraft = (
  element: ts.JsxElement,
  wrapperProps: Record<string, unknown>,
  wrapperBindings: Record<string, DesignerBindingDefinition>,
): ParsedDesignerNodeDraft | null => {
  const splitDirection = wrapperProps['data-split-direction'] ?? wrapperProps.dataSplitDirection;
  if (typeof splitDirection === 'string' && splitDirection.trim().length > 0) {
    const defaultSplit = wrapperProps['data-default-split'] ?? wrapperProps.dataDefaultSplit;
    const mergedProps = applyPaletteDefaults('layout.split-pane', normalizeReversePropsForPalette('layout.split-pane', {
      direction: splitDirection,
      defaultSplit: typeof defaultSplit === 'number' ? defaultSplit : Number(defaultSplit),
      className: wrapperProps.className,
    }));

    return attachParsedNodeSignatures({
      type: 'container',
      paletteItemId: 'layout.split-pane',
      props: mergedProps,
      layout: {},
      binding: wrapperBindings,
      children: [],
      signature: '',
    });
  }

  const tableElement = findDirectChildElementByRootTag(element.children, 'Table');
  const paginationElement = findDirectChildElementByRootTag(element.children, 'Pagination');
  if (!tableElement || !paginationElement) {
    return null;
  }

  const tableTagName = getJsxTagName(tableElement.openingElement.tagName);
  const { props: tableProps, bindings: tableBindings } = readJsxAttributesWithBindings(
    tableElement.openingElement.attributes,
    tableTagName,
  );
  const mergedProps = applyPaletteDefaults('heroui.data-grid', normalizeReversePropsForPalette('heroui.data-grid', {
    ...tableProps,
    className: typeof wrapperProps.className === 'string' ? wrapperProps.className : tableProps.className,
  }));

  return attachParsedNodeSignatures({
    type: 'container',
    paletteItemId: 'heroui.data-grid',
    props: mergedProps,
    layout: {},
    binding: { ...wrapperBindings, ...tableBindings },
    children: [],
    signature: '',
  });
};

const parseJsxElement = (element: ts.JsxElement): ParsedDesignerNodeDraft | ParsedDesignerNodeDraft[] | null => {
  const tagName = getJsxTagName(element.openingElement.tagName);
  if (!tagName) {
    return null;
  }

  if (HEROUI_SKIP_TAGS.has(tagName)) {
    return parseJsxChildren(element.children);
  }

  if (HEROUI_CONTENT_TAGS.has(tagName)) {
    return parseJsxChildren(element.children);
  }

  const literalProps = readJsxLiteralAttributes(element.openingElement.attributes);
  const bindingContext = resolveJsxBindingContext(tagName, literalProps);
  const { props, bindings: attributeBindings } = readJsxAttributesWithBindings(element.openingElement.attributes, tagName);
  const childDrafts = parseJsxChildren(element.children);
  const childContentBindings = extractChildContentBinding(element.children, bindingContext);
  const selectItemsBindings = tagName === 'UiSelect' || tagName === 'Select'
    ? extractSelectItemsBindingFromChildren(element.children, activeFetchEndpointMap, activeBindingDefinitions)
    : {};
  const bindings = { ...attributeBindings, ...childContentBindings, ...selectItemsBindings };

  if (tagName === 'div') {
    const compositeDraft = tryParseDesignerCompositeDivDraft(element, props, bindings);
    if (compositeDraft) {
      return compositeDraft;
    }
  }

  if (tagName === 'Card' && childDrafts.length === 0) {
    const titleNode = element.children.find((child) => ts.isJsxElement(child) && getJsxTagName(child.openingElement.tagName) === 'Card.Header');
    if (titleNode && ts.isJsxElement(titleNode)) {
      const titleText = collectJsxTextContent(titleNode.children);
      if (titleText) {
        props.title = titleText;
      }
    }
  }

  const paletteContext = resolveJsxBindingContext(tagName, literalProps);
  const htmlMapping = resolveHtmlMapping(tagName, props);
  if (
    (htmlMapping.type === 'text' || htmlMapping.type === 'heading')
    && !bindings[propertyBindingKeyForProp('text')]
  ) {
    Object.assign(props, resolveTranslatableTextProps(element.children, htmlMapping.type));
  }

  const propsWithCodegenMetadata = applyDesignerCodegenMetadataProps(
    paletteContext.paletteItemId ?? 'html.container',
    props,
  );

  if (tagName === 'UiTabs' || tagName === 'Tabs') {
    const parsedTabs = parseUiTabsItemsFromAttributes(element.openingElement.attributes);
    if (parsedTabs && parsedTabs.items.length > 0) {
      propsWithCodegenMetadata.items = parsedTabs.items;
      const nextChildren = childDrafts.length > 0 ? childDrafts : parsedTabs.contentDrafts;
      return createDraftFromJsx(tagName, propsWithCodegenMetadata, nextChildren, bindings);
    }
  }

  return createDraftFromJsx(tagName, propsWithCodegenMetadata, childDrafts, bindings);
};

function parseUiTabsItemsFromAttributes(
  attributes: ts.JsxAttributes,
): { items: Array<{ key: string; label: string }>; contentDrafts: ParsedDesignerNodeDraft[] } | null {
  for (const attributeLike of attributes.properties) {
    if (!ts.isJsxAttribute(attributeLike)) {
      continue;
    }
    if (getJsxAttributeNameText(attributeLike.name) !== 'items') {
      continue;
    }
    const initializer = attributeLike.initializer;
    if (!initializer || !ts.isJsxExpression(initializer) || !initializer.expression) {
      return null;
    }
    const expr = unwrapExpression(initializer.expression);
    if (!ts.isArrayLiteralExpression(expr)) {
      return null;
    }

    const items: Array<{ key: string; label: string }> = [];
    const contentDrafts: ParsedDesignerNodeDraft[] = [];
    expr.elements.forEach((element, index) => {
      if (!ts.isObjectLiteralExpression(element)) {
        return;
      }
      let key = `tab-${index}`;
      let label = `Tab ${index + 1}`;
      let contentExpr: ts.Expression | undefined;
      for (const property of element.properties) {
        if (!ts.isPropertyAssignment(property)) {
          continue;
        }
        const name = ts.isIdentifier(property.name)
          ? property.name.text
          : ts.isStringLiteral(property.name)
            ? property.name.text
            : '';
        if (name === 'id' || name === 'key') {
          key = readStringLiteral(property.initializer) ?? key;
        }
        if (name === 'label') {
          label = readStringLiteral(property.initializer) ?? label;
        }
        if (name === 'content') {
          contentExpr = property.initializer;
        }
      }
      items.push({ key, label });
      if (!contentExpr) {
        return;
      }
      const unwrapped = unwrapExpression(contentExpr);
      const parsed = parseJsxNode(unwrapped as ts.JsxChild);
      if (!parsed) {
        return;
      }
      if (Array.isArray(parsed)) {
        contentDrafts.push(...parsed);
      } else {
        contentDrafts.push(parsed);
      }
    });
    return { items, contentDrafts };
  }

  return null;
}

const parseJsxSelfClosingElement = (element: ts.JsxSelfClosingElement): ParsedDesignerNodeDraft | null => {
  const tagName = getJsxTagName(element.tagName);
  if (!tagName) {
    return null;
  }

  const { props, bindings } = readJsxAttributesWithBindings(element.attributes, tagName);
  const paletteContext = resolveJsxBindingContext(tagName, props);
  const propsWithCodegenMetadata = applyDesignerCodegenMetadataProps(
    paletteContext.paletteItemId ?? 'html.container',
    props,
  );
  if (tagName === 'UiTabs' || tagName === 'Tabs') {
    const parsedTabs = parseUiTabsItemsFromAttributes(element.attributes);
    if (parsedTabs && parsedTabs.items.length > 0) {
      propsWithCodegenMetadata.items = parsedTabs.items;
      return createDraftFromJsx(tagName, propsWithCodegenMetadata, parsedTabs.contentDrafts, bindings);
    }
  }
  return createDraftFromJsx(tagName, propsWithCodegenMetadata, [], bindings);
};

const parseJsxNode = (node: ts.JsxChild): ParsedDesignerNodeDraft | ParsedDesignerNodeDraft[] | null => {
  if (ts.isJsxExpression(node) && node.expression) {
    const logicParsed = parseLogicJsxExpression(node.expression, parseJsxNode);
    if (logicParsed) {
      return logicParsed;
    }

    // Local overlay open state: `{isOpen ? <CreateEditModalShell …/> : null}`
    const unwrapped = unwrapExpression(node.expression);
    if (ts.isConditionalExpression(unwrapped)) {
      const whenTrue = unwrapExpression(unwrapped.whenTrue);
      if (ts.isJsxElement(whenTrue) || ts.isJsxSelfClosingElement(whenTrue) || ts.isJsxFragment(whenTrue)) {
        return parseJsxNode(whenTrue as ts.JsxChild);
      }
    }
  }

  if (ts.isJsxElement(node)) {
    return parseJsxElement(node);
  }

  if (ts.isJsxSelfClosingElement(node)) {
    return parseJsxSelfClosingElement(node);
  }

  if (ts.isJsxFragment(node)) {
    return parseJsxChildren(node.children);
  }

  const text = readJsxTextContent(node);
  if (text.length === 0) {
    return null;
  }

  return attachParsedNodeSignatures({
    type: 'text',
    paletteItemId: 'html.text',
    props: applyPaletteDefaults('html.text', { text }),
    layout: {},
    binding: {},
    children: [],
    signature: '',
  });
};

const readJsxClassNameLiteral = (attributes: ts.JsxAttributes): string => {
  for (const property of attributes.properties) {
    if (!ts.isJsxAttribute(property)) {
      continue;
    }
    if (getJsxAttributeNameText(property.name) !== 'className') {
      continue;
    }
    const initializer = property.initializer;
    if (initializer && ts.isStringLiteral(initializer)) {
      return initializer.text;
    }
    if (initializer && ts.isJsxExpression(initializer) && initializer.expression) {
      return readStringLiteral(initializer.expression) ?? '';
    }
  }
  return '';
};

const unwrapGeneratedComponentRoot = (node: ts.JsxChild): ts.JsxChild[] => {
  if (!ts.isJsxElement(node)) {
    return [node];
  }

  const tagName = getJsxTagName(node.openingElement.tagName).toLowerCase();
  const className = readJsxClassNameLiteral(node.openingElement.attributes);
  if (tagName === 'div' && isDesignerGeneratedRootClass(className)) {
    return [...node.children];
  }

  return [node];
};

const findGeneratedComponentReturnJsx = (sourceFile: ts.SourceFile): ts.JsxChild[] => {
  let jsxRoot: ts.Expression | undefined;

  const visit = (node: ts.Node) => {
    if (jsxRoot) {
      return;
    }

    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || declaration.name.text !== GENERATED_COMPONENT_NAME) {
          continue;
        }

        const initializer = declaration.initializer;
        if (!initializer) {
          continue;
        }

        const expression = unwrapExpression(initializer);
        if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
          const body = expression.body;
          if (ts.isJsxElement(body) || ts.isJsxFragment(body) || ts.isJsxSelfClosingElement(body)) {
            jsxRoot = body as ts.Expression;
          } else if (ts.isParenthesizedExpression(body)) {
            jsxRoot = unwrapExpression(body);
          } else if (ts.isBlock(body)) {
            for (const statement of body.statements) {
              if (ts.isReturnStatement(statement) && statement.expression) {
                jsxRoot = unwrapExpression(statement.expression);
                break;
              }
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  if (!jsxRoot) {
    throw new Error('Could not locate GeneratedComponent JSX return block.');
  }

  if (ts.isJsxFragment(jsxRoot)) {
    return [...jsxRoot.children];
  }

  if (ts.isJsxElement(jsxRoot)) {
    return unwrapGeneratedComponentRoot(jsxRoot);
  }

  if (ts.isParenthesizedExpression(jsxRoot)) {
    const inner = unwrapExpression(jsxRoot);
    if (ts.isJsxElement(inner)) {
      return unwrapGeneratedComponentRoot(inner);
    }
    if (ts.isJsxFragment(inner)) {
      return [...inner.children];
    }
  }

  throw new Error('GeneratedComponent return value is not a JSX tree.');
};

export const parseDesignerTsxJsxBody = (
  tsxCode: string,
  baseDocument: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
): { document: DesignerDocument; bindingDefinitions: DesignerBindingDefinitions; structureFingerprint: string } => {
  activeFetchEndpointMap = extractUseDataFetchVarEndpoints(tsxCode);
  activeBindingDefinitions = bindingDefinitions;
  const sourceFile = ts.createSourceFile('designer-sync.tsx', tsxCode, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const parseDiagnostics = (sourceFile as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];

  if (parseDiagnostics.length > 0) {
    throw new Error(formatParserDiagnostic(parseDiagnostics[0]));
  }

  const jsxChildren = findGeneratedComponentReturnJsx(sourceFile);
  const drafts: ParsedDesignerNodeDraft[] = [];

  for (const child of jsxChildren) {
    const parsed = parseJsxNode(child);
    if (!parsed) {
      continue;
    }

    if (Array.isArray(parsed)) {
      drafts.push(...parsed);
    } else {
      drafts.push(parsed);
    }
  }

  const structureFingerprint = computeJsxStructureFingerprint(drafts);
  const document = reconcileParsedJsxTree(drafts, baseDocument);

  return {
    document,
    bindingDefinitions,
    structureFingerprint,
  };
};

export const extractJsxStructureFingerprintFromTsx = (tsxCode: string): string | null => {
  try {
    const sourceFile = ts.createSourceFile('designer-sync.tsx', tsxCode, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const parseDiagnostics = (sourceFile as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];
    if (parseDiagnostics.length > 0) {
      return null;
    }

    const jsxChildren = findGeneratedComponentReturnJsx(sourceFile);
    const drafts: ParsedDesignerNodeDraft[] = [];

    for (const child of jsxChildren) {
      const parsed = parseJsxNode(child);
      if (!parsed) {
        continue;
      }

      if (Array.isArray(parsed)) {
        drafts.push(...parsed);
      } else {
        drafts.push(parsed);
      }
    }

    return computeJsxStructureFingerprint(drafts);
  } catch {
    return null;
  }
};
