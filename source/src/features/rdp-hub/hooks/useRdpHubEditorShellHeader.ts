import { useMemo } from 'react';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { navLabelKey } from '../../../core/culture/cultureShellKeys';
import { useShellHeaderOverride } from '../../../layouts/adminShell/ShellHeaderOverrideContext';
import { buildNestedEditorShellHeaderOverride, NESTED_EDITOR_SHELL_SESSION_LABEL } from '../../../layouts/adminShell/nestedEditorShellHeader';

const RDP_HUB_PAGE_KEY = 'rdp-hub';
const RDP_HUB_NAV_ICON = 'tabler:IconDeviceDesktop';

export type RdpHubEditorShellHeaderInput = {
  enabled: boolean;
  description?: string | null;
};

export function buildRdpHubEditorShellHeaderOverride(
  listLabel: string,
  description?: string | null,
) {
  return buildNestedEditorShellHeaderOverride({
    listLabel,
    description: description?.trim() || undefined,
    icon: RDP_HUB_NAV_ICON,
    modeLabel: NESTED_EDITOR_SHELL_SESSION_LABEL,
  });
}

export function useRdpHubEditorShellHeader(input: RdpHubEditorShellHeaderInput): void {
  const culture = useOptionalCulture();
  const listLabel = culture?.t(navLabelKey(RDP_HUB_PAGE_KEY)) ?? 'RDP';

  const override = useMemo(
    () => (input.enabled
      ? buildRdpHubEditorShellHeaderOverride(listLabel, input.description)
      : null),
    [input.description, input.enabled, listLabel],
  );

  useShellHeaderOverride(override);
}
