import React, { useEffect, useMemo, useState } from 'react';
import { Check, Globe, ListFilter, Plus, UserCheck, X } from 'lucide-react';
import type { FunctionAccessControl, FunctionAccessMode, FunctionAccessListField } from '../api/contracts/server-functions/accessControl';
import {
  addFunctionAccessListEntry,
  normalizeFunctionAccessControl,
  removeFunctionAccessListEntry,
} from '../api/contracts/server-functions/accessControl';
import { useRolesListQuery } from '../api/queries/roles';
import { useUsersListQuery } from '../api/queries/users';
import { cn } from '../../lib/utils';
import { AccessControlActionIcon } from './accessControlAction';
import { AccessEntityPickerDialog } from './AccessEntityPickerDialog';
import { AppButton } from './AppButton';
import { CreateEditModalShell } from './CreateEditModalShell';
import { QueryErrorPanel } from './QueryErrorPanel';
import { UiOptionCardGroup, type UiOptionCardIcon } from './UiOptionCardGroup';

const ACCESS_MODE_OPTIONS: Array<{
  value: FunctionAccessMode;
  title: string;
  description: string;
  icon: UiOptionCardIcon;
}> = [
  {
    value: 'public',
    title: 'Public',
    description: 'No login required. Anonymous and signed-in callers can invoke this route.',
    icon: Globe,
  },
  {
    value: 'authenticated',
    title: 'Logged in users',
    description: 'Caller must be signed in. Any authenticated user can access this route.',
    icon: UserCheck,
  },
  {
    value: 'specific',
    title: 'Specific',
    description: 'Use allow/deny lists for roles and users. Deny rules override allow rules.',
    icon: ListFilter,
  },
];

type AccessColumnConfig = {
  field: FunctionAccessListField;
  title: string;
  tone: 'allow' | 'deny';
  pickerTitle: string;
  emptyMessage: string;
};

const ACCESS_COLUMNS: AccessColumnConfig[] = [
  {
    field: 'allowRoles',
    title: 'Allowed Roles',
    tone: 'allow',
    pickerTitle: 'Add allowed role',
    emptyMessage: 'No roles available to add.',
  },
  {
    field: 'allowUsers',
    title: 'Allowed Users',
    tone: 'allow',
    pickerTitle: 'Add allowed user',
    emptyMessage: 'No users available to add.',
  },
  {
    field: 'denyRoles',
    title: 'Denied Roles',
    tone: 'deny',
    pickerTitle: 'Add denied role',
    emptyMessage: 'No roles available to add.',
  },
  {
    field: 'denyUsers',
    title: 'Denied Users',
    tone: 'deny',
    pickerTitle: 'Add denied user',
    emptyMessage: 'No users available to add.',
  },
];

export type AccessControlModalProps = {
  open: boolean;
  titlePath: string;
  accessControl: FunctionAccessControl;
  disabled?: boolean;
  isSaving?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: () => void | Promise<void>;
  onChange: (accessControl: FunctionAccessControl) => void;
};

