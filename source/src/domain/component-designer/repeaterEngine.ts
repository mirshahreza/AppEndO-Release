import { dataPathToOptionalChainExpression } from './bindingEngine';
import { resolveStorePathExpression } from './bindingStoreEngine';
import type { DesignerNode } from './types';
import { readString } from './runtimeShared';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from './propRegistry';

export const LOGIC_REPEATER_PALETTE_ITEM_ID = 'logic.repeater';

/** Valid JS identifier shape used for repeater item/index aliases in Export codegen. */
const JS_IDENTIFIER_PATTERN = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

/** Common reserved words that would produce invalid Export TSX when used as aliases. */
const JS_RESERVED_IDENTIFIERS = new Set([
  'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'function',
  'if', 'implements', 'import', 'in', 'instanceof', 'interface', 'let', 'new', 'null',
  'package', 'private', 'protected', 'public', 'return', 'static', 'super', 'switch',
  'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
]);

export const isValidRepeaterAliasIdentifier = (value: string): boolean =>
  JS_IDENTIFIER_PATTERN.test(value) && !JS_RESERVED_IDENTIFIERS.has(value);

/**
 * Bug found (parity audit item 40): aliases were only `.trim()`'d — values like `"my item"`,
 * `"1x"`, or reserved words could reach Export and produce invalid TSX (esbuild syntax error).
 * Invalid values fall back to a safe default (`item`/`index`).
 */
export const sanitizeRepeaterAlias = (value: string, fallback: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }
  return isValidRepeaterAliasIdentifier(trimmed) ? trimmed : fallback;
};

export type RepeaterRenderScope = {
  itemVar: string;
  indexVar: string;
};

export type RepeaterNodeConfig = {
  dataPath: string;
  itemAlias: string;
  indexAlias: string;
};

export const isLogicRepeaterNode = (node: DesignerNode): boolean => {
  const paletteItemId = node.props[DESIGNER_PALETTE_ITEM_ID_PROP];
  return paletteItemId === LOGIC_REPEATER_PALETTE_ITEM_ID;
};

export const resolveRepeaterNodeConfig = (node: DesignerNode): RepeaterNodeConfig => ({
  dataPath: readString(node.props.dataPath, 'items').trim() || 'items',
  itemAlias: sanitizeRepeaterAlias(readString(node.props.itemAlias, 'item'), 'item'),
  indexAlias: sanitizeRepeaterAlias(readString(node.props.indexAlias, 'index'), 'index'),
});

export const normalizeRepeaterDataPath = (dataPath: string): string => {
  const trimmed = dataPath.trim();
  if (trimmed.startsWith('dataContext.')) {
    return trimmed.slice('dataContext.'.length);
  }

  if (trimmed.startsWith('store.')) {
    return trimmed;
  }

  return trimmed;
};

export const resolveRepeaterArrayExpression = (
  dataPath: string,
  dataContextVar = 'dataContext',
  storeVar = 'designerStore',
): string => {
  const normalized = normalizeRepeaterDataPath(dataPath);
  if (normalized.startsWith('store.')) {
    const storePath = normalized.slice('store.'.length);
    return `${resolveStorePathExpression(storePath, storeVar)} ?? []`;
  }

  return `${dataPathToOptionalChainExpression(normalized, dataContextVar)} ?? []`;
};

export const resolveItemScopedPathExpression = (
  dataPath: string,
  scope: RepeaterRenderScope,
): string => {
  const trimmed = dataPath.trim();
  if (!trimmed.startsWith('item.')) {
    return dataPathToOptionalChainExpression(trimmed, scope.itemVar);
  }

  const remainder = trimmed.slice('item.'.length);
  const segments = remainder.split('.').map((segment) => segment.trim()).filter(Boolean);
  if (segments.length === 0) {
    return scope.itemVar;
  }

  return segments.reduce((expression, segment) => `${expression}?.${segment}`, scope.itemVar);
};

export const isItemScopedDataPath = (dataPath: string): boolean =>
  dataPath.trim().startsWith('item.');
