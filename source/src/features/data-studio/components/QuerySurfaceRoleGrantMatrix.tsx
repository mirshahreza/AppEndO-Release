import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { QuerySurfaceGrant } from '../../../shared/api/contracts/data-api';
import { cn } from '../../../lib/utils';
import { AppButton, ToolbarSearchInput, UiCheckbox } from '../../../shared/ui';
import { MODELER_CAPTION_CLASS } from '../lib/modelerChipStyles';

export type QuerySurfaceGrantRow = {
  key: string;
  kind: 'preset' | 'column';
  title: string;
  detail?: string;
};

type QuerySurfaceRoleGrantMatrixProps = {
  rows: readonly QuerySurfaceGrantRow[];
  roles: readonly { name: string; note?: string | null }[];
  getGrant: (rowKey: string) => QuerySurfaceGrant;
  onToggle: (rowKey: string, roleName: string, checked: boolean) => void;
  onSetRowRoles: (rowKey: string, grant: QuerySurfaceGrant) => void;
  className?: string;
};

const grantIncludesRole = (grant: QuerySurfaceGrant, roleName: string): boolean => (
  grant.mode === 'roles'
  && (grant.roleIds ?? []).some((id) => id.toUpperCase() === roleName.toUpperCase())
);

const grantForRoleNames = (roleNames: readonly string[]): QuerySurfaceGrant => {
  const ids = roleNames.map((name) => name.trim()).filter(Boolean);
  if (ids.length === 0) {
    return { mode: 'public' };
  }
  return { mode: 'roles', roleIds: [...new Set(ids.map((id) => id.toUpperCase()))] };
};

const KIND_BADGE: Record<QuerySurfaceGrantRow['kind'], { label: string; className: string }> = {
  preset: { label: 'Preset', className: 'bg-indigo-50 text-indigo-700 ring-indigo-200/80' },
  column: { label: 'List filter', className: 'bg-slate-100 text-slate-700 ring-slate-200/80' },
};

