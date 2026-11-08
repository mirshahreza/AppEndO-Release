import React from 'react';

import type { TranslationFn } from '../../core/culture/TranslationRuntime';
import { columnCommonKey, columnsRolesKey } from '../../core/culture/translations/cultureKeyHelpers';

import { FunctionAccessActionIcon } from '../../shared/ui/functionAccessGridActions';

import { History, Pencil, Shield, Tags, Trash2 } from 'lucide-react';

import { cn } from '../../lib/utils';

import type { AppTableGridColumnDef } from '../../shared/lib/appTableGridQuery';

import { BuiltInBadge } from '../../shared/ui';
import { NativeButton } from '../../shared/ui/NativeButton';
import { APP_TABLE_GRID_NOTE_COLUMN_MAX_WIDTH } from '../../shared/ui/surfaceClasses';

import type { RoleRecord } from './types';

import { AppGridRowActions, type GridRowActionItem } from '../../shared/ui/AppGridRowActions';
import {
  DEFAULT_GRID_MAX_VISIBLE_ACTIONS,
  gridActionsColumnWidth,
  resolveGridActionSlotCount,
} from '../../shared/lib/gridRowActions';
const ROLE_TABLE_ICON_ACTION_COUNT = 6;

import { isAdminRoleName, isBaseRole } from '../../shared/api/contracts/roles/roleNames';



export type RoleGridColumnHandlers = {
  onEdit: (role: RoleRecord) => void;

  onEditMcpAccess: (role: RoleRecord) => void;

  onEditFunctionAccess: (role: RoleRecord) => void;

  onEditAttributes: (role: RoleRecord) => void;

  onDelete: (role: RoleRecord) => void;

  onOpenHistory: (role: RoleRecord) => void;

};

export function createRoleGridRowActions(
  role: RoleRecord,
  handlers: RoleGridColumnHandlers,
  t: TranslationFn,
): GridRowActionItem[] {
  const admin = isAdminRoleName(role.name);
  const base = isBaseRole(role.name);

  return [
    {
      id: 'edit',
      label: t(columnsRolesKey('editRole')),
      icon: <Pencil className="h-3.5 w-3.5" aria-hidden="true" />,
      intent: 'edit',
      cardLabeled: true,
      disabled: admin,
      title: admin ? t(columnsRolesKey('adminCannotEdit')) : undefined,
      onClick: () => handlers.onEdit(role),
    },
    {
      id: 'history',
      label: 'History',
      icon: <History className="h-3.5 w-3.5" aria-hidden="true" />,
      intent: 'utility',
      onClick: () => handlers.onOpenHistory(role),
    },
    {
      id: 'attributes',
      label: t('actions.editAttributes'),
      icon: <Tags className="h-3.5 w-3.5" aria-hidden="true" />,
      intent: 'edit',
      disabled: admin,
      title: admin ? 'ADMIN role attributes cannot be edited' : undefined,
      onClick: () => handlers.onEditAttributes(role),
    },
    {
      id: 'function-access',
      label: t('actions.configureFunctionAccess'),
      icon: <FunctionAccessActionIcon />,
      intent: 'access',
      disabled: admin,
      title: admin ? 'ADMIN role bypasses server function access checks' : undefined,
      onClick: () => handlers.onEditFunctionAccess(role),
    },
    {
      id: 'mcp-access',
      label: t(columnsRolesKey('mcpAccess')),
      icon: <Shield className="h-3.5 w-3.5" aria-hidden="true" />,
      intent: 'access',
      disabled: admin,
      title: admin ? t(columnsRolesKey('adminMcpLocked')) : undefined,
      onClick: () => handlers.onEditMcpAccess(role),
    },
    {
      id: 'delete',
      label: t('actions.delete'),
      icon: <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />,
      intent: 'delete',
      disabled: base,
      onClick: () => handlers.onDelete(role),
    },
  ];
}

export function createRoleGridColumns(

  handlers: RoleGridColumnHandlers,

  t: TranslationFn,

): AppTableGridColumnDef<RoleRecord>[] {

  return [

    {

      id: 'id',

      label: t(columnCommonKey('rowNumber')),

      width: 80,

      headerClassName: 'text-start',

      cellClassName: 'text-start font-mono text-lg font-bold tabular-nums text-slate-700 whitespace-nowrap',

      renderCell: (role) => role.id,

      sort: false,

      filter: false,

      card: { role: 'hidden' },

    },

    {

      id: 'name',

      label: t(columnCommonKey('name')),

      minWidth: 96,

      card: { role: 'title' },

      renderCell: (role) => (

        <NativeButton

          type="button"

          onClick={() => handlers.onEdit(role)}

          disabled={isAdminRoleName(role.name)}

          title={isAdminRoleName(role.name) ? t(columnsRolesKey('adminCannotEdit')) : t(columnsRolesKey('editRole'))}

          aria-label={t(columnsRolesKey('editRoleNamed')).replace('{name}', role.name)}

          className={cn(

            'rounded-full px-2 py-0.5 font-mono text-[10px] font-bold underline-offset-2 disabled:cursor-default',

            role.name === 'ADMIN'

              ? 'bg-indigo-100 text-indigo-700'

              : 'bg-cyan-100 text-cyan-700 hover:text-cyan-800',

            isAdminRoleName(role.name) ? '' : 'hover:underline',

          )}

        >

          {role.name}

        </NativeButton>

      ),

      sort: false,

      filter: false,

    },

    {

      id: 'note',

      label: t(columnCommonKey('note')),

      width: APP_TABLE_GRID_NOTE_COLUMN_MAX_WIDTH,

      cellClassName: 'max-w-[280px] truncate text-slate-600',

      card: { role: 'subtitle' },

      renderCell: (role) => (
        <span className="block truncate" title={role.note ?? undefined}>
          {role.note ?? <span className="text-slate-300">-</span>}
        </span>
      ),

      sort: false,

      filter: false,

    },

    {

      id: 'type',

      label: t(columnCommonKey('type')),

      card: { role: 'field', label: t(columnCommonKey('type')) },

      renderCell: (role) => (

        isBaseRole(role.name)

          ? <BuiltInBadge />

          : <span className="rounded bg-cyan-50 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-700">{t(columnsRolesKey('customType'))}</span>

      ),

      sort: false,

      filter: false,

    },

    {

      id: 'actions',

      label: '',

      headerClassName: 'text-end',

      cellClassName: 'text-end',

      width: gridActionsColumnWidth(
        resolveGridActionSlotCount(ROLE_TABLE_ICON_ACTION_COUNT, DEFAULT_GRID_MAX_VISIBLE_ACTIONS),
      ),

      layout: { hideable: false, resizable: false },

      card: { role: 'actions' },

      renderCell: (role) => (
        <AppGridRowActions
          actions={createRoleGridRowActions(role, handlers, t)}
          align="end"
          density="table"
        />
      ),

      sort: false,

      filter: false,

    },

  ];

}


