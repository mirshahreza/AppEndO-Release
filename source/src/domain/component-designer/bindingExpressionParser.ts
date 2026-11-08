import ts from 'typescript';
import {
  createPropertyBindingDefinition,
  propertyBindingKeyForProp,
} from './bindingEngine';
import { createStoreReadBindingDefinition } from './bindingStoreEngine';
import { fromJsxAttributeName } from './propRegistry';
import type { DesignerBindingDefinition } from './types';

const DATA_CONTEXT_ROOT_VAR = 'dataContext';
const DESIGNER_STORE_ROOT_VAR = 'designerStore';
const ITEM_SCOPE_ROOT_VAR = 'item';

export type ParsedJsxPropertyBinding = {
  bindingKey: string;
  definition: DesignerBindingDefinition;
  targetProp: string;
};

export type JsxBindingContext = {
  paletteItemId?: string;
  nodeType?: string;
};

const unwrapExpression = (expression: ts.Expression): ts.Expression => {
  if (ts.isParenthesizedExpression(expression)) {
    return unwrapExpression(expression.expression);
  }

  return expression;
};

const isDataContextIdentifier = (node: ts.Expression): boolean =>
  ts.isIdentifier(node) && node.text === DATA_CONTEXT_ROOT_VAR;

const collectDataContextMemberSegments = (expression: ts.Expression): string[] | null => {
  let node: ts.Expression = unwrapExpression(expression);
  const segments: string[] = [];

  while (
    ts.isPropertyAccessExpression(node)
    || ts.isPropertyAccessChain(node)
  ) {
    segments.unshift(node.name.text);
    node = node.expression;
  }

  while (
    ts.isElementAccessExpression(node)
    || ts.isElementAccessChain(node)
  ) {
    if (ts.isStringLiteral(node.argumentExpression) || ts.isNumericLiteral(node.argumentExpression)) {
      segments.unshift(node.argumentExpression.text);
      node = node.expression;
    } else {
      return null;
    }
  }

  if (!isDataContextIdentifier(node)) {
    return null;
  }

  return segments;
};

export const extractDataContextPathFromExpression = (expression: ts.Expression | undefined): string | null => {
  if (!expression) {
    return null;
  }

  const unwrapped = unwrapExpression(expression);

  if (ts.isBinaryExpression(unwrapped)) {
    if (
      unwrapped.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
      || unwrapped.operatorToken.kind === ts.SyntaxKind.BarBarToken
    ) {
      return extractDataContextPathFromExpression(unwrapped.left)
        ?? extractDataContextPathFromExpression(unwrapped.right);
    }
  }

  if (ts.isConditionalExpression(unwrapped)) {
    return extractDataContextPathFromExpression(unwrapped.whenTrue)
      ?? extractDataContextPathFromExpression(unwrapped.whenFalse)
      ?? extractDataContextPathFromExpression(unwrapped.condition);
  }

  const segments = collectDataContextMemberSegments(unwrapped);
  if (!segments) {
    return null;
  }

  return segments.join('.');
};

const isIdentifierNamed = (expression: ts.Expression, name: string): boolean =>
  ts.isIdentifier(unwrapExpression(expression)) && unwrapExpression(expression).getText() === name;

const collectRootMemberSegments = (expression: ts.Expression, rootName: string): string[] | null => {
  let node: ts.Expression = unwrapExpression(expression);
  const segments: string[] = [];

  while (ts.isPropertyAccessExpression(node) || ts.isPropertyAccessChain(node)) {
    segments.unshift(node.name.text);
    node = node.expression;
  }

  while (ts.isElementAccessExpression(node) || ts.isElementAccessChain(node)) {
    if (ts.isStringLiteral(node.argumentExpression) || ts.isNumericLiteral(node.argumentExpression)) {
      segments.unshift(node.argumentExpression.text);
      node = node.expression;
    } else {
      return null;
    }
  }

  if (!isIdentifierNamed(node, rootName)) {
    return null;
  }

  return segments;
};

/**
 * Bug found (parity audit item 15/18 follow-up): `extractStorePathFromExpression`/
 * `extractItemPathFromExpression` never unwrapped a `??`/`||`/ternary fallback wrapper before
 * walking the member-access chain — unlike `extractDataContextPathFromExpression`, which already
 * did. `renderBoundJsxTextExpression` (bindingCodegen.ts) always emits bound children text as
 * `{expr ?? "fallback"}`, so any store- or item-scoped children-text binding (e.g. a
 * `logic.repeater`-nested `html.heading` bound to `item.title`) failed to round-trip through the
 * reverse parser once it stopped relying on a duplicate/dead JSX attribute for the same value
 * (the attribute-based extraction path masked this gap). Recurses through the same wrapper forms
 * `extractDataContextPathFromExpression` already handles, then delegates to `extractPath`.
 */
const unwrapFallbackAndExtractPath = (
  expression: ts.Expression,
  extractPath: (expression: ts.Expression) => string | null,
): string | null => {
  const unwrapped = unwrapExpression(expression);

  if (ts.isBinaryExpression(unwrapped)) {
    if (
      unwrapped.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
      || unwrapped.operatorToken.kind === ts.SyntaxKind.BarBarToken
    ) {
      return unwrapFallbackAndExtractPath(unwrapped.left, extractPath)
        ?? unwrapFallbackAndExtractPath(unwrapped.right, extractPath);
    }
  }

  if (ts.isConditionalExpression(unwrapped)) {
    return unwrapFallbackAndExtractPath(unwrapped.whenTrue, extractPath)
      ?? unwrapFallbackAndExtractPath(unwrapped.whenFalse, extractPath)
      ?? unwrapFallbackAndExtractPath(unwrapped.condition, extractPath);
  }

  return extractPath(unwrapped);
};