export const AccessControlModal: React.FC<AccessControlModalProps> = ({
  open,
  titlePath,
  accessControl,
  disabled = false,
  isSaving = false,
  error = null,
  onClose,
  onSave,
  onChange,
}) => {
  const rolesQuery = useRolesListQuery();
  const usersQuery = useUsersListQuery({});
  const [activePicker, setActivePicker] = useState<FunctionAccessListField | null>(null);

  useEffect(() => {
    if (!open) {
      setActivePicker(null);
    }
  }, [open]);

  const normalized = normalizeFunctionAccessControl(accessControl);
  const mode = normalized.accessMode ?? 'authenticated';
  const isSpecific = mode === 'specific';
  const userItems = usersQuery.data?.items ?? [];

  const rolePickerItems = useMemo(
    () => (rolesQuery.data ?? [])
      .map((role) => role.name.trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
      .map((name) => ({
        value: name.toUpperCase(),
        label: name,
      })),
    [rolesQuery.data],
  );

  const userPickerItems = useMemo(
    () => userItems
      .map((user) => {
        const value = (user.email?.trim() || String(user.id)).trim();
        const label = user.username?.trim() || user.email?.trim() || `User #${user.id}`;
        const detail = user.email?.trim() && user.username?.trim() ? user.email.trim() : undefined;
        return { value, label, detail };
      })
      .filter((item) => item.value)
      .sort((left, right) => left.label.localeCompare(right.label)),
    [userItems],
  );

  const updateMode = (nextMode: FunctionAccessMode) => {
    onChange(normalizeFunctionAccessControl({
      ...accessControl,
      accessMode: nextMode,
    }));
  };

  const addListItem = (field: FunctionAccessListField, rawValue: string) => {
    onChange(addFunctionAccessListEntry(accessControl, field, rawValue));
  };

  const removeListItem = (field: FunctionAccessListField, index: number) => {
    onChange(removeFunctionAccessListEntry(accessControl, field, index));
  };

  const activeColumn = ACCESS_COLUMNS.find((column) => column.field === activePicker) ?? null;
  const activePickerItems = activePicker?.endsWith('Roles') ? rolePickerItems : userPickerItems;
  const activeExcludedValues = useMemo(() => {
    if (!activePicker) {
      return new Set<string>();
    }
    return new Set(normalized[activePicker] || []);
  }, [activePicker, normalized]);

  if (!open) {
    return null;
  }

  const dialogTitle = `Access — ${titlePath}`;
  const accessModeHeader = (
    <UiOptionCardGroup
      value={mode}
      onChange={(value) => updateMode(value as FunctionAccessMode)}
      disabled={disabled || isSaving}
      ariaLabel="Access mode"
      columns={3}
      density="compact"
      className="w-full"
      options={ACCESS_MODE_OPTIONS.map((option) => ({
        value: option.value,
        title: option.title,
        description: option.description,
        icon: option.icon,
      }))}
    />
  );

  return (
    <>
      <CreateEditModalShell
        title={(
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-cyan-200 bg-cyan-50 text-cyan-600">
              <AccessControlActionIcon className="h-3.5 w-3.5" />
            </span>
            <span className="truncate">{dialogTitle}</span>
          </span>
        )}
        ariaLabel={dialogTitle}
        subtitle={accessModeHeader}
        size="maximized"
        headerClassName="!bg-slate-50/80 ![background-image:none]"
        subtitleClassName="!overflow-visible !text-inherit"
        shellClassName="flex min-h-0 flex-col overflow-hidden"
        bodyOuterClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden !min-h-0 !p-0"
        footerClassName="!mt-0"
        onClose={onClose}
        onBackdropClick={onClose}
        footer={(
          <>
            <AppButton intent="cancel" size="sm" onClick={onClose} disabled={isSaving}>
              <X className="h-3.5 w-3.5" />
              Cancel
            </AppButton>
            <AppButton
              intent="primary"
              size="sm"
              disabled={disabled || isSaving}
              onClick={() => void onSave()}
            >
              <Check className="h-3.5 w-3.5" />
              {isSaving ? 'Saving...' : 'Save Access'}
            </AppButton>
          </>
        )}
      >
        <div className="flex h-full min-h-0 flex-col bg-white">
          {error ? (
            <div className="shrink-0 p-[15px] pb-0">
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error}
              </div>
            </div>
          ) : null}

          {rolesQuery.isError ? (
            <div className="shrink-0 p-[15px] pb-0">
              <QueryErrorPanel
                message="Failed to load roles."
                detail={rolesQuery.error instanceof Error ? rolesQuery.error.message : 'Could not load roles.'}
                onRetry={() => { void rolesQuery.refetch(); }}
              />
            </div>
          ) : null}

          {usersQuery.isError ? (
            <div className="shrink-0 p-[15px] pb-0">
              <QueryErrorPanel
                message="Failed to load users."
                detail={usersQuery.error instanceof Error ? usersQuery.error.message : 'Could not load users.'}
                onRetry={() => { void usersQuery.refetch(); }}
              />
            </div>
          ) : null}

          <div className="grid min-h-0 flex-1 grid-cols-4 gap-2 p-[15px]">
          {ACCESS_COLUMNS.map((column) => {
            const items = normalized[column.field] || [];
            const columnDisabled = disabled || isSaving || !isSpecific;
            return (
              <div
                key={column.field}
                className={cn(
                  'flex min-h-0 flex-col rounded-lg border bg-white',
                  column.tone === 'allow' ? 'border-emerald-200' : 'border-rose-200',
                  columnDisabled && 'opacity-60',
                )}
              >
                <div className={cn(
                  'flex h-9 shrink-0 items-center justify-between border-b px-3',
                  column.tone === 'allow'
                    ? 'border-emerald-100 bg-emerald-50/70'
                    : 'border-rose-100 bg-rose-50/70',
                )}
                >
                  <span className={cn(
                    'text-[10px] font-bold uppercase tracking-wider',
                    column.tone === 'allow' ? 'text-emerald-800' : 'text-rose-800',
                  )}
                  >
                    {column.title}
                  </span>
                  <AppButton
                    type="button"
                    intent="secondary"
                    size="icon-sm"
                    aria-label={column.pickerTitle}
                    title={column.pickerTitle}
                    disabled={columnDisabled}
                    onClick={() => setActivePicker(column.field)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </AppButton>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                  {items.length === 0 ? (
                    <p className="px-1 py-2 text-xs text-slate-400">
                      {isSpecific ? 'No entries yet.' : 'Select Specific mode to edit.'}
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {items.map((item, index) => (
                        <div
                          key={`${column.field}-${item}-${index}`}
                          className={cn(
                            'flex items-center justify-between rounded border px-2 py-1.5 font-mono text-[11px] font-medium',
                            column.tone === 'allow'
                              ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
                              : 'border-rose-100 bg-rose-50 text-rose-800',
                          )}
                        >
                          <span className="min-w-0 truncate">{item}</span>
                          {!columnDisabled ? (
                            <button
                              type="button"
                              aria-label={`Remove ${item}`}
                              className={cn(
                                'ml-1 shrink-0 rounded p-0.5',
                                column.tone === 'allow'
                                  ? 'text-emerald-500 hover:bg-emerald-100 hover:text-emerald-800'
                                  : 'text-rose-500 hover:bg-rose-100 hover:text-rose-800',
                              )}
                              onClick={() => removeListItem(column.field, index)}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </CreateEditModalShell>

      {activeColumn ? (
        <AccessEntityPickerDialog
          open
          title={activeColumn.pickerTitle}
          items={activePickerItems}
          excludedValues={activeExcludedValues}
          isLoading={activePicker?.endsWith('Roles') ? rolesQuery.isLoading : usersQuery.isLoading}
          emptyMessage={activeColumn.emptyMessage}
          onClose={() => setActivePicker(null)}
          onSelect={(value) => addListItem(activeColumn.field, value)}
        />
      ) : null}
    </>
  );
};