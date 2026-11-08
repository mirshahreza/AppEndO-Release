import React, { useEffect, useState } from 'react';
import { UserCog, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useAppSettingsQuery } from '../../shared/api/queries/settings';
import { useRolesListQuery } from '../../shared/api/queries/roles';
import { useUsersListQuery, type UserRecord } from '../../shared/api/queries/users';
import type { RoleRecord } from '../../shared/api/contracts/roles/types';
import { useEndImpersonationMutation, useStartImpersonationMutation } from '../../shared/api/queries/dev-toolbar';
import {
  setDevToolbarImpersonation,
  useDevToolbarSnapshot,
} from '../../shared/lib/devToolbarSignal';
import { UiChip } from '../../shared/ui/UiChip';
import { UiTooltip } from '../../shared/ui/UiTooltip';
import { AppButton } from '../../shared/ui/AppButton';
import { UiSelect } from '../../shared/ui';
import { parsePinnedDesignerLoaderRef } from '../../domain/component-designer/publishLoaderRef';
import {
  buildDesignerHandoffUrl,
  resolveStudioMountPathPrefix,
} from '../../features/component-designer/lib/designerDraftPath';
import { STUDIO_PORTAL_SEGMENT } from '../../shared/api/contracts/platform/mountConstants';
import { useOptionalPortal } from './PortalContext';

type ImpersonateActorMode = 'role' | 'user';

/** Remaining minutes, floored at 0 — used for the toolbar's live countdown chip. */
const minutesUntil = (isoExpiry: string): number => (
  Math.max(0, Math.round((new Date(isoExpiry).getTime() - Date.now()) / 60_000))
);

/**
 * PDK-2/PDK-7 — visible only for ADMIN + explicit `developerToolbar` Settings flag, and never on
 * the Studio shell itself (this is for debugging *published* pages, Studio already has its own
 * chrome). Any other visitor gets zero extra DOM, not just a hidden node.
 *
 * Gated on the portal's resolved `shellKey`, not `PlatformMount.id` — a `/us/studio/...` page is
 * served by the culture mount with shellKey `studio`, not by the separate `studio` PlatformMount
 * (that one only backs the legacy bare `/studio/...` path); comparing against the mount id let the
 * toolbar leak into Studio.
 *
 * Impersonation ("View as") never touches the real session/cookie — it only attaches an
 * `x-impersonate-grant` header (see `devToolbarSignal.ts`) that the server accepts *only* from the
 * real admin who created the grant, and only applies to Record Policy / Data API evaluation for the
 * lifetime of the grant (server-enforced time-box, default 15 min, hard-capped at 60).
 */
