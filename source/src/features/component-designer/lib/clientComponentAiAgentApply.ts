import type { DesignerBindingDefinitions, DesignerDocument } from '../../../domain/component-designer/types';
import type { AgentStreamEvent, ChangeSet } from '../../../shared/api/contracts/ai/agentTypes';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

export type ClientComponentLayoutApplyPayload = {
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
};

export function isDesignerDocument(value: unknown): value is DesignerDocument {
  if (!isRecord(value)) {
    return false;
  }
  const rootNodeId = typeof value.rootNodeId === 'string' ? value.rootNodeId.trim() : '';
  const nodes = isRecord(value.nodes) ? value.nodes : null;
  if (!rootNodeId || !nodes || !isRecord(nodes[rootNodeId])) {
    return false;
  }
  return true;
}

export function readLayoutFromComponentPatch(changeSet: ChangeSet): ClientComponentLayoutApplyPayload | null {
  if (changeSet.kind !== 'component_layout_patch') {
    return null;
  }
  const patch = isRecord(changeSet.patch) ? changeSet.patch : {};
  if (!isDesignerDocument(patch.document)) {
    return null;
  }
  const bindingDefinitions = isRecord(patch.bindingDefinitions)
    ? patch.bindingDefinitions as DesignerBindingDefinitions
    : {};
  return { document: patch.document, bindingDefinitions };
}

export function readLayoutFromDraftComponentLayoutArgs(
  args: Record<string, unknown>,
): ClientComponentLayoutApplyPayload | null {
  if (!isDesignerDocument(args.document)) {
    return null;
  }
  const bindingDefinitions = isRecord(args.bindingDefinitions)
    ? args.bindingDefinitions as DesignerBindingDefinitions
    : {};
  return { document: args.document, bindingDefinitions };
}

export type ClientComponentAgentApplyCollector = {
  ingest: (event: AgentStreamEvent) => void;
  layout: () => ClientComponentLayoutApplyPayload | null;
};

/** Latest drafted layout from a proposal, or from draft_component_layout tool args. */
export function createClientComponentAgentApplyCollector(): ClientComponentAgentApplyCollector {
  let proposalLayout: ClientComponentLayoutApplyPayload | null = null;
  let draftToolLayout: ClientComponentLayoutApplyPayload | null = null;

  return {
    ingest(event) {
      if (event.type === 'proposal') {
        const layouts = event.changeSets.map(readLayoutFromComponentPatch).filter(
          (layout): layout is ClientComponentLayoutApplyPayload => Boolean(layout),
        );
        if (layouts.length > 0) {
          proposalLayout = layouts[layouts.length - 1] ?? null;
        }
        return;
      }
      if (event.type === 'tool_start' && event.name === 'draft_component_layout') {
        const layout = readLayoutFromDraftComponentLayoutArgs(event.args);
        if (layout) {
          draftToolLayout = layout;
        }
      }
    },
    layout: () => proposalLayout ?? draftToolLayout,
  };
};
