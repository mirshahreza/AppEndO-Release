import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Search, Shield, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { FunctionAccessEntityKind } from '../../../shared/api/contracts/server-functions/entityAccess';
import { resolveListUserAvatarSrc } from '../../../shared/api/contracts/users/avatar';
import { fetchUsersList, type UserRecord } from '../../../shared/api/queries/users';
import { useRolesListQuery } from '../../../shared/api/queries/roles';
import { formatProfileDisplayName } from '../../../shared/profile/profileDisplayName';
import {
  isFunctionAccessAclSubjectRoleExcluded,
  isFunctionAccessAclSubjectUserExcluded,
} from '../../../shared/lib/server-functions/functionAccessBypass';
import { cn } from '../../../lib/utils';
import { UiAvatar, UiInput } from '../../../shared/ui';
import {
  ACCESS_ASSISTANT_FIELD_LABEL_CLASS,
  ACCESS_ASSISTANT_PICKER_LIST_CLASS,
  ACCESS_ASSISTANT_SUBJECT_TYPE_GRID_CLASS,
  resolveAccessAssistantPickerRowClass,
  resolveAccessAssistantSubjectTypeCardClass,
} from '../lib/accessAssistantWizardChrome';

export type AccessAssistantSubjectStepProps = {
  wizardOpen: boolean;
  entityKind: FunctionAccessEntityKind | null;
  onEntityKindChange: (kind: FunctionAccessEntityKind) => void;
  entityKey: string | null;
  onEntitySelect: (key: string, label: string) => void;
};

type SubjectTypeOption = {
  value: FunctionAccessEntityKind;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const SubjectSearchField: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
}> = ({ value, onChange, placeholder, ariaLabel }) => (
  <div className="relative shrink-0">
    <Search
      className="pointer-events-none absolute start-2.5 top-1/2 z-[1] h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
      aria-hidden
    />
    <UiInput
      size="sm"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      ariaLabel={ariaLabel}
      className="!ps-8"
      aiAssist={false}
    />
  </div>
);

const SUBJECT_TYPE_OPTIONS: readonly SubjectTypeOption[] = [
  {
    value: 'user',
    title: 'User',
    description: 'Direct access for one account',
    icon: User,
  },
  {
    value: 'role',
    title: 'Role',
    description: 'Access shared by everyone in the role',
    icon: Shield,
  },
];

