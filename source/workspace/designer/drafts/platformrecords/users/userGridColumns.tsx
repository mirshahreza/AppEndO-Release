import React from 'react';
import type { TranslationFn } from '@/src/core/culture/TranslationRuntime';
import { columnCommonKey } from '@/src/core/culture/translations/cultureKeyHelpers';
import type { BaseInfoOption, UserRecord } from '@/src/shared/api/queries/users';
import { cn } from '@/src/lib/utils';
import { BaseInfoUiIcon } from '@/src/shared/lib/baseInfoUiIcon';
import type { AppTableGridColumnDef } from '@/src/shared/lib/appTableGridQuery';
import type { GridColumnLayoutState } from '@/src/shared/lib/appTableGridColumnLayout';
import { ActionTooltip } from '@/src/shared/ui/ActionTooltip';
import { AppButton } from '@/src/shared/ui/AppButton';
import { NativeButton } from '@/src/shared/ui/NativeButton';
import {
  ChangePasswordActionIcon,
  ResetPasswordActionIcon,
} from '@/src/shared/ui/userPasswordGridActions';
import {
  FunctionAccessActionIcon,
  GRID_ACTION_FUNCTION_ACCESS_BUTTON_CLASS,
} from '@/src/shared/ui/functionAccessGridActions';
import {
  APP_TABLE_GRID_AUDIT_COLUMN_WIDTH,
  GRID_ACTION_CHANGE_PASSWORD_CLASS,
  GRID_ACTION_RESET_PASSWORD_CLASS,
} from '@/src/shared/ui/surfaceClasses';
import { Lock, LockOpen, LogIn, Mail, Shield, Tags, Trash2, User } from 'lucide-react';
import { ACTION_BUTTON_BASE_CLASS } from './constants';
import type { UserTableActionHandlers } from './types';
import { MountGridDateText } from '@/src/app/platform/MountGridDateText';
import { UserGridRoleChips } from './components/UserGridRoleChips';
import { UserListAvatar } from './components/UserListAvatar';
import { formatProfileDisplayName, sortUserGridRoles, userHasDeleteRestricted, userHasRestrictedActions } from './utils';

const USER_ACTIONS_COLUMN_WIDTH = 133;
const USER_LOGIN_AS_COLUMN_WIDTH = 116;

export type UserGridColumnHandlers = UserTableActionHandlers & {
  getGenderOption: (code?: string | null) => BaseInfoOption | null;
  getPersonTypeOption: (code?: string | null) => BaseInfoOption | null;
  renderActorLabel: (username?: string | null, actorId?: number | null) => React.ReactNode;
  getAvatarSrc: (user: UserRecord) => string | null;
  currentUserId?: number;
  isAdmin: boolean;
  isLoggingInAs: number | null;
};

const buildLoginAsColumn = (
  handlers: UserGridColumnHandlers,
  t: TranslationFn,
): AppTableGridColumnDef<UserRecord> => ({
  id: 'login_as',
  label: t(columnCommonKey('loginAs')),
  layout: { hideable: false },
  headerClassName: 'text-center [&>div]:justify-center',
  cellClassName: 'text-center',
  width: USER_LOGIN_AS_COLUMN_WIDTH,
  card: { role: 'actions', label: t(columnCommonKey('loginAs')) },
  renderCell: (user) => (
    handlers.currentUserId === user.id || user.is_builtin ? (
      <span className="text-slate-300">—</span>
    ) : (
      <AppButton
        intent="utility"
        size="sm"
        onClick={() => handlers.onLoginAs(user)}
        disabled={handlers.isLoggingInAs === user.id}
        aria-label={t('actions.loginAs')}
      >
        <LogIn className="h-3.5 w-3.5" />
        {t('actions.loginAs')}
      </AppButton>
    )
  ),
  sort: false,
  filter: false,
});

