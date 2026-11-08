import { getNodePropertyBinding } from './bindingEngine';
import { getNodeRegionColumnOptionLovDefinition } from './bindingRegionEngine';
import { getNodeStoreReadBindingForProp } from './bindingStoreEngine';
import {
  DEFAULT_DESIGNER_AUTOCOMPLETE_ITEMS,
  normalizeDesignerOptionItems,
  resolveDesignerNodeStaticOptionItems,
  type DesignerAutocompleteItem,
} from './designerAutocompleteItems';
import type { DesignerNode } from './types';
import type { DesignerPreviewBindingBridge } from './runtimeTypes';

export type DesignerOptionItemView = {
  value: string;
  label: string;
};

export const toDesignerOptionItemViews = (items: DesignerAutocompleteItem[]): DesignerOptionItemView[] =>
  items.map((item) => ({
    value: item.id,
    label: item.textValue,
  }));

export const hasDesignerNodeItemsBinding = (node: DesignerNode): boolean =>
  Boolean(
    getNodePropertyBinding(node, 'items')
    || getNodeStoreReadBindingForProp(node, 'items')
    || getNodeRegionColumnOptionLovDefinition(node),
  );

const isUnresolvedBindingPlaceholder = (value: unknown): boolean => {
  if (typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim();
  return (trimmed.startsWith('{{') && trimmed.endsWith('}}'))
    || trimmed.startsWith('[Bound:');
};

export const resolveDesignerStaticOptionItemViews = (node: DesignerNode): DesignerOptionItemView[] => {
  const staticItems = resolveDesignerNodeStaticOptionItems(node);
  if (staticItems.length > 0) {
    return toDesignerOptionItemViews(staticItems);
  }

  return toDesignerOptionItemViews(DEFAULT_DESIGNER_AUTOCOMPLETE_ITEMS);
};

export const resolveDesignerNodeOptionItemViews = (
  node: DesignerNode,
  previewBindings?: DesignerPreviewBindingBridge,
): DesignerOptionItemView[] => {
  if (!hasDesignerNodeItemsBinding(node)) {
    return resolveDesignerStaticOptionItemViews(node);
  }

  const bound = previewBindings?.resolveSelectItems?.(node);
  if (Array.isArray(bound) && bound.length > 0) {
    return toDesignerOptionItemViews(bound);
  }

  const staticItems = resolveDesignerNodeStaticOptionItems(node);
  if (staticItems.length > 0) {
    return toDesignerOptionItemViews(staticItems);
  }

  return toDesignerOptionItemViews(DEFAULT_DESIGNER_AUTOCOMPLETE_ITEMS);
};

export const normalizeBoundDesignerOptionItems = (bound: unknown, staticFallback: unknown): DesignerAutocompleteItem[] => {
  if (isUnresolvedBindingPlaceholder(bound)) {
    const staticItems = normalizeDesignerOptionItems(staticFallback);
    return staticItems.length > 0 ? staticItems : DEFAULT_DESIGNER_AUTOCOMPLETE_ITEMS;
  }

  const normalized = normalizeDesignerOptionItems(bound);
  return normalized.length > 0 ? normalized : normalizeDesignerOptionItems(staticFallback);
};
