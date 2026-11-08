import { useMemo } from 'react';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { navLabelKey } from '../../../core/culture/cultureShellKeys';
import { useShellHeaderOverride } from '../../../layouts/adminShell/ShellHeaderOverrideContext';
import { buildNestedEditorShellHeaderOverride, NESTED_EDITOR_SHELL_SESSION_LABEL } from '../../../layouts/adminShell/nestedEditorShellHeader';

const FILE_HUB_PAGE_KEY = 'file-hub';
const FILE_HUB_NAV_ICON = 'tabler:IconFolders';

export type FileHubEditorShellHeaderInput = {
  enabled: boolean;
  description?: string | null;
};

export function buildFileHubEditorShellHeaderOverride(
  listLabel: string,
  description?: string | null,
) {
  return buildNestedEditorShellHeaderOverride({
    listLabel,
    description: description?.trim() || undefined,
    icon: FILE_HUB_NAV_ICON,
    modeLabel: NESTED_EDITOR_SHELL_SESSION_LABEL,
  });
}

export function useFileHubEditorShellHeader(input: FileHubEditorShellHeaderInput): void {
  const culture = useOptionalCulture();
  const listLabel = culture?.t(navLabelKey(FILE_HUB_PAGE_KEY)) ?? 'Sftp';

  const override = useMemo(
    () => (input.enabled
      ? buildFileHubEditorShellHeaderOverride(listLabel, input.description)
      : null),
    [input.description, input.enabled, listLabel],
  );

  useShellHeaderOverride(override);
}