const buildActionsColumn = (
  handlers: UserGridColumnHandlers,
  t: TranslationFn,
): AppTableGridColumnDef<UserRecord> => ({
  id: 'actions',
  label: '',
  layout: { hideable: false },
  headerClassName: 'text-end',
  cellClassName: 'text-end',
  width: USER_ACTIONS_COLUMN_WIDTH,
  card: { role: 'actions' },
  renderCell: (user) => {
    const isRestricted = userHasRestrictedActions(user, handlers.currentUserId);

    return (
    <div className="flex items-center justify-end">
      <ActionTooltip
        content={
          isRestricted
            ? t('columns.users.editAttributesDisabledBuiltin')
            : t('actions.editAttributes')
        }
      >
        <NativeButton
          onClick={() => handlers.onOpenEditAttributes(user)}
          disabled={isRestricted}
          className={`${ACTION_BUTTON_BASE_CLASS} text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 disabled:text-slate-400 disabled:hover:bg-transparent`}
          aria-label={t('actions.editAttributes')}
        >
          <Tags className="h-3.5 w-3.5" />
        </NativeButton>
      </ActionTooltip>
      <span className="mx-[3px] h-3 border-s border-slate-200" aria-hidden="true" />
      <ActionTooltip
        content={
          isRestricted
            ? t('columns.users.editAttributesDisabledBuiltin')
            : t('actions.configureFunctionAccess')
        }
      >
        <NativeButton
          onClick={() => handlers.onEditFunctionAccess(user)}
          disabled={isRestricted}
          className={`${ACTION_BUTTON_BASE_CLASS} ${GRID_ACTION_FUNCTION_ACCESS_BUTTON_CLASS} disabled:text-slate-400 disabled:hover:bg-transparent`}
          aria-label={t('actions.configureFunctionAccess')}
        >
          <FunctionAccessActionIcon />
        </NativeButton>
      </ActionTooltip>
      <span className="mx-[3px] h-3 border-s border-slate-200" aria-hidden="true" />
      <ActionTooltip content={t('actions.changePassword')}>
        <NativeButton
          onClick={() => handlers.onStartChangePassword(user)}
          disabled={isRestricted}
          className={`${ACTION_BUTTON_BASE_CLASS} ${GRID_ACTION_CHANGE_PASSWORD_CLASS} disabled:text-slate-400 disabled:hover:bg-transparent`}
          aria-label={t('actions.changePassword')}
        >
          <ChangePasswordActionIcon />
        </NativeButton>
      </ActionTooltip>
      <span className="mx-[3px] h-3 border-s border-slate-200" aria-hidden="true" />
      <ActionTooltip content={t('actions.resetPassword')}>
        <NativeButton
          onClick={() => handlers.onStartResetPassword(user)}
          disabled={isRestricted}
          className={`${ACTION_BUTTON_BASE_CLASS} ${GRID_ACTION_RESET_PASSWORD_CLASS} disabled:text-slate-400 disabled:hover:bg-transparent`}
          aria-label={t('actions.resetPassword')}
        >
          <ResetPasswordActionIcon />
        </NativeButton>
      </ActionTooltip>
      <span className="mx-[3px] h-3 border-s border-slate-200" aria-hidden="true" />
      <ActionTooltip
        content={
          userHasDeleteRestricted(user)
            ? t('columns.users.deleteDisabledBuiltin')
            : t('actions.delete')
        }
      >
        <NativeButton
          onClick={() => handlers.onRequestDelete(user)}
          disabled={userHasDeleteRestricted(user)}
          className={`${ACTION_BUTTON_BASE_CLASS} text-rose-600 hover:text-rose-700 hover:bg-rose-50 disabled:text-slate-400 disabled:hover:bg-transparent`}
          aria-label={t('actions.delete')}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </NativeButton>
      </ActionTooltip>
    </div>
    );
  },
  sort: false,
  filter: false,
});

export function normalizeUsersGridColumnLayout(
  layout: GridColumnLayoutState,
): GridColumnLayoutState {
  const loginAsIndex = layout.order.indexOf('login_as');
  const actionsIndex = layout.order.indexOf('actions');
  if (loginAsIndex < 0 || actionsIndex < 0 || loginAsIndex < actionsIndex) {
    return layout;
  }

  const order = layout.order.filter((columnId) => columnId !== 'login_as');
  const nextActionsIndex = order.indexOf('actions');
  order.splice(nextActionsIndex, 0, 'login_as');
  return { ...layout, order };
}

const renderAuditCell = (
  date?: string | null,
  actorUsername?: string | null,
  actorId?: number | null,
  renderActorLabel?: UserGridColumnHandlers['renderActorLabel'],
) => (
  <div className="flex flex-col items-start gap-0.5 text-start leading-tight">
    <MountGridDateText value={date} className="font-mono text-slate-400" />
    <span className="text-[10px] text-start">{renderActorLabel?.(actorUsername, actorId)}</span>
  </div>
);

