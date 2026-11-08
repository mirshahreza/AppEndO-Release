import React from 'react';
import { Plus } from 'lucide-react';
import {
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  ToolbarActionGroupWithRefresh,
  ToolbarSearchInput,
  UiSelect,
  ListPageToolbarFrame,
} from '../../../../shared/ui';
import { ListPageToolbarScrollRoot } from '../../../../shared/ui/list-page/listPageToolbarChrome';
import { cn } from '../../../../lib/utils';
import type { ActiveFilter } from './types';

export type SettingsAttributesToolbarProps = {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  activeFilter: ActiveFilter;
  onActiveFilterChange: (value: ActiveFilter) => void;
  onCreate: () => void;
  createLabel: string;
  onRefresh: () => void;
  isRefreshing: boolean;
  listToolbarCollapsed?: boolean;
};

export const SettingsAttributesToolbar: React.FC<SettingsAttributesToolbarProps> = ({
  searchInput,
  onSearchInputChange,
  activeFilter,
  onActiveFilterChange,
  onCreate,
  createLabel,
  onRefresh,
  isRefreshing,
  listToolbarCollapsed = false,
}) => (
  <ListPageToolbarFrame>

    <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
      <ToolbarSearchInput
        value={searchInput}
        onChange={onSearchInputChange}
        placeholder="key, label, id"
        ariaLabel="Search settings attributes"
      />
      <div className="w-full min-w-0 sm:w-36">
        <UiSelect
          size="sm"
          value={activeFilter}
          onChange={(e) => onActiveFilterChange(e.target.value as ActiveFilter)}
          ariaLabel="Filter by active status"
        >
          <option value="ALL">All</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </UiSelect>
      </div>
    </div>
    <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
      <ToolbarActionGroupWithRefresh
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        actions={[
          {
            id: 'create-attribute',
            label: createLabel,
            icon: <Plus className="h-3.5 w-3.5" aria-hidden="true" />,
            intent: 'create',
            primary: true,
            onClick: onCreate,
          },
        ]}
      />
    </div>
  </ListPageToolbarFrame>
);
