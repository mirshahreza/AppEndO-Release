import React from 'react';
import { ChevronsDownUp, ChevronsUpDown, Network, Plus, Settings2, Table2 } from 'lucide-react';
import {
  AppButton,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  ToolbarActionGroupWithRefresh,
  ToolbarSearchInput,
  UiTooltip,
  ListPageToolbarFrame,
} from '../../../shared/ui';
import { ListPageToolbarScrollRoot } from '../../../shared/ui/list-page/listPageToolbarChrome';
import { PAGE_GUIDE_EN } from '../../../core/culture/translations/pageGuideEn';
import { pageGuideLocalProps } from '../../../shared/ui/shell/pageGuide/pageGuideChrome';
import { cn } from '../../../lib/utils';
import type { ScopedBaseInfoTreeModel } from '../hooks/useScopedBaseInfoTree';
import type { OrgGeoWorkspaceViewMode } from '../lib/orgGeoViewModePrefs';

type OrgGeoDatasheetToolbarProps = {
  page: ScopedBaseInfoTreeModel;
  viewMode: OrgGeoWorkspaceViewMode;
  onViewModeChange: (mode: OrgGeoWorkspaceViewMode) => void;
  onOpenSettings?: () => void;
};

const TOOLBAR_HINT_CLASS =
  'z-[9999] border border-slate-700/80 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 shadow-md';

type TreeToolbarHintButtonProps = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
};

const TreeToolbarHintButton: React.FC<TreeToolbarHintButtonProps> = ({
  label,
  onClick,
  disabled,
  children,
}) => (
  <UiTooltip content={label} contentClassName={TOOLBAR_HINT_CLASS}>
    <AppButton
      size="icon-md"
      intent="utility"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      {...pageGuideLocalProps(
        label,
        label === 'Expand all'
          ? PAGE_GUIDE_EN['pageGuide.page.baseInfo.expand.hint']
          : PAGE_GUIDE_EN['pageGuide.page.baseInfo.collapse.hint'],
        18,
      )}
    >
      {children}
    </AppButton>
  </UiTooltip>
);

export const OrgGeoDatasheetToolbar: React.FC<OrgGeoDatasheetToolbarProps> = ({
  page,
  viewMode,
  onViewModeChange,
  onOpenSettings,
}) => {
  const treeActionsDisabled = page.isLoading || page.isSaving || page.isMoving;

  return (
    <ListPageToolbarFrame>

      <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
        <ToolbarSearchInput
          value={page.search}
          onChange={page.setSearch}
          placeholder="id or title"
          ariaLabel="Search places"
        />
      </div>

      <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
        <ToolbarActionGroupWithRefresh
          onRefresh={() => void page.load()}
          isRefreshing={page.isLoading}
          actions={[
            {
              id: 'create-place',
              label: 'Create',
              icon: <Plus className="h-3.5 w-3.5" aria-hidden="true" />,
              intent: 'create',
              primary: true,
              onClick: page.openCreateModal,
            },
          ]}
        />
        <span className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
        <div className="flex items-center gap-0.5 rounded-md border border-slate-200 bg-white p-0.5">
          <UiTooltip content="Canvas" contentClassName={TOOLBAR_HINT_CLASS}>
            <AppButton
              type="button"
              intent={viewMode === 'canvas' ? 'secondary' : 'utility'}
              size="icon-md"
              aria-label="Canvas view"
              aria-pressed={viewMode === 'canvas'}
              onClick={() => onViewModeChange('canvas')}
            >
              <Network className="h-3.5 w-3.5" />
            </AppButton>
          </UiTooltip>
          <UiTooltip content="Datasheet" contentClassName={TOOLBAR_HINT_CLASS}>
            <AppButton
              type="button"
              intent={viewMode === 'datasheet' ? 'secondary' : 'utility'}
              size="icon-md"
              aria-label="Datasheet view"
              aria-pressed={viewMode === 'datasheet'}
              onClick={() => onViewModeChange('datasheet')}
            >
              <Table2 className="h-3.5 w-3.5" />
            </AppButton>
          </UiTooltip>
        </div>
        <span className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
        <TreeToolbarHintButton
          label="Expand all"
          onClick={page.expandAll}
          disabled={treeActionsDisabled}
        >
          <ChevronsUpDown className="h-3.5 w-3.5" />
        </TreeToolbarHintButton>
        <TreeToolbarHintButton
          label="Collapse all"
          onClick={page.collapseAll}
          disabled={treeActionsDisabled}
        >
          <ChevronsDownUp className="h-3.5 w-3.5" />
        </TreeToolbarHintButton>
        {onOpenSettings ? (
          <>
            <span className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
            <AppButton
              type="button"
              intent="secondary"
              size="sm"
              aria-label="Chart settings"
              disabled={page.isLoading || page.isSaving}
              onClick={onOpenSettings}
              {...pageGuideLocalProps(
                PAGE_GUIDE_EN['pageGuide.page.org.settings.title'],
                PAGE_GUIDE_EN['pageGuide.page.org.settings.hint'],
                16,
              )}
            >
              <Settings2 className="h-3.5 w-3.5" />
              Settings
            </AppButton>
          </>
        ) : null}
      </div>
    </ListPageToolbarFrame>
  );
};
