import { useMemo } from 'react';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { navLabelKey } from '../../../core/culture/cultureShellKeys';
import { useShellHeaderOverride } from '../../../layouts/adminShell/ShellHeaderOverrideContext';
import { buildNestedEditorShellHeaderOverride } from '../../../layouts/adminShell/nestedEditorShellHeader';

const CLIENT_COMPONENTS_PAGE_KEY = 'client-components';
const CLIENT_COMPONENTS_NAV_ICON = 'Component';

export type LiveDesignerShellHeaderInput = {
  enabled: boolean;
};

export function buildLiveDesignerShellHeaderOverride(listLabel: string) {
  return buildNestedEditorShellHeaderOverride({
    listLabel,
    icon: CLIENT_COMPONENTS_NAV_ICON,
  });
}

export function useLiveDesignerShellHeader(input: LiveDesignerShellHeaderInput | boolean): void {
  const enabled = typeof input === 'boolean' ? input : input.enabled;
  const culture = useOptionalCulture();
  const listLabel = culture?.t(navLabelKey(CLIENT_COMPONENTS_PAGE_KEY)) ?? 'Client Components';

  const override = useMemo(
    () => (enabled ? buildLiveDesignerShellHeaderOverride(listLabel) : null),
    [enabled, listLabel],
  );

  useShellHeaderOverride(override);
}
