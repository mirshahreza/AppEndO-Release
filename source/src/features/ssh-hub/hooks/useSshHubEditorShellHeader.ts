import { useMemo } from 'react';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { navLabelKey } from '../../../core/culture/cultureShellKeys';
import { useShellHeaderOverride } from '../../../layouts/adminShell/ShellHeaderOverrideContext';
import { buildNestedEditorShellHeaderOverride, NESTED_EDITOR_SHELL_SESSION_LABEL } from '../../../layouts/adminShell/nestedEditorShellHeader';

const SSH_HUB_PAGE_KEY = 'ssh-hub';
const SSH_HUB_NAV_ICON = 'tabler:IconTerminal2';

export type SshHubEditorShellHeaderInput = {
  enabled: boolean;
  description?: string | null;
};

export function buildSshHubEditorShellHeaderOverride(
  listLabel: string,
  description?: string | null,
) {
  return buildNestedEditorShellHeaderOverride({
    listLabel,
    description: description?.trim() || undefined,
    icon: SSH_HUB_NAV_ICON,
    modeLabel: NESTED_EDITOR_SHELL_SESSION_LABEL,
  });
}

export function useSshHubEditorShellHeader(input: SshHubEditorShellHeaderInput): void {
  const culture = useOptionalCulture();
  const listLabel = culture?.t(navLabelKey(SSH_HUB_PAGE_KEY)) ?? 'SSH';

  const override = useMemo(
    () => (input.enabled
      ? buildSshHubEditorShellHeaderOverride(listLabel, input.description)
      : null),
    [input.description, input.enabled, listLabel],
  );

  useShellHeaderOverride(override);
}
