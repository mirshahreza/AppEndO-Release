import React from 'react';
import type { TranslationFn } from '../../core/culture/TranslationRuntime';
import { columnCommonKey } from '../../core/culture/translations/cultureKeyHelpers';
import type { BaseInfoOption, UserRecord } from '../../shared/api/queries/users';
import { cn } from '../../lib/utils';
import { BaseInfoUiIcon } from '../../shared/lib/baseInfoUiIcon';
import type { AppTableGridColumnDef } from '../../shared/lib/appTableGridQuery';
import type { GridColumnLayoutState } from '../../shared/lib/appTableGridColumnLayout';
import { BuiltInBadge } from '../../shared/ui';
import { ActionTooltip } from '../../shared/ui/ActionTooltip';
import { AppButton } from '../../shared/ui/AppButton';
import { NativeButton } from '../../shared/ui/NativeButton';
import {
  ChangePasswordActionIcon,
  ResetPasswordActionIcon,
} from '../../shared/ui/userPasswordGridActions';
import { FunctionAccessActionIcon } from '../../shared/ui/functionAccessGridActions';
import {
  APP_TABLE_GRID_AUDIT_COLUMN_WIDTH,
  APP_TABLE_GRID_AUDIT_TEXT_CLASS,
  APP_TABLE_GRID_ACTOR_TEXT_CLASS,
} from '../../shared/ui/surfaceClasses';
import { Lock, LockOpen, LogIn, History, Pencil, Shield, Tags, Trash2 } from 'lucide-react';
import { AppGridRowActions, type GridRowActionItem } from '../../shared/ui/AppGridRowActions';
import {
  DEFAULT_GRID_MAX_VISIBLE_ACTIONS,
  gridActionsColumnWidth,
  resolveGridActionSlotCount,
} from '../../shared/lib/gridRowActions';
import type { UserTableActionHandlers } from './types';
import { MountGridDateText } from '../../app/platform/MountGridDateText';
import { UserGridRoleChips } from './components/UserGridRoleChips';
import { hwyMemberFaceCaptionTextClass } from '../../domain/hwy/hwyMemberFaceCaptionDisplay';
import {
  canDeleteUserRecord,
  formatProfileDisplayName,
  resolveUserGridAvatarCaption,
  userHasAdminRole,
} from './utils';

const USER_TABLE_ICON_ACTION_COUNT = 6;
const USER_LOGIN_AS_COLUMN_WIDTH = 116;

/** Account column floor — keeps table within shell at 1280 with docked sidebar (truncate in cell). */
export const USER_GRID_ACCOUNT_MIN_WIDTH = 160;

/** Clamp persisted resize widths so saved layouts cannot reintroduce horizontal clip on actions. */
const USER_GRID_PERSISTED_WIDTH_CAPS: Record<string, number> = {
  image: 76,
  email: 240,
  full_name: 220,
  roles: 88,
  locked: 96,
  created_at: APP_TABLE_GRID_AUDIT_COLUMN_WIDTH,
  updated_at: APP_TABLE_GRID_AUDIT_COLUMN_WIDTH,
};

export type UserGridColumnHandlers = UserTableActionHandlers & {
  getGenderOption: (code?: string | null) => BaseInfoOption | null;
  getPersonTypeOption: (code?: string | null) => BaseInfoOption | null;
  renderActorLabel: (username?: string | null, actorId?: number | null) => React.ReactNode;
  getAvatarSrc: (user: UserRecord) => string | null;
  currentUserId?: number;
  isAdmin: boolean;
  isLoggingInAs: number | null;
};

