import { collectDocumentRegionPlan } from '../../../domain/component-designer/bindingRegionEngine';
import { patchDesignerStorePath } from '../../../domain/component-designer/bindingPreviewHandlers';
import type { DesignerBindingDefinitions, DesignerDocument } from '../../../domain/component-designer/types';
import type { EuaExtractedFieldValue } from '../../api/contracts/ai/euaFieldAssist';

export function applyEuaUpdatesToDesignerStore(
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions | Record<string, unknown>,
  store: Record<string, unknown>,
  updates: EuaExtractedFieldValue[],
): Record<string, unknown> {
  const plan = collectDocumentRegionPlan(document, bindingDefinitions as DesignerBindingDefinitions);
  let next = store;

  updates.forEach((update) => {
    const binding = plan.regionColumnBindings.find((entry) => entry.nodeId === update.name);
    if (!binding) {
      return;
    }
    const path = `${binding.dataVar}.${binding.column}`;
    next = patchDesignerStorePath(next, path, update.value);
  });

  return next;
}
