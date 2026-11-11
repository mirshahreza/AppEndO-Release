import React from 'react';
import { Plus } from 'lucide-react';
import { useOptionalCulture } from '@/core/culture/CultureContext';
import { CULTURE_ACTION_FALLBACK_LABELS } from '@/core/culture/cultureShellKeys';
import { AppCultureButton, PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS, PAGE_TOOLBAR_FILTER_CHECKBOX_GROUP_CLASS, PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS, PAGE_TOOLBAR_SINGLE_ROW_CLASS, ToolbarFilterCheckboxGroupItem, ToolbarRefreshButton, ToolbarSearchInput } from '@/shared/ui';

export type UserFilterToolbarProps = {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  availableRoles: string[];
  roleFilters: Record<string, boolean>;
  onRoleFilterChange: (role: string, checked: boolean) => void;
  onAddUser: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
};

export const UserFilterToolbar: React.FC<UserFilterToolbarProps> = ({
  searchInput,
  onSearchInputChange,
  availableRoles,
  roleFilters,
  onRoleFilterChange,
  onAddUser,
  onRefresh,
  isRefreshing,
}) => {
  const culture = useOptionalCulture();
  const searchPlaceholder = culture?.ready
    ? culture.t('toolbar.searchUsers')
    : CULTURE_ACTION_FALLBACK_LABELS['toolbar.searchUsers'];

  return (
    <div className={`${PAGE_TOOLBAR_SINGLE_ROW_CLASS} justify-between`}>
      <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
        <ToolbarSearchInput
          value={searchInput}
          onChange={onSearchInputChange}
          placeholder={searchPlaceholder}
          ariaLabel={culture?.ready ? culture.t('grid.search') : 'Search'}
        />

        <div className={PAGE_TOOLBAR_FILTER_CHECKBOX_GROUP_CLASS}>
          {availableRoles.map((role) => (
            <ToolbarFilterCheckboxGroupItem
              key={role}
              id={`users-filter-role-${role}`}
              checked={Boolean(roleFilters[role])}
              onChange={(checked) => onRoleFilterChange(role, checked)}
            >
              {role}
            </ToolbarFilterCheckboxGroupItem>
          ))}
        </div>
      </div>

      <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
        <AppCultureButton intent="create" size="sm" labelKey="toolbar.addUser" onClick={onAddUser}>
          <Plus className="w-3.5 h-3.5" />
          {culture?.ready
            ? culture.t('toolbar.addUser')
            : CULTURE_ACTION_FALLBACK_LABELS['toolbar.addUser']}
        </AppCultureButton>
        <ToolbarRefreshButton onClick={onRefresh} isRefreshing={isRefreshing} />
      </div>
    </div>
  );
};
