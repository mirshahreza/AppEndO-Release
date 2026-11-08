import React from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  Eye,
  PackageCheck,
  PackageMinus,
  PackageOpen,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { TranslationFn } from '../../core/culture/TranslationRuntime';
import { columnCommonKey, columnsPackagesKey } from '../../core/culture/translations/cultureKeyHelpers';
import type { AppTableGridColumnDef } from '../../shared/lib/appTableGridQuery';
import type { GridRowActionItem } from '../../shared/ui/AppGridRowActions';
import { ActionTooltip } from '../../shared/ui/ActionTooltip';
import { AppButton } from '../../shared/ui/AppButton';
import { AppGridRowActions } from '../../shared/ui/AppGridRowActions';
import {
  APP_TABLE_GRID_AUDIT_COLUMN_WIDTH,
  APP_TABLE_GRID_EMPTY_VALUE,
  APP_TABLE_GRID_EMPTY_VALUE_CLASS,
} from '../../shared/ui/surfaceClasses';
import { packageRowKey } from '../../shared/api/contracts/package-manifest/mappers';
import type { PackageRow } from './types';
import { MountGridDateText } from '../../app/platform/MountGridDateText';
import {
  APP_TABLE_GRID_ACTOR_TEXT_CLASS,
  APP_TABLE_GRID_AUDIT_TEXT_CLASS,
} from '../../shared/ui/surfaceClasses';
import { isPackageVersionSwitch } from './utils';
import {
  ACTION_COLUMN_WIDTH,
  PACKAGE_GRID_DEPENDENCY_COLUMN_WIDTH,
  PACKAGE_GRID_OPERATION_BUTTON_EXTRA_CLASS,
  PACKAGE_GRID_OPERATIONS_COLUMN_WIDTH,
  PACKAGE_GRID_VERSION_COLUMN_WIDTH,
} from './constants';

const EmptyGridValue: React.FC = () => (
  <span className={APP_TABLE_GRID_EMPTY_VALUE_CLASS}>{APP_TABLE_GRID_EMPTY_VALUE}</span>
);

const PackageCreationCell: React.FC<{ createdAt?: string | null; createdBy?: string | null }> = ({
  createdAt,
  createdBy,
}) => {
  const by = createdBy?.trim();
  const hasDate = Boolean(createdAt?.trim());
  if (!by && !hasDate) {
    return <EmptyGridValue />;
  }
  const title = by && hasDate ? `${by} — ${createdAt}` : by || createdAt || '';
  return (
    <div
      className="flex max-w-full flex-col items-center gap-0.5 text-center leading-tight"
      title={title}
    >
      {by ? (
        <span className={`block max-w-full truncate ${APP_TABLE_GRID_ACTOR_TEXT_CLASS}`}>{by}</span>
      ) : null}
      {hasDate ? (
        <MountGridDateText value={createdAt} className={APP_TABLE_GRID_AUDIT_TEXT_CLASS} />
      ) : null}
    </div>
  );
};

export type PackageGridColumnHandlers = {
  onOpenInstall: (row: PackageRow) => void;
  onOpenUninstall: (row: PackageRow) => void;
  onOpenDelete: (row: PackageRow) => void;
  onOpenDetail: (row: PackageRow) => void;
  onDownload: (row: PackageRow) => void;
  onOpenDeployment: (row: PackageRow) => void;
  onOpenRepair?: (row: PackageRow) => void;
  onOpenRepack?: (row: PackageRow) => void;
};

