import React from 'react';
import { Check } from 'lucide-react';
import { useCultureT } from '@/src/core/culture/CultureContext';
import { buildDataUrlFromBase64 } from '@/src/shared/lib/fileFieldUtils';
import { resolveUserAvatarXsSrc } from '@/src/shared/api/contracts/users/avatar';
import type { BaseInfoOption, UserRecord } from '@/src/shared/api/queries/users';
import { AppButton, CreateEditModalShell } from '@/src/shared/ui';
import type { EditUserForm } from '../types';
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
  onSubmit: () => void;
  onImageReadError: () => void;
};

export const UserFormModal: React.FC<UserFormModalProps> = (props) => {
  const t = useCultureT();

  if (!props.open) return null;

  const errorMessage = props.editError;

  return (
    <CreateEditModalShell
      size="xl"
      title={t('users.modal.editProfile', { id: String(props.editingUser.id) })}
      onClose={props.onClose}
      footer={(
        <>
          <AppButton intent="cancel" onClick={props.onClose}>{t('actions.cancel')}</AppButton>
          <AppButton intent="primary" onClick={props.onSubmit} disabled={props.isSaving}>
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
        onChange={(patch) => props.onEditFormChange((p) => ({ ...p, ...patch }))}
        genderOptions={props.genderOptions}
        personTypeOptions={props.personTypeOptions}
        profileImage={{
          previewSrc: resolveEditProfileImagePreview(props.editingUser, props.editForm),
          previewMimeType: props.editForm.profileImageMime || props.editingUser.profile_image_mime || 'image/jpeg',
          onChange: props.onEditImageSelected,
          onError: props.onImageReadError,
        }}
      />
    </CreateEditModalShell>
  );
};
