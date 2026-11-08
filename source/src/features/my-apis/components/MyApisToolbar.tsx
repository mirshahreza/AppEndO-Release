import React from 'react';
import {
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  ToolbarActionGroupWithRefresh,
  ToolbarSearchInput,
  ListPageToolbarFrame,
} from '../../../shared/ui';
import { ListPageToolbarScrollRoot } from '../../../shared/ui/list-page/listPageToolbarChrome';
import { cn } from '../../../lib/utils';
import type { MyApisPageModel } from '../hooks/useMyApisPage';

type MyApisToolbarProps = {
  page: MyApisPageModel;
};

export const MyApisToolbar: React.FC<MyApisToolbarProps> = ({ page }) => (
  <ListPageToolbarFrame>

    <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
      <ToolbarSearchInput
        value={page.searchInput}
        onChange={page.setSearchInput}
        placeholder="name, path, method, folder…"
      />
      <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
        {page.filteredRoutes.length} of {page.totalCount} routes
      </span>
    </div>
    <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
      <ToolbarActionGroupWithRefresh
        onRefresh={() => { void page.routesQuery.refetch(); }}
        isRefreshing={page.routesQuery.isFetching && !page.routesQuery.isLoading}
        actions={[]}
      />
    </div>
  </ListPageToolbarFrame>
);
