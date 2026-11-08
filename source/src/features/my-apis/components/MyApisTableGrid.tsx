import React, { useMemo } from 'react';
import { useCultureT } from '../../../core/culture/CultureContext';
import {
  AppTableGrid,
  QueryErrorPanel,
} from '../../../shared/ui';
import { formatQueryError } from '../../../shared/api/client';
import type { MyApisPageModel } from '../hooks/useMyApisPage';
import { createMyApisGridColumns } from '../myApisGridColumns';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';

type MyApisTableGridProps = {
  page: MyApisPageModel;
};

export const MyApisTableGrid: React.FC<MyApisTableGridProps> = ({ page }) => {
  const t = useCultureT();
  const columns = useMemo(
    () => createMyApisGridColumns({ onOpenTest: page.openTestModal }, t),
    [page.openTestModal, t],
  );

  return (
    <AppTableGrid
      presentation="auto"
      persistListKey={APP_LIST_PREFERENCE_KEYS.myApis}
      size="sm"
      columns={columns}
      rows={page.filteredRoutes}
      getRowKey={(route) => `${route.id}:${route.method}:${route.path}`}
      onScroll={page.handleGridScroll}
      compact={{ tablet: { cardsPerRow: 2 } }}
      isLoading={page.routesQuery.isLoading}
      loadingMessage="Loading accessible API routes…"
      errorContent={
        page.routesQuery.isError ? (
          <QueryErrorPanel
            message="Failed to load API routes"
            detail={formatQueryError(page.routesQuery.error, 'Could not load accessible routes.')}
            onRetry={() => { void page.routesQuery.refetch(); }}
          />
        ) : undefined
      }
      isEmpty={!page.routesQuery.isLoading && !page.routesQuery.isError && page.filteredRoutes.length === 0}
      emptyMessage={page.searchInput.trim() ? 'No routes match your search.' : 'No accessible API routes found.'}
    />
  );
};
