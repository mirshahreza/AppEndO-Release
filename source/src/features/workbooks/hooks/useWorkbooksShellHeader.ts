import { useMemo } from 'react';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { resolveNavLabel } from '../../../core/culture/cultureShellKeys';
import { useShellHeaderOverride } from '../../../layouts/adminShell/ShellHeaderOverrideContext';
import { buildNestedEditorShellHeaderOverride } from '../../../layouts/adminShell/nestedEditorShellHeader';

export const WORKBOOKS_PAGE_KEY = 'workbooks';
export const MY_WORKBOOKS_PAGE_KEY = 'my-workbooks';
const WORKBOOKS_NAV_ICON = 'tabler:IconTable';

export type WorkbooksShellHeaderInput = {
  enabled: boolean;
  pageKey?: string;
};

export function buildWorkbooksShellHeaderOverride(listLabel: string) {
  return buildNestedEditorShellHeaderOverride({
    listLabel,
    icon: WORKBOOKS_NAV_ICON,
  });
}

export function useWorkbooksShellHeader(input: WorkbooksShellHeaderInput): void {
  const culture = useOptionalCulture();
  const pageKey = input.pageKey || WORKBOOKS_PAGE_KEY;
  const fallback = pageKey === MY_WORKBOOKS_PAGE_KEY ? 'My Workbooks' : 'Workbooks';
  const listLabel = resolveNavLabel(culture?.t, pageKey, fallback);

  const override = useMemo(
    () => (input.enabled ? buildWorkbooksShellHeaderOverride(listLabel) : null),
    [input.enabled, listLabel],
  );

  useShellHeaderOverride(override);
}
