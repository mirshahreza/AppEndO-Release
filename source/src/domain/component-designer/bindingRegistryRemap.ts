import { REGION_DATA_SOURCE_BINDING_KEY } from './bindingRegionEngine';
import { sanitizeTrueActions } from './bindingDynamicActionsEngine';
import type { DesignerBindingDefinition, DesignerDocument, DesignerNode } from './types';

const remapDataSourceRef = (value: string | undefined, fromId: string, toId: string): string | undefined => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === fromId ? toId : value;
};

const remapBindingDefinition = (
  definition: DesignerBindingDefinition,
  fromId: string,
  toId: string,
): DesignerBindingDefinition => {
  const nextDefinition: DesignerBindingDefinition = { ...definition };

  if (nextDefinition.dataSourceRef) {
    nextDefinition.dataSourceRef = remapDataSourceRef(nextDefinition.dataSourceRef, fromId, toId);
  }

  if (nextDefinition.sourcePath) {
    nextDefinition.sourcePath = remapDataSourceRef(nextDefinition.sourcePath, fromId, toId);
  }

  if (Array.isArray(nextDefinition.trueActions)) {
    nextDefinition.trueActions = sanitizeTrueActions(nextDefinition.trueActions).map((action) => {
      if (action.type !== 'refreshDataSource' || !action.dataSourceRef) {
        return action;
      }

      return {
        ...action,
        dataSourceRef: remapDataSourceRef(action.dataSourceRef, fromId, toId) ?? action.dataSourceRef,
      };
    });
  }

  return nextDefinition;
};

export const remapDataSourceReferencesInNode = (
  node: DesignerNode,
  fromId: string,
  toId: string,
): DesignerNode => {
  if (fromId === toId) {
    return node;
  }

  const nextBinding: DesignerNode['binding'] = {};

  for (const [bindingKey, definition] of Object.entries(node.binding)) {
    if (!definition) {
      continue;
    }

    nextBinding[bindingKey] = remapBindingDefinition(definition, fromId, toId);
  }

  const regionDefinition = nextBinding[REGION_DATA_SOURCE_BINDING_KEY];
  if (regionDefinition) {
    nextBinding[REGION_DATA_SOURCE_BINDING_KEY] = {
      ...regionDefinition,
      dataSourceRef: remapDataSourceRef(regionDefinition.dataSourceRef, fromId, toId),
      sourcePath: remapDataSourceRef(regionDefinition.sourcePath, fromId, toId),
    };
  }

  return {
    ...node,
    binding: nextBinding,
  };
};

export const remapDataSourceReferencesInDocument = (
  document: DesignerDocument,
  fromId: string,
  toId: string,
): DesignerDocument => {
  const previousId = fromId.trim();
  const nextId = toId.trim();
  if (!previousId || !nextId || previousId === nextId) {
    return document;
  }

  const nextNodes: Record<string, DesignerNode> = {};
  for (const [nodeId, node] of Object.entries(document.nodes)) {
    nextNodes[nodeId] = remapDataSourceReferencesInNode(node, previousId, nextId);
  }

  return {
    ...document,
    nodes: nextNodes,
  };
};
