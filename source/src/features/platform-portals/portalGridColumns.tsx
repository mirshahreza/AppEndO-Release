import React from 'react';
import { Link } from 'react-router-dom';
import { Copy, ListTree, Trash2 } from 'lucide-react';
import type { TranslationFn } from '../../core/culture/TranslationRuntime';
import { columnCommonKey, columnsPortalsKey } from '../../core/culture/translations/cultureKeyHelpers';
import { AccessControlActionIcon, BuiltInBadge } from '../../shared/ui';
import { NativeButton } from '../../shared/ui/NativeButton';
import type {
  ExperienceManifestPortal,
} from '../../shared/api/contracts/platform/experienceManifest';
import {
  portalUsesRedirectEntry,
  formatPortalUrlSegment,
  portalSupportsNavigation,
  isBuiltInPortal,
  isBuiltInHomePortal,
  isBuiltInStudioPortal,
  isBuiltInComponentAlonePortal,
  isOperatorHiddenBuiltinPortal,
} from '../../shared/api/contracts/platform/experienceManifest';
import { formatAuthRolesLabel } from '../../app/guards/roleAccess';
import type { AppTableGridColumnDef } from '../../shared/lib/appTableGridQuery';
import { ActionTooltip } from '../../shared/ui/ActionTooltip';
import { renderBooleanIcon } from '../../shared/lib/gridCellRenderers';
import { formatPortalLayoutDisplay, canOpenPortalLayoutInDesigner } from './lib/portalDesigner';
import { PackageSourceBadge } from '../../shared/packages/PackageSourceBadge';
import {
  APPLICATION_ACTION_COLUMN_WIDTH,
  APPLICATION_GRID_ACTION_BUTTON_CLASS,
} from './constants';

export type ApplicationGridHandlers = {
  onEdit: (index: number, row: ExperienceManifestPortal) => void;
  resolveEditLayoutHref: (row: ExperienceManifestPortal) => string;
  onNavigations: (index: number, row: ExperienceManifestPortal) => void;
  onAccess: (index: number, row: ExperienceManifestPortal) => void;
  onDuplicate: (index: number, row: ExperienceManifestPortal) => void;
  onDelete: (index: number, row: ExperienceManifestPortal) => void;
  resolveRowIndex: (row: ExperienceManifestPortal) => number;
};

