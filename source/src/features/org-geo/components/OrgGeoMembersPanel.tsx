import React, { useMemo, useState } from 'react';
import { History, Loader2, Plus, Shield, Users, X } from 'lucide-react';
import {
  useCreateScopeMembershipMutation,
  useCreateScopeRoleMembershipMutation,
  useDeleteScopeMembershipMutation,
  useDeleteScopeRoleMembershipMutation,
  useScopeMembershipEventsQuery,
  useScopeMembershipsQuery,
  useScopeRoleMembershipEventsQuery,
  useScopeRoleMembershipsQuery,
} from '../../../shared/api/queries/scope-memberships';
import { AppButton } from '../../../shared/ui';
import { OrgGeoPersonAvatar } from './OrgGeoPersonAvatar';
import { OrgGeoPersonPickerDialog } from './OrgGeoPersonPickerDialog';
import { OrgGeoRolePickerDialog } from './OrgGeoRolePickerDialog';

type OrgGeoMembersPanelProps = {
  dimensionKey: string;
  nodeId: string | null | undefined;
};

const formatEventWhen = (iso: string | null): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

const eventVerb = (eventType: string): string => {
  if (eventType === 'assigned') return 'Assigned';
  if (eventType === 'removed') return 'Removed';
  if (eventType === 'updated') return 'Updated';
  return eventType;
};

