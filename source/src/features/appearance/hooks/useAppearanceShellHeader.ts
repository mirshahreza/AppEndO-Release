import { useMemo } from 'react';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import {
  navDescriptionKey,
  resolveCultureLabel,
  resolveNavLabel,
} from '../../../core/culture/cultureShellKeys';
import type { TranslationFn } from '../../../core/culture/TranslationRuntime';
import { useShellHeaderOverride } from '../../../layouts/adminShell/ShellHeaderOverrideContext';
import type { ShellHeaderOverride } from '../../../layouts/adminShell/mergeShellHeaderModule';

const APPEARANCE_PAGE_KEY = 'appearance';
const APPEARANCE_NAV_ICON = 'tabler:IconPalette';

export type AppearanceShellHeaderInput = {
  enabled: boolean;
};

export function buildAppearanceShellHeaderOverride(t: TranslationFn | undefined): ShellHeaderOverride {
  return {
    icon: APPEARANCE_NAV_ICON,
    label: resolveNavLabel(t, APPEARANCE_PAGE_KEY, 'Appearance'),
    description: resolveCultureLabel(
      t,
      navDescriptionKey(APPEARANCE_PAGE_KEY),
      'Colors, shell layout, sidebar behavior, and atmosphere tokens.',
    ),
  };
}

export function useAppearanceShellHeader(input: AppearanceShellHeaderInput | boolean): void {
  const enabled = typeof input === 'boolean' ? input : input.enabled;
  const culture = useOptionalCulture();
  const t = culture?.t;

  const override = useMemo(
    () => (enabled ? buildAppearanceShellHeaderOverride(t) : null),
    [enabled, t],
  );

  useShellHeaderOverride(override);
}
