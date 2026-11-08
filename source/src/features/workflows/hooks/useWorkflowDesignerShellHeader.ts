import { useMemo } from 'react';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { navLabelKey } from '../../../core/culture/cultureShellKeys';
import { useShellHeaderOverride } from '../../../layouts/adminShell/ShellHeaderOverrideContext';
import { buildNestedEditorShellHeaderOverride } from '../../../layouts/adminShell/nestedEditorShellHeader';

const WORKFLOWS_PAGE_KEY = 'workflows';
const WORKFLOWS_NAV_ICON = 'Workflow';

export type WorkflowDesignerShellHeaderInput = {
  enabled: boolean;
  description?: string | null;
};

export function buildWorkflowDesignerShellHeaderOverride(
  listLabel: string,
  description?: string | null,
) {
  return buildNestedEditorShellHeaderOverride({
    listLabel,
    description: description?.trim() || undefined,
    icon: WORKFLOWS_NAV_ICON,
  });
}

export function useWorkflowDesignerShellHeader(input: WorkflowDesignerShellHeaderInput): void {
  const culture = useOptionalCulture();
  const listLabel = culture?.t(navLabelKey(WORKFLOWS_PAGE_KEY)) ?? 'Workflows';

  const override = useMemo(
    () => (input.enabled
      ? buildWorkflowDesignerShellHeaderOverride(listLabel, input.description)
      : null),
    [input.description, input.enabled, listLabel],
  );

  useShellHeaderOverride(override);
}
