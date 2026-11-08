import type { DesignerHandoffPayload } from '../../../shared/api/contracts/ai/agentTypes';
import type { RuntimeActivationBatchResult } from '../../../shared/api/contracts/appendoo/runtimeActivation.types';
import { buildDesignerComponentPath } from '../../../shared/lib/designerComponentPath';
import { readDraftRecord } from '../../domain/component-designer/draftIo';
import type { DesignerDraftRecord } from '../../domain/component-designer/draftTypes';

const designerDraftHasRenderableContent = (draft: DesignerDraftRecord): boolean => {
  const nodes = Object.values(draft.document?.nodes ?? {});
  if (nodes.length <= 1) {
    return false;
  }

  return nodes.some((node) => {
    const paletteItemId = node.props?._designerPaletteItemId;
    return paletteItemId === 'html.form'
      || paletteItemId === 'heroui.input-text'
      || paletteItemId === 'heroui.number-input'
      || paletteItemId === 'layout.flex-column'
      || paletteItemId === 'html.text';
  });
};

/** Map live designer activations to AppEndoo "Open in Designer" handoff payloads. */
export const buildDesignerHandoffFromActivationBatch = (
  batch: RuntimeActivationBatchResult,
): DesignerHandoffPayload[] => {
  const handoffs: DesignerHandoffPayload[] = [];
  const seenLayoutIds = new Set<string>();

  for (const record of batch.records) {
    if (record.kind !== 'designer_draft' || record.status === 'FAILED' || !record.activationRef?.trim()) {
      continue;
    }

    const draft = readDraftRecord(record.activationRef.trim());
    if (!draft || !designerDraftHasRenderableContent(draft)) {
      continue;
    }

    if (seenLayoutIds.has(draft.id)) {
      continue;
    }
    seenLayoutIds.add(draft.id);

    handoffs.push({
      layoutId: draft.id,
      name: draft.name,
      componentPath: buildDesignerComponentPath(draft.folder, draft.name),
    });
  }

  return handoffs;
};
