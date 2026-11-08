import React from 'react';
import type { CachePageModel } from '../hooks/useCachePage';
import { AppTableGrid } from '../../../shared/ui/AppTableGrid';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { QueryErrorPanel } from '../../../shared/ui/QueryErrorPanel';
import { useCultureT } from '../../../core/culture/CultureContext';
import { operationsKey } from '../../../core/culture/translations/cultureKeyHelpers';

type CacheEntriesTableProps = {
  page: CachePageModel;
  footer?: React.ReactNode;
};

export const CacheEntriesTable: React.FC<CacheEntriesTableProps> = ({ page, footer }) => {
  const t = useCultureT();

  return (
    <AppTableGrid
      presentation="auto"
      persistListKey={APP_LIST_PREFERENCE_KEYS.cache}
      size="sm"
      tableClassName="text-slate-700"
      theadClassName="text-start text-xs font-bold text-slate-500 uppercase tracking-widest"
      tbodyClassName="text-sm"
      columns={page.gridColumns}
      rows={page.visibleItems}
      getRowKey={(item) => item.cacheKey || `cache-row-${item.createdAt}`}
      gridQueryMode="server"
      query={page.query}
      onQueryChange={page.handleGridQueryChange}
      isLoading={page.isLoading}
      loadingMessage={t(operationsKey('cache.loading'))}
      onScroll={page.handleGridScroll}
      compact={{ tablet: { cardsPerRow: 2 } }}
      errorContent={
        page.isError && page.listError ? (
          <QueryErrorPanel
            message={t(operationsKey('cache.loadFailed'))}
            detail={page.listError}
            onRetry={page.retryLoadEntries}
            isRetrying={page.isRetryingEntries}
          />
        ) : page.actionError ? (
          <div className="flex items-center justify-center h-40 px-6 text-rose-600 text-sm text-center">{page.actionError}</div>
        ) : undefined
      }
      isEmpty={
        !page.isLoading
        && !(page.isError && page.listError)
        && !page.actionError
        && page.visibleItems.length === 0
      }
      emptyMessage={t(operationsKey('cache.empty'))}
      footer={footer}
    />
  );
};
