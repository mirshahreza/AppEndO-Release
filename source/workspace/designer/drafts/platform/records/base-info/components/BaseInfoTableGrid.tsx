import React from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { BaseTreeGrid } from '@/components/ui/BaseTreeGrid';
import { cn } from '@/lib/utils';
import { useCultureT } from '@/core/culture/CultureContext';
import { useViewportTier } from '@/shared/lib/useViewportTier';
import { ACTION_COLUMN_WIDTH } from '../constants';
import type { BaseInfoPageModel } from '../hooks/useBaseInfoPage';
import type { BaseInfoTreeRow } from '../types';

type BaseInfoTableGridProps = {
  page: BaseInfoPageModel;
};

export const BaseInfoTableGrid: React.FC<BaseInfoTableGridProps> = ({ page }) => {
  const t = useCultureT();
  const viewportTier = useViewportTier();
  const isPhoneLayout = viewportTier === 'phone';

  return (
  <div className="flex-1 min-h-0 overflow-auto">
    {page.isLoading ? (
      <div className="h-40 flex items-center justify-center text-sm text-slate-400">{t('baseInfo.loadingTree')}</div>
    ) : page.error ? (
      <div className="h-40 flex items-center justify-center text-sm text-rose-500">{page.error}</div>
    ) : page.filteredTreeRows.length === 0 ? (
      <div className="h-40 flex items-center justify-center text-sm text-slate-400">{t('baseInfo.empty')}</div>
    ) : (
      <BaseTreeGrid<BaseInfoTreeRow>
        rows={page.treeGridRows}
        layout={isPhoneLayout ? 'hybrid-stacked' : 'table'}
        expandedById={page.expandedById}
        loadingByParent={page.loadingByParent}
        moveDisabled={isPhoneLayout || page.isMoving || page.isSaving || page.isDeleting || Boolean(page.editingId) || page.isCreateModalOpen || Boolean(page.deleteTarget)}
        onToggleExpand={(item) => {
          void page.toggleExpand(item.row);
        }}
        onMove={page.moveNode}
        canDrop={(sourceId, targetId, position) => page.canDropNode(sourceId, targetId, position)}
        getNodeLabel={(item) => item.row.label || item.row.title || '-'}
        columns={[
          {
            key: 'titleEn',
            header: 'Title En',
            className: 'text-slate-600',
            headerClassName: 'min-w-[8rem]',
            renderCell: (item) => item.row.title_en || '-',
          },
          {
            key: 'titleFa',
            header: 'Title Fa',
            className: 'text-slate-600',
            headerClassName: 'min-w-[8rem]',
            renderCell: (item) => item.row.title_fa || '-',
          },
          {
            key: 'titleAr',
            header: 'Title Ar',
            className: 'text-slate-600',
            headerClassName: 'min-w-[8rem]',
            renderCell: (item) => item.row.title_ar || '-',
          },
          {
            key: 'active',
            header: 'Active',
            className: 'text-center',
            headerClassName: 'w-20 text-center',
            renderCell: (item) => (
              <span className={cn(
                'inline-flex items-center justify-center w-6 h-5',
                item.row.is_active
                  ? 'text-emerald-700'
                  : 'text-rose-700',
              )}>
                {item.row.is_active ? <Check className="w-3.5 h-3.5" aria-label="Yes" /> : <X className="w-3.5 h-3.5" aria-label="No" />}
              </span>
            ),
          },
          {
            key: 'actions',
            header: '',
            className: 'text-end',
            headerClassName: 'text-end',
            style: { width: `${ACTION_COLUMN_WIDTH}px`, minWidth: `${ACTION_COLUMN_WIDTH}px` },
            headerStyle: { width: `${ACTION_COLUMN_WIDTH}px`, minWidth: `${ACTION_COLUMN_WIDTH}px` },
            renderCell: (item) => (
              <div className="inline-flex items-center">
                <button
                  onClick={() => page.openCreateChildModal(item.row)}
                  disabled={page.isMoving || page.isSaving || page.isDeleting || Boolean(page.editingId) || page.isCreateModalOpen || Boolean(page.deleteTarget)}
                  className="h-5 w-5 inline-flex items-center justify-center rounded transition-colors cursor-pointer text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                  aria-label={`Create child under ${item.row.id}`}
                  title="Create child"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <span className="mx-[3px] h-3 w-px bg-slate-200" aria-hidden="true" />
                <button
                  onClick={() => page.openEditModal(item.row)}
                  disabled={page.isMoving || page.isDeleting}
                  className="h-5 w-5 inline-flex items-center justify-center rounded transition-colors cursor-pointer text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                  aria-label={`Edit ${item.row.id}`}
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <span className="mx-[3px] h-3 w-px bg-slate-200" aria-hidden="true" />
                <button
                  onClick={() => page.openDeleteModal(item.row)}
                  disabled={Boolean(item.row.has_children) || page.isMoving || page.isDeleting}
                  className={cn(
                    'h-5 w-5 inline-flex items-center justify-center rounded transition-colors',
                    item.row.has_children
                      ? 'text-slate-400 cursor-not-allowed'
                      : 'cursor-pointer text-rose-600 hover:text-rose-700 hover:bg-rose-50',
                  )}
                  aria-label={`Delete ${item.row.id}`}
                  title={item.row.has_children ? 'Delete (disabled: has children)' : 'Delete'}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ),
          },
        ]}
      />
    )}
  </div>
  );
};
