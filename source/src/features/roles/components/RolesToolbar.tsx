import React, { useMemo } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { CULTURE_ACTION_FALLBACK_LABELS } from '../../../core/culture/cultureShellKeys';
import { PAGE_GUIDE_EN } from '../../../core/culture/translations/pageGuideEn';
import { useViewportTier } from '../../../shared/lib/useViewportTier';
import { isCompactChromeTier } from '../../../shared/lib/viewportTokens';
import {
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  ToolbarActionGroup,
  ToolbarRefreshButton,
  ToolbarSearchInput,
  ListPageToolbarFrame,
  type ToolbarActionItem,
} from '../../../shared/ui';

export type RolesToolbarProps = {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onAddRole: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  rowCount: number;
  showRowCount: boolean;
};

export const RolesToolbar: React.FC<RolesToolbarProps> = ({
  searchInput,
  onSearchInputChange,
  onAddRole,
  onRefresh,
  isRefreshing,
  rowCount,
  showRowCount,
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
      disabled: isRefreshing,
      loading: isRefreshing,
      guideHint: PAGE_GUIDE_EN['pageGuide.chrome.refresh.hint'],
    }),
    [isRefreshing, onRefresh, refreshLabel],
  );

  const addActions = useMemo<ToolbarActionItem[]>(
    () => [
      {
        id: 'add-role',
        label: 'Add Role',
        icon: <Plus className="h-3.5 w-3.5" aria-hidden="true" />,
        intent: 'create',
        primary: true,
        onClick: onAddRole,
      },
    ],
    [onAddRole],
  );

  return (
    <ListPageToolbarFrame>
      <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
        <ToolbarSearchInput
          value={searchInput}
          onChange={onSearchInputChange}
          placeholder="name, note, id"
          ariaLabel="Search roles"
        />
      </div>
      <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
        <ToolbarActionGroup
          actions={addActions}
          compactOverflowActions={compactChrome ? [refreshOverflowAction] : undefined}
        />
        {showRowCount ? (
          <span
            className="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold tabular-nums text-slate-700"
            aria-live="polite"
          >
            {Math.max(0, rowCount).toLocaleString()}
          </span>
        ) : null}
        {!compactChrome ? (
          <ToolbarRefreshButton
            onClick={onRefresh}
            isRefreshing={isRefreshing}
            separatorBefore={showRowCount || addActions.length > 0}
          />
        ) : null}
      </div>
    </ListPageToolbarFrame>
  );
};
