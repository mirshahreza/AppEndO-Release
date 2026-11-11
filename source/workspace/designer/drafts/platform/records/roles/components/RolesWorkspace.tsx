import React, { useMemo } from 'react';
import { useRolesPage } from '../hooks/useRolesPage';
import { RolesPageView } from './RolesPageView';
import { usePublishAiPageContext } from '@/shared/lib/aiPageContextStore';

export const RolesWorkspace: React.FC = () => {
  const page = useRolesPage();

  const aiContext = useMemo(() => ({
    entityType: 'roles',
    activeFilters: {
      search: page.searchInput,
    },
  }), [page.searchInput]);

  usePublishAiPageContext(aiContext);

  return <RolesPageView page={page} />;
};
