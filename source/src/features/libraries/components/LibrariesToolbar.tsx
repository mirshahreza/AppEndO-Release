import React from 'react';
import { Plus } from 'lucide-react';
import {
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  ToolbarActionGroupWithRefresh,
  ToolbarBuiltInFilter,
  ToolbarSearchInput,
  ListPageToolbarFrame,
} from '../../../shared/ui';
import { ListPageToolbarScrollRoot } from '../../../shared/ui/list-page/listPageToolbarChrome';
import { cn } from '../../../lib/utils';

export type LibrariesToolbarProps = {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  builtInFilter: string;
  onBuiltInFilterChange: (value: string) => void;
  onInstall: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  listToolbarCollapsed?: boolean;
};

export const LibrariesToolbar: React.FC<LibrariesToolbarProps> = ({
  searchInput,
  onSearchInputChange,
  builtInFilter,
  onBuiltInFilterChange,
  onInstall,
  onRefresh,
  isRefreshing,
  listToolbarCollapsed = false,
}) => (
  <ListPageToolbarFrame>

    <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
      <ToolbarSearchInput
        value={searchInput}
        onChange={onSearchInputChange}
        placeholder="Search libraries"
        ariaLabel="Search libraries"
      />
      <ToolbarBuiltInFilter
        value={builtInFilter}
        onChange={onBuiltInFilterChange}
      />
    </div>
    <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
      <ToolbarActionGroupWithRefresh
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        actions={[
          {
            id: 'install-library',
            label: 'Install',
            icon: <Plus className="h-3.5 w-3.5" aria-hidden="true" />,
            intent: 'create',
            primary: true,
            onClick: onInstall,
          },
        ]}
      />
    </div>
  </ListPageToolbarFrame>
);
