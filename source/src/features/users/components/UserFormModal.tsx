import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { useCultureT } from '../../../core/culture/CultureContext';
import { buildDataUrlFromBase64 } from '../../../shared/lib/fileFieldUtils';
import { resolveUserAvatarXsSrc } from '../../../shared/api/contracts/users/avatar';
import {
  USERS_PROFILE_CHANGE_REASON,
  changeReasonValueSatisfiesPolicy,
} from '../../../shared/api/contracts/record-events';
import { useNamedApiChangeReasonPolicy } from '../../../shared/api/queries/namedApiChangeReason';
import type { BaseInfoOption, UserRecord } from '../../../shared/api/queries/users';
import { isCompanyPersonType, isIndividualPersonType } from '../../../shared/profile/personType';
import { useRecordSubjectHistory } from '../../../shared/lib/useRecordSubjectHistory';
import {
  AppButton,
  ChangeReasonFields,
  ConfirmDialogShell,
  CreateEditModalShell,
  RecordEventHistoryDialog,
  recordEventHistoryFieldChromeToggle,
  useRecordSubjectTimelineCopy,
  emptyChangeReason,
  type ChangeReasonValue,
} from '../../../shared/ui';
import type { EditUserForm } from '../types';
import {
  USER_PROFILE_HISTORY_FIELD_MAP,
  USER_PROFILE_TRACKED_FIELDS,
  restoreUserHistoryEvent,
} from '../restoreUserHistoryEvent';
import { resolveUserProfileChangeReasonGate } from '../userProfileSaveReason';
import { UserProfileFields } from './UserProfileFields';

const getUserProfilePreviewSrc = (user: UserRecord): string | null => resolveUserAvatarXsSrc(user);

const resolveEditProfileImagePreview = (user: UserRecord, editForm: EditUserForm): string | null => {
  if (editForm.profileImageRemoved) return null;
  if (editForm.profileImageBodyXs) {
    return buildDataUrlFromBase64(editForm.profileImageBodyXs, editForm.profileImageMime || 'image/jpeg');
  }
  return getUserProfilePreviewSrc(user);
};

export type UserFormModalProps = {
  open: boolean;
  editingUser: UserRecord;
  editForm: EditUserForm;
  onEditFormChange: React.Dispatch<React.SetStateAction<EditUserForm>>;
  genderOptions: BaseInfoOption[];
  personTypeOptions: BaseInfoOption[];
  editError: string | null;
  isSaving: boolean;
  onEditImageSelected: (file?: File | null) => Promise<void>;
  onClose: () => void;
  onSubmit: (reason: ChangeReasonValue) => void;
  onImageReadError: () => void;
};

export const UserFormModal: React.FC<UserFormModalProps> = (props) => {
  const t = useCultureT();
  const timelineCopy = useRecordSubjectTimelineCopy();
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState<ChangeReasonValue>(emptyChangeReason());
  const policy = useNamedApiChangeReasonPolicy('PUT', '/api/users/:id/profile', USERS_PROFILE_CHANGE_REASON);
  const history = useRecordSubjectHistory({
    subjectKind: 'base_users',
    subjectId: props.editingUser.id,
    fieldMap: USER_PROFILE_HISTORY_FIELD_MAP,
    trackedFields: USER_PROFILE_TRACKED_FIELDS,
    enabled: props.open,
  });

  if (!props.open) return null;

  const reasonGate = resolveUserProfileChangeReasonGate(props.editingUser, props.editForm, policy.reasonAsk);
  const reasonRequired = reasonGate === 'required';
  const canConfirm = changeReasonValueSatisfiesPolicy(reason, policy);

  const submitOrAskReason = () => {
    if (reasonGate === 'skip') {
      props.onSubmit(emptyChangeReason());
      return;
    }
    setReasonOpen(true);
  };

  const errorMessage = props.editError;
  const layoutPersonTypeCode = props.editingUser.person_type_code?.trim()
    || props.editForm.personTypeCode.trim()
    || '';
  const editTitle = isCompanyPersonType(layoutPersonTypeCode)
    ? t('users.modal.editCompanyProfile', { id: String(props.editingUser.id) })
    : isIndividualPersonType(layoutPersonTypeCode)
      ? t('users.modal.editIndividualProfile', { id: String(props.editingUser.id) })
      : t('users.modal.editProfile', { id: String(props.editingUser.id) });

  return (
    <>
      <CreateEditModalShell
        size="xl"
        title={editTitle}
        onClose={props.onClose}
        headerExtra={recordEventHistoryFieldChromeToggle(history)}
        footer={(
          <>
            <AppButton intent="cancel" onClick={props.onClose}>
              <X className="h-3.5 w-3.5" />
              {t('actions.cancel')}
            </AppButton>
            <AppButton
              intent="primary"
              onClick={submitOrAskReason}
              disabled={props.isSaving}
            >
              <Check className="w-3.5 h-3.5" />
              {props.isSaving ? t('actions.saving') : t('actions.save')}
            </AppButton>
          </>
        )}
      >
        {errorMessage ? (
          <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <UserProfileFields
          values={props.editForm}
          layoutPersonTypeCode={layoutPersonTypeCode}
          personTypeOptions={props.personTypeOptions}
          onChange={(patch) => props.onEditFormChange((p) => ({ ...p, ...patch }))}
          genderOptions={props.genderOptions}
          history={history.available && history.fieldIconsVisible
            ? {
              available: true,
              onOpenField: history.openHistory,
            }
            : undefined}
          profileImage={{
            previewSrc: resolveEditProfileImagePreview(props.editingUser, props.editForm),
            previewMimeType: props.editForm.profileImageMime || props.editingUser.profile_image_mime || 'image/jpeg',
            onChange: props.onEditImageSelected,
            onError: props.onImageReadError,
          }}
        />
      </CreateEditModalShell>

      <RecordEventHistoryDialog
        open={history.dialogOpen}
        title={history.dialogField ? `${timelineCopy.title} · ${history.dialogField}` : timelineCopy.title}
        subjectKind="base_users"
        subjectId={props.editingUser.id}
        field={history.dialogField}
        fieldMap={USER_PROFILE_HISTORY_FIELD_MAP}
        onClose={history.closeHistory}
        onRestore={async (item) => {
          await restoreUserHistoryEvent(props.editingUser.id, item);
        }}
      />

      <ConfirmDialogShell
        open={reasonOpen}
        title="Confirm profile save"
        onClose={() => setReasonOpen(false)}
        confirmIntent="primary"
        confirmLabel={t('actions.save')}
        onConfirm={() => {
          if (!canConfirm) return;
          setReasonOpen(false);
          props.onSubmit(reason);
        }}
        isConfirming={props.isSaving}
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
