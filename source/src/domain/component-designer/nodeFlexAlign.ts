import type { TailwindInspectorField } from './inspectorRegistry';
import type { DesignerDocument, DesignerNode } from './types';
import { applyTailwindUtility, syncTailwindPropKeys } from './tailwindClasses';

const FLEX_SELF_FIELD: TailwindInspectorField = {
  key: 'twSelf',
  label: 'Align Self',
  type: 'select',
  group: 'tailwind',
  utilityPrefix: 'self',
  conflictPattern: /^(?:[a-z0-9-]+:)?self-(?:auto|start|end|center|stretch|baseline)$/,
  options: [
    { value: '', label: '(none)' },
    { value: 'self-start', label: 'self-start' },
    { value: 'self-center', label: 'self-center' },
    { value: 'self-end', label: 'self-end' },
    { value: 'self-stretch', label: 'self-stretch' },
  ],
};

export type FlexChildAlignment = 'start' | 'center';

export const isFlexContainerNode = (node: DesignerNode | undefined): boolean => {
  if (!node) {
    return false;
  }

  const className = typeof node.props.className === 'string' ? node.props.className : '';
  if (/\bflex(?:-|\s|$)/.test(className)) {
    return true;
  }

  const direction = node.props.twFlexDirection;
  return direction === 'flex-row' || direction === 'flex-col' || direction === 'flex-row-reverse' || direction === 'flex-col-reverse';
};

export const resolveSharedFlexParentId = (
  document: DesignerDocument,
  nodeIds: readonly string[],
): string | null => {
  if (nodeIds.length < 2) {
    return null;
  }

  const parentIds = nodeIds.map((nodeId) => document.nodes[nodeId]?.parentId ?? null);
  const firstParent = parentIds[0];
  if (!firstParent || parentIds.some((parentId) => parentId !== firstParent)) {
    return null;
  }

  const parent = document.nodes[firstParent];
  if (!isFlexContainerNode(parent)) {
    return null;
  }

  return firstParent;
};

export const applyFlexChildAlignmentClass = (
  className: string,
  alignment: FlexChildAlignment,
): string => {
  const utility = alignment === 'center' ? 'self-center' : 'self-start';
  return applyTailwindUtility(className, FLEX_SELF_FIELD, utility);
};

export const alignNodesInFlexParent = (
  document: DesignerDocument,
  nodeIds: readonly string[],
  alignment: FlexChildAlignment,
): DesignerDocument | null => {
  const parentId = resolveSharedFlexParentId(document, nodeIds);
  if (!parentId) {
    return null;
  }

  const nodes = { ...document.nodes };
  for (const nodeId of nodeIds) {
    const node = nodes[nodeId];
    if (!node || node.parentId !== parentId) {
      continue;
    }

    const className = typeof node.props.className === 'string' ? node.props.className : '';
    const nextClassName = applyFlexChildAlignmentClass(className, alignment);
    nodes[nodeId] = {
      ...node,
      props: {
        ...node.props,
        className: nextClassName,
        ...syncTailwindPropKeys(nextClassName),
      },
    };
  }

  return {
    ...document,
    nodes,
  };
};
