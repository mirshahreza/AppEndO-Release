import { designerReducer } from '../../../../domain/component-designer/state';
import type { NativeToolDefinition } from '../ToolRegistry';
import {
  buildComponentLayoutDraftResult,
  hydrateDesignerStateFromSource,
  resolveComponentLayoutSource,
  resolveLayoutIdFromArgs,
  saveComponentLayoutDraft,
} from './designerLayoutDraftHelpers';

export const DESIGNER_SET_PROP_TOOL_NAME = 'designer_set_prop';

const parsePropValue = (value: unknown): unknown => {
  if (value === null) {
    return undefined;
  }
  return value;
};

export const executeDesignerSetProp = async (
  args: Record<string, unknown>,
  context?: import('../../agent/types').ToolExecutionContext,
) => {
  const propKey = typeof args.propKey === 'string' ? args.propKey.trim()
    : typeof args.key === 'string' ? args.key.trim()
      : '';
  if (!propKey) {
    return { ok: false as const, summary: 'Property key is required (propKey).', error: 'missing_prop_key' };
  }

  if (!Object.prototype.hasOwnProperty.call(args, 'value')) {
    return { ok: false as const, summary: 'Property value is required.', error: 'missing_value' };
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

  const nodeIdArg = typeof args.nodeId === 'string' ? args.nodeId.trim() : '';
  const selectedNodeId = context?.pageContext?.selectedNodeId?.trim() || '';
  const nodeId = nodeIdArg || selectedNodeId;
  if (!nodeId) {
    return {
      ok: false as const,
      summary: 'Node id is required (nodeId arg or pageContext.selectedNodeId).',
      error: 'missing_node_id',
    };
  }

  if (!source.document.nodes[nodeId]) {
    return { ok: false as const, summary: `Node "${nodeId}" was not found in layout.`, error: 'node_not_found' };
  }

  const value = parsePropValue(args.value);
  const beforeState = hydrateDesignerStateFromSource(source, nodeId);
  const afterState = designerReducer(beforeState, {
    type: 'set-node-prop',
    nodeId,
    key: propKey,
    value,
  });

  if (afterState.document === beforeState.document) {
    return {
      ok: false as const,
      summary: `Property "${propKey}" on node "${nodeId}" was not changed.`,
      error: 'prop_unchanged',
    };
  }

  const draft = saveComponentLayoutDraft(afterState, source);

  return {
    ...buildComponentLayoutDraftResult(
      draft,
      `Set "${propKey}" on node "${nodeId}" in layout "${draft.layoutId}".`,
    ),
    data: {
      draftId: draft.id,
      layoutId: draft.layoutId,
      name: draft.name,
      nodeCount: Object.keys(draft.document.nodes).length,
      nodeId,
      propKey,
      value: value ?? null,
    },
  };
};

export const designerSetPropTool: NativeToolDefinition = {
  name: DESIGNER_SET_PROP_TOOL_NAME,
  description: 'Sets a property on a Component Designer node in an existing layout draft (no disk save). Use after draft_component_layout to tweak labels, bindings, or HeroUI props. Form controls need label plus hint (a short sentence the page guide reads). Returns updated node id and prop key. Example: designer_set_prop({ nodeId: "field-1", propKey: "hint", value: "Required. Enter the order title." }).',
  group: 'draft',
  parameters: {
    type: 'object',
    properties: {
      nodeId: { type: 'string', description: 'Target node id; defaults to pageContext.selectedNodeId' },
      propKey: { type: 'string', description: 'Property key to set or clear (use null value to remove)' },
      value: { type: 'string', description: 'Property value (JSON-compatible); null removes the prop' },
      layoutId: { type: 'string', description: 'Layout or agent draft id; defaults to pageContext.layoutId' },
      draftId: { type: 'string', description: 'Agent draft id when modifying a prior draft artifact' },
    },
    required: ['propKey', 'value'],
  },
  execute: executeDesignerSetProp,
};
