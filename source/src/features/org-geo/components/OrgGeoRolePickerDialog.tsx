import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Search, Shield, UserPlus, X } from 'lucide-react';
import { useRolesListQuery } from '../../../shared/api/queries/roles';
import {
  AppButton,
  CreateEditModalShell,
  UiInput,
} from '../../../shared/ui';
import { cn } from '../../../lib/utils';

type OrgGeoRolePickerDialogProps = {
  open: boolean;
  excludedRoleNames: ReadonlySet<string>;
  busy?: boolean;
  onClose: () => void;
  onAdd: (roleNames: string[]) => Promise<void>;
};

export const OrgGeoRolePickerDialog: React.FC<OrgGeoRolePickerDialogProps> = ({
  open,
  excludedRoleNames,
  busy = false,
  onClose,
  onAdd,
}) => {
  const rolesQuery = useRolesListQuery();
  const [search, setSearch] = useState('');
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setSelectedNames(new Set());
    setError(null);
  }, [open]);

  const filteredRoles = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (rolesQuery.data ?? [])
      .filter((role) => !excludedRoleNames.has(role.name))
      .filter((role) => {
        if (!needle) return true;
        return [role.name, role.note || ''].join(' ').toLowerCase().includes(needle);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [excludedRoleNames, rolesQuery.data, search]);

  if (!open) return null;

  const selectedCount = selectedNames.size;

  const toggle = (name: string) => {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleAdd = async () => {
    if (selectedCount === 0) {
      setError('Select at least one role.');
      return;
    }
    setError(null);
    try {
      await onAdd(Array.from(selectedNames));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add roles.');
    }
  };

  return (
    <CreateEditModalShell
      size="lg"
      title={(
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700">
            <Shield className="h-3.5 w-3.5" aria-hidden />
          </span>
          <span className="truncate">Add roles</span>
        </span>
      )}
      subtitle={(
        <span className="text-xs text-slate-500">
          Roles assigned here grant this node to all users who have that role.
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
              placeholder="Search roles…"
              ariaLabel="Search roles"
              className="!ps-8"
              autoFocus
              aiAssist={false}
            />
          </div>
          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {rolesQuery.isLoading ? (
            <div className="flex h-full min-h-[12rem] items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading roles…
            </div>
          ) : filteredRoles.length === 0 ? (
            <div className="flex h-full min-h-[12rem] items-center justify-center px-4 text-sm text-slate-500">
              {search.trim() ? 'No matching roles.' : 'No roles available to add.'}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filteredRoles.map((role) => {
                const selected = selectedNames.has(role.name);
                return (
                  <li key={role.name}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => toggle(role.name)}
                      className={cn(
                        'flex w-full items-center gap-3 px-[15px] py-2.5 text-start transition-colors',
                        selected ? 'bg-emerald-50/80' : 'hover:bg-slate-50',
                        busy && 'opacity-60',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                          selected
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-slate-300 bg-white text-transparent',
                        )}
                        aria-hidden
                      >
                        <Check className="h-3 w-3" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800">
                          {role.name}
                        </span>
                        {role.note ? (
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            {role.note}
                          </span>
                        ) : null}
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
