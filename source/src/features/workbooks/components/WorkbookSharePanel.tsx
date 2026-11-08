import React, { useMemo, useState } from 'react';
import { Check, Copy, Globe, Link2, ListFilter, Plus, UserCheck, X } from 'lucide-react';
import type { FunctionAccessControl, FunctionAccessMode } from '../../../shared/api/contracts/server-functions/accessControl';
import {
  addFunctionAccessListEntry,
  normalizeFunctionAccessControl,
  removeFunctionAccessListEntry,
} from '../../../shared/api/contracts/server-functions/accessControl';
import type { WorkbookAccessPermission } from '../../../shared/api/contracts/workbooks/access';
import { PRIVATE_WORKBOOK_ACCESS_CONTROL } from '../../../shared/api/contracts/workbooks/access';
import type { WorkbookRecord, WorkbookSharedMember } from '../../../shared/api/contracts/workbooks/types';
import {
  useResolveWorkbookUsernameMutation,
  useUpdateWorkbookAccessMutation,
} from '../../../shared/api/queries/workbooks';
import { formatApiErrorMessage, isApiError } from '../../../shared/api/client';
import {
  AppButton,
  CreateEditModalShell,
  FormField,
  FormSection,
  UiInput,
  UiOptionCardGroup,
  UiRadioChoiceList,
  showAppFeedbackToast,
  type UiOptionCardIcon,
} from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import { buildSharedWorkbookPath } from '../workbookRoute';

const ACCESS_MODE_OPTIONS: Array<{
  value: FunctionAccessMode;
  title: string;
  description: string;
  icon: UiOptionCardIcon;
}> = [
  {
    value: 'specific',
    title: 'Restricted',
    description: 'Only people you add by exact username.',
    icon: ListFilter,
  },
  {
    value: 'authenticated',
    title: 'Anyone signed in',
    description: 'Any signed-in platform user with the link.',
    icon: UserCheck,
  },
  {
    value: 'public',
    title: 'Anyone with the link',
    description: 'Anyone who has the link, even without signing in.',
    icon: Globe,
  },
];

type WorkbookSharePanelProps = {
  open: boolean;
  workbook: WorkbookRecord;
  onClose: () => void;
};