export const OrgGeoMembersPanel: React.FC<OrgGeoMembersPanelProps> = ({
  dimensionKey,
  nodeId,
}) => {
  const enabled = Boolean(nodeId);

  const membershipsQuery = useScopeMembershipsQuery(
    { dimensionKey, nodeId: nodeId || undefined },
    enabled,
  );
  const roleMembershipsQuery = useScopeRoleMembershipsQuery(
    { dimensionKey, nodeId: nodeId || undefined },
    enabled,
  );
  const eventsQuery = useScopeMembershipEventsQuery(
    { dimensionKey, nodeId: nodeId || '', limit: 40 },
    enabled,
  );
  const roleEventsQuery = useScopeRoleMembershipEventsQuery(
    { dimensionKey, nodeId: nodeId || '', limit: 40 },
    enabled,
  );
  const createMutation = useCreateScopeMembershipMutation();
  const deleteMutation = useDeleteScopeMembershipMutation();
  const createRoleMutation = useCreateScopeRoleMembershipMutation();
  const deleteRoleMutation = useDeleteScopeRoleMembershipMutation();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const memberUserIds = useMemo(
    () => new Set((membershipsQuery.data || []).map((row) => String(row.userId))),
    [membershipsQuery.data],
  );
  const memberRoleNames = useMemo(
    () => new Set((roleMembershipsQuery.data || []).map((row) => row.roleName)),
    [roleMembershipsQuery.data],
  );

  if (!nodeId) return null;

  const busy = createMutation.isPending
    || deleteMutation.isPending
    || createRoleMutation.isPending
    || deleteRoleMutation.isPending;
  const items = membershipsQuery.data || [];
  const roleItems = roleMembershipsQuery.data || [];
  const events = eventsQuery.data || [];
  const roleEvents = roleEventsQuery.data || [];

  return (
    <section className="mt-3 border-t border-slate-100 pt-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5 text-slate-400" aria-hidden />
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          People
        </h3>
        <span className="ms-auto font-mono text-[10px] text-slate-400">{items.length}</span>
      </div>

      {membershipsQuery.isLoading ? (
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading members…
        </p>
      ) : null}

      {membershipsQuery.isError ? (
        <p className="text-xs text-rose-600">
          {membershipsQuery.error instanceof Error
            ? membershipsQuery.error.message
            : 'Failed to load members.'}
        </p>
      ) : null}

      {!membershipsQuery.isLoading && items.length === 0 ? (
        <p className="mb-2 text-xs text-slate-400">No people assigned yet.</p>
      ) : null}

      <ul className="mb-2 space-y-1.5">
        {items.map((row) => (
          <li
            key={row.id}
            className="group flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50/80 px-2 py-1.5"
          >
            <OrgGeoPersonAvatar
              src={row.avatarUrl || null}
              label={row.displayName}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-800">{row.displayName}</p>
            </div>
            <button
              type="button"
              aria-label={`Remove ${row.displayName}`}
              title="Remove"
              disabled={busy}
              className="rounded p-0.5 text-slate-400 opacity-0 transition-opacity hover:bg-slate-200/80 hover:text-rose-600 focus-visible:opacity-100 disabled:opacity-0 group-hover:opacity-100"
              onClick={() => {
                setLocalError(null);
                void deleteMutation.mutateAsync(row.id).catch((err) => {
                  setLocalError(err instanceof Error ? err.message : 'Failed to remove member.');
                });
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <AppButton
        type="button"
        intent="secondary"
        size="sm"
        className="w-full"
        disabled={busy}
        onClick={() => {
          setLocalError(null);
          setPickerOpen(true);
        }}
      >
        <Plus className="h-3.5 w-3.5" />
        Add person
      </AppButton>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <div className="mb-2 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Roles
          </h3>
          <span className="ms-auto font-mono text-[10px] text-slate-400">{roleItems.length}</span>
        </div>

        {roleMembershipsQuery.isLoading ? (
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading roles…
          </p>
        ) : null}

        {roleMembershipsQuery.isError ? (
          <p className="text-xs text-rose-600">
            {roleMembershipsQuery.error instanceof Error
              ? roleMembershipsQuery.error.message
              : 'Failed to load roles.'}
          </p>
        ) : null}

        {!roleMembershipsQuery.isLoading && roleItems.length === 0 ? (
          <p className="mb-2 text-xs text-slate-400">No roles assigned yet.</p>
        ) : null}

        <ul className="mb-2 space-y-1.5">
          {roleItems.map((row) => (
            <li
              key={row.id}
              className="group flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50/80 px-2 py-1.5"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
                <Shield className="h-3.5 w-3.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-800">{row.roleName}</p>
              </div>
              <button
                type="button"
                aria-label={`Remove role ${row.roleName}`}
                title="Remove"
                disabled={busy}
                className="rounded p-0.5 text-slate-400 opacity-0 transition-opacity hover:bg-slate-200/80 hover:text-rose-600 focus-visible:opacity-100 disabled:opacity-0 group-hover:opacity-100"
                onClick={() => {
                  setLocalError(null);
                  void deleteRoleMutation.mutateAsync(row.id).catch((err) => {
                    setLocalError(err instanceof Error ? err.message : 'Failed to remove role.');
                  });
                }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>

        <AppButton
          type="button"
          intent="secondary"
          size="sm"
          className="w-full"
          disabled={busy}
          onClick={() => {
            setLocalError(null);
            setRolePickerOpen(true);
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add role
        </AppButton>
      </div>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <button
          type="button"
          className="mb-2 flex w-full items-center gap-1.5 text-start"
          onClick={() => setHistoryOpen((open) => !open)}
          aria-expanded={historyOpen}
        >
          <History className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            History
          </span>
          <span className="ms-auto text-[10px] font-medium text-slate-400">
            {historyOpen ? 'Hide' : 'Show'}
          </span>
        </button>

        {historyOpen ? (
          eventsQuery.isLoading || roleEventsQuery.isLoading ? (
            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading history…
            </p>
          ) : eventsQuery.isError || roleEventsQuery.isError ? (
            <p className="text-xs text-rose-600">Failed to load history.</p>
          ) : events.length === 0 && roleEvents.length === 0 ? (
            <p className="text-xs text-slate-400">No membership changes recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {[
                ...events.map((event) => ({
                  id: `u-${event.id}`,
                  sortAt: event.createdAt || '',
                  title: `${eventVerb(event.eventType)} ${event.displayName}`,
                  meta: `${formatEventWhen(event.createdAt)}${event.actorDisplayName ? ` · by ${event.actorDisplayName}` : ''}`,
                })),
                ...roleEvents.map((event) => ({
                  id: `r-${event.id}`,
                  sortAt: event.createdAt || '',
                  title: `${eventVerb(event.eventType)} role ${event.roleName}`,
                  meta: `${formatEventWhen(event.createdAt)}${event.actorDisplayName ? ` · by ${event.actorDisplayName}` : ''}`,
                })),
              ]
                .sort((a, b) => b.sortAt.localeCompare(a.sortAt))
                .map((event) => (
                  <li
                    key={event.id}
                    className="rounded-md border border-slate-100 bg-white px-2 py-1.5"
                  >
                    <p className="text-xs font-medium text-slate-700">{event.title}</p>
                    <p className="mt-0.5 text-[10px] leading-snug text-slate-400">{event.meta}</p>
                  </li>
                ))}
            </ul>
          )
        ) : null}
      </div>

      {localError ? (
        <p className="mt-2 text-xs text-rose-600">{localError}</p>
      ) : null}

      <OrgGeoPersonPickerDialog
        open={pickerOpen}
        excludedUserIds={memberUserIds}
        busy={createMutation.isPending}
        onClose={() => setPickerOpen(false)}
        onAdd={async (userIds) => {
          for (const userId of userIds) {
            await createMutation.mutateAsync({
              dimensionKey,
              nodeId,
              userId,
            });
          }
        }}
      />

      <OrgGeoRolePickerDialog
        open={rolePickerOpen}
        excludedRoleNames={memberRoleNames}
        busy={createRoleMutation.isPending}
        onClose={() => setRolePickerOpen(false)}
        onAdd={async (roleNames) => {
          for (const roleName of roleNames) {
            await createRoleMutation.mutateAsync({
              dimensionKey,
              nodeId,
              roleName,
            });
          }
        }}
      />
    </section>
  );
};