export function createPortalGridColumns(
  handlers: ApplicationGridHandlers,
  t: TranslationFn,
): AppTableGridColumnDef<ExperienceManifestPortal>[] {
  return [
    {
      id: 'name',
      label: t(columnCommonKey('name')),
      sort: false,
      filter: false,
      card: { role: 'title' },
      renderCell: (row) => {
        const index = handlers.resolveRowIndex(row);
        const url = formatPortalUrlSegment(row.segment);

        return (
          <div className="flex flex-col gap-[2px]">
            <div className="flex items-center gap-2">
              <NativeButton
                type="button"
                onClick={() => handlers.onEdit(index, row)}
                title={t(columnsPortalsKey('editPortal'))}
                aria-label={t(columnsPortalsKey('editPortalNamed')).replace('{name}', row.name)}
                className="text-start text-sm font-medium text-indigo-600 underline-offset-2 hover:text-indigo-700 hover:underline"
              >
                {row.name}
              </NativeButton>
              {isOperatorHiddenBuiltinPortal(row) ? (
                <BuiltInBadge />
              ) : null}
              {row.ownerPackageId ? (
                <PackageSourceBadge
                  packageId={row.ownerPackageId}
                  packageDisplayName={row.packageDisplayName}
                />
              ) : null}
            </div>
            <p className="ps-[4px] text-[10px] text-slate-500">
              {t(columnsPortalsKey('urlPrefix'))}{' '}
              <code className="font-mono text-slate-700">{url}</code>
            </p>
          </div>
        );
      },
    },
    {
      id: 'layout',
      label: t(columnCommonKey('layout')),
      width: 300,
      sort: false,
      filter: false,
      card: { role: 'subtitle' },
      renderCell: (row) => {
        if (portalUsesRedirectEntry(row)) {
          return (
            <span className="text-xs text-slate-600">
              → {row.redirectToCulture}/{formatPortalUrlSegment(row.redirectToSegment ?? '').replace(/^\//, '')}
            </span>
          );
        }

        const layoutLabel = formatPortalLayoutDisplay(row);

        if (!canOpenPortalLayoutInDesigner(row)) {
          return (
            <code className="text-xs font-mono text-slate-700">
              {layoutLabel}
            </code>
          );
        }

        return (
          <Link
            to={handlers.resolveEditLayoutHref(row)}
            title={t(columnsPortalsKey('editLayout'))}
            aria-label={t(columnsPortalsKey('editLayout'))}
            className="text-xs font-mono text-indigo-600 underline-offset-2 hover:text-indigo-700 hover:underline"
          >
            {layoutLabel}
          </Link>
        );
      },
    },
    {
      id: 'navigations',
      label: t(columnCommonKey('navigations')),
      width: 138,
      sort: false,
      filter: false,
      card: { role: 'field', label: t(columnCommonKey('navigations')) },
      renderCell: (row) => {
        const index = handlers.resolveRowIndex(row);
        const isRedirect = !portalSupportsNavigation(row);

        return (
          <NativeButton
            type="button"
            onClick={() => handlers.onNavigations(index, row)}
            disabled={isRedirect}
            title={isRedirect ? t(columnsPortalsKey('navigationsDisabledRedirect')) : t(columnsPortalsKey('manageNavigations'))}
            aria-label={t(columnsPortalsKey('manageNavigations'))}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold underline-offset-2 disabled:cursor-not-allowed ${
              isRedirect
                ? 'text-slate-400'
                : 'text-indigo-600 hover:text-indigo-700 hover:underline'
            }`}
          >
            <ListTree className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t(columnCommonKey('navigations'))}
          </NativeButton>
        );
      },
    },
    {
      id: 'access',
      label: t(columnCommonKey('access')),
      width: 225,
      sort: false,
      filter: false,
      card: { role: 'field', label: t(columnCommonKey('access')) },
      renderCell: (row) => {
        if (portalUsesRedirectEntry(row)) {
          return <span className="text-xs text-slate-400">—</span>;
        }

        const index = handlers.resolveRowIndex(row);
        const accessLabel = formatAuthRolesLabel(row.auth);

        return (
          <NativeButton
            type="button"
            onClick={() => handlers.onAccess(index, row)}
            title={accessLabel}
            aria-label={t(columnsPortalsKey('configureAccessNamed')).replace('{label}', accessLabel)}
            className="inline-flex items-center gap-1.5 text-start text-cyan-600 underline-offset-2 hover:text-cyan-700 hover:underline"
          >
            <AccessControlActionIcon />
            <code className="text-xs text-cyan-700">{accessLabel}</code>
          </NativeButton>
        );
      },
    },
    {
      id: 'enabled',
      label: t(columnCommonKey('enabled')),
      width: 112,
      cellClassName: 'text-center',
      headerClassName: 'text-center [&>div]:justify-center',
      sort: false,
      filter: false,
      card: { role: 'field', label: t(columnCommonKey('enabled')) },
      renderCell: (row) => (
        <div className="flex justify-center">
          {renderBooleanIcon(row.enabled)}
        </div>
      ),
    },
    {
      id: 'actions',
      label: '',
      width: APPLICATION_ACTION_COLUMN_WIDTH,
      sort: false,
      filter: false,
      card: { role: 'actions' },
      renderCell: (row) => {
        const index = handlers.resolveRowIndex(row);
        const isRootApplication = isBuiltInHomePortal(row);
        const isStudioBuiltIn = isBuiltInStudioPortal(row);
        const isComponentAloneBuiltIn = isBuiltInComponentAlonePortal(row);
        const duplicateDisabled = isRootApplication || isComponentAloneBuiltIn;
        const deleteDisabled = isBuiltInPortal(row);

        return (
          <div className="flex items-center gap-[7px]">
            <ActionTooltip content={isRootApplication ? 'Root portal cannot be duplicated' : 'Duplicate application'}>
              <button
                type="button"
                className={`${APPLICATION_GRID_ACTION_BUTTON_CLASS} ${duplicateDisabled ? 'text-slate-400' : 'text-indigo-600 hover:bg-indigo-50'}`}
                disabled={duplicateDisabled}
                onClick={() => handlers.onDuplicate(index, row)}
                aria-label={t(columnsPortalsKey('duplicateApplication'))}
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </ActionTooltip>
            <ActionTooltip content={
              isRootApplication
                ? 'Root portal cannot be deleted'
                : isStudioBuiltIn
                  ? t(columnsPortalsKey('deleteStudioBlocked'))
                  : isComponentAloneBuiltIn
                    ? t(columnsPortalsKey('deleteComponentAloneBlocked'))
                    : t(columnsPortalsKey('deleteApplication'))
            }>
              <button
                type="button"
                className={`${APPLICATION_GRID_ACTION_BUTTON_CLASS} ${deleteDisabled ? 'text-slate-400' : 'text-rose-600 hover:bg-rose-50'}`}
                disabled={deleteDisabled}
                onClick={() => handlers.onDelete(index, row)}
                aria-label={t(columnsPortalsKey('deleteApplication'))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </ActionTooltip>
          </div>
        );
      },
    },
  ];
}