export function createUserGridColumns(
  handlers: UserGridColumnHandlers,
  t: TranslationFn,
): AppTableGridColumnDef<UserRecord>[] {
  const trailingColumns: AppTableGridColumnDef<UserRecord>[] = handlers.isAdmin
    ? [buildLoginAsColumn(handlers, t), buildActionsColumn(handlers, t)]
    : [buildActionsColumn(handlers, t)];

  return [
    {
      id: 'id',
      label: t(columnCommonKey('id')),
      headerClassName: 'text-start',
      cellClassName: 'text-start font-mono text-slate-400',
      width: 48,
      renderCell: (user) => user.id,
      sort: false,
      filter: false,
      card: { role: 'hidden' },
    },
    {
      id: 'image',
      label: '',
      headerClassName: 'text-center',
      cellClassName: 'text-center',
      width: 62,
      card: { role: 'meta', priority: -10 },
      renderCell: (user) => {
        const avatarSrc = handlers.getAvatarSrc(user);
        const fallbackLabel = (formatProfileDisplayName(user) || user.username || '?').slice(0, 1).toUpperCase();
        return (
          <UserListAvatar
            userId={user.id}
            src={avatarSrc}
            alt={`Avatar of ${user.username}`}
            fallbackLabel={fallbackLabel}
          />
        );
      },
      sort: false,
      filter: false,
    },
    {
      id: 'email',
      label: t(columnCommonKey('account')),
      card: { role: 'title' },
      renderCell: (user) => (
        <>
          <div className="flex items-center gap-1.5 font-medium text-slate-800">
            <Mail className="h-3 w-3 text-slate-400" />
            <span>{user.email ?? <span className="text-slate-300">—</span>}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-slate-500">
            <User className="h-3 w-3 text-slate-400" />
            <span>{user.username}</span>
            {user.is_builtin ? (
              <span
                className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-amber-700"
                title={t('columns.users.builtinUser')}
                aria-label={t('columns.users.builtinUser')}
              >
                <Shield className="h-2.5 w-2.5" />
              </span>
            ) : null}
          </div>
        </>
      ),
      getSortValue: (user) => (user.email ?? '').toLowerCase(),
      getFilterValue: (user) => `${user.email ?? ''} ${user.username}`,
      sort: { mode: 'server' },
      filter: { mode: 'server', type: 'text', placeholder: t('grid.filter.account') },
    },
    {
      id: 'person_type',
      label: '',
      cellClassName: 'text-center',
      width: 34,
      renderCell: (user) => {
        const personType = handlers.getPersonTypeOption(user.person_type_code);
        if (!personType?.uiHtml) return <span className="text-slate-300">—</span>;
        return (
          <ActionTooltip content={personType.label}>
            <span className="inline-flex items-center justify-center text-slate-500">
              <BaseInfoUiIcon uiHtml={personType.uiHtml} label={personType.label} />
            </span>
          </ActionTooltip>
        );
      },
      sort: false,
      filter: false,
      card: { role: 'hidden' },
    },
    {
      id: 'full_name',
      label: t(columnCommonKey('profile')),
      cellClassName: 'text-slate-600',
      card: { role: 'subtitle' },
      renderCell: (user) => {
        const isRestricted = userHasRestrictedActions(user, handlers.currentUserId);

        return (
        <NativeButton
          type="button"
          onClick={() => handlers.onOpenEditProfile(user)}
          disabled={isRestricted}
          className={cn(
            'text-start underline-offset-2 disabled:cursor-default',
            isRestricted ? 'text-slate-600' : 'hover:underline',
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            {(() => {
              const gender = handlers.getGenderOption(user.gender_code);
              if (!gender?.uiHtml) return null;
              return (
                <ActionTooltip content={gender.label}>
                  <span className="inline-flex items-center text-slate-500">
                    <BaseInfoUiIcon uiHtml={gender.uiHtml} label={gender.label} />
                  </span>
                </ActionTooltip>
              );
            })()}
            <span>
              {formatProfileDisplayName(user) ?? <span className="text-slate-300">-</span>}
            </span>
          </span>
        </NativeButton>
        );
      },
      getSortValue: (user) => (formatProfileDisplayName(user) ?? '').toLowerCase(),
      getFilterValue: (user) => formatProfileDisplayName(user) ?? '',
      sort: { mode: 'server' },
      filter: { mode: 'server', type: 'text', placeholder: t('grid.filter.profile') },
    },
    {
      id: 'roles',
      label: t(columnCommonKey('roles')),
      card: { role: 'field', label: t(columnCommonKey('roles')) },
      renderCell: (user) => (
        <UserGridRoleChips
          roles={user.roles}
          disabled={userHasRestrictedActions(user, handlers.currentUserId)}
          onOpenEditRoles={() => handlers.onOpenEditRoles(user)}
        />
      ),
      getFilterValue: (user) => sortUserGridRoles(user.roles).join(' '),
      filter: { mode: 'server', type: 'text', placeholder: t('grid.filter.roles') },
    },
    {
      id: 'locked',
      label: t(columnCommonKey('lockStatus')),
      headerClassName: 'text-start',
      cellClassName: 'text-start',
      card: { role: 'field', label: t(columnCommonKey('lockStatus')) },
      renderCell: (user) => (
        userHasRestrictedActions(user, handlers.currentUserId) ? (
          <span className="text-slate-300">—</span>
        ) : (
          <div className="flex items-start gap-1.5 text-start leading-tight">
            <ActionTooltip content={user.locked ? t('columns.users.clickToUnlock') : t('columns.users.clickToLock')}>
              <NativeButton
                type="button"
                onClick={() => handlers.onToggleLocked(user)}
                className={cn(
                  'inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded transition-colors',
                  user.locked
                    ? 'text-rose-600 hover:bg-rose-50'
                    : 'text-emerald-600 hover:bg-emerald-50',
                )}
                aria-label={user.locked ? t('actions.unlockUser') : t('actions.lockUser')}
              >
                {user.locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
              </NativeButton>
            </ActionTooltip>
            <div className="flex min-w-0 flex-col items-start gap-0.5">
              {user.locked ? (
                <>
                  <MountGridDateText value={user.locked_at} className="font-mono text-slate-400" />
                  <span className="text-[10px] text-start">{handlers.renderActorLabel(user.locked_by_username, user.locked_by)}</span>
                </>
              ) : (
                <>
                  <MountGridDateText value={user.unlocked_at} className="font-mono text-slate-400" />
                  <span className="text-[10px] text-start">{handlers.renderActorLabel(user.unlocked_by_username, user.unlocked_by)}</span>
                </>
              )}
            </div>
          </div>
        )
      ),
      getFilterValue: (user) => (user.locked ? 'true' : 'false'),
      filter: {
        mode: 'server',
        type: 'boolean',
      },
    },
    {
      id: 'created_at',
      label: t(columnCommonKey('created')),
      headerClassName: 'text-start',
      cellClassName: 'text-start',
      width: APP_TABLE_GRID_AUDIT_COLUMN_WIDTH,
      card: { role: 'meta', label: t(columnCommonKey('created')), priority: 10 },
      hideBelow: 'lg',
      renderCell: (user) => renderAuditCell(user.created_at, user.created_by_username, user.created_by, handlers.renderActorLabel),
      getSortValue: (user) => user.created_at ?? '',
      getFilterValue: (user) => user.created_at ?? '',
      sort: { mode: 'server' },
      filter: { mode: 'server', type: 'dateRange' },
    },
    {
      id: 'updated_at',
      label: t(columnCommonKey('updated')),
      headerClassName: 'text-start',
      cellClassName: 'text-start',
      width: APP_TABLE_GRID_AUDIT_COLUMN_WIDTH,
      card: { role: 'meta', label: t(columnCommonKey('updated')), priority: 20 },
      hideBelow: 'lg',
      renderCell: (user) => renderAuditCell(user.updated_at, user.updated_by_username, user.updated_by, handlers.renderActorLabel),
      getSortValue: (user) => user.updated_at ?? '',
      getFilterValue: (user) => user.updated_at ?? '',
      sort: { mode: 'server' },
      filter: { mode: 'server', type: 'dateRange' },
    },
    ...trailingColumns,
  ];
}

const noopUserGridCell = () => null;

const identityT: TranslationFn = (key) => key;

/** Static column metadata for grid query state — avoids duplicating full column factories. */
export const USER_GRID_QUERY_COLUMNS: ReadonlyArray<AppTableGridColumnDef<UserRecord>> =
  createUserGridColumns({
    onOpenEditProfile: noopUserGridCell,
    onOpenEditRoles: noopUserGridCell,
    onOpenEditAttributes: noopUserGridCell,
    onEditFunctionAccess: noopUserGridCell,
    onStartChangePassword: noopUserGridCell,
    onStartResetPassword: noopUserGridCell,
    onToggleLocked: noopUserGridCell,
    onLoginAs: noopUserGridCell,
    onRequestDelete: noopUserGridCell,
    getGenderOption: () => null,
    getPersonTypeOption: () => null,
    renderActorLabel: () => null,
    getAvatarSrc: () => null,
    currentUserId: undefined,
    isAdmin: true,
    isLoggingInAs: null,
  }, identityT);
