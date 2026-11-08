import React from 'react';
import type { CachePageModel } from '../hooks/useCachePage';
import { GridPagingFooter } from '../../../shared/ui';
import { CACHE_SORT_OPTIONS, CACHE_SORT_FIELDS } from '../constants';
import { CacheEntriesTable } from './CacheEntriesTable';
import { CacheFlushConfirmModal } from './CacheFlushConfirmModal';
import { CacheToolbar } from './CacheToolbar';
import { CacheViewModal } from './CacheViewModal';

type CachePageViewProps = {
  page: CachePageModel;
};

export const CachePageView: React.FC<CachePageViewProps> = ({ page }) => (
  <div className="w-full h-full flex flex-col bg-white" id="cache-page-wrapper">
    <CacheToolbar page={page} />

    <CacheEntriesTable
      page={page}
      footer={(
        <GridPagingFooter
          totalCount={page.presentation.totalCount}
          safePage={page.presentation.safePage}
          pageSize={page.pageSize}
          onPageSizeChange={page.setPageSize}
          sortBy={page.sortBy}
          sortOptions={CACHE_SORT_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
          onSortByChange={(value) => page.setFooterSort(value, page.sortDirection, CACHE_SORT_FIELDS)}
          sortDirection={page.sortDirection}
          onToggleSortDirection={() => page.setFooterSort(
            page.sortBy,
            page.sortDirection === 'asc' ? 'desc' : 'asc',
            CACHE_SORT_FIELDS,
          )}
          totalPages={page.presentation.totalPages}
          pageNumbers={page.presentation.pageNumbers}
          onPageChange={page.presentation.setPage}
          listMode={page.listMode}
          onListModeChange={page.setListMode}
          visibleInfiniteCount={page.presentation.visibleInfiniteCount}
        />
      )}
    />

    {page.viewItem && (
      <CacheViewModal
        item={page.viewItem}
        viewValue={page.viewValue}
        isViewLoading={page.isViewLoading}
        onClose={page.closeViewModal}
      />
    )}

    {page.showFlushConfirm && (
      <CacheFlushConfirmModal
        onCancel={page.closeFlushConfirm}
        onConfirm={page.handleEvictAll}
      />
    )}
  </div>
);