function renderOperationsCell(row: PackageRow, handlers: PackageGridColumnHandlers, t: TranslationFn) {
  const isInstalled = row.installStatus === 'installed';
  const isBusy = row.installStatus === 'installing' || row.installStatus === 'uninstalling';
  const hasPendingDeployment = isInstalled
    && row.deploymentStatus === 'pending'
    && row.pluginKind === 'vertical-app';
  const isSwitchVersion = isPackageVersionSwitch(row);
  const canInstall = !isInstalled && !isBusy;
  const canUninstall = isInstalled && !isBusy && !hasPendingDeployment;
  const showRepair = isInstalled && !isBusy && !hasPendingDeployment && Boolean(handlers.onOpenRepair);
  const showRepack = isInstalled && !isBusy && !hasPendingDeployment && Boolean(handlers.onOpenRepack);

  return (
    <div className="flex w-full min-w-0 flex-wrap items-center justify-start gap-2 lg:flex-nowrap">
      {hasPendingDeployment ? (
        <ActionTooltip content={t(columnsPackagesKey('applyPendingDeployment'))} triggerClassName="shrink-0">
          <AppButton
            type="button"
            intent="confirm"
            size="sm"
            onClick={() => handlers.onOpenDeployment(row)}
            className={PACKAGE_GRID_OPERATION_BUTTON_EXTRA_CLASS}
            aria-label={t(columnsPackagesKey('applyDeployment'))}
          >
            <Check className="h-3.5 w-3.5 shrink-0" />
            {t(columnsPackagesKey('apply'))}
          </AppButton>
        </ActionTooltip>
      ) : canInstall ? (
        <>
        <ActionTooltip
          content={isSwitchVersion ? t(columnsPackagesKey('switchVersion')) : t(columnsPackagesKey('installPackage'))}
          triggerClassName="shrink-0"
        >
          <AppButton
            type="button"
            intent="confirm"
            size="sm"
            onClick={() => handlers.onOpenInstall(row)}
            className={PACKAGE_GRID_OPERATION_BUTTON_EXTRA_CLASS}
            aria-label={isSwitchVersion ? t(columnsPackagesKey('switch')) : t(columnsPackagesKey('install'))}
          >
            <PackageCheck className="h-3.5 w-3.5 shrink-0" />
            {isSwitchVersion ? t(columnsPackagesKey('switch')) : t(columnsPackagesKey('install'))}
          </AppButton>
        </ActionTooltip>
        {isSwitchVersion ? (
          <ActionTooltip content={t(columnsPackagesKey('uninstallPackage'))} triggerClassName="shrink-0">
            <AppButton
              type="button"
              intent="destructive-soft"
              size="sm"
              onClick={() => handlers.onOpenUninstall(row)}
              className={PACKAGE_GRID_OPERATION_BUTTON_EXTRA_CLASS}
              aria-label={t(columnsPackagesKey('uninstall'))}
            >
              <PackageMinus className="h-3.5 w-3.5 shrink-0" />
              {t(columnsPackagesKey('uninstall'))}
            </AppButton>
          </ActionTooltip>
        ) : null}
        </>
      ) : canUninstall ? (
        <ActionTooltip content={t(columnsPackagesKey('uninstallPackage'))} triggerClassName="shrink-0">
          <AppButton
            type="button"
            intent="destructive-soft"
            size="sm"
            onClick={() => handlers.onOpenUninstall(row)}
            className={PACKAGE_GRID_OPERATION_BUTTON_EXTRA_CLASS}
            aria-label={t(columnsPackagesKey('uninstall'))}
          >
            <PackageMinus className="h-3.5 w-3.5 shrink-0" />
            {t(columnsPackagesKey('uninstall'))}
          </AppButton>
        </ActionTooltip>
      ) : (
        <EmptyGridValue />
      )}
      {showRepair ? (
        <ActionTooltip content={t(columnsPackagesKey('repairPackage'))} triggerClassName="shrink-0">
          <AppButton
            type="button"
            intent="warning"
            size="sm"
            onClick={() => handlers.onOpenRepair?.(row)}
            className={PACKAGE_GRID_OPERATION_BUTTON_EXTRA_CLASS}
            aria-label={t(columnsPackagesKey('repair'))}
          >
            <RefreshCw className="h-3.5 w-3.5 shrink-0" />
            {t(columnsPackagesKey('repair'))}
          </AppButton>
        </ActionTooltip>
      ) : null}
      {showRepack ? (
        <ActionTooltip content={t(columnsPackagesKey('repackPackage'))} triggerClassName="shrink-0">
          <AppButton
            type="button"
            intent="secondary"
            size="sm"
            onClick={() => handlers.onOpenRepack?.(row)}
            className={PACKAGE_GRID_OPERATION_BUTTON_EXTRA_CLASS}
            aria-label={t(columnsPackagesKey('repack'))}
          >
            <PackageOpen className="h-3.5 w-3.5 shrink-0" />
            {t(columnsPackagesKey('repack'))}
          </AppButton>
        </ActionTooltip>
      ) : null}
    </div>
  );
}

