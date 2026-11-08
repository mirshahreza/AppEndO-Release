import { getPaletteItemForNode } from './catalog';
import { parseDesignerDataGridColumns } from './designerDataGridColumns';
import { getNodeGridListResourceRef } from './bindingGridEngine';
import { getNodeRegionDataSourceRef, isDataRegionEligibleContainer } from './bindingRegionEngine';
import { parseCrudSetSpec, parseRecordFormColumns, isRecordFormMode } from './crudSetSpec';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from './propRegistry';
import type { DesignerBindingDefinitions, DesignerNode } from './types';

export type OutlineNodeDisplay = {
  /** Toolbox / palette name — e.g. Input Text, Form, Data Grid */
  componentLabel: string;
  /** User-facing detail — label, button text, API connection, column count */
  detail: string | null;
};

const NODE_TYPE_LABELS: Record<string, string> = {
  root: 'Layout',
  container: 'Container',
  text: 'Text',
  heading: 'Heading',
  link: 'Link',
  image: 'Image',
  list: 'List',
  'list-item': 'List Item',
};

const readTrimmedProp = (node: DesignerNode, key: string): string => {
  const value = node.props[key];
  return typeof value === 'string' ? value.trim() : '';
};

const resolveDataSourceLabel = (
  dataSourceRef: string,
  bindingDefinitions: DesignerBindingDefinitions,
): string => {
  const trimmed = dataSourceRef.trim();
  if (!trimmed) {
    return '';
  }

  const dataSource = bindingDefinitions.dataSources[trimmed];
  return dataSource?.name?.trim() || trimmed;
};

export const resolveOutlineComponentLabel = (node: DesignerNode): string => {
  const paletteItem = getPaletteItemForNode(node);
  if (paletteItem?.label.trim()) {
    return paletteItem.label.trim();
  }

  return NODE_TYPE_LABELS[node.type] ?? node.type;
};

export const resolveOutlineNodeDetail = (
  node: DesignerNode,
  bindingDefinitions: DesignerBindingDefinitions,
): string | null => {
  if (node.type === 'reusable-slot') {
    const componentLabel = readTrimmedProp(node, 'label');
    if (componentLabel) {
      return componentLabel;
    }

    const componentId = node.componentRef?.refId ?? readTrimmedProp(node, 'componentId');
    return componentId || null;
  }

  if (node.type === 'system-slot') {
    const slotLabel = readTrimmedProp(node, 'label');
    if (slotLabel) {
      return slotLabel;
    }

    return readTrimmedProp(node, 'slotId') || null;
  }

  const paletteItemId = readTrimmedProp(node, DESIGNER_PALETTE_ITEM_ID_PROP);

  if (paletteItemId === 'heroui.data-grid' || paletteItemId === 'heroui.app-table-grid') {
    const columnCount = parseDesignerDataGridColumns(node.props.columns).length;
    const resourceRef = getNodeGridListResourceRef(node);
    const columnPart = `${columnCount} column${columnCount === 1 ? '' : 's'}`;
    if (resourceRef) {
      return `${columnPart} · ${resolveDataSourceLabel(resourceRef, bindingDefinitions)}`;
    }

    return columnPart;
  }

  if (paletteItemId === 'heroui.crud-set') {
    const spec = parseCrudSetSpec(node.props.spec);
    const columnCount = spec?.columns.length ?? 0;
    const resourceRef = getNodeGridListResourceRef(node);
    const columnPart = `${columnCount} column${columnCount === 1 ? '' : 's'}`;
    if (resourceRef) {
      return `${columnPart} · ${resolveDataSourceLabel(resourceRef, bindingDefinitions)}`;
    }

    return columnPart;
  }

  if (paletteItemId === 'heroui.record-form') {
    const columns = parseRecordFormColumns(node.props.spec);
    const mode = isRecordFormMode(node.props.mode) ? node.props.mode : 'edit';
    const fieldCount = columns.length;
    return `${mode} · ${fieldCount} field${fieldCount === 1 ? '' : 's'}`;
  }

  if (isDataRegionEligibleContainer(node)) {
    const resourceRef = getNodeRegionDataSourceRef(node);
    if (resourceRef) {
      return resolveDataSourceLabel(resourceRef, bindingDefinitions);
    }
  }

  const text = readTrimmedProp(node, 'text');
  if (text) {
    return text;
  }

  const label = readTrimmedProp(node, 'label');
  if (label) {
    return label;
  }

  const name = readTrimmedProp(node, 'name');
  if (name) {
    return name;
  }

  const placeholder = readTrimmedProp(node, 'placeholder');
  if (placeholder) {
    return placeholder;
  }

  const alt = readTrimmedProp(node, 'alt');
  if (alt) {
    return alt;
  }

  const href = readTrimmedProp(node, 'href');
  if (href && href !== '#') {
    return href;
  }

  const repeaterPath = readTrimmedProp(node, 'dataPath');
  if (paletteItemId === 'logic.repeater' && repeaterPath) {
    return repeaterPath;
  }

  return null;
};

export const resolveOutlineNodeDisplay = (
  node: DesignerNode,
  bindingDefinitions: DesignerBindingDefinitions,
): OutlineNodeDisplay => ({
  componentLabel: resolveOutlineComponentLabel(node),
  detail: resolveOutlineNodeDetail(node, bindingDefinitions),
});

export const resolveOutlinePrimaryLabel = (
  node: DesignerNode,
  bindingDefinitions: DesignerBindingDefinitions = { definitions: {}, dataSources: {}, storeSegments: {}, lovs: {} },
): string => {
  const display = resolveOutlineNodeDisplay(node, bindingDefinitions);
  return display.detail ?? display.componentLabel;
};

export const resolveOutlineNodeSearchText = (
  node: DesignerNode,
  bindingDefinitions: DesignerBindingDefinitions,
): string => {
  const display = resolveOutlineNodeDisplay(node, bindingDefinitions);
  const parts = [
    display.componentLabel,
    display.detail,
    readTrimmedProp(node, 'name'),
    readTrimmedProp(node, 'text'),
    readTrimmedProp(node, 'label'),
    readTrimmedProp(node, 'placeholder'),
    node.type,
  ];

  return parts.filter((part) => part && part.length > 0).join(' ');
};
