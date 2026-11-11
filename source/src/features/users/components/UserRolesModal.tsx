import React, { useEffect, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { useCultureT } from '../../../core/culture/CultureContext';
import type { UserRecord } from '../../../shared/api/queries/users';
import { mergeRolePickerOptions } from '../../../shared/api/contracts/roles/roleNames';
import {
  RECORD_CHANGE_REASON_ROLE_ASSIGNMENT,
  USERS_ROLES_CHANGE_REASON,
  changeReasonValueSatisfiesPolicy,
} from '../../../shared/api/contracts/record-events';
import { useNamedApiChangeReasonPolicy } from '../../../shared/api/queries/namedApiChangeReason';
import {
  AppButton,
  ChangeReasonFields,
  ConfirmDialogShell,
  CreateEditModalShell,
  FieldHintTooltip,
  RecordEventHistoryDialog,
  recordEventHistoryFieldChromeToggle,
  useRecordSubjectTimelineCopy,
  emptyChangeReason,
  type ChangeReasonValue,
} from '../../../shared/ui';
import { useRecordSubjectHistory } from '../../../shared/lib/useRecordSubjectHistory';
import type { EditUserForm } from '../types';
import { normalizeRoleSelection, roleSelectionIncludes } from '../utils';
import { roleSetsEqual } from '../userProfileSaveReason';
import { UserFormRoleOption } from './userFormLayout';

export type UserRolesModalProps = {
  open: boolean;
  editingUser: UserRecord | null;
  editForm: EditUserForm;
  availableRoles: string[];
  editError: string | null;
  isSaving: boolean;
  onSetEditRoleChecked: (role: string, checked: boolean) => void;
  onClose: () => void;
  onSubmit: (reason: ChangeReasonValue) => void;
};

export const UserRolesModal: React.FC<UserRolesModalProps> = ({
  open,
  editingUser,
  editForm,
  availableRoles,
  editError,
  isSaving,
  onSetEditRoleChecked,
  onClose,
  onSubmit,
}) => {
  const t = useCultureT();
  const timelineCopy = useRecordSubjectTimelineCopy();
  const policy = useNamedApiChangeReasonPolicy('PUT', '/api/users/:id/roles', USERS_ROLES_CHANGE_REASON);
  const [baselineRoles, setBaselineRoles] = useState<string[]>([]);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState<ChangeReasonValue>({
    code: RECORD_CHANGE_REASON_ROLE_ASSIGNMENT,
    text: '',
  });
  const roleOptions = useMemo(
    () => mergeRolePickerOptions(availableRoles, editingUser?.roles ?? []),
    [availableRoles, editingUser?.roles],
  );
  const history = useRecordSubjectHistory({
    subjectKind: 'base_users',
    subjectId: editingUser?.id,
    trackedFields: ['roles'],
    enabled: open && Boolean(editingUser),
  });

  useEffect(() => {
    if (!open || !editingUser) return;
    setBaselineRoles(normalizeRoleSelection(editingUser.roles));
  }, [open, editingUser]);

  if (!open || !editingUser) return null;

  const rolesChanged = !roleSetsEqual(editForm.roles, baselineRoles);
  const reasonRequired = policy.reasonAsk === 'required';
  const canConfirm = changeReasonValueSatisfiesPolicy(reason, policy);

  const submitOrAskReason = () => {
    if (!rolesChanged) return;
    if (policy.reasonAsk === 'required') {
      setReasonOpen(true);
      return;
    }
    if (policy.reasonAsk === 'off') {
      onSubmit(emptyChangeReason());
      return;
    }
    onSubmit(emptyChangeReason());
  };

  return (
    <>
      <CreateEditModalShell
        size="lg"
        bodyClassName="min-h-[200px]"
        title={t('users.modal.editRoles', { id: String(editingUser.id) })}
        onClose={onClose}
        headerExtra={(
          <div className="flex items-center gap-1">
            <FieldHintTooltip
              hint={t('users.modal.rolesDescription')}
              label={t('users.modal.editRoles', { id: String(editingUser.id) })}
              ink="contrast"
            />
            {recordEventHistoryFieldChromeToggle(history)}
          </div>
        )}
        footer={(
          <>
            <AppButton intent="cancel" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
              {t('actions.cancel')}
            </AppButton>
            <AppButton intent="primary" onClick={submitOrAskReason} disabled={isSaving || !rolesChanged}>
              <Check className="w-3.5 h-3.5" />
              {isSaving ? t('actions.saving') : t('actions.save')}
            </AppButton>
          </>
        )}
      >
        {editError ? (
          <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {editError}
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {roleOptions.map((role) => (
            <UserFormRoleOption
              key={role}
              id={`edit-roles-${role}`}
              role={role}
              checked={roleSelectionIncludes(editForm.roles, role)}
              onCheckedChange={(checked) => onSetEditRoleChecked(role, checked)}
            />
          ))}
        </div>
      </CreateEditModalShell>

      <RecordEventHistoryDialog
        open={history.dialogOpen}
        title={history.dialogField ? `${timelineCopy.title} · ${history.dialogField}` : timelineCopy.title}
        subjectKind="base_users"
        subjectId={editingUser.id}
        field={history.dialogField}
        onClose={history.closeHistory}
      />

      <ConfirmDialogShell
        open={reasonOpen}
        title="Confirm role change"
        onClose={() => setReasonOpen(false)}
        confirmIntent="primary"
        confirmLabel={t('actions.save')}
        confirmDisabled={!canConfirm}
        onConfirm={() => {
          if (!canConfirm) return;
          setReasonOpen(false);
          onSubmit(reason);
        }}
        isConfirming={isSaving}
      >
        <ChangeReasonFields
          required={reasonRequired}
          capture={policy.reasonCapture}
          vocabNodeId={policy.reasonVocabNodeId}
          includeGeneral={policy.reasonIncludeGeneral}
          value={reason}
          onChange={setReason}
        />
      </ConfirmDialogShell>
    </>
  );
};