export function createUserCardRowActions(
  user: UserRecord,
  handlers: UserGridColumnHandlers,
  t: TranslationFn,
): GridRowActionItem[] {
  const canDelete = canDeleteUserRecord(user);
  const actions: GridRowActionItem[] = [];

  actions.push(
    {
      id: 'edit-profile',
      label: t('profile.actions.editProfile'),
      icon: <Pencil className="h-3.5 w-3.5" />,
      intent: 'edit',
      cardLabeled: true,
      onClick: () => handlers.onOpenEditProfile(user),
    },
    {
      id: 'edit-roles',
      label: t('users.modal.editRoles', { id: String(user.id) }),
      icon: <Shield className="h-3.5 w-3.5" />,
      intent: 'edit',
      onClick: () => handlers.onOpenEditRoles(user),
    },
    {
      id: 'toggle-lock',
      label: user.locked ? t('actions.unlockUser') : t('actions.lockUser'),
      icon: user.locked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />,
      intent: user.locked ? 'destructive-soft' : 'utility',
      onClick: () => handlers.onToggleLocked(user),
    },
    {
      id: 'history',
      label: 'History',
      icon: <History className="h-3.5 w-3.5" />,
      intent: 'view',
      onClick: () => handlers.onOpenHistory(user),
    },
    {
      id: 'edit-attributes',
      label: t('actions.editAttributes'),
      icon: <Tags className="h-3.5 w-3.5" />,
      intent: 'edit',
      onClick: () => handlers.onOpenEditAttributes(user),
    },
    {
      id: 'function-access',
      label: t('actions.configureFunctionAccess'),
      icon: <FunctionAccessActionIcon />,
      intent: 'access',
      onClick: () => handlers.onEditFunctionAccess(user),
    },
    {
      id: 'change-password',
      label: t('actions.changePassword'),
      icon: <ChangePasswordActionIcon />,
      intent: 'edit',
      onClick: () => handlers.onStartChangePassword(user),
    },
    {
      id: 'reset-password',
      label: t('actions.resetPassword'),
      icon: <ResetPasswordActionIcon />,
      intent: 'edit',
      onClick: () => handlers.onStartResetPassword(user),
    },
    {
      id: 'delete',
      label: t('actions.delete'),
      icon: <Trash2 className="h-3.5 w-3.5" />,
      intent: 'delete',
      disabled: !canDelete,
      title: !canDelete ? t('columns.users.deleteDisabledAdmin') : undefined,
      onClick: () => handlers.onRequestDelete(user),
    },
  );

  if (
    handlers.isAdmin
    && handlers.currentUserId !== user.id
    && !userHasAdminRole(user)
  ) {
    actions.push({
      id: 'login-as',
      label: t('actions.loginAs'),
      icon: <LogIn className="h-3.5 w-3.5" />,
      intent: 'utility',
      disabled: handlers.isLoggingInAs === user.id,
      onClick: () => handlers.onLoginAs(user),
    });
  }

  return actions;
}

function createUserTableIconActions(
  user: UserRecord,
  handlers: UserGridColumnHandlers,
  t: TranslationFn,
): GridRowActionItem[] {
  const canDelete = canDeleteUserRecord(user);
  return [
    {
      id: 'history',
      label: 'History',
      icon: <History className="h-3.5 w-3.5" />,
      intent: 'view',
      onClick: () => handlers.onOpenHistory(user),
    },
    {
      id: 'edit-attributes',
      label: t('actions.editAttributes'),
      icon: <Tags className="h-3.5 w-3.5" />,
      intent: 'edit',
      onClick: () => handlers.onOpenEditAttributes(user),
    },
    {
      id: 'function-access',
      label: t('actions.configureFunctionAccess'),
      icon: <FunctionAccessActionIcon />,
      intent: 'access',
      onClick: () => handlers.onEditFunctionAccess(user),
    },
    {
      id: 'change-password',
      label: t('actions.changePassword'),
      icon: <ChangePasswordActionIcon />,
      intent: 'edit',
      onClick: () => handlers.onStartChangePassword(user),
    },
    {
      id: 'reset-password',
      label: t('actions.resetPassword'),
      icon: <ResetPasswordActionIcon />,
      intent: 'edit',
      onClick: () => handlers.onStartResetPassword(user),
    },
    {
      id: 'delete',
      label: t('actions.delete'),
      icon: <Trash2 className="h-3.5 w-3.5" />,
      intent: 'delete',
      disabled: !canDelete,
      title: !canDelete ? t('columns.users.deleteDisabledAdmin') : undefined,
      onClick: () => handlers.onRequestDelete(user),
    },
  ];
}

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
    handlers.currentUserId === user.id || userHasAdminRole(user) ? (
      <span className="text-slate-300">—</span>
    ) : (
      <AppButton
        intent="utility"
        size="sm"
        className="h-7 min-h-7 gap-1 px-2 text-[10px] font-medium leading-none [@media(pointer:coarse)]:min-h-8"
        onClick={() => handlers.onLoginAs(user)}
        disabled={handlers.isLoggingInAs === user.id}
        aria-label={t('actions.loginAs')}
      >
        <LogIn className="h-3 w-3 shrink-0" />
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
  width: gridActionsColumnWidth(
    resolveGridActionSlotCount(USER_TABLE_ICON_ACTION_COUNT, DEFAULT_GRID_MAX_VISIBLE_ACTIONS),
  ),
  card: { role: 'actions' },
  renderCell: (user) => (
    <AppGridRowActions
      actions={createUserTableIconActions(user, handlers, t)}
      align="end"
      density="table"
    />
  ),
  sort: false,
  filter: false,
});

