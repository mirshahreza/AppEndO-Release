import React, { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { useOptionalCulture } from '../../core/culture/CultureContext';
import { CULTURE_ACTION_FALLBACK_LABELS } from '../../core/culture/cultureShellKeys';
import { PAGE_GUIDE_EN } from '../../core/culture/translations/pageGuideEn';
import { useViewportTier } from '../lib/useViewportTier';
import { isCompactChromeTier } from '../lib/viewportTokens';
import { ToolbarActionGroup, type ToolbarActionGroupProps, type ToolbarActionItem } from './ToolbarActionGroup';
import { ToolbarRefreshButton } from './ToolbarRefreshButton';

export type ToolbarActionGroupWithRefreshProps = Omit<ToolbarActionGroupProps, 'actions'> & {
  actions?: ToolbarActionItem[];
  onRefresh: () => void;
  isRefreshing?: boolean;
  refreshDisabled?: boolean;
};

export const ToolbarActionGroupWithRefresh: React.FC<ToolbarActionGroupWithRefreshProps> = ({
  actions = [],
  compactOverflowActions,
  onRefresh,
  isRefreshing = false,
  refreshDisabled = false,
}) => {
  const culture = useOptionalCulture();
  const tier = useViewportTier();
  const compactChrome = isCompactChromeTier(tier);

  const refreshLabel = culture?.ready
    ? culture.t('actions.refresh')
    : CULTURE_ACTION_FALLBACK_LABELS['actions.refresh'];

  const refreshOverflowAction = useMemo<ToolbarActionItem>(
    () => ({
      id: 'refresh',
      label: refreshLabel,
      icon: <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />,
      intent: 'utility',
      onClick: onRefresh,
      disabled: refreshDisabled || isRefreshing,
      loading: isRefreshing,
      guideHint: PAGE_GUIDE_EN['pageGuide.chrome.refresh.hint'],
    }),
    [isRefreshing, onRefresh, refreshDisabled, refreshLabel],
  );

  const mergedCompactOverflow = useMemo(
    () => [...(compactOverflowActions ?? []), refreshOverflowAction],
    [compactOverflowActions, refreshOverflowAction],
  );

  return (
    <>
      <ToolbarActionGroup
        actions={actions}
        compactOverflowActions={compactChrome ? mergedCompactOverflow : compactOverflowActions}
      />
      {!compactChrome ? (
        <ToolbarRefreshButton
          onClick={onRefresh}
          isRefreshing={isRefreshing}
          disabled={refreshDisabled}
          separatorBefore
        />
      ) : null}
    </>
  );
};
