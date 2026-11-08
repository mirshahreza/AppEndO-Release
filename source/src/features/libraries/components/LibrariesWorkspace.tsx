import React, { useMemo } from 'react';
import { usePublishAiPageContext } from '../../../shared/lib/aiPageContextStore';
import { useLibrariesPage } from '../hooks/useLibrariesPage';
import { LibrariesPageView } from './LibrariesPageView';

export const LibrariesWorkspace: React.FC = () => {
  const page = useLibrariesPage();
  const aiContext = useMemo(() => ({
    entityType: 'libraries',
    activeFilters: {
      search: page.searchInput,
      builtIn: page.builtInFilter,
    },
  }), [page.builtInFilter, page.searchInput]);
  usePublishAiPageContext(aiContext);
  return <LibrariesPageView page={page} />;
};
