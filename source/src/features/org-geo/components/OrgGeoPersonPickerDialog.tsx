import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Search, UserPlus, Users, X } from 'lucide-react';
import { resolveListUserAvatarSrc } from '../../../shared/api/contracts/users/avatar';
import { fetchUsersList, type UserRecord } from '../../../shared/api/queries/users';
import {
  AppButton,
  CreateEditModalShell,
  UiInput,
} from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import { OrgGeoPersonAvatar } from './OrgGeoPersonAvatar';

type OrgGeoPersonPickerDialogProps = {
  open: boolean;
  excludedUserIds: ReadonlySet<string>;
  busy?: boolean;
  onClose: () => void;
  onAdd: (userIds: number[]) => Promise<void>;
};

function personLabel(user: UserRecord): string {
  const full = [user.firstname, user.lastname].filter(Boolean).join(' ').trim();
  return full || user.username;
}

export const OrgGeoPersonPickerDialog: React.FC<OrgGeoPersonPickerDialogProps> = ({
  open,
  excludedUserIds,
  busy = false,
  onClose,
  onAdd,
}) => {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setSelectedIds(new Set());
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setIsLoading(true);
      void fetchUsersList({ search: search.trim() || undefined, pageSize: 80, page: 1 })
        .then((result) => {
          if (cancelled) return;
          setUsers(
            result.items
              .filter((user) => !excludedUserIds.has(String(user.id)))
              .map((user) => ({
                ...user,
                avatar_url: resolveListUserAvatarSrc(user),
              })),
          );
        })
        .catch(() => {
          if (!cancelled) setUsers([]);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, search, excludedUserIds]);

  const selectedCount = selectedIds.size;

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => personLabel(a).localeCompare(personLabel(b)));
  }, [users]);

  if (!open) return null;

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    if (selectedCount === 0) {
      setError('Select at least one person.');
      return;
    }
    setError(null);
    const ids = Array.from(selectedIds)
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0);
    try {
      await onAdd(ids);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add people.');
    }
  };

  return (
    <CreateEditModalShell
      size="maximized"
      title={(
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-violet-200 bg-violet-50 text-violet-600">
            <Users className="h-3.5 w-3.5" aria-hidden />
          </span>
          <span className="truncate">Add people</span>
        </span>
      )}
      subtitle={(
        <span className="text-xs text-slate-500">
          Search and select people to assign to this node.
          {selectedCount > 0 ? ` · ${selectedCount} selected` : ''}
        </span>
      )}
      onClose={onClose}
      onBackdropClick={busy ? undefined : onClose}
      closeOnEscape={!busy}
      shellClassName="flex flex-col overflow-hidden"
      bodyOuterClassName="flex min-h-0 flex-1 flex-col"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden !p-0"
      footer={(
        <>
          <AppButton intent="cancel" size="sm" disabled={busy} onClick={onClose}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton
            intent="primary"
            size="sm"
            disabled={busy || selectedCount === 0}
            onClick={() => void handleAdd()}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <UserPlus className="h-3.5 w-3.5" />
            )}
            Add {selectedCount > 0 ? `(${selectedCount})` : ''}
          </AppButton>
        </>
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 space-y-2 border-b border-slate-200 bg-slate-50/80 px-[15px] py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <UiInput
              size="sm"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or username…"
              ariaLabel="Search people"
              className="!ps-8"
              autoFocus
              aiAssist={false}
            />
          </div>
          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex h-full min-h-[12rem] items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching…
            </div>
          ) : sortedUsers.length === 0 ? (
            <div className="flex h-full min-h-[12rem] items-center justify-center px-4 text-sm text-slate-500">
              {search.trim() ? 'No matching people.' : 'No people available to add.'}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {sortedUsers.map((user) => {
                const id = String(user.id);
                const selected = selectedIds.has(id);
                const label = personLabel(user);
                return (
                  <li key={id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => toggle(id)}
                      className={cn(
                        'flex w-full items-center gap-3 px-[15px] py-2.5 text-start transition-colors',
                        selected ? 'bg-violet-50/80' : 'hover:bg-slate-50',
                        busy && 'opacity-60',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                          selected
                            ? 'border-violet-500 bg-violet-500 text-white'
                            : 'border-slate-300 bg-white text-transparent',
                        )}
                        aria-hidden
                      >
                        <Check className="h-3 w-3" />
                      </span>
                      <OrgGeoPersonAvatar
                        size="md"
                        src={user.avatar_url}
                        label={label}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800">
                          {label}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500">
                          @{user.username}
                          {user.email ? ` · ${user.email}` : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </CreateEditModalShell>
  );
};