export const QuerySurfaceRoleGrantMatrix: React.FC<QuerySurfaceRoleGrantMatrixProps> = ({
  rows,
  roles,
  getGrant,
  onToggle,
  onSetRowRoles,
  className,
}) => {
  const [roleSearch, setRoleSearch] = useState('');

  const sortedRoles = useMemo(
    () => [...roles].sort((a, b) => a.name.localeCompare(b.name)),
    [roles],
  );

  const visibleRoles = useMemo(() => {
    const needle = roleSearch.trim().toLowerCase();
    if (!needle) {
      return sortedRoles;
    }
    return sortedRoles.filter((role) => (
      role.name.toLowerCase().includes(needle)
      || (role.note?.trim().toLowerCase().includes(needle) ?? false)
    ));
  }, [roleSearch, sortedRoles]);

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex min-h-0 flex-col gap-3', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-[12rem] flex-1 sm:max-w-md">
          <p className={cn(MODELER_CAPTION_CLASS, 'mb-1.5')}>Filter roles</p>
          <ToolbarSearchInput
            value={roleSearch}
            onChange={setRoleSearch}
            placeholder="Search by role name or note…"
            ariaLabel="Search roles"
          />
        </div>
        <p className={MODELER_CAPTION_CLASS}>
          {visibleRoles.length === sortedRoles.length
            ? `${sortedRoles.length} role${sortedRoles.length === 1 ? '' : 's'}`
            : `${visibleRoles.length} of ${sortedRoles.length} roles`}
          {' · '}
          {rows.length} restricted surface{rows.length === 1 ? '' : 's'}
        </p>
      </div>

      {visibleRoles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
          No roles match your search. Clear the filter or create roles in Studio.
        </div>
      ) : (
        <div
          className="min-h-0 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm"
          style={{ maxHeight: 'min(52vh, 28rem)' }}
        >
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90">
                <th
                  scope="col"
                  className="sticky start-0 z-20 min-w-[11rem] max-w-[14rem] border-e border-slate-200 bg-slate-50/95 px-3 py-2 text-start text-[11px] font-semibold uppercase tracking-wide text-slate-600"
                >
                  Surface
                </th>
                {visibleRoles.map((role) => (
                  <th
                    key={role.name}
                    scope="col"
                    className="min-w-[5.5rem] max-w-[8rem] px-2 py-2 text-center align-bottom"
                    title={role.note?.trim() || role.name}
                  >
                    <span className="block truncate text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                      {role.name}
                    </span>
                  </th>
                ))}
                <th
                  scope="col"
                  className="sticky end-0 z-20 min-w-[7.5rem] border-s border-slate-200 bg-slate-50/95 px-2 py-2 text-end text-[11px] font-semibold uppercase tracking-wide text-slate-600"
                >
                  Row
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => {
                const grant = getGrant(row.key);
                const badge = KIND_BADGE[row.kind];
                const visibleRoleNames = visibleRoles.map((role) => role.name);
                const allVisibleSelected = visibleRoleNames.length > 0
                  && visibleRoleNames.every((name) => grantIncludesRole(grant, name));
                const anySelected = visibleRoleNames.some((name) => grantIncludesRole(grant, name));

                return (
                  <tr
                    key={row.key}
                    className={cn(
                      'border-b border-slate-100 last:border-b-0',
                      rowIndex % 2 === 1 ? 'bg-slate-50/40' : 'bg-white',
                    )}
                  >
                    <th
                      scope="row"
                      className={cn(
                        'sticky start-0 z-10 border-e border-slate-200 px-3 py-2.5 text-start align-top',
                        rowIndex % 2 === 1 ? 'bg-slate-50/95' : 'bg-white',
                      )}
                    >
                      <span
                        className={cn(
                          'mb-1 inline-flex rounded px-1.5 py-px text-[10px] font-semibold uppercase ring-1 ring-inset',
                          badge.className,
                        )}
                      >
                        {badge.label}
                      </span>
                      <span className="mt-1 block text-sm font-medium leading-snug text-slate-800">
                        {row.title}
                      </span>
                      {row.detail ? (
                        <span className="mt-0.5 block truncate font-mono text-[11px] text-slate-500" title={row.detail}>
                          {row.detail}
                        </span>
                      ) : null}
                    </th>
                    {visibleRoles.map((role) => {
                      const checked = grantIncludesRole(grant, role.name);
                      return (
                        <td key={`${row.key}-${role.name}`} className="px-2 py-2 text-center align-middle">
                          <div className="flex justify-center">
                            <UiCheckbox
                              checked={checked}
                              ariaLabel={`${row.title} — ${role.name}`}
                              onChange={(event) => {
                                onToggle(row.key, role.name, event.target.checked);
                              }}
                            />
                          </div>
                        </td>
                      );
                    })}
                    <td
                      className={cn(
                        'sticky end-0 z-10 border-s border-slate-200 px-2 py-2 text-end align-middle',
                        rowIndex % 2 === 1 ? 'bg-slate-50/95' : 'bg-white',
                      )}
                    >
                      <div className="flex flex-col items-end gap-1">
                        <AppButton
                          type="button"
                          intent="utility"
                          size="sm"
                          disabled={allVisibleSelected || visibleRoleNames.length === 0}
                          onClick={() => {
                            const merged = new Set((grant.roleIds ?? []).map((id) => id.toUpperCase()));
                            for (const name of visibleRoleNames) {
                              merged.add(name.toUpperCase());
                            }
                            onSetRowRoles(row.key, grantForRoleNames([...merged]));
                          }}
                        >
                          All shown
                        </AppButton>
                        <AppButton
                          type="button"
                          intent="utility"
                          size="sm"
                          disabled={!anySelected}
                          onClick={() => {
                            if (visibleRoleNames.length === sortedRoles.length) {
                              onSetRowRoles(row.key, { mode: 'public' });
                              return;
                            }
                            const remaining = (grant.roleIds ?? []).filter(
                              (id) => !visibleRoleNames.some((name) => name.toUpperCase() === id.toUpperCase()),
                            );
                            onSetRowRoles(row.key, grantForRoleNames(remaining));
                          }}
                        >
                          Clear shown
                        </AppButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className={cn(MODELER_CAPTION_CLASS, 'flex items-start gap-1.5')}>
        <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
        Scroll horizontally for more roles. Row actions apply only to roles currently shown in the filter.
      </p>
    </div>
  );
};
