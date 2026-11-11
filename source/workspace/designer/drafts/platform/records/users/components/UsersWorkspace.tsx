import React, { useMemo } from 'react';
import { useUsersPage } from '../hooks/useUsersPage';
import { UsersPageView } from './UsersPageView';
import { usePublishAiPageContext } from '@/shared/lib/aiPageContextStore';

export const UsersWorkspace: React.FC = () => {
  const page = useUsersPage();

  const aiContext = useMemo(() => ({
    entityType: 'users',
    activeFilters: {
      search: page.searchInput,
      roles: page.roleFilters,
      columnFilters: page.query.filters,
    },
    sort: {
      field: page.sortBy,
      direction: page.sortDirection,
    },
  }), [page.query.filters, page.roleFilters, page.searchInput, page.sortBy, page.sortDirection]);

  usePublishAiPageContext(aiContext);

  return <UsersPageView page={page} />;
};
