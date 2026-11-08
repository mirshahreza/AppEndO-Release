import type { DesignerBindingDefinitions, DesignerDocument, DesignerNode } from '../../../domain/component-designer/types';
import { getPaletteItemForNode } from '../../../domain/component-designer/catalog';
import { resolveRegionFormFieldName } from '../../../domain/component-designer/bindingRegionEngine';
import type { EuaFieldMapEntry } from '../../api/contracts/ai/euaFieldAssist';

const TEXT_FIELD_PALETTE_IDS = new Set([
  'heroui.input-text',
  'heroui.textarea',
  'heroui.select',
  'heroui.tags-input',
]);

/** Fields inside closed overlay shells are not page-visible — skip for published toolbar. */
const OVERLAY_SHELL_PALETTE_IDS = new Set([
  'heroui.modal',
  'heroui.alert-dialog',
]);

function isInsideOverlayShell(node: DesignerNode, nodes: Record<string, DesignerNode>): boolean {
  let current: DesignerNode | undefined = node;
  while (current?.parentId) {
    const parent = nodes[current.parentId];
    if (!parent) {
      break;
    }
    const parentPaletteId = getPaletteItemForNode(parent)?.id ?? '';
    if (OVERLAY_SHELL_PALETTE_IDS.has(parentPaletteId)) {
      return true;
    }
    current = parent;
  }
  return false;
}

function isHiddenFieldNode(node: DesignerNode): boolean {
  const className = node.props.className;
  return typeof className === 'string' && /\bhidden\b/.test(className);
}

function resolveFieldType(paletteItemId: string): string {
  if (paletteItemId === 'heroui.textarea') {
    return 'textarea';
  }
  if (paletteItemId === 'heroui.select' || paletteItemId === 'heroui.tags-input') {
    return 'select';
  }
  return 'text';
}

function resolveFieldLabel(node: DesignerNode): string {
  const label = node.props.label;
  if (typeof label === 'string' && label.trim()) {
    return label.trim();
  }
  const placeholder = node.props.placeholder;
  if (typeof placeholder === 'string' && placeholder.trim()) {
    return placeholder.trim();
  }
  const paletteItem = getPaletteItemForNode(node);
  return paletteItem?.label ?? node.id;
}

function resolveSectionId(node: DesignerNode, nodes: Record<string, DesignerNode>): string | undefined {
  let current: DesignerNode | undefined = node;
  while (current?.parentId) {
    const parent = nodes[current.parentId];
    if (!parent) {
      break;
    }
    const paletteItem = getPaletteItemForNode(parent);
    if (paletteItem?.id === 'layout.section' || paletteItem?.id === 'layout.tabs') {
      return parent.id;
    }
    current = parent;
  }
  return undefined;
}

export function isPublishedFormAssistEnabled(document: DesignerDocument): boolean {
  const root = document.nodes[document.rootNodeId];
  const value = root?.props?.publishedFormAssist;
  return value !== false && value !== 'false';
}

export function buildEuaFieldMapFromDocument(
  document: DesignerDocument,
  _bindingDefinitions: DesignerBindingDefinitions | Record<string, unknown> = {},
  options?: {
    sectionId?: string;
    currentValues?: Record<string, string>;
  },
): EuaFieldMapEntry[] {
  const entries: EuaFieldMapEntry[] = [];

  Object.values(document.nodes).forEach((node) => {
    const paletteItem = getPaletteItemForNode(node);
    const paletteItemId = paletteItem?.id ?? '';
    if (!TEXT_FIELD_PALETTE_IDS.has(paletteItemId)) {
      return;
    }

    const aiAssist = node.props.aiAssist;
    if (aiAssist === 'false' || aiAssist === false) {
      return;
    }

    if (isHiddenFieldNode(node) || isInsideOverlayShell(node, document.nodes)) {
      return;
    }

    const sectionId = resolveSectionId(node, document.nodes);
    if (options?.sectionId && sectionId && sectionId !== options.sectionId) {
      return;
    }

    const name = resolveRegionFormFieldName(node.id);
    entries.push({
      name,
      label: resolveFieldLabel(node),
      type: resolveFieldType(paletteItemId),
      sectionId,
      required: node.props.isRequired === true || node.props.required === true,
      currentValue: options?.currentValues?.[name],
    });
  });

  return entries;
}