export function normalizeUsersGridColumnLayout(
  layout: GridColumnLayoutState,
): GridColumnLayoutState {
  const stripLegacyIdColumn = (state: GridColumnLayoutState): GridColumnLayoutState => {
    if (!state.order.includes('id') && !state.hidden.includes('id') && state.widths.id == null) {
      return state;
    }
    const widths = { ...state.widths };
    delete widths.id;
    return {
      order: state.order.filter((columnId) => columnId !== 'id'),
      hidden: state.hidden.filter((columnId) => columnId !== 'id'),
      widths,
    };
  };

  const withoutLegacyId = stripLegacyIdColumn(layout);

  const capPersistedWidths = (state: GridColumnLayoutState): GridColumnLayoutState => {
    const widths = { ...state.widths };
    for (const [columnId, cap] of Object.entries(USER_GRID_PERSISTED_WIDTH_CAPS)) {
      const width = widths[columnId];
      if (typeof width === 'number' && width > cap) {
        widths[columnId] = cap;
      }
    }
    return { ...state, widths };
  };

  const loginAsIndex = withoutLegacyId.order.indexOf('login_as');
  const actionsIndex = withoutLegacyId.order.indexOf('actions');
  if (loginAsIndex < 0 || actionsIndex < 0 || loginAsIndex < actionsIndex) {
    return capPersistedWidths(withoutLegacyId);
  }

  const order = withoutLegacyId.order.filter((columnId) => columnId !== 'login_as');
  const nextActionsIndex = order.indexOf('actions');
  order.splice(nextActionsIndex, 0, 'login_as');

  return capPersistedWidths({ ...withoutLegacyId, order });
}

const renderAuditCell = (
  date?: string | null,
  actorUsername?: string | null,
  actorId?: number | null,
  renderActorLabel?: UserGridColumnHandlers['renderActorLabel'],
) => {
  const actorLine = renderActorLabel?.(actorUsername, actorId);
  const hasActor =
    (actorUsername?.trim().length ?? 0) > 0
    || (actorId != null && actorId > 0);
  return (
    <div className="flex flex-col items-start gap-0.5 text-start leading-tight">
      <MountGridDateText value={date} className={APP_TABLE_GRID_AUDIT_TEXT_CLASS} />
      {hasActor && actorLine ? (
        <span className={`text-start ${APP_TABLE_GRID_ACTOR_TEXT_CLASS}`}>{actorLine}</span>
      ) : null}
    </div>
  );
};

