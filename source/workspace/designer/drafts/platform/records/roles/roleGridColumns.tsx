import React from 'react';

import type { TranslationFn } from '@/core/culture/TranslationRuntime';
import { columnCommonKey, columnsRolesKey } from '@/core/culture/translations/cultureKeyHelpers';

import {
  FunctionAccessActionIcon,
  GRID_ACTION_FUNCTION_ACCESS_BUTTON_CLASS,
} from '@/shared/ui/functionAccessGridActions';

import { Shield, Tags, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { AppTableGridColumnDef } from '@/shared/lib/appTableGridQuery';

import { ActionTooltip } from '@/shared/ui/ActionTooltip';
import { NativeButton } from '@/shared/ui/NativeButton';
import { APP_TABLE_GRID_AUDIT_COLUMN_WIDTH } from '@/shared/ui/surfaceClasses';

import type { RoleRecord } from './types';

import { ACTION_BUTTON_BASE_CLASS, ACTION_COLUMN_WIDTH } from './constants';

import { MountGridDateText } from '@/app/platform/MountGridDateText';
import { isAdminRoleName, isBaseRole } from './utils';



export type RoleGridColumnHandlers = {

  renderActorLabel: (username?: string | null, actorId?: number | null) => React.ReactNode;

  onEdit: (role: RoleRecord) => void;

  onEditMcpAccess: (role: RoleRecord) => void;

  onEditFunctionAccess: (role: RoleRecord) => void;

  onEditAttributes: (role: RoleRecord) => void;

  onDelete: (role: RoleRecord) => void;

};



export function createRoleGridColumns(

  handlers: RoleGridColumnHandlers,

  t: TranslationFn,

): AppTableGridColumnDef<RoleRecord>[] {

  return [

    {

      id: 'id',

      label: t(columnCommonKey('rowNumber')),

      width: 32,

      cellClassName: 'font-mono text-slate-400',

      renderCell: (role) => role.id,

      sort: false,

      filter: false,

      card: { role: 'hidden' },

    },

    {

      id: 'name',

      label: t(columnCommonKey('name')),

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

              : role.name === 'USER'

                ? 'bg-slate-100 text-slate-600 hover:text-slate-700'

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

      cellClassName: 'text-slate-600',

      card: { role: 'subtitle' },

      renderCell: (role) => role.note ?? <span className="text-slate-300">-</span>,

      sort: false,

      filter: false,

    },

    {

      id: 'type',

      label: t(columnCommonKey('type')),

      card: { role: 'field', label: t(columnCommonKey('type')) },

      renderCell: (role) => (

        isBaseRole(role.name)

          ? <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">{t(columnsRolesKey('builtinType'))}</span>

          : <span className="rounded bg-cyan-50 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-700">{t(columnsRolesKey('customType'))}</span>

      ),

      sort: false,

      filter: false,

    },

    {

      id: 'created_at',

      label: t(columnCommonKey('created')),

      headerClassName: 'text-start',

      cellClassName: 'text-start font-mono text-slate-400',

      width: APP_TABLE_GRID_AUDIT_COLUMN_WIDTH,

      card: { role: 'meta', label: t(columnCommonKey('created')), priority: 10 },

      hideBelow: 'lg',

      renderCell: (role) => <MountGridDateText value={role.created_at} />,

      sort: false,

      filter: false,

    },

    {

      id: 'created_by',

      label: t(columnCommonKey('createdBy')),

      headerClassName: 'text-start',

      cellClassName: 'text-start',

      card: { role: 'meta', label: t(columnCommonKey('createdBy')), priority: 11 },

      hideBelow: 'lg',

      renderCell: (role) => handlers.renderActorLabel(role.created_by_username, role.created_by),

      sort: false,

      filter: false,

    },

    {

      id: 'updated_at',

      label: t(columnCommonKey('updated')),

      headerClassName: 'text-start',

      cellClassName: 'text-start font-mono text-slate-400',

      width: APP_TABLE_GRID_AUDIT_COLUMN_WIDTH,

      card: { role: 'meta', label: t(columnCommonKey('updated')), priority: 20 },

      hideBelow: 'lg',

      renderCell: (role) => <MountGridDateText value={role.updated_at} />,

      sort: false,

      filter: false,

    },

    {

      id: 'updated_by',

      label: t(columnCommonKey('updatedBy')),

      headerClassName: 'text-start',

      cellClassName: 'text-start',

      card: { role: 'meta', label: t(columnCommonKey('updatedBy')), priority: 21 },

      hideBelow: 'lg',

      renderCell: (role) => handlers.renderActorLabel(role.updated_by_username, role.updated_by),

      sort: false,

      filter: false,

    },

    {

      id: 'actions',

      label: '',

      headerClassName: 'text-end',

      cellClassName: 'text-end',

      width: ACTION_COLUMN_WIDTH,

      card: { role: 'actions' },

      renderCell: (role) => (

        <div className="flex items-center justify-end">

          <ActionTooltip content={isAdminRoleName(role.name) ? 'ADMIN role attributes cannot be edited' : 'Edit Attributes'}>

            <button

              type="button"

              onClick={() => handlers.onEditAttributes(role)}

              disabled={isAdminRoleName(role.name)}

              className={`${ACTION_BUTTON_BASE_CLASS} text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 disabled:text-slate-400 disabled:hover:bg-transparent`}

              aria-label={t('actions.editAttributes')}

            >

              <Tags className="h-3.5 w-3.5" />

            </button>

          </ActionTooltip>

          <span className="mx-[3px] h-3 border-s border-slate-200" aria-hidden="true" />

          <ActionTooltip content={isAdminRoleName(role.name) ? 'ADMIN role bypasses server function access checks' : 'Server Function Access'}>

            <button

              type="button"

              onClick={() => handlers.onEditFunctionAccess(role)}

              disabled={isAdminRoleName(role.name)}

              className={`${ACTION_BUTTON_BASE_CLASS} ${GRID_ACTION_FUNCTION_ACCESS_BUTTON_CLASS} disabled:text-slate-400 disabled:hover:bg-transparent`}

              aria-label={t('actions.configureFunctionAccess')}

            >

              <FunctionAccessActionIcon />

            </button>

          </ActionTooltip>

          <span className="mx-[3px] h-3 border-s border-slate-200" aria-hidden="true" />

          <ActionTooltip content={isAdminRoleName(role.name) ? t(columnsRolesKey('adminMcpLocked')) : t(columnsRolesKey('mcpAccess'))}>

            <button

              type="button"

              onClick={() => handlers.onEditMcpAccess(role)}

              disabled={isAdminRoleName(role.name)}

              className={`${ACTION_BUTTON_BASE_CLASS} text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 disabled:text-slate-400 disabled:hover:bg-transparent`}

              aria-label={t(columnsRolesKey('mcpAccess'))}

            >

              <Shield className="h-3.5 w-3.5" />

            </button>

          </ActionTooltip>

          <span className="mx-[3px] h-3 border-s border-slate-200" aria-hidden="true" />

          <ActionTooltip content="Delete">

            <button

              type="button"

              onClick={() => handlers.onDelete(role)}

              disabled={isBaseRole(role.name)}

              className={`${ACTION_BUTTON_BASE_CLASS} text-rose-600 hover:text-rose-700 hover:bg-rose-50`}

              aria-label={t('actions.delete')}

            >

              <Trash2 className="h-3.5 w-3.5" />

            </button>

          </ActionTooltip>

        </div>

      ),

      sort: false,

      filter: false,

    },

  ];

}


