import { parseDesignerAutocompleteItems, serializeDesignerAutocompleteItems } from './designerAutocompleteItems';
import { parseDesignerDataGridColumns } from './designerDataGridColumns';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from './propRegistry';
import type { DesignerNode } from './types';

export const DESIGNER_METADATA_ATTR_COLUMNS = 'data-designer-columns';
export const DESIGNER_METADATA_ATTR_ITEMS = 'data-designer-items';
export const DESIGNER_METADATA_ATTR_PALETTE_ID = 'data-designer-palette-id';

export const isDesignerCodegenMetadataPropKey = (key: string): boolean =>
  key === 'dataDesignerColumns'
  || key === 'dataDesignerItems'
  || key === 'dataDesignerPaletteId'
  || key === DESIGNER_METADATA_ATTR_COLUMNS
  || key === DESIGNER_METADATA_ATTR_ITEMS
  || key === DESIGNER_METADATA_ATTR_PALETTE_ID;

export const resolveDesignerColumnsMetadataValue = (node: DesignerNode): string => {
  if (typeof node.props.columns === 'string' && node.props.columns.trim().length > 0) {
    return node.props.columns.trim();
  }

  return JSON.stringify(parseDesignerDataGridColumns(node.props.columns));
};

export const resolveDesignerItemsMetadataValue = (node: DesignerNode): string => {
  if (typeof node.props.items === 'string' && node.props.items.trim().length > 0) {
    return node.props.items.trim();
  }

  return serializeDesignerAutocompleteItems(parseDesignerAutocompleteItems(node.props.items));
};

export const applyDesignerCodegenMetadataProps = (
  paletteItemId: string,
  props: Record<string, unknown>,
): Record<string, unknown> => {
  const next = { ...props };

  const paletteMeta = next[DESIGNER_METADATA_ATTR_PALETTE_ID] ?? next.dataDesignerPaletteId;
  if (typeof paletteMeta === 'string' && paletteMeta.trim().length > 0) {
    next[DESIGNER_PALETTE_ITEM_ID_PROP] = paletteMeta.trim();
  }

  const columnsMeta = next[DESIGNER_METADATA_ATTR_COLUMNS] ?? next.dataDesignerColumns;
  if (
    (paletteItemId === 'heroui.data-grid' || paletteItemId === 'heroui.app-table-grid' || typeof columnsMeta === 'string')
    && typeof columnsMeta === 'string'
    && columnsMeta.trim().length > 0
  ) {
    next.columns = columnsMeta.trim();
  }

  const itemsMeta = next[DESIGNER_METADATA_ATTR_ITEMS] ?? next.dataDesignerItems;
  if (
    (paletteItemId === 'heroui.autocomplete' || typeof itemsMeta === 'string')
    && typeof itemsMeta === 'string'
    && itemsMeta.trim().length > 0
  ) {
    next.items = itemsMeta.trim();
  }

  delete next[DESIGNER_METADATA_ATTR_COLUMNS];
  delete next.dataDesignerColumns;
  delete next[DESIGNER_METADATA_ATTR_ITEMS];
  delete next.dataDesignerItems;
  delete next[DESIGNER_METADATA_ATTR_PALETTE_ID];
  delete next.dataDesignerPaletteId;

  return next;
};
