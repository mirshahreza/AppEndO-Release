import type { DesignerBindingDefinition, DesignerBindingDefinitions, DesignerNode } from '../../../domain/component-designer/types';
import { resolveOutlineNodeSearchText } from '../../../domain/component-designer/outlineNodeDisplay';
import { getBindingDefinitionEntries, coerceBindingDefinitions } from '../../../domain/component-designer/bindingRegistry';
import type { DesignerVersionRecord, DesignerVersionSummary } from '../../../shared/api/queries/component-designer';
import { normalizeComponentFolder } from '../utils/componentFolder';
export { isDescendantNode } from '../../../domain/component-designer/documentTree';

export const toDraftSummaryFromRecord = (draft: DesignerVersionRecord): DesignerVersionSummary => ({
  id: draft.id,
  name: draft.name,
  folder: normalizeComponentFolder(draft.folder),
  catalogKind: draft.catalogKind,
  tags: draft.tags ?? [],
  createdAt: draft.metadata.createdAt,
  updatedAt: draft.metadata.updatedAt,
  createdBy: draft.metadata.createdBy,
  updatedBy: draft.metadata.updatedBy,
  isBuiltIn: false,
});

export const createDraftFingerprint = (
  document: unknown,
  bindingDefinitions: unknown,
): string => JSON.stringify({ document, bindingDefinitions });

export const hasOpenDesignerModal = (): boolean => {
  if (typeof document === 'undefined') {
    return false;
  }

  return Boolean(document.querySelector('dialog[data-designer-dialog-backdrop][open]'));
};

export const isEditableKeyboardTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tagName = target.tagName;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }

  return Boolean(target.closest('[contenteditable="true"], [role="textbox"]'));
};

export const collectPreviewBindings = (
  document: { nodes: Record<string, DesignerNode> },
  bindingDefinitions: DesignerBindingDefinitions | Record<string, DesignerBindingDefinition>,
): Record<string, DesignerBindingDefinition> => {
  const output: Record<string, DesignerBindingDefinition> = {
    ...getBindingDefinitionEntries(coerceBindingDefinitions(bindingDefinitions)),
  };

  Object.values(document.nodes).forEach((node) => {
    Object.entries(node.binding).forEach(([bindingKey, definition]) => {
      output[`node:${node.id}:${bindingKey}`] = definition;
    });
  });

  return output;
};

export const computeVisibleTreeNodeIds = (
  nodes: Record<string, DesignerNode>,
  rootNodeId: string,
  searchTerm: string,
  bindingDefinitions: DesignerBindingDefinitions,
): ReadonlySet<string> | null => {
  const term = searchTerm.trim().toLowerCase();
  if (!term) {
    return null;
  }

  const visible = new Set<string>();
  for (const node of Object.values(nodes) as DesignerNode[]) {
    if (node.id === rootNodeId) {
      continue;
    }
    const haystack = resolveOutlineNodeSearchText(node, bindingDefinitions).toLowerCase();
    if (haystack.includes(term) || node.type.toLowerCase().includes(term)) {
      visible.add(node.id);
      let ancestorId = nodes[node.id]?.parentId;
      while (ancestorId && ancestorId !== rootNodeId) {
        visible.add(ancestorId);
        ancestorId = nodes[ancestorId]?.parentId ?? null;
      }
    }
  }

  return visible;
};
