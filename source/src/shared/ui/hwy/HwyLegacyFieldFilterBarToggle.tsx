import React from 'react';
import { ListFilter, SlidersHorizontal } from 'lucide-react';

import { useCulture } from '../../../core/culture/CultureContext';
import { CULTURE_ACTION_FALLBACK_LABELS } from '../../../core/culture/cultureShellKeys';
import { AppButton } from '../AppButton';
import {
  catalogAppButtonSoftCyanAppliedStateClass,
  catalogAppButtonSoftIndigoAppliedStateClass,
} from '../catalog/catalogInteractionApplied';
import type { CatalogInteractionPreviewProps } from '../catalog/catalogInteractionState';
import { CATALOG_INTERACTION_MARKER_APP_BUTTON } from '../catalog/catalogInteractionState';
import { cn } from '../../../lib/utils';
import { PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS } from '../surfaceClasses';

export type HwyLegacyFieldFilterBarToggleProps = CatalogInteractionPreviewProps & {
  active: boolean;
  onToggle: () => void;
  className?: string;
  /** When false, omits the leading separator in the actions cluster. */
  separatorBefore?: boolean;
  /** Icon-only (default) or labeled «Filter» (`actions.filter`). */
  presentation?: 'icon' | 'labeled';
};

export const HwyLegacyFieldFilterBarToggle: React.FC<HwyLegacyFieldFilterBarToggleProps> = ({
  active,
  onToggle,
  className,
  separatorBefore = false,
  presentation = 'icon',
  catalogPreviewState,
}) => {
  const culture = useCulture();
  const iconLabel = culture.t(
    'hwy.toolbar.legacyFieldFilters.toggle',
    'Field filters (legacy)',
  );
  const hint = culture.t(
    'hwy.toolbar.legacyFieldFilters.hint',
    'Show filters that search specific fields, like the previous app.',
  );
  const labeledText = culture.ready
    ? culture.t('actions.filter')
    : CULTURE_ACTION_FALLBACK_LABELS['actions.filter'] ?? 'Filter';

  const catalogButtonApplied = active
    ? catalogAppButtonSoftCyanAppliedStateClass(catalogPreviewState)
    : catalogAppButtonSoftIndigoAppliedStateClass(catalogPreviewState);

  const labeledButton = (
    <AppButton
      type="button"
      intent={active ? 'toggle-on' : 'secondary'}
      size="sm"
      className={cn(className, CATALOG_INTERACTION_MARKER_APP_BUTTON, catalogButtonApplied)}
      aria-label={labeledText}
      title={hint}
      aria-pressed={active}
      data-testid="hwy-legacy-field-filter-bar-toggle-labeled"
      onClick={onToggle}
    >
      <ListFilter className="h-3.5 w-3.5" aria-hidden="true" />
      {labeledText}
    </AppButton>
  );

  const iconButton = (
    <AppButton
      type="button"
      intent={active ? 'toggle-on' : 'toggle-off'}
      size="icon-md"
      className={cn(className, CATALOG_INTERACTION_MARKER_APP_BUTTON, catalogButtonApplied)}
      aria-label={iconLabel}
      title={hint}
      aria-pressed={active}
      data-testid="hwy-legacy-field-filter-bar-toggle"
      onClick={onToggle}
    >
      <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
    </AppButton>
  );

  return (
    <>
      {separatorBefore ? (
        <span className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
      ) : null}
      {presentation === 'labeled' ? labeledButton : iconButton}
    </>
  );
};
