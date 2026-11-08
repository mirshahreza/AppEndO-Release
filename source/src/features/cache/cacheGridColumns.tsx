import React from 'react';
import { Eye, Trash2 } from 'lucide-react';
import type { TranslationFn } from '../../core/culture/TranslationRuntime';
import { columnCommonKey } from '../../core/culture/translations/cultureKeyHelpers';
import type { CacheEntryRecord } from '../../shared/api/contracts/cache/types';
import type { AppTableGridColumnDef } from '../../shared/lib/appTableGridQuery';
import { ActionTooltip } from '../../shared/ui/ActionTooltip';
import {
  ACTION_BUTTON_BASE_CLASS,
  ACTION_COLUMN_WIDTH,
  CACHE_METRIC_COLUMN_WIDTH,
} from './constants';
import { formatCacheSize } from './utils';
import {
  APP_TABLE_GRID_ACTION_CELL_CLASS,
  APP_TABLE_GRID_ACTION_HEADER_CLASS,
  FLOATING_ACTION_SEPARATOR_CLASS,
} from '../../shared/ui/surfaceClasses';

export type CacheGridColumnHandlers = {
  onView: (item: CacheEntryRecord) => void;
  onEvict: (cacheKey: string) => void;
};

export function createCacheGridColumns(
  handlers: CacheGridColumnHandlers,
  t: TranslationFn,
): AppTableGridColumnDef<CacheEntryRecord>[] {
  return [
    {
      id: 'cacheKey',
      label: t(columnCommonKey('cacheKey')),
      cellClassName: 'font-mono font-medium text-slate-900',
      card: { role: 'title' },
      renderCell: (item) => item.cacheKey,
      sort: { mode: 'server' },
      filter: false,
    },
    {
      id: 'cacheType',
      label: t(columnCommonKey('type')),
      width: CACHE_METRIC_COLUMN_WIDTH,
      headerClassName: '!p-0',
      cellClassName: '!p-0 text-slate-500',
      card: { role: 'subtitle' },
      renderCell: (item) => item.cacheType,
      sort: false,
      filter: {
        mode: 'server',
        type: 'text',
        placeholder: t('grid.filter.type'),
      },
    },
    {
      id: 'sizeBytes',
      label: t(columnCommonKey('size')),
      width: CACHE_METRIC_COLUMN_WIDTH,
      headerClassName: '!p-0',
      cellClassName: '!p-0 text-slate-500 font-mono',
      card: { role: 'field', label: t(columnCommonKey('size')) },
      renderCell: (item) => formatCacheSize(item.sizeBytes),
      sort: { mode: 'server' },
      filter: {
        mode: 'server',
        type: 'text',
        placeholder: t('grid.filter.size'),
      },
    },
    {
      id: 'hitCount',
      label: t(columnCommonKey('hits')),
      width: CACHE_METRIC_COLUMN_WIDTH,
      headerClassName: '!p-0',
      cellClassName: '!p-0 text-slate-900 font-bold',
      card: { role: 'field', label: t(columnCommonKey('hits')) },
      renderCell: (item) => item.hitCount.toLocaleString(),
      sort: { mode: 'server' },
      filter: {
        mode: 'server',
        type: 'text',
        placeholder: t('grid.filter.hits'),
      },
    },
    {
      id: 'actions',
      label: '',
      width: ACTION_COLUMN_WIDTH,
      headerClassName: APP_TABLE_GRID_ACTION_HEADER_CLASS,
      cellClassName: APP_TABLE_GRID_ACTION_CELL_CLASS,
      card: { role: 'actions' },
      renderCell: (item) => {
        const canActOnItem = Boolean(item.cacheKey);
        return (
          <div className="flex items-center justify-end">
            <ActionTooltip content={t('actions.view')}>
              <button
                type="button"
                disabled={!canActOnItem}
                onClick={() => handlers.onView(item)}
                className={`${ACTION_BUTTON_BASE_CLASS} text-cyan-600 hover:text-cyan-800`}
                aria-label={t('actions.view')}
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            </ActionTooltip>
            <span className={FLOATING_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
            <ActionTooltip content={t('actions.evict')}>
              <button
                type="button"
                disabled={!canActOnItem}
                onClick={() => handlers.onEvict(item.cacheKey)}
                className={`${ACTION_BUTTON_BASE_CLASS} text-rose-600 hover:text-rose-700 hover:bg-rose-50`}
                aria-label={t('actions.evict')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </ActionTooltip>
          </div>
        );
      },
      sort: false,
      filter: false,
    },
  ];
}
