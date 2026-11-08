import {
  formatBoundPlaceholder,
  getNodePropertyBinding,
  resolveBoundCanvasPropValue,
  resolveBoundCanvasTextContent,
  resolveDesignerEventJsxAttributeName,
  resolveNodeMockEventHandlers,
  resolvePropertyBindingDataPath,
} from './bindingEngine';
import { isRegionColumnBindingDefinition } from './bindingRegionEngine';
import type { DesignerNode } from './types';

export const resolveCanvasInputPlaceholder = (node: DesignerNode, fallback: string): string => {
  const bound = resolveBoundCanvasPropValue(node, 'placeholder', node.props.placeholder);
  return typeof bound === 'string' ? bound : fallback;
};

export const resolveCanvasInputValue = (node: DesignerNode): string | undefined => {
  const binding = getNodePropertyBinding(node, 'value');
  if (binding) {
    const dataPath = resolvePropertyBindingDataPath(binding.definition);
    return dataPath ? formatBoundPlaceholder(dataPath) : undefined;
  }

  return typeof node.props.value === 'string' ? node.props.value : undefined;
};

export const resolveCanvasTextContent = (node: DesignerNode, fallback: string): string =>
  resolveBoundCanvasTextContent(node, fallback);

export const resolveCanvasImageSrc = (node: DesignerNode, fallback: string): string => {
  const bound = resolveBoundCanvasPropValue(node, 'src', node.props.src);
  return typeof bound === 'string' ? bound : fallback;
};

export const resolveCanvasImageAlt = (node: DesignerNode, fallback: string): string => {
  const bound = resolveBoundCanvasPropValue(node, 'alt', node.props.alt);
  return typeof bound === 'string' ? bound : fallback;
};

export const resolveCanvasFallbackSrc = (node: DesignerNode, fallback = ''): string => {
  const bound = resolveBoundCanvasPropValue(node, 'fallbackSrc', node.props.fallbackSrc);
  return typeof bound === 'string' ? bound : fallback;
};

export const resolveCanvasMockEventProps = (
  node: DesignerNode,
): Record<string, (event: Event) => void> => {
  const handlers = resolveNodeMockEventHandlers(node);
  const mapped: Record<string, (event: Event) => void> = {};

  for (const [targetEvent, handler] of Object.entries(handlers)) {
    mapped[resolveDesignerEventJsxAttributeName(targetEvent)] = handler;
  }

  return mapped;
};

export const nodeHasBoundProperties = (node: DesignerNode): boolean =>
  Object.entries(node.binding).some(([bindingKey, definition]) => {
    if (isRegionColumnBindingDefinition(definition)) {
      return true;
    }

    const dataPath = resolvePropertyBindingDataPath(definition);
    return Boolean(dataPath) && (definition.bindingRole === 'property' || bindingKey.startsWith('prop:'));
  });

export const nodeHasBoundEvents = (node: DesignerNode): boolean =>
  Object.keys(resolveNodeMockEventHandlers(node)).length > 0;
