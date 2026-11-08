import React from 'react';
import { Check, Pencil, PlugZap, Trash2, X } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import type { TranslationFn } from '../../../../core/culture/TranslationRuntime';
import { columnCommonKey, columnsMcpServersKey } from '../../../../core/culture/translations/cultureKeyHelpers';
import type { AppTableGridColumnDef } from '../../../../shared/lib/appTableGridQuery';
import {
  AppButton,
  AccessControlActionIcon,
  BuiltInBadge,
  GRID_ACTION_ACCESS_CLASS,
} from '../../../../shared/ui';
import { getSettingsTypography } from '../../settingsSectionTypography';
import { canConfigureMcpGridRowAccess } from './mcpResourceAccess';
import type { McpGridRow } from './buildMcpGridRows';

const typo = getSettingsTypography('mcp-servers');

const renderEnabledCell = (enabled: boolean, t: TranslationFn) => (
  enabled
    ? <Check className="h-4 w-4 text-emerald-700" aria-label={t(columnsMcpServersKey('enabledAria'))} />
    : <X className="h-4 w-4 text-rose-700" aria-label={t(columnsMcpServersKey('disabledAria'))} />
);

export type McpServersGridColumnHandlers = {
  testingServerId: string | null;
  onOpenAccess: (row: McpGridRow) => void;
  onTest: (server: NonNullable<McpGridRow['server']>) => void;
  onEdit: (row: McpGridRow) => void;
  onDelete: (server: NonNullable<McpGridRow['server']>) => void;
};

export function createMcpServersGridColumns(
  handlers: McpServersGridColumnHandlers,
  t: TranslationFn,
): AppTableGridColumnDef<McpGridRow>[] {
  return [
    {
      id: 'name',
      label: t(columnCommonKey('name')),
      card: { role: 'title' },
      renderCell: (row) => (
        <div className="flex min-w-0 flex-col gap-[2px]">
          <div className="flex items-center gap-2">
            <p className={cn('truncate', typo.gridPrimary)}>{row.label}</p>
            {row.hasWriteTools ? (
              <span className="shrink-0 rounded border border-slate-200 bg-slate-50 px-1 text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                {t(columnsMcpServersKey('writeBadge'))}
              </span>
            ) : null}
          </div>
          <p className="truncate font-mono text-[11px] text-slate-500">{row.subtitle}</p>
        </div>
      ),
      sort: false,
      filter: false,
    },
    {
      id: 'source',
      label: t(columnCommonKey('source')),
      card: { role: 'subtitle' },
      cellClassName: 'text-sm text-slate-700',
      renderCell: (row) => (
        row.sourceLabel === 'Built-in' ? <BuiltInBadge /> : row.sourceLabel
      ),
      sort: false,
      filter: false,
    },
    {
      id: 'transport',
      label: t(columnsMcpServersKey('transportTools')),
      card: { role: 'field', label: t(columnsMcpServersKey('transportTools')) },
      cellClassName: 'text-xs text-slate-600',
      renderCell: (row) => (
        <>
          {row.transport ? (
            <span className="block text-sm text-slate-700">{row.transport}</span>
          ) : null}
          <span className={row.transport ? 'text-slate-500' : ''}>{row.toolSummary}</span>
        </>
      ),
      sort: false,
      filter: false,
    },
    {
      id: 'enabled',
      label: t(columnCommonKey('enabled')),
      width: 72,
      card: { role: 'field', label: t(columnCommonKey('enabled')) },
      renderCell: (row) => renderEnabledCell(row.enabled, t),
      sort: false,
      filter: false,
    },
    {
      id: 'actions',
      label: '',
      width: 114,
      headerClassName: 'text-end',
      cellClassName: 'text-end',
      card: { role: 'actions' },
      renderCell: (row) => (
        <div className="flex items-center justify-end gap-[7px]">
          {canConfigureMcpGridRowAccess(row) ? (
            <AppButton
              size="icon-sm"
              className={GRID_ACTION_ACCESS_CLASS}
              aria-label={t(columnsMcpServersKey('configureAccessNamed')).replace('{label}', row.label)}
              onClick={() => handlers.onOpenAccess(row)}
            >
              <AccessControlActionIcon />
            </AppButton>
          ) : (
            <AppButton
              size="icon-sm"
              className="text-slate-400"
              aria-label={t(columnsMcpServersKey('accessNotAvailable'))}
              disabled
            >
              <AccessControlActionIcon />
            </AppButton>
          )}
          {row.kind === 'external-server' && row.server ? (
            <AppButton
              size="icon-sm"
              className="text-cyan-600 hover:bg-cyan-50"
              aria-label={t(columnsMcpServersKey('testNamed')).replace('{label}', row.label)}
              disabled={handlers.testingServerId === row.server.id}
              onClick={() => { void handlers.onTest(row.server!); }}
            >
              <PlugZap className="h-3.5 w-3.5" />
            </AppButton>
          ) : (
            <AppButton
              size="icon-sm"
              className="text-slate-400"
              aria-label={t(columnsMcpServersKey('testNotAvailable'))}
              disabled
            >
              <PlugZap className="h-3.5 w-3.5" />
            </AppButton>
          )}
          <AppButton
            size="icon-sm"
            className="text-indigo-600 hover:bg-indigo-50"
            aria-label={t(columnsMcpServersKey('configureNamed')).replace('{label}', row.label)}
            onClick={() => handlers.onEdit(row)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </AppButton>
          {row.kind === 'external-server' && row.server && !row.server.managedByPlugin ? (
            <AppButton
              size="icon-sm"
              className="text-rose-600 hover:bg-rose-50"
              aria-label={t(columnsMcpServersKey('deleteNamed')).replace('{label}', row.label)}
              onClick={() => handlers.onDelete(row.server!)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </AppButton>
          ) : (
            <AppButton
              size="icon-sm"
              className="text-slate-400"
              aria-label={t(columnsMcpServersKey('deleteNotAvailable'))}
              disabled
            >
              <Trash2 className="h-3.5 w-3.5" />
            </AppButton>
          )}
        </div>
      ),
      sort: false,
      filter: false,
    },
  ];
}
