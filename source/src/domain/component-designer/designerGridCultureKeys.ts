import { getNodePaletteItemId } from './runtimeShared';
import {
  APP_TABLE_GRID_PALETTE_ITEM_ID,
  parseDesignerAppTableGridColumns,
  parseDesignerGridSortOptions,
} from './designerDataGridColumns';
import { parseDesignerGridToolbarConfig } from './designerGridToolbarConfig';
import type { DesignerDocument, DesignerNode } from './types';

const readTrimmedProp = (node: DesignerNode, prop: string): string => {
  const value = node.props[prop];
  return typeof value === 'string' ? value.trim() : '';
};

export const appTableGridNodeUsesCultureKeys = (node: DesignerNode): boolean => {
  if (getNodePaletteItemId(node) !== APP_TABLE_GRID_PALETTE_ITEM_ID) {
    return false;
  }

  if (
    readTrimmedProp(node, 'loadingMessageTranslationKey')
    || readTrimmedProp(node, 'emptyContentTranslationKey')
    || readTrimmedProp(node, 'errorContentTranslationKey')
    || readTrimmedProp(node, 'searchPlaceholderTranslationKey')
    || readTrimmedProp(node, 'refreshLabelTranslationKey')
  ) {
    return true;
  }

  const columns = parseDesignerAppTableGridColumns(node.props.columns);
  if (columns.some((column) => Boolean(column.labelTranslationKey?.trim()))) {
    return true;
  }

  const sortOptions = parseDesignerGridSortOptions(node.props.sortOptions);
  if (sortOptions.some((option) => Boolean(option.labelTranslationKey?.trim()))) {
    return true;
  }

  const toolbarConfig = parseDesignerGridToolbarConfig(node.props.toolbarConfig);
  const fieldFilters = toolbarConfig?.fieldFilters ?? [];
  if (fieldFilters.some((filter) => Boolean(filter.labelTranslationKey?.trim()))) {
    return true;
  }

  return false;
};

export const documentUsesAppTableGridCultureKeys = (document: DesignerDocument): boolean =>
  Object.values(document.nodes).some((node) => appTableGridNodeUsesCultureKeys(node));

export const nodeUsesFormFieldCultureKeys = (node: DesignerNode): boolean =>
  Boolean(
    readTrimmedProp(node, 'labelTranslationKey')
    || readTrimmedProp(node, 'placeholderTranslationKey'),
  );

export const documentUsesFormFieldCultureKeys = (document: DesignerDocument): boolean =>
  Object.values(document.nodes).some((node) => nodeUsesFormFieldCultureKeys(node));

/** Runtime/preview parity with exported `culture.t(...)` grid chrome strings. */
export const resolveDesignerGridCultureText = (
  node: DesignerNode,
  translationKeyProp: string,
  literal: string,
  translate?: (key: string) => string,
): string => {
  const key = readTrimmedProp(node, translationKeyProp);
  if (!key || !translate) {
    return literal;
  }
  const translated = translate(key);
  return translated !== key ? translated : literal;
};

/** Resolve a bound prop via an optional `*TranslationKey` sibling (forms, modals, buttons). */
export const resolveDesignerCulturePropText = (
  node: DesignerNode,
  translationKeyProp: string,
  literalProp: string,
  fallback: string,
  translate?: (key: string) => string,
): string => {
  const raw = node.props[literalProp];
  const literal = typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : fallback;
  return resolveDesignerGridCultureText(node, translationKeyProp, literal, translate);
};
