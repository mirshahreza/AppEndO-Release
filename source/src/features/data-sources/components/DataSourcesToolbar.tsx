import React, { useState } from 'react';
import { Plus, Wifi } from 'lucide-react';
import {
  AppButton,
  AppSplitButton,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  SplitButtonMenuItem,
  ToolbarActionGroupWithRefresh,
  ListPageToolbarFrame,
} from '../../../shared/ui';
import { ListPageToolbarScrollRoot } from '../../../shared/ui/list-page/listPageToolbarChrome';
import { cn } from '../../../lib/utils';
import { PAGE_GUIDE_EN } from '../../../core/culture/translations/pageGuideEn';
import { pageGuideLocalProps } from '../../../shared/ui/shell/pageGuide/pageGuideChrome';
import { DataSourceType } from '../../../shared/api/contracts/data-sources/types';
import type { DataSourcesPageModel } from '../hooks/useDataSourcesPage';

type DataSourcesToolbarProps = {
  page: Pick<
    DataSourcesPageModel,
    | 'typeOptions'
    | 'testingAll'
    | 'loading'
    | 'items'
    | 'testConnectivityAll'
    | 'openCreateDialog'
    | 'refreshList'
    | 'isRetryingList'
    | 'listToolbarCollapsed'
  >;
};

export const DataSourcesToolbar: React.FC<DataSourcesToolbarProps> = ({ page }) => {
  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);

  return (
    <ListPageToolbarFrame>

      <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
        <span className="text-xs font-medium text-slate-600">
          {page.items.length} data source{page.items.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
        <AppButton
          type="button"
          intent="utility"
          size="sm"
          onClick={page.testConnectivityAll}
          disabled={page.testingAll || page.loading || page.items.length === 0}
          {...pageGuideLocalProps(
            PAGE_GUIDE_EN['pageGuide.page.sources.testAll.title'],
            PAGE_GUIDE_EN['pageGuide.page.sources.testAll.hint'],
            18,
          )}
        >
          <Wifi className="h-3.5 w-3.5" />
          Test All
        </AppButton>
        <span className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
        <AppSplitButton
          intent="secondary"
          size="sm"
          icon={<Plus className="h-3.5 w-3.5" />}
          isOpen={isNewMenuOpen}
          onOpenChange={setIsNewMenuOpen}
          triggerAriaLabel="Create new data source"
          menuAriaLabel="Select data source type"
          menuClassName="min-w-[190px]"
        >
          {page.typeOptions.map((type) => (
            <SplitButtonMenuItem
              key={type}
              onClick={() => {
                page.openCreateDialog(type as DataSourceType);
                setIsNewMenuOpen(false);
              }}
            >
              {type}
            </SplitButtonMenuItem>
          ))}
        </AppSplitButton>
        <ToolbarActionGroupWithRefresh
          onRefresh={() => { void page.refreshList(); }}
          isRefreshing={page.isRetryingList}
          actions={[]}
        />
      </div>
    </ListPageToolbarFrame>
  );
};