export const DeveloperToolbar: React.FC = () => {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.roles.includes('ADMIN') ?? false;
  const portal = useOptionalPortal();
  const isStudioShell = portal?.shellKey === STUDIO_PORTAL_SEGMENT;
  const settingsQuery = useAppSettingsQuery({ enabled: isAdmin && !isStudioShell });
  const { activePage, lastApiCall, impersonation } = useDevToolbarSnapshot();

  const [isImpersonatePanelOpen, setIsImpersonatePanelOpen] = useState(false);
  const [actorMode, setActorMode] = useState<ImpersonateActorMode>('role');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [, forceTick] = useState(0);

  const canUseToolbar = isAdmin && !isStudioShell && Boolean(settingsQuery.data?.developerToolbar);

  const rolesQuery = useRolesListQuery();
  const usersQuery = useUsersListQuery(
    { search: userSearch || undefined, pageSize: 20 },
    { enabled: canUseToolbar && isImpersonatePanelOpen && actorMode === 'user' },
  );
  const startImpersonationMutation = useStartImpersonationMutation();
  const endImpersonationMutation = useEndImpersonationMutation();

  // Re-render once a minute so the remaining-time chip counts down without a manual poke.
  useEffect(() => {
    if (!impersonation) {
      return;
    }
    const timer = window.setInterval(() => forceTick((tick) => tick + 1), 30_000);
    return () => window.clearInterval(timer);
  }, [impersonation]);

  if (!canUseToolbar) {
    return null;
  }

  const clientComponentsUrl = activePage?.loaderKind === 'designer' && typeof window !== 'undefined'
    ? buildDesignerHandoffUrl(
      resolveStudioMountPathPrefix(window.location.pathname),
      {
        layoutId: '',
        componentPath: parsePinnedDesignerLoaderRef(activePage.loaderRef).componentPath,
      },
    )
    : null;

  const impersonationLabel = impersonation
    ? (impersonation.targetEmail ?? (impersonation.targetRoles.join(', ') || 'unknown'))
    : '';

  const handleStartImpersonation = async () => {
    const payload = actorMode === 'role'
      ? { targetRole: selectedRole, durationMinutes }
      : { targetUserId: Number(selectedUserId), durationMinutes };
    if (actorMode === 'role' && !selectedRole) {
      return;
    }
    if (actorMode === 'user' && !selectedUserId) {
      return;
    }

    const result = await startImpersonationMutation.mutateAsync(payload);
    setDevToolbarImpersonation({
      grantId: result.grantId,
      targetUserId: result.targetUserId,
      targetEmail: result.targetEmail,
      targetRoles: result.targetRoles,
      expiresAt: result.expiresAt,
    });
    setIsImpersonatePanelOpen(false);
  };

  const handleStopImpersonation = async () => {
    if (!impersonation) {
      return;
    }
    await endImpersonationMutation.mutateAsync(impersonation.grantId);
    setDevToolbarImpersonation(null);
  };

  return (
    <div
      data-testid="developer-toolbar"
      className="fixed bottom-3 right-3 z-[999] flex flex-col items-end gap-2"
    >
      {isImpersonatePanelOpen ? (
        <div className="w-72 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold text-slate-700">View as</span>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setIsImpersonatePanelOpen(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mb-2 flex gap-2">
            <UiSelect
              value={actorMode}
              onChange={(event) => setActorMode(event.target.value as ImpersonateActorMode)}
              size="sm"
              ariaLabel="Impersonate mode"
              className="w-24"
            >
              <option value="role">Role</option>
              <option value="user">User</option>
            </UiSelect>
            {actorMode === 'role' ? (
              <UiSelect
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value)}
                size="sm"
                ariaLabel="Target role"
                className="flex-1"
              >
                <option value="">Pick a role…</option>
                {((rolesQuery.data as RoleRecord[] | undefined) ?? []).map((role) => (
                  <option key={role.name} value={role.name}>{role.name}</option>
                ))}
              </UiSelect>
            ) : (
              <input
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Search users…"
                className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs"
              />
            )}
          </div>
          {actorMode === 'user' ? (
            <UiSelect
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              size="sm"
              ariaLabel="Target user"
              className="mb-2 w-full"
            >
              <option value="">Pick a user…</option>
              {((usersQuery.data as { items: UserRecord[] } | undefined)?.items ?? []).map((user) => (
                <option key={user.id} value={user.id}>{user.username || user.email || `User #${user.id}`}</option>
              ))}
            </UiSelect>
          ) : null}
          <div className="mb-3 flex items-center gap-2">
            <span className="text-slate-500">Time-box</span>
            <UiSelect
              value={String(durationMinutes)}
              onChange={(event) => setDurationMinutes(Number(event.target.value))}
              size="sm"
              ariaLabel="Impersonation duration"
              className="flex-1"
            >
              <option value="5">5 min</option>
              <option value="15">15 min</option>
              <option value="30">30 min</option>
              <option value="60">60 min</option>
            </UiSelect>
          </div>
          <AppButton
            type="button"
            intent="primary"
            size="sm"
            disabled={startImpersonationMutation.isPending}
            onClick={() => { void handleStartImpersonation(); }}
            className="w-full justify-center"
          >
            Start
          </AppButton>
        </div>
      ) : null}

      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-xs shadow-lg backdrop-blur">
        <UiTooltip content="Request id of the last API call on this page">
          <UiChip size="sm" variant="soft">
            {lastApiCall?.requestId ?? 'no calls yet'}
          </UiChip>
        </UiTooltip>
        {lastApiCall ? (
          <UiTooltip content="Duration of the last API call on this page">
            <UiChip size="sm" variant="soft">{`${lastApiCall.durationMs} ms`}</UiChip>
          </UiTooltip>
        ) : null}
        {clientComponentsUrl ? (
          <AppButton
            size="sm"
            intent="secondary"
            onClick={() => window.open(clientComponentsUrl, '_blank', 'noopener')}
          >
            Open in Client Components
          </AppButton>
        ) : null}
        {impersonation ? (
          <>
            <UiTooltip content={`Viewing as ${impersonationLabel} — expires in ${minutesUntil(impersonation.expiresAt)} min`}>
              <UiChip size="sm" variant="soft" color="warning">
                {`Viewing as ${impersonationLabel} (${minutesUntil(impersonation.expiresAt)}m)`}
              </UiChip>
            </UiTooltip>
            <AppButton
              size="sm"
              intent="cancel"
              disabled={endImpersonationMutation.isPending}
              onClick={() => { void handleStopImpersonation(); }}
            >
              Stop
            </AppButton>
          </>
        ) : (
          <AppButton
            size="sm"
            intent="secondary"
            onClick={() => setIsImpersonatePanelOpen((open) => !open)}
          >
            <UserCog className="h-3.5 w-3.5" />
            View as
          </AppButton>
        )}
      </div>
    </div>
  );
};
