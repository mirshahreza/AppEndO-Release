import { useMemo } from 'react';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { navLabelKey } from '../../../core/culture/cultureShellKeys';
import { useShellHeaderOverride } from '../../../layouts/adminShell/ShellHeaderOverrideContext';
import { buildNestedEditorShellHeaderOverride } from '../../../layouts/adminShell/nestedEditorShellHeader';

const SERVER_FUNCTIONS_PAGE_KEY = 'server-functions';
const SERVER_FUNCTIONS_NAV_ICON = 'tabler:IconFunction';

export type ServerFunctionEditorShellHeaderInput = {
  enabled: boolean;
  description?: string | null;
};

export function buildServerFunctionEditorShellHeaderOverride(
  listLabel: string,
  description?: string | null,
) {
  return buildNestedEditorShellHeaderOverride({
    listLabel,
    description: description?.trim() || undefined,
    icon: SERVER_FUNCTIONS_NAV_ICON,
  });
}

export function useServerFunctionEditorShellHeader(input: ServerFunctionEditorShellHeaderInput): void {
  const culture = useOptionalCulture();
  const listLabel = culture?.t(navLabelKey(SERVER_FUNCTIONS_PAGE_KEY)) ?? 'Server Functions';

  const override = useMemo(
    () => (input.enabled
      ? buildServerFunctionEditorShellHeaderOverride(listLabel, input.description)
      : null),
    [input.description, input.enabled, listLabel],
  );

  useShellHeaderOverride(override);
}