export function createUserGridColumns(
  handlers: UserGridColumnHandlers,
  t: TranslationFn,
): AppTableGridColumnDef<UserRecord>[] {
  const trailingColumns: AppTableGridColumnDef<UserRecord>[] = handlers.isAdmin
    ? [buildLoginAsColumn(handlers, t), buildActionsColumn(handlers, t)]
    : [buildActionsColumn(handlers, t)];

  return [
    {
      id: 'image',
      label: '',
      headerClassName: 'sr-only',
      cellClassName: 'text-center',
      width: 76,
      wrap: true,
      card: { role: 'media', phoneRole: 'hidden' },
      renderCell: (user) => {
        const avatarSrc = handlers.getAvatarSrc(user);
        const avatarCaption = resolveUserGridAvatarCaption(user);
        const avatarUsername = avatarCaption.text;
        const fallbackLabel = (formatProfileDisplayName(user) || avatarUsername || '?').slice(0, 1).toUpperCase();
        return (
          <div className="mx-auto flex flex-col items-center gap-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-100">
              {avatarSrc ? (
                <img
                  key={avatarSrc}
                  src={avatarSrc}
                  alt={`Avatar of ${avatarUsername}`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-[10px] font-bold leading-none text-slate-500">{fallbackLabel}</span>
              )}
            </div>
            <ActionTooltip content={avatarUsername}>
              <span
                dir="ltr"
                className={cn(
                  'block w-full max-w-[4.5rem] truncate text-center text-[10px] leading-none',
                  avatarCaption.kind === 'none'
                    ? 'text-slate-500'
                    : hwyMemberFaceCaptionTextClass(avatarCaption.kind),
                )}
              >
                {avatarUsername}
              </span>
            </ActionTooltip>
          </div>
        );
      },
      sort: false,
      filter: false,
    },
    {
      id: 'email',
      label: t(columnCommonKey('account')),
      minWidth: USER_GRID_ACCOUNT_MIN_WIDTH,
      card: { role: 'subtitle' },
      renderCell: (user) => (
        <div className="flex min-w-0 flex-col items-start gap-1">
          {user.is_builtin ? (
            <BuiltInBadge
              title={t('columns.users.builtinUser')}
              aria-label={t('columns.users.builtinUser')}
            />
          ) : null}
          <span dir="ltr" className="max-w-full truncate text-xs text-slate-600">
            {user.email || user.username || '—'}
          </span>
        </div>
      ),
      getSortValue: (user) => (user.username ?? '').toLowerCase(),
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
      card: { role: 'title' },
      renderCell: (user) => (
        <NativeButton
          type="button"
          onClick={() => handlers.onOpenEditProfile(user)}
          className="text-start underline-offset-2 hover:underline [@media(pointer:coarse)]:underline"
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
      ),
      getSortValue: (user) => (formatProfileDisplayName(user) ?? '').toLowerCase(),
      getFilterValue: (user) => formatProfileDisplayName(user) ?? '',
      sort: { mode: 'server' },
      filter: { mode: 'server', type: 'text', placeholder: t('grid.filter.profile') },
    },
    {
      id: 'roles',
      label: t(columnCommonKey('roles')),
      width: 88,
      card: {
        role: 'field',
        label: t(columnCommonKey('roles')),
        phoneRole: 'hidden',
      },
      renderCell: (user) => {
        if (user.roles.length === 0) {
          return <span className="text-slate-300 max-lg:hidden">—</span>;
        }
        return (
          <UserGridRoleChips
            roles={user.roles}
            onClick={() => handlers.onOpenEditRoles(user)}
          />
        );
      },
      getFilterValue: (user) => user.roles.join(' '),
      filter: { mode: 'server', type: 'text', placeholder: t('grid.filter.roles') },
    },
    {
      id: 'locked',
      label: t(columnCommonKey('lockStatus')),
      width: 96,
      headerClassName: 'text-start',
      cellClassName: 'text-start',
      card: {
        role: 'field',
        label: t(columnCommonKey('lockStatus')),
        phoneRole: 'hidden',
        tabletRole: 'hidden',
      },
      renderCell: (user) => (
        <div className="flex items-start gap-1.5 text-start leading-tight">
            <div className="flex items-center gap-1.5 lg:hidden">
              {user.locked ? (
                <>
                  <Lock className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
                  <span className="text-xs font-medium text-amber-800">{t('actions.lock')}</span>
                </>
              ) : (
                <span className="text-xs text-slate-600">Not locked</span>
              )}
            </div>
            <div className="hidden items-start gap-1.5 lg:flex">
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
                  <MountGridDateText value={user.locked_at} className={APP_TABLE_GRID_AUDIT_TEXT_CLASS} />
                  {(user.locked_by_username?.trim() || user.locked_by) ? (
                    <span className={`text-start ${APP_TABLE_GRID_ACTOR_TEXT_CLASS}`}>
                      {handlers.renderActorLabel(user.locked_by_username, user.locked_by)}
                    </span>
                  ) : null}
                </>
              ) : user.unlocked_at?.trim() ? (
                <>
                  <MountGridDateText value={user.unlocked_at} className={APP_TABLE_GRID_AUDIT_TEXT_CLASS} />
                  {(user.unlocked_by_username?.trim() || user.unlocked_by) ? (
                    <span className={`text-start ${APP_TABLE_GRID_ACTOR_TEXT_CLASS}`}>
                      {handlers.renderActorLabel(user.unlocked_by_username, user.unlocked_by)}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="text-xs text-slate-400">—</span>
              )}
            </div>
            </div>
        </div>
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
    onOpenHistory: noopUserGridCell,
    getGenderOption: () => null,
    getPersonTypeOption: () => null,
    renderActorLabel: () => null,
    getAvatarSrc: () => null,
    currentUserId: undefined,
    isAdmin: true,
    isLoggingInAs: null,
  }, identityT);
