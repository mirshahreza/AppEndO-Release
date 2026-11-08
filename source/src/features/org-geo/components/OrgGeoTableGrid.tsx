import React from 'react';
import { Check, X } from 'lucide-react';
import { BaseTreeGrid } from '../../../components/ui/BaseTreeGrid';
import { cn } from '../../../lib/utils';
import { useViewportTier } from '../../../shared/lib/useViewportTier';
import { isCompactChromeTier } from '../../../shared/lib/viewportTokens';
import type { ScopedBaseInfoTreeModel } from '../hooks/useScopedBaseInfoTree';
import { resolveGeoNodeTypeLabel } from '../lib/orgGeoNodeKind';
import type { BaseInfoTreeRow } from '../../base-info/types';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';

type OrgGeoTableGridProps = {
  page: ScopedBaseInfoTreeModel;
  accent: 'sky' | 'emerald';
};

const selectedRowClass = (accent: 'sky' | 'emerald') => (
  accent === 'emerald' ? 'bg-emerald-50/90' : 'bg-sky-50/90'
);

export const OrgGeoTableGrid: React.FC<OrgGeoTableGridProps> = ({ page, accent }) => {
  const viewportTier = useViewportTier();
  const compactChrome = isCompactChromeTier(viewportTier);

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      {page.isLoading ? (
        <div className="flex h-40 items-center justify-center text-sm text-slate-400">Loading tree…</div>
      ) : page.error ? (
        <div className="flex h-40 items-center justify-center text-sm text-rose-500">{page.error}</div>
      ) : page.filteredTreeRows.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-slate-400">No places in this tree yet.</div>
      ) : (
        <BaseTreeGrid<BaseInfoTreeRow>
          rows={page.treeGridRows}
          persistListKey={APP_LIST_PREFERENCE_KEYS.geographicDivisionsTree}
          layout={compactChrome ? 'hybrid-stacked' : 'table'}
          expandedById={page.expandedById}
          loadingByParent={page.loadingByParent}
          moveDisabled={
            compactChrome
            || page.isMoving
            || page.isSaving
            || page.isDeleting
            || Boolean(page.editingId)
            || page.isCreateModalOpen
            || Boolean(page.deleteTarget)
          }
          onScroll={page.handleTreeScroll}
          onToggleExpand={(item) => {
            void page.toggleExpand(item.row);
          }}
          onMove={page.moveNode}
          canDrop={(sourceId, targetId, position) => page.canDropNode(sourceId, targetId, position)}
          getNodeLabel={(item) => item.row.label || item.row.title || '-'}
          onRowClick={(item) => page.setSelectedChartId(item.row.id)}
          rowClassName={(item) => (
            item.row.id === page.selectedChartId ? selectedRowClass(accent) : ''
          )}
          columns={[
            {
              key: 'type',
              header: 'Type',
              className: 'text-left text-slate-600',
              headerClassName: 'w-24 text-left',
              renderCell: (item) => resolveGeoNodeTypeLabel(item.row) || '—',
            },
            {
              key: 'titleEn',
              header: 'Title En',
              className: 'text-left text-slate-600',
              headerClassName: 'min-w-[8rem] text-left',
              renderCell: (item) => item.row.title_en || '-',
            },
            {
              key: 'titleFa',
              header: 'Title Fa',
              className: 'text-left text-slate-600',
              headerClassName: 'min-w-[8rem] text-left',
              renderCell: (item) => item.row.title_fa || '-',
            },
            {
              key: 'titleAr',
              header: 'Title Ar',
              className: 'text-left text-slate-600',
              headerClassName: 'min-w-[8rem] text-left',
              renderCell: (item) => item.row.title_ar || '-',
            },
            {
              key: 'active',
              header: 'Active',
              className: 'text-center',
              headerClassName: 'w-20 text-center',
              renderCell: (item) => (
                <span className={cn(
                  'inline-flex h-5 w-6 items-center justify-center',
                  item.row.is_active ? 'text-emerald-700' : 'text-rose-700',
                )}>
                  {item.row.is_active ? (
                    <Check className="h-3.5 w-3.5" aria-label="Yes" />
                  ) : (
                    <X className="h-3.5 w-3.5" aria-label="No" />
                  )}
                </span>
              ),
            },
          ]}
        />
      )}
    </div>
  );
};
