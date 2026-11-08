import React from 'react';
import { BookOpen, Braces, Play } from 'lucide-react';
import type { TranslationFn } from '../../core/culture/TranslationRuntime';
import { columnCommonKey } from '../../core/culture/translations/cultureKeyHelpers';
import { cn } from '../../lib/utils';
import type { AccessibleApiRouteItem } from '../../shared/api/contracts/my-apis/types';
import type { AppTableGridColumnDef } from '../../shared/lib/appTableGridQuery';
import { ActionTooltip } from '../../shared/ui/ActionTooltip';
import {
  buildServerFunctionOpenApiUrl,
  buildServerFunctionSwaggerUrl,
  openServerFunctionDocUrl,
} from '../server-functions/lib/serverFunctionDocsUrls';
import { ACTION_BUTTON_BASE_CLASS, ACTION_COLUMN_WIDTH } from './constants';

const METHOD_BADGE_CLASS: Record<string, string> = {
  GET: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  POST: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  PUT: 'bg-amber-50 text-amber-700 border-amber-200',
  PATCH: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  DELETE: 'bg-rose-50 text-rose-700 border-rose-200',
};

const renderMethodBadge = (method: string) => {
  const normalized = method.toUpperCase();
  return (
    <span className={cn(
      'inline-flex min-w-[3.25rem] items-center justify-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold',
      METHOD_BADGE_CLASS[normalized] ?? 'bg-slate-50 text-slate-700 border-slate-200',
    )}
    >
      {normalized}
    </span>
  );
};

export type MyApisGridColumnHandlers = {
  onOpenTest: (route: AccessibleApiRouteItem) => void;
};

const openOpenApiDoc = (route: AccessibleApiRouteItem) => {
  openServerFunctionDocUrl(buildServerFunctionOpenApiUrl('function', route.id));
};

const openSwaggerDoc = (route: AccessibleApiRouteItem) => {
  openServerFunctionDocUrl(buildServerFunctionSwaggerUrl('function', route.id));
};

export function createMyApisGridColumns(
  handlers: MyApisGridColumnHandlers,
  t: TranslationFn,
): AppTableGridColumnDef<AccessibleApiRouteItem>[] {
  return [
    {
      id: 'method',
      label: t(columnCommonKey('method')),
      width: '4.5rem',
      card: { role: 'meta', priority: -10 },
      renderCell: (route) => renderMethodBadge(route.method),
      sort: false,
      filter: false,
    },
    {
      id: 'path',
      label: t(columnCommonKey('path')),
      card: { role: 'title' },
      cellClassName: 'font-mono text-xs text-slate-700',
      renderCell: (route) => route.path,
      sort: false,
      filter: false,
    },
    {
      id: 'name',
      label: t(columnCommonKey('name')),
      card: { role: 'subtitle' },
      renderCell: (route) => (
        <>
          <p className="truncate text-sm font-medium text-slate-800">{route.name}</p>
          <p className="truncate text-[11px] text-slate-500">{route.id}</p>
        </>
      ),
      sort: false,
      filter: false,
    },
    {
      id: 'folder',
      label: t(columnCommonKey('folder')),
      card: { role: 'field', label: t(columnCommonKey('folder')) },
      cellClassName: 'text-xs text-slate-600',
      renderCell: (route) => route.folder,
      sort: false,
      filter: false,
    },
    {
      id: 'actions',
      label: '',
      width: ACTION_COLUMN_WIDTH,
      headerClassName: 'text-end',
      cellClassName: 'text-end',
      card: { role: 'actions' },
      renderCell: (route) => (
        <div className="inline-flex items-center gap-[7px]">
          <ActionTooltip content={t('columns.myApis.openapiJson')}>
            <button
              type="button"
              className={cn(ACTION_BUTTON_BASE_CLASS, 'text-cyan-600 hover:bg-cyan-50 hover:text-cyan-700')}
              aria-label={t('columns.myApis.openapiJson')}
              onClick={() => openOpenApiDoc(route)}
            >
              <Braces className="h-3.5 w-3.5" />
            </button>
          </ActionTooltip>
          <ActionTooltip content={t('columns.myApis.swaggerUi')}>
            <button
              type="button"
              className={cn(ACTION_BUTTON_BASE_CLASS, 'text-cyan-600 hover:bg-cyan-50 hover:text-cyan-700')}
              aria-label={t('columns.myApis.swaggerUi')}
              onClick={() => openSwaggerDoc(route)}
            >
              <BookOpen className="h-3.5 w-3.5" />
            </button>
          </ActionTooltip>
          <ActionTooltip content={t('columns.myApis.testRoute')}>
            <button
              type="button"
              className={cn(ACTION_BUTTON_BASE_CLASS, 'text-cyan-600 hover:bg-cyan-50 hover:text-cyan-700')}
              aria-label={t('actions.test')}
              onClick={() => handlers.onOpenTest(route)}
            >
              <Play className="h-3.5 w-3.5" />
            </button>
          </ActionTooltip>
        </div>
      ),
      sort: false,
      filter: false,
    },
  ];
}
