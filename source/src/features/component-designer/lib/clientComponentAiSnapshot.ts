import type {
  DesignerBindingDefinitions,
  DesignerDocument,
  DesignerNode,
} from '../../../domain/component-designer/types';

const MAX_SNAPSHOT_CHARS = 32_000;

export type ClientComponentAiSnapshotInput = {
  name: string;
  layoutId: string | null;
  selectedNodeId: string | null;
  readOnly: boolean;
  document: DesignerDocument | null;
  bindingDefinitions: DesignerBindingDefinitions;
};

const clipJson = (value: unknown): unknown => {
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length <= MAX_SNAPSHOT_CHARS) {
      return value;
    }
    return { truncated: true, preview: serialized.slice(0, MAX_SNAPSHOT_CHARS) };
  } catch {
    return { error: 'Unserializable layout snapshot' };
  }
};

const summarizeNode = (node: DesignerNode | undefined): Record<string, unknown> | null => {
  if (!node) {
    return null;
  }
  return {
    id: node.id,
    type: node.type,
    parentId: node.parentId,
    childCount: node.children.length,
    props: node.props,
  };
};

export const buildClientComponentAiSnapshot = (input: ClientComponentAiSnapshotInput): string => {
  const document = input.document;
  const selected = document && input.selectedNodeId
    ? document.nodes[input.selectedNodeId]
    : undefined;

  return JSON.stringify({
    name: input.name,
    layoutId: input.layoutId,
    selectedNodeId: input.selectedNodeId,
    readOnly: input.readOnly,
    nodeCount: document ? Object.keys(document.nodes).length : 0,
    selectedNode: summarizeNode(selected),
    document: clipJson(document),
    bindingDefinitions: clipJson(input.bindingDefinitions),
  }, null, 2);
};
