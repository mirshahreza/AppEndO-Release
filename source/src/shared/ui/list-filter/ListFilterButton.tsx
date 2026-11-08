import React from 'react';
import { ListFilter } from 'lucide-react';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { CULTURE_ACTION_FALLBACK_LABELS } from '../../../core/culture/cultureShellKeys';
import { PAGE_GUIDE_EN } from '../../../core/culture/translations/pageGuideEn';
import { AppButton } from '../AppButton';
import { pageGuideChromeProps } from '../shell/pageGuide/pageGuideChrome';

export type ListFilterButtonProps = {
  onClick: () => void;
  active?: boolean;
  conditionCount?: number;
  disabled?: boolean;
};

export const ListFilterButton: React.FC<ListFilterButtonProps> = ({
  onClick,
  active = false,
  conditionCount = 0,
  disabled = false,
}) => {
  const culture = useOptionalCulture();
  const label = culture?.ready
    ? culture.t('actions.filter')
    : CULTURE_ACTION_FALLBACK_LABELS['actions.filter'] ?? 'Filter';
  const countLabel = active && conditionCount > 0 ? `${label} (${conditionCount})` : label;

  return (
    <AppButton
      intent={active ? 'toggle-on' : 'secondary'}
      size="sm"
      aria-label={countLabel}
      aria-pressed={active}
      title={countLabel}
      disabled={disabled}
      onClick={onClick}
      {...pageGuideChromeProps((key) => PAGE_GUIDE_EN[key] ?? key, 'filter', 22)}
    >
      <ListFilter className="h-3.5 w-3.5" />
      {countLabel}
    </AppButton>
  );
};
