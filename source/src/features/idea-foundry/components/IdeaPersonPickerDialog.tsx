import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Search, UserPlus, Users, X } from 'lucide-react';
import { resolveListUserAvatarSrc } from '../../../shared/api/contracts/users/avatar';
import type { IdeaTeamPerson } from '../../../shared/api/contracts/idea-foundry/types';
import { fetchUsersList, type UserRecord } from '../../../shared/api/queries/users';
import { formatProfileDisplayName } from '../../../shared/profile/profileDisplayName';
import {
  AppButton,
  CreateEditModalShell,
  DIALOG_NESTED_BACKDROP_Z_CLASS,
  UiAvatar,
  UiInput,
} from '../../../shared/ui';
import { cn } from '../../../lib/utils';

type IdeaPersonPickerDialogProps = {
  open: boolean;
  title: string;
  multiple: boolean;
  excludedUserIds: ReadonlySet<number>;
  onClose: () => void;
  onPick: (people: IdeaTeamPerson[]) => void;
};

const toTeamPerson = (user: UserRecord): IdeaTeamPerson => {
  const displayName = formatProfileDisplayName(user) || user.username;
  return {
    userId: user.id,
    displayName,
    username: user.username,
    avatarUrl: resolveListUserAvatarSrc(user),
  };
};

export const IdeaPersonPickerDialog: React.FC<IdeaPersonPickerDialogProps> = ({
  open,
  title,
  multiple,
  excludedUserIds,
  onClose,
  onPick,
}) => {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setSelectedIds(new Set());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setIsLoading(true);
      void fetchUsersList({ search: search.trim() || undefined, pageSize: 80, page: 1 })
        .then((result) => {
          if (cancelled) return;
          setUsers(result.items.filter((user) => !excludedUserIds.has(user.id)));
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
  }, [excludedUserIds, open, search]);

  const sortedUsers = useMemo(
    () => [...users].sort((left, right) => (
      (formatProfileDisplayName(left) || left.username).localeCompare(formatProfileDisplayName(right) || right.username)
    )),
    [users],
  );

  if (!open) return null;

  const toggle = (id: number) => {
    if (!multiple) {
      const user = users.find((item) => item.id === id);
      if (user) onPick([toTeamPerson(user)]);
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    const people = users.filter((user) => selectedIds.has(user.id)).map(toTeamPerson);
    if (people.length === 0) return;
    onPick(people);
  };

  return (
    <CreateEditModalShell
      size="lg"
      backdropClassName={DIALOG_NESTED_BACKDROP_Z_CLASS}
      title={(
        <span className="flex min-w-0 items-center gap-2">
          <Users className="h-3.5 w-3.5 text-slate-500" aria-hidden />
          <span className="truncate">{title}</span>
        </span>
      )}
      onClose={onClose}
      onBackdropClick={onClose}
      footer={(
        <>
          <AppButton intent="cancel" size="sm" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          {multiple ? (
            <AppButton intent="primary" size="sm" disabled={selectedIds.size === 0} onClick={handleAdd}>
              <UserPlus className="h-3.5 w-3.5" />
              Add{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
            </AppButton>
          ) : null}
        </>
      )}
    >
      <div className="flex flex-col gap-3">
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
        {isLoading ? (
          <div className="flex h-40 items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching…
          </div>
        ) : sortedUsers.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-slate-500">
            {search.trim() ? 'No matching people.' : 'No people available to add.'}
          </div>
        ) : (
          <ul className="max-h-[22rem] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
            {sortedUsers.map((user) => {
              const selected = selectedIds.has(user.id);
              const person = toTeamPerson(user);
              return (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => toggle(user.id)}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2.5 text-start transition-colors',
                      selected ? 'bg-indigo-50/80' : 'hover:bg-slate-50',
                    )}
                  >
                    {multiple ? (
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                          selected
                            ? 'border-indigo-500 bg-indigo-500 text-white'
                            : 'border-slate-300 bg-white text-transparent',
                        )}
                        aria-hidden
                      >
                        <Check className="h-3 w-3" />
                      </span>
                    ) : null}
                    <UiAvatar
                      size="sm"
                      src={person.avatarUrl ?? undefined}
                      alt=""
                      fallback={(person.displayName || '?').slice(0, 1).toUpperCase()}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">{person.displayName}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">@{person.username}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </CreateEditModalShell>
  );
};
