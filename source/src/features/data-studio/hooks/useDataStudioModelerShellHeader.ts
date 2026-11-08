import { useMemo } from 'react';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { resolveNavLabel } from '../../../core/culture/cultureShellKeys';
import { useShellHeaderOverride } from '../../../layouts/adminShell/ShellHeaderOverrideContext';
import { buildNestedEditorShellHeaderOverride } from '../../../layouts/adminShell/nestedEditorShellHeader';

const DATA_STUDIO_PAGE_KEY = 'data-studio';
const DATA_STUDIO_NAV_ICON = 'Database';

export type DataStudioModelerShellHeaderInput = {
  enabled: boolean;
  description?: string | null;
};

export function buildDataStudioModelerShellHeaderOverride(
  listLabel: string,
  description?: string | null,
) {
  return buildNestedEditorShellHeaderOverride({
    listLabel,
    description: description?.trim() || undefined,
    icon: DATA_STUDIO_NAV_ICON,
  });
}

export function useDataStudioModelerShellHeader(input: DataStudioModelerShellHeaderInput): void {
  const culture = useOptionalCulture();
  const listLabel = resolveNavLabel(culture?.t, DATA_STUDIO_PAGE_KEY, 'Data Studio');

  const override = useMemo(
    () => (input.enabled
      ? buildDataStudioModelerShellHeaderOverride(listLabel, input.description)
      : null),
    [input.description, input.enabled, listLabel],
  );

  useShellHeaderOverride(override);
}
