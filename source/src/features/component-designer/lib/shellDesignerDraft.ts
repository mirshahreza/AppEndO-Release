import type { CreateComponentDesignerVersionPayload } from '../../../shared/api/queries/component-designer';
import { createStateFromAdminShellLayoutTemplate } from '../../../domain/component-designer/layout-presets/adminShellLayoutTemplate';
import { normalizeDesignerComponentName } from '../utils/componentName';
import {
  COMPONENT_ALONE_SHELL_LAYOUT_KEY,
  DEFAULT_DRAFT_FOLDER,
} from '../../../shared/lib/designerShellEntry';
import { getComponentAloneShellLayoutRecord } from '../../../domain/component-designer/systemManagedShellLayout';

export function buildShellDesignerDraftCreatePayload(shellKey: string): CreateComponentDesignerVersionPayload {
  const normalizedShellKey = normalizeDesignerComponentName(shellKey);
  if (normalizedShellKey === COMPONENT_ALONE_SHELL_LAYOUT_KEY) {
    const record = getComponentAloneShellLayoutRecord();
    return {
      name: record.name,
      folder: record.folder,
      document: record.document,
      bindingDefinitions: record.bindingDefinitions,
      workspace: record.workspace,
    };
  }

  const { state } = createStateFromAdminShellLayoutTemplate();

  return {
    name: normalizedShellKey,
    folder: DEFAULT_DRAFT_FOLDER,
    document: {
      ...state.document,
      name: normalizedShellKey,
    },
    bindingDefinitions: state.bindingDefinitions,
    workspace: {
      viewport: state.viewport,
    },
  };
}
