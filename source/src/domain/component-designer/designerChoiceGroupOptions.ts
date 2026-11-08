import { getNodePropertyBinding } from './bindingEngine';
import { hasDesignerNodeItemsBinding } from './designerOptionItems';
import { getNodePaletteItemId } from './runtimeShared';
import type { DesignerNode } from './types';

export type DesignerChoiceGroupOptionsSource = 'static' | 'lov' | 'apiRef';

export const DESIGNER_CHOICE_GROUP_OPTIONS_SOURCES: readonly DesignerChoiceGroupOptionsSource[] = [
  'static',
  'lov',
  'apiRef',
];

export const parseDesignerChoiceGroupOptionsSource = (value: unknown): DesignerChoiceGroupOptionsSource | undefined => {
  if (value === 'static' || value === 'lov' || value === 'apiRef') {
    return value;
  }
  return undefined;
};

/** Resolve how checkbox/radio group options are loaded — explicit prop wins, then infer from bindings. */
export const resolveDesignerChoiceGroupOptionsSource = (node: DesignerNode): DesignerChoiceGroupOptionsSource => {
  const explicit = parseDesignerChoiceGroupOptionsSource(node.props.optionsSource);
  if (explicit) {
    return explicit;
  }

  if (!hasDesignerNodeItemsBinding(node)) {
    return 'static';
  }

  const itemsBinding = getNodePropertyBinding(node, 'items');
  if (itemsBinding?.definition.lovRef?.trim()) {
    return 'lov';
  }

  if (itemsBinding?.definition.fetchEndpoint?.trim()) {
    return 'apiRef';
  }

  return 'apiRef';
};

export const designerChoiceGroupUsesDynamicOptions = (node: DesignerNode): boolean => {
  const paletteItemId = getNodePaletteItemId(node);
  if (paletteItemId !== 'heroui.checkbox-group' && paletteItemId !== 'heroui.radio-group') {
    return true;
  }

  return resolveDesignerChoiceGroupOptionsSource(node) !== 'static';
};