export const extractStorePathFromExpression = (expression: ts.Expression | undefined): string | null => {
  if (!expression) {
    return null;
  }

  return unwrapFallbackAndExtractPath(expression, (node) => {
    const segments = collectRootMemberSegments(node, DESIGNER_STORE_ROOT_VAR);
    return segments ? segments.join('.') : null;
  });
};

const extractItemPathFromExpression = (expression: ts.Expression | undefined): string | null => {
  if (!expression) {
    return null;
  }

  return unwrapFallbackAndExtractPath(expression, (node) => {
    const segments = collectRootMemberSegments(node, ITEM_SCOPE_ROOT_VAR);
    return segments ? `item.${segments.join('.')}` : null;
  });
};

export const extractFetchScopedPathFromExpression = (
  expression: ts.Expression | undefined,
): { rootVar: string; path: string } | null => {
  if (!expression) {
    return null;
  }

  let node: ts.Expression = unwrapExpression(expression);
  const segments: string[] = [];

  while (ts.isPropertyAccessExpression(node) || ts.isPropertyAccessChain(node)) {
    segments.unshift(node.name.text);
    node = node.expression;
  }

  while (ts.isElementAccessExpression(node) || ts.isElementAccessChain(node)) {
    if (ts.isStringLiteral(node.argumentExpression) || ts.isNumericLiteral(node.argumentExpression)) {
      segments.unshift(node.argumentExpression.text);
      node = node.expression;
    } else {
      return null;
    }
  }

  if (!ts.isIdentifier(node)) {
    return null;
  }

  const rootVar = node.text;
  if (rootVar !== DATA_CONTEXT_ROOT_VAR && !/^fetchData_\d+$/.test(rootVar)) {
    return null;
  }

  return {
    rootVar,
    path: segments.join('.'),
  };
};

export const extractScopedBindingPathFromExpression = (
  expression: ts.Expression | undefined,
): { kind: 'dataContext' | 'store' | 'item'; path: string } | null => {
  const itemPath = extractItemPathFromExpression(expression);
  if (itemPath) {
    return { kind: 'item', path: itemPath };
  }

  const storePath = extractStorePathFromExpression(expression);
  if (storePath) {
    return { kind: 'store', path: storePath };
  }

  const dataPath = extractDataContextPathFromExpression(expression);
  if (dataPath) {
    return { kind: 'dataContext', path: dataPath };
  }

  return null;
};

export const resolveTargetPropFromJsxBoundAttribute = (
  jsxAttrName: string,
  context: JsxBindingContext = {},
): string => {
  if (jsxAttrName === 'defaultValue') {
    if (
      context.nodeType === 'text'
      || context.nodeType === 'heading'
      || context.nodeType === 'link'
      || context.nodeType === 'list-item'
    ) {
      return 'text';
    }

    if (context.nodeType === 'image') {
      return 'src';
    }

    if (
      context.paletteItemId === 'heroui.input-text'
      || context.paletteItemId === 'heroui.textarea'
      || context.paletteItemId === 'heroui.number-input'
      || context.paletteItemId === 'form.code-editor'
      || context.paletteItemId === 'form.html-editor'
      || context.paletteItemId === 'form.markdown-editor'
      || context.paletteItemId === 'form.calculator'
      || context.paletteItemId === 'form.mask-input'
      || context.paletteItemId === 'heroui.color-control'
    ) {
      return 'placeholder';
    }

    if (context.paletteItemId === 'heroui.select') {
      return 'selectedKeys';
    }

    return 'value';
  }

  if (jsxAttrName === 'value') {
    return 'value';
  }

  return fromJsxAttributeName(jsxAttrName);
};

export const resolveContentBindingTargetProp = (
  context: JsxBindingContext = {},
): string => {
  if (
    context.paletteItemId === 'heroui.input-text'
    || context.paletteItemId === 'heroui.textarea'
    || context.paletteItemId === 'form.code-editor'
    || context.paletteItemId === 'form.html-editor'
    || context.paletteItemId === 'form.markdown-editor'
  ) {
    return 'label';
  }

  return 'text';
};

export const createPropertyBindingFromDataPath = (
  targetProp: string,
  dataPath: string,
): ParsedJsxPropertyBinding => {
  const definition = createPropertyBindingDefinition(targetProp, dataPath);

  return {
    bindingKey: propertyBindingKeyForProp(targetProp),
    definition,
    targetProp,
  };
};

export const parseDataContextBindingFromExpression = (
  expression: ts.Expression | undefined,
  targetProp: string,
): ParsedJsxPropertyBinding | null => {
  const scoped = extractScopedBindingPathFromExpression(expression);
  if (!scoped) {
    return null;
  }

  if (scoped.kind === 'store') {
    const storeBinding = createStoreReadBindingDefinition(targetProp, scoped.path);
    return {
      bindingKey: storeBinding.bindingKey,
      definition: storeBinding.definition,
      targetProp,
    };
  }

  return createPropertyBindingFromDataPath(targetProp, scoped.path);
};

export const parseDataContextBindingFromJsxAttribute = (
  jsxAttrName: string,
  expression: ts.Expression | undefined,
  context: JsxBindingContext = {},
): ParsedJsxPropertyBinding | null => {
  const targetProp = resolveTargetPropFromJsxBoundAttribute(jsxAttrName, context);
  return parseDataContextBindingFromExpression(expression, targetProp);
};