const SubjectTypeCards: React.FC<{
  value: FunctionAccessEntityKind | null;
  onChange: (value: FunctionAccessEntityKind) => void;
}> = ({ value, onChange }) => (
  <div className="flex shrink-0 flex-col gap-2">
    <p className={ACCESS_ASSISTANT_FIELD_LABEL_CLASS}>Subject type</p>
    <div className={ACCESS_ASSISTANT_SUBJECT_TYPE_GRID_CLASS} role="radiogroup" aria-label="Subject type">
      {SUBJECT_TYPE_OPTIONS.map((option) => {
        const selected = value === option.value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={resolveAccessAssistantSubjectTypeCardClass(selected)}
          >
            {selected ? (
              <span
                className="absolute end-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-white"
                aria-hidden
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
            ) : null}
            <div className="flex flex-col gap-2 px-4 py-4 pe-10">
              <Icon
                className={cn(
                  'h-5 w-5',
                  selected ? 'text-primary-700' : 'text-slate-500',
                )}
                aria-hidden
              />
              <div>
                <p className="text-base font-semibold text-slate-900">{option.title}</p>
                <p className="mt-1 text-xs leading-snug text-slate-600">{option.description}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  </div>
);

const UserSubjectPicker: React.FC<{
  wizardOpen: boolean;
  selectedKey: string | null;
  onSelect: (key: string, label: string) => void;
}> = ({ wizardOpen, selectedKey, onSelect }) => {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (!wizardOpen) {
      setSearch('');
      setDebouncedSearch('');
    }
  }, [wizardOpen]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const usersQuery = useQuery({
    queryKey: ['access-assistant', 'subject-users', debouncedSearch],
    queryFn: ({ signal }) =>
      fetchUsersList(
        { page: 1, pageSize: 80, search: debouncedSearch || undefined },
        signal,
      ),
    enabled: wizardOpen,
    staleTime: 30_000,
  });

  const users = useMemo(
    () =>
      (usersQuery.data?.items ?? []).filter(
        (user) => !isFunctionAccessAclSubjectUserExcluded({
          username: user.username,
          is_builtin: user.is_builtin,
          roles: user.roles,
        }),
      ),
    [usersQuery.data?.items],
  );

  const sortedUsers = useMemo(
    () =>
      [...users].sort((left, right) => {
        const leftLabel = formatProfileDisplayName(left) || left.username;
        const rightLabel = formatProfileDisplayName(right) || right.username;
        return leftLabel.localeCompare(rightLabel);
      }),
    [users],
  );

  const resolveUserLabel = (user: UserRecord) =>
    formatProfileDisplayName(user) || user.username;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className={ACCESS_ASSISTANT_FIELD_LABEL_CLASS}>Select user</p>
      <SubjectSearchField
        value={search}
        onChange={setSearch}
        placeholder="Search user by name or email…"
        ariaLabel="Search users"
      />
      {usersQuery.isLoading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading users…
        </div>
      ) : sortedUsers.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 px-4 text-center text-sm text-slate-500">
          {search.trim() ? 'No users match your search.' : 'No users available.'}
        </div>
      ) : (
        <ul
          className={cn(ACCESS_ASSISTANT_PICKER_LIST_CLASS, 'min-h-0 flex-1 overflow-y-auto')}
          role="listbox"
          aria-label="Users"
        >
          {sortedUsers.map((user) => {
            const key = String(user.id);
            const selected = selectedKey === key;
            const displayName = resolveUserLabel(user);
            const avatarSrc = resolveListUserAvatarSrc(user);
            const secondary = user.email?.trim() || `@${user.username}`;
            return (
              <li key={user.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => onSelect(key, displayName)}
                  className={cn(resolveAccessAssistantPickerRowClass(selected), 'items-center')}
                >
                  <UiAvatar
                    size="sm"
                    src={avatarSrc ?? undefined}
                    alt=""
                    fallback={displayName.slice(0, 1).toUpperCase()}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">{displayName}</span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">{secondary}</span>
                  </span>
                  {selected ? (
                    <Check className="h-4 w-4 shrink-0 text-primary-600" aria-hidden />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const RoleSubjectPicker: React.FC<{
  selectedKey: string | null;
  onSelect: (key: string, label: string) => void;
}> = ({ selectedKey, onSelect }) => {
  const rolesQuery = useRolesListQuery();
  const [search, setSearch] = useState('');

  const roles = rolesQuery.data ?? [];
  const filteredRoles = useMemo(() => {
    const term = search.trim().toLowerCase();
    const assignable = roles.filter((role) => !isFunctionAccessAclSubjectRoleExcluded(role.name));
    const list = term
      ? assignable.filter((role) => role.name.toLowerCase().includes(term))
      : assignable;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [roles, search]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className={ACCESS_ASSISTANT_FIELD_LABEL_CLASS}>Select role</p>
      <SubjectSearchField
        value={search}
        onChange={setSearch}
        placeholder="Search role by name…"
        ariaLabel="Search roles"
      />
      {rolesQuery.isLoading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading roles…
        </div>
      ) : filteredRoles.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 px-4 text-center text-sm text-slate-500">
          {search.trim() ? 'No roles match your search.' : 'No roles available.'}
        </div>
      ) : (
        <ul
          className={cn(ACCESS_ASSISTANT_PICKER_LIST_CLASS, 'min-h-0 flex-1 overflow-y-auto')}
          role="listbox"
          aria-label="Roles"
        >
          {filteredRoles.map((role) => {
            const selected = selectedKey === role.name;
            return (
              <li key={role.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => onSelect(role.name, role.name)}
                  className={cn(resolveAccessAssistantPickerRowClass(selected), 'items-center')}
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border',
                      selected
                        ? 'border-primary-200 bg-primary-subtle/60 text-primary-700'
                        : 'border-slate-200 bg-slate-50 text-slate-500',
                    )}
                    aria-hidden
                  >
                    <Shield className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">{role.name}</span>
                    {role.note?.trim() ? (
                      <span className="mt-0.5 block truncate text-xs text-slate-500">{role.note}</span>
                    ) : null}
                  </span>
                  {selected ? (
                    <Check className="h-4 w-4 shrink-0 text-primary-600" aria-hidden />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export const AccessAssistantSubjectStep: React.FC<AccessAssistantSubjectStepProps> = ({
  wizardOpen,
  entityKind,
  onEntityKindChange,
  entityKey,
  onEntitySelect,
}) => (
  <div className="flex min-h-0 flex-1 flex-col gap-6">
    <SubjectTypeCards
      value={entityKind}
      onChange={(kind) => {
        onEntityKindChange(kind);
      }}
    />

    {entityKind === 'user' ? (
      <UserSubjectPicker
        wizardOpen={wizardOpen}
        selectedKey={entityKey}
        onSelect={onEntitySelect}
      />
    ) : null}

    {entityKind === 'role' ? (
      <RoleSubjectPicker selectedKey={entityKey} onSelect={onEntitySelect} />
    ) : null}

    {!entityKind ? (
      <p className="text-center text-sm text-slate-500">
        Choose User or Role above to pick who receives access on this page.
      </p>
    ) : null}
  </div>
);