export function createPackageCardRowActions(
  row: PackageRow,
  handlers: PackageGridColumnHandlers,
  t: TranslationFn,
): GridRowActionItem[] {
  const isInstalled = row.installStatus === 'installed';
  const isBusy = row.installStatus === 'installing' || row.installStatus === 'uninstalling';
  const canDelete = !isInstalled && !isBusy;

  return [
    {
      id: 'details',
      label: t(columnsPackagesKey('details')),
      icon: <Eye className="h-3.5 w-3.5" />,
      intent: 'view',
      cardLabeled: true,
      onClick: () => void handlers.onOpenDetail(row),
    },
    {
      id: 'download',
      label: t(columnsPackagesKey('download')),
      icon: <Download className="h-3.5 w-3.5" />,
      intent: 'utility',
      onClick: () => void handlers.onDownload(row),
    },
    {
      id: 'delete',
      label: t(columnsPackagesKey('delete')),
      icon: <Trash2 className="h-3.5 w-3.5" />,
      intent: 'delete',
      disabled: !canDelete,
      onClick: () => handlers.onOpenDelete(row),
    },
  ];
}

function renderActionsCell(row: PackageRow, handlers: PackageGridColumnHandlers, t: TranslationFn) {
  return (
    <AppGridRowActions
      align="end"
      actions={createPackageCardRowActions(row, handlers, t)}
    />
  );
}

export function createPackageGridColumns(
  handlers: PackageGridColumnHandlers,
  t: TranslationFn,
): AppTableGridColumnDef<PackageRow>[] {
  return [
    {
      id: 'name',
      label: t(columnCommonKey('name')),
      card: { role: 'title' },
      cellClassName: 'text-slate-800 font-semibold',
      renderCell: (row) => row.displayName,
      sort: false,
      filter: false,
    },
    {
      id: 'version',
      label: t(columnCommonKey('version')),
      width: PACKAGE_GRID_VERSION_COLUMN_WIDTH,
      card: { role: 'subtitle' },
      headerClassName: 'text-center [&>div]:justify-center',
      cellClassName: 'text-center text-slate-700 font-mono text-xs',
      renderCell: (row) => row.version,
      sort: false,
      filter: false,
    },
    {
      id: 'dependency',
      label: t(columnsPackagesKey('dependency')),
      width: PACKAGE_GRID_DEPENDENCY_COLUMN_WIDTH,
      card: { role: 'field', label: t(columnsPackagesKey('dependency')) },
      cellClassName: 'text-start text-slate-700',
      renderCell: (row) => (
        row.dependencyHealthy ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <Check className="h-3 w-3 shrink-0" />
            {t(columnsPackagesKey('healthy'))}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            {t(columnsPackagesKey('issueCount')).replace('{count}', String(row.dependencyIssues.length))}
          </span>
        )
      ),
      sort: false,
      filter: false,
    },
    {
      id: 'creation',
      label: t(columnsPackagesKey('creation')),
      width: APP_TABLE_GRID_AUDIT_COLUMN_WIDTH,
      card: { role: 'meta', label: t(columnCommonKey('created')), priority: 10 },
      hideBelow: 'lg',
      headerClassName: 'text-center [&>div]:justify-center',
      cellClassName: 'text-center text-slate-700',
      renderCell: (row) => (
        <PackageCreationCell createdAt={row.createdAt} createdBy={row.createdBy} />
      ),
      sort: false,
      filter: false,
    },
    {
      id: 'operations',
      label: t(columnsPackagesKey('operations')),
      width: PACKAGE_GRID_OPERATIONS_COLUMN_WIDTH,
      card: { role: 'field', label: t(columnsPackagesKey('lifecycle')) },
      cellClassName: 'text-start',
      renderCell: (row) => renderOperationsCell(row, handlers, t),
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
      layout: { hideable: false, resizable: false },
      renderCell: (row) => renderActionsCell(row, handlers, t),
      sort: false,
      filter: false,
    },
  ];
}

export { packageRowKey };