export const WorkbookSharePanel: React.FC<WorkbookSharePanelProps> = ({
  open,
  workbook,
  onClose,
}) => {
  const updateAccess = useUpdateWorkbookAccessMutation();
  const resolveUsername = useResolveWorkbookUsernameMutation();
  const [accessControl, setAccessControl] = useState<FunctionAccessControl>(
    workbook.accessControl ?? PRIVATE_WORKBOOK_ACCESS_CONTROL,
  );
  const [permission, setPermission] = useState<WorkbookAccessPermission>(workbook.accessPermission ?? 'view');
  const [members, setMembers] = useState<WorkbookSharedMember[]>(workbook.sharedMembers ?? []);
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'found' | 'missing'>('idle');
  const [copied, setCopied] = useState(false);

  const mode = accessControl.accessMode ?? 'specific';
  const shareUrl = useMemo(
    () => `${window.location.origin}${buildSharedWorkbookPath(workbook.id)}`,
    [workbook.id],
  );

  if (!open) {
    return null;
  }

  const persist = (
    nextControl: FunctionAccessControl,
    nextPermission: WorkbookAccessPermission,
    nextMembers = members,
  ) => {
    setAccessControl(nextControl);
    setPermission(nextPermission);
    setMembers(nextMembers);
    void updateAccess.mutateAsync({
      id: workbook.id,
      accessControl: nextControl,
      permission: nextPermission,
    }).then((item) => {
      setAccessControl(item.accessControl);
      setPermission(item.accessPermission);
      setMembers(item.sharedMembers);
    }).catch((error: unknown) => {
      showAppFeedbackToast(
        isApiError(error) ? formatApiErrorMessage(error) : error instanceof Error ? error.message : 'Failed to update sharing.',
        { type: 'error' },
      );
    });
  };

  const addUsername = () => {
    const value = username.trim();
    if (!value) {
      return;
    }
    void resolveUsername.mutateAsync(value).then((result) => {
      if (!result.exists || !result.accessKey) {
        setUsernameStatus('missing');
        return;
      }
      setUsernameStatus('found');
      const nextControl = addFunctionAccessListEntry(accessControl, 'allowUsers', result.accessKey);
      const nextMembers = nextControl.allowUsers.includes(result.accessKey)
        && !members.some((member) => member.key.toLowerCase() === result.accessKey?.toLowerCase())
        ? [...members, {
          key: result.accessKey,
          userId: result.userId ?? 0,
          username: result.username ?? value,
          displayName: result.displayName ?? result.username ?? value,
          avatar: result.avatar ?? null,
        }]
        : members;
      setUsername('');
      persist(nextControl, permission, nextMembers);
    }).catch(() => {
      setUsernameStatus('missing');
    });
  };

  return (
    <CreateEditModalShell
      size="lg"
      title="Share workbook"
      onClose={onClose}
      onBackdropClick={onClose}
      footer={(
        <AppButton intent="primary" onClick={onClose}>
          <Check className="h-3.5 w-3.5" />
          Done
        </AppButton>
      )}
    >
      <div className="flex min-h-[28rem] flex-col gap-4">
        <FormSection title="Who can open" hint="Choose who the link works for." ink="accent">
          <UiOptionCardGroup
            ariaLabel="Workbook access"
            value={mode}
            density="compact"
            columns={1}
            options={ACCESS_MODE_OPTIONS}
            onChange={(value) => {
              persist(normalizeFunctionAccessControl({
                ...accessControl,
                accessMode: value as FunctionAccessMode,
              }), permission);
            }}
          />
        </FormSection>

        <FormSection title="Permission" hint="Applies to everyone who can open this workbook, except you." ink="complement">
          <UiRadioChoiceList
            ariaLabel="Workbook permission"
            orientation="horizontal"
            value={permission}
            onChange={(value) => persist(accessControl, value as WorkbookAccessPermission)}
            options={[
              { value: 'view', label: 'Can view' },
              { value: 'edit', label: 'Can edit' },
            ]}
          />
        </FormSection>

        <FormSection
          title="Public link"
          hint={
            mode === 'public'
              ? 'Anyone with this address can open the workbook, even without signing in.'
              : mode === 'authenticated'
                ? 'Any signed-in platform user with this address can open the workbook.'
                : 'Choose Anyone signed in or Anyone with the link to enable this address.'
          }
          ink="contrast"
        >
          <fieldset disabled={mode === 'specific'} className="min-w-0 border-0 p-0">
            <div className="flex items-center gap-2">
              <UiInput
                size="sm"
                value={shareUrl}
                readOnly
                disabled={mode === 'specific'}
                autoDir={false}
                aiAssist={false}
                ariaLabel="Share link"
              />
              <AppButton
                size="sm"
                intent="secondary"
                disabled={mode === 'specific'}
                className="h-9 min-w-[7.5rem] shrink-0 px-4 text-sm"
                onClick={() => {
                  void navigator.clipboard.writeText(shareUrl).then(() => {
                    setCopied(true);
                    showAppFeedbackToast('Link copied.', { type: 'success' });
                    window.setTimeout(() => setCopied(false), 1600);
                  }).catch(() => {
                    showAppFeedbackToast('Could not copy the link.', { type: 'error' });
                  });
                }}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy link'}
              </AppButton>
            </div>
          </fieldset>
        </FormSection>

        <FormSection
          title="People"
          count={members.length}
          hint="Type the exact username. No suggestions are shown."
          ink="complement"
        >
          <fieldset disabled={mode !== 'specific'} className="min-w-0 border-0 p-0">
            <FormField
              label="Username"
              invalid={usernameStatus === 'missing'}
            >
              <div className="flex items-center gap-2">
                <UiInput
                  size="sm"
                  value={username}
                  disabled={mode !== 'specific'}
                  autoComplete="off"
                  autoDir={false}
                  aiAssist={false}
                  ariaLabel="Exact username"
                  placeholder="exact username"
                  className={cn(
                    usernameStatus === 'found' && 'border-emerald-400 focus-visible:ring-emerald-200',
                    usernameStatus === 'missing' && 'border-rose-400',
                  )}
                  onChange={(event) => {
                    setUsername(event.target.value);
                    setUsernameStatus('idle');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addUsername();
                    }
                  }}
                  onBlur={() => {
                    if (username.trim()) {
                      addUsername();
                    }
                  }}
                />
                <AppButton
                  size="sm"
                  intent="secondary"
                  disabled={mode !== 'specific' || resolveUsername.isPending || !username.trim()}
                  onClick={addUsername}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </AppButton>
              </div>
            </FormField>
            <p className={cn(
              'min-h-4 text-xs font-medium',
              usernameStatus === 'missing' && 'text-rose-600',
              usernameStatus === 'found' && 'text-emerald-700',
              usernameStatus === 'idle' && 'text-transparent',
            )}
            >
              {usernameStatus === 'missing'
                ? 'This username was not found.'
                : usernameStatus === 'found'
                  ? 'Person added.'
                  : ' '}
            </p>

            <ul className="mt-2 flex min-h-[5.5rem] flex-col gap-1.5">
              {members.length === 0 ? (
                <li className="text-xs font-medium text-slate-500">No people added yet.</li>
              ) : members.map((member) => (
                <li
                  key={member.key}
                  className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5"
                >
                  {member.avatar ? (
                    <img
                      src={member.avatar}
                      alt=""
                      className="h-6 w-6 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-700">
                      {member.displayName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700">
                    {member.displayName}
                    <span className="ml-1 font-medium text-slate-400">@{member.username}</span>
                  </span>
                  <AppButton
                    size="icon-sm"
                    intent="cancel"
                    disabled={mode !== 'specific'}
                    aria-label={`Remove ${member.displayName}`}
                    onClick={() => {
                      const accessIndex = accessControl.allowUsers.findIndex(
                        (entry) => entry.toLowerCase() === member.key.toLowerCase(),
                      );
                      persist(
                        removeFunctionAccessListEntry(accessControl, 'allowUsers', accessIndex),
                        permission,
                        members.filter((item) => item.key !== member.key),
                      );
                    }}
                  >
                    <X className="h-3 w-3" />
                  </AppButton>
                </li>
              ))}
            </ul>
          </fieldset>
        </FormSection>

        <p className={cn(
          'flex items-center gap-1.5 text-[11px] font-medium',
          mode === 'specific' ? 'text-slate-500' : 'text-slate-300',
        )}
        >
          <Link2 className="h-3 w-3" />
          People you add open this workbook from My Workbooks → Shared with me.
        </p>
      </div>
    </CreateEditModalShell>
  );
};
