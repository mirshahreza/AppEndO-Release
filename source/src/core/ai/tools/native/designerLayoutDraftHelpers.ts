import { getBuiltInComponentRecord, isBuiltInComponentId } from '../../../../domain/component-designer/layout-presets/builtInComponents';
import { getDesignerDraft } from '../../../../server/domain/component-designer/drafts';
import type { DesignerBindingDefinition, DesignerDocument } from '../../../../domain/component-designer/types';
import { createInitialDesignerState, designerReducer } from '../../../../domain/component-designer/state';
import type { DesignerState } from '../../../../domain/component-designer/types';
import type { ToolExecutionContext } from '../../agent/types';
import {
  createDraftId,
  getAgentDraft,
  listAgentDrafts,
  putAgentDraft,
  type ComponentLayoutDraft,
} from './agentDraftStore';

export type ResolvedComponentLayoutSource = {
  name: string;
  folder: string;
  description?: string;
  layoutId: string;
  document: DesignerDocument;
  bindingDefinitions: Record<string, DesignerBindingDefinition>;
  baseLayoutId?: string;
};

export const resolveLayoutIdFromArgs = (
  args: Record<string, unknown>,
  context?: ToolExecutionContext,
): string | undefined => {
  const draftId = typeof args.draftId === 'string' ? args.draftId.trim() : '';
  const layoutId = typeof args.layoutId === 'string' ? args.layoutId.trim() : '';
  const pageLayoutId = context?.pageContext?.layoutId?.trim() || '';
  return draftId || layoutId || pageLayoutId || undefined;
};

export const resolveComponentLayoutSource = (
  id: string,
): ResolvedComponentLayoutSource | { error: string; summary: string } => {
  const trimmed = id.trim();
  if (!trimmed) {
    return { error: 'missing_layout_id', summary: 'Layout id is required (args or pageContext.layoutId).' };
  }

  const agentDraft = getAgentDraft(trimmed);
  if (agentDraft?.kind === 'component_layout') {
    return componentLayoutDraftToSource(agentDraft);
  }

  const agentDraftByLayoutId = [...listAgentDrafts()]
    .reverse()
    .find((draft) => draft.kind === 'component_layout' && draft.layoutId === trimmed);
  if (agentDraftByLayoutId?.kind === 'component_layout') {
    return componentLayoutDraftToSource(agentDraftByLayoutId);
  }

  if (isBuiltInComponentId(trimmed)) {
    const builtIn = getBuiltInComponentRecord(trimmed);
    if (!builtIn) {
      return { error: 'layout_not_found', summary: `Layout "${trimmed}" was not found.` };
    }
    return {
      name: builtIn.name,
      folder: builtIn.folder,
      layoutId: trimmed,
      document: structuredClone(builtIn.document),
      bindingDefinitions: structuredClone(builtIn.bindingDefinitions ?? {}),
      baseLayoutId: trimmed,
    };
  }

  const designerDraft = getDesignerDraft(trimmed);
  if (designerDraft) {
    return {
      name: designerDraft.name,
      folder: designerDraft.folder,
      layoutId: designerDraft.id,
      document: structuredClone(designerDraft.document),
      bindingDefinitions: structuredClone(designerDraft.bindingDefinitions ?? {}),
      baseLayoutId: trimmed,
    };
  }

  return { error: 'layout_not_found', summary: `Layout "${trimmed}" was not found.` };
};

const componentLayoutDraftToSource = (draft: ComponentLayoutDraft): ResolvedComponentLayoutSource => ({
  name: draft.name,
  folder: draft.folder,
  description: draft.description,
  layoutId: draft.layoutId,
  document: structuredClone(draft.document),
  bindingDefinitions: structuredClone(draft.bindingDefinitions),
  baseLayoutId: draft.baseLayoutId,
});

export const hydrateDesignerStateFromSource = (
  source: ResolvedComponentLayoutSource,
  preferredSelectedNodeId?: string | null,
): DesignerState => {
  let state = createInitialDesignerState(source.name);
  state = designerReducer(state, {
    type: 'hydrate-document',
    document: source.document,
    bindingDefinitions: source.bindingDefinitions,
    preferredSelectedNodeId: preferredSelectedNodeId ?? null,
  });
  return state;
};

export const saveComponentLayoutDraft = (
  state: DesignerState,
  source: ResolvedComponentLayoutSource,
): ComponentLayoutDraft => {
  const draftId = createDraftId();
  return putAgentDraft({
    kind: 'component_layout',
    id: draftId,
    layoutId: source.layoutId,
    name: source.name,
    folder: source.folder,
    description: source.description,
    document: state.document,
    bindingDefinitions: state.bindingDefinitions,
    baseLayoutId: source.baseLayoutId,
    previousDocument: structuredClone(source.document),
  }) as ComponentLayoutDraft;
};

export const buildComponentLayoutDraftResult = (draft: ComponentLayoutDraft, summary: string) => ({
  ok: true as const,
  summary,
  data: {
    draftId: draft.id,
    layoutId: draft.layoutId,
    name: draft.name,
    nodeCount: Object.keys(draft.document.nodes).length,
    selectedNodeId: null as string | null,
  },
  artifacts: [{ kind: 'draft' as const, id: draft.id, label: draft.name }],
});
