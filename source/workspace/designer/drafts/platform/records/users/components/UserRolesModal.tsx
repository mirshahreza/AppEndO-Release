import React from 'react';
import { Check } from 'lucide-react';
import { useCultureT } from '@/core/culture/CultureContext';
import { columnCommonKey } from '@/core/culture/translations/cultureKeyHelpers';
import type { UserRecord } from '@/shared/api/queries/users';
import { AppButton, CreateEditModalShell } from '@/shared/ui';
import type { EditUserForm } from '../types';
import { UserFormRoleOption, UserFormSection } from './userFormLayout';

export type UserRolesModalProps = {
  open: boolean;
  editingUser: UserRecord | null;
  editForm: EditUserForm;
  availableRoles: string[];
  editError: string | null;
  isSaving: boolean;
  onToggleEditRole: (role: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export const UserRolesModal: React.FC<UserRolesModalProps> = ({
  open,
  editingUser,
  editForm,
  availableRoles,
  editError,
  isSaving,
  onToggleEditRole,
  onClose,
  onSubmit,
}) => {
  const t = useCultureT();

  if (!open || !editingUser) return null;

  return (
    <CreateEditModalShell
      size="lg"
      title={t('users.modal.editRoles', { id: String(editingUser.id) })}
      onClose={onClose}
      footer={(
        <>
          <AppButton intent="cancel" onClick={onClose}>{t('actions.cancel')}</AppButton>
          <AppButton intent="primary" onClick={onSubmit} disabled={isSaving}>
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

      <UserFormSection
        title={t(columnCommonKey('roles'))}
        tone="violet"
        description={t('users.modal.rolesDescription')}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {availableRoles.map((role) => (
            <UserFormRoleOption
              key={role}
              id={`edit-roles-${role}`}
              role={role}
              checked={editForm.roles.includes(role)}
              onToggle={() => onToggleEditRole(role)}
            />
          ))}
        </div>
      </UserFormSection>
    </CreateEditModalShell>
  );
};
