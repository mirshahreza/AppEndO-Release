import { useMemo } from 'react';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { navLabelKey } from '../../../core/culture/cultureShellKeys';
import { useShellHeaderOverride } from '../../../layouts/adminShell/ShellHeaderOverrideContext';
import { buildNestedEditorShellHeaderOverride } from '../../../layouts/adminShell/nestedEditorShellHeader';

const IDEA_FOUNDRY_PAGE_KEY = 'idea-foundry';
const IDEA_FOUNDRY_NAV_ICON = 'Sparkles';

export type IdeaFoundryShellHeaderInput = {
  enabled: boolean;
};

export function buildIdeaFoundryShellHeaderOverride(listLabel: string) {
  return buildNestedEditorShellHeaderOverride({
    listLabel,
    icon: IDEA_FOUNDRY_NAV_ICON,
  });
}

export function useIdeaFoundryShellHeader(input: IdeaFoundryShellHeaderInput): void {
  const culture = useOptionalCulture();
  const listLabel = culture?.t(navLabelKey(IDEA_FOUNDRY_PAGE_KEY)) ?? 'Idea Foundry';

  const override = useMemo(
    () => (input.enabled ? buildIdeaFoundryShellHeaderOverride(listLabel) : null),
    [input.enabled, listLabel],
  );

  useShellHeaderOverride(override);
}
