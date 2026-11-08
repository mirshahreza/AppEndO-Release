import { useMemo } from 'react';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { resolveNavLabel } from '../../../core/culture/cultureShellKeys';
import { useShellHeaderOverride } from '../../../layouts/adminShell/ShellHeaderOverrideContext';
import { buildNestedEditorShellHeaderOverride } from '../../../layouts/adminShell/nestedEditorShellHeader';

const DATA_SOURCES_PAGE_KEY = 'sources';
const DATA_SOURCES_NAV_ICON = 'Database';
const DATA_SOURCES_QUESTIONS_MODE_LABEL = 'Questions';

export type DataSourcesQuestionsShellHeaderInput = {
  enabled: boolean;
  description?: string | null;
};

export function buildDataSourcesQuestionsShellHeaderOverride(
  listLabel: string,
  description?: string | null,
) {
  return buildNestedEditorShellHeaderOverride({
    listLabel,
    description: description?.trim() || undefined,
    icon: DATA_SOURCES_NAV_ICON,
    modeLabel: DATA_SOURCES_QUESTIONS_MODE_LABEL,
  });
}

export function useDataSourcesQuestionsShellHeader(input: DataSourcesQuestionsShellHeaderInput): void {
  const culture = useOptionalCulture();
  const listLabel = resolveNavLabel(culture?.t, DATA_SOURCES_PAGE_KEY, 'Data Sources');

  const override = useMemo(
    () => (input.enabled
      ? buildDataSourcesQuestionsShellHeaderOverride(listLabel, input.description)
      : null),
    [input.description, input.enabled, listLabel],
  );

  useShellHeaderOverride(override);
}
