import type { DesignerBindingDefinitions, DesignerNode } from '../../../domain/component-designer/types';
import { resolveOutlinePrimaryLabel } from '../../../domain/component-designer/outlineNodeDisplay';

export const getNodeLabel = (
  node: DesignerNode,
  bindingDefinitions?: DesignerBindingDefinitions,
): string => resolveOutlinePrimaryLabel(node, bindingDefinitions);
