import React from 'react';
import { Plus } from 'lucide-react';
import { AppButton, PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS, PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS, PAGE_TOOLBAR_SINGLE_ROW_CLASS, ToolbarRefreshButton, ToolbarSearchInput } from '@/src/shared/ui';

export type RolesToolbarProps = {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onAddRole: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
};

export const RolesToolbar: React.FC<RolesToolbarProps> = ({
  searchInput,
  onSearchInputChange,
  onAddRole,
  onRefresh,
  isRefreshing,
}) => (
  <div className={`${PAGE_TOOLBAR_SINGLE_ROW_CLASS} justify-between`}>
    <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
      <ToolbarSearchInput
        value={searchInput}
        onChange={onSearchInputChange}
        placeholder="name, note, id"
        ariaLabel="Search roles"
      />
    </div>
    <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
      <AppButton intent="create" size="sm" onClick={onAddRole}>
        <Plus className="h-3.5 w-3.5" />
        Add Role
      </AppButton>
      <ToolbarRefreshButton onClick={onRefresh} isRefreshing={isRefreshing} />
    </div>
  </div>
);
