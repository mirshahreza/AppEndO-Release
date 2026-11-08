import { getPaletteItemById } from '../../../../domain/component-designer/catalog';
import { designerReducer } from '../../../../domain/component-designer/state';
import type { NativeToolDefinition } from '../ToolRegistry';
import {
  buildComponentLayoutDraftResult,
  hydrateDesignerStateFromSource,
  resolveComponentLayoutSource,
  resolveLayoutIdFromArgs,
  saveComponentLayoutDraft,
} from './designerLayoutDraftHelpers';

export const DESIGNER_INSERT_PALETTE_ITEM_TOOL_NAME = 'designer_insert_palette_item';

export const executeDesignerInsertPaletteItem = async (
  args: Record<string, unknown>,
  context?: import('../../agent/types').ToolExecutionContext,
) => {
  const itemId = typeof args.itemId === 'string' ? args.itemId.trim() : '';
  if (!itemId) {
    return { ok: false as const, summary: 'Palette item id is required.', error: 'missing_item_id' };
  }

  if (!getPaletteItemById(itemId)) {
    return { ok: false as const, summary: `Palette item "${itemId}" was not found.`, error: 'palette_item_not_found' };
  }

  const layoutId = resolveLayoutIdFromArgs(args, context);
  if (!layoutId) {
    return {
      ok: false as const,
      summary: 'Layout id is required (layoutId/draftId arg or pageContext.layoutId).',
      error: 'missing_layout_id',
    };
  }

  const source = resolveComponentLayoutSource(layoutId);
  if ('error' in source) {
    return { ok: false as const, summary: source.summary, error: source.error };
  }

  const parentIdArg = typeof args.parentId === 'string' ? args.parentId.trim() : '';
  const selectedNodeId = context?.pageContext?.selectedNodeId?.trim() || '';
  const parentId = parentIdArg || selectedNodeId || source.document.rootNodeId;

  const index = typeof args.index === 'number' && Number.isFinite(args.index)
    ? Math.max(0, Math.floor(args.index))
    : undefined;

  const beforeState = hydrateDesignerStateFromSource(source, selectedNodeId || null);
  const afterState = designerReducer(beforeState, {
    type: 'insert-palette-item',
    itemId,
    parentId,
    index,
  });

  if (afterState.document === beforeState.document && afterState.selectedNodeId === beforeState.selectedNodeId) {
    return {
      ok: false as const,
      summary: `Could not insert "${itemId}" under node "${parentId}". Check parent container rules.`,
      error: 'insert_failed',
    };
  }

  const draft = saveComponentLayoutDraft(afterState, source);
  const insertedNodeId = afterState.selectedNodeId;

  return {
    ...buildComponentLayoutDraftResult(
      draft,
      `Inserted palette item "${itemId}" into layout "${draft.layoutId}".`,
    ),
    data: {
      draftId: draft.id,
      layoutId: draft.layoutId,
      name: draft.name,
      nodeCount: Object.keys(draft.document.nodes).length,
      insertedNodeId,
      parentId,
      itemId,
    },
  };
};

export const designerInsertPaletteItemTool: NativeToolDefinition = {
  name: DESIGNER_INSERT_PALETTE_ITEM_TOOL_NAME,
  description: 'Inserts a palette item into a Component Designer layout draft (no disk save). Use to add HeroUI controls or HTML nodes under a parent. After inserting a form control, set label and hint (plain-language sentence) with designer_set_prop so the page guide can explain the field. Returns new node id and itemId. Example: designer_insert_palette_item({ itemId: "heroui.button-solid", parentId: "root" }).',
  group: 'draft',
  parameters: {
    type: 'object',
    properties: {
      itemId: { type: 'string', description: 'Palette item id (e.g. heroui.button-solid, html.text)' },
      layoutId: { type: 'string', description: 'Layout or agent draft id; defaults to pageContext.layoutId' },
      draftId: { type: 'string', description: 'Agent draft id when modifying a prior draft artifact' },
      parentId: { type: 'string', description: 'Parent node id; defaults to pageContext.selectedNodeId or layout root' },
      index: { type: 'number', description: 'Optional child index under parent' },
    },
    required: ['itemId'],
  },
  execute: executeDesignerInsertPaletteItem,
};
