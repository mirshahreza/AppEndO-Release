import React from 'react';
import { useCultureT } from '@/core/culture/CultureContext';
import { profileKey } from '@/core/culture/translations/cultureKeyHelpers';
import type { UserRecord } from '@/shared/api/queries/users';
import {
  AppButton,
  ChangePasswordActionIcon,
  CreateEditModalShell,
  PasswordStrengthHints,
  ResetPasswordActionIcon,
} from '@/shared/ui';

export type UserChangePasswordModalProps = {
  user: UserRecord | null;
  newPassword: string;
  confirmPassword: string;
  error: string | null;
  isSaving: boolean;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export const UserChangePasswordModal: React.FC<UserChangePasswordModalProps> = ({
  user,
  newPassword,
  confirmPassword,
  error,
  isSaving,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onClose,
  onSubmit,
}) => {
  const t = useCultureT();

  if (!user) return null;

  return (
    <CreateEditModalShell
      size="md"
      title={t('actions.changePassword')}
      subtitle={t('users.modal.changePasswordSubtitle', { email: user.email })}
      onClose={onClose}
      footer={(
        <>
          <AppButton intent="cancel" onClick={onClose}>{t('actions.cancel')}</AppButton>
          <AppButton intent="utility" onClick={onSubmit} disabled={isSaving}>
            <ChangePasswordActionIcon />
            {isSaving ? t('actions.saving') : t('users.modal.change')}
          </AppButton>
        </>
      )}
    >
      <div className="space-y-3">
        <div className="flex flex-col gap-[2px]">
          <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ps-[4px]">{t(profileKey('fields.newPassword'))}</label>
          <input type="password" value={newPassword} onChange={(e) => onNewPasswordChange(e.target.value)} className="h-8 text-xs px-2.5 border border-slate-200 rounded-md outline-none focus:border-indigo-400 bg-white text-slate-800" />
        </div>

        <div className="flex flex-col gap-[2px]">
          <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ps-[4px]">{t('users.modal.confirmPassword')}</label>
          <input type="password" value={confirmPassword} onChange={(e) => onConfirmPasswordChange(e.target.value)} className="h-8 text-xs px-2.5 border border-slate-200 rounded-md outline-none focus:border-indigo-400 bg-white text-slate-800" />
        </div>

        <PasswordStrengthHints password={newPassword} />
      </div>

      {error ? <p className="mt-2 text-xs text-red-600 font-semibold">{error}</p> : null}
    </CreateEditModalShell>
  );
};

export type UserResetPasswordModalProps = {
  user: UserRecord | null;
  error: string | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

export const UserResetPasswordModal: React.FC<UserResetPasswordModalProps> = ({
  user,
  error,
  isSaving,
  onClose,
  onSubmit,
}) => {
  const t = useCultureT();

  if (!user) return null;

  return (
    <CreateEditModalShell
      size="md"
      title={t('actions.resetPassword')}
      onClose={onClose}
      footer={(
        <>
          <AppButton intent="cancel" onClick={onClose}>{t('actions.cancel')}</AppButton>
          <AppButton intent="warning" onClick={onSubmit} disabled={isSaving}>
            <ResetPasswordActionIcon />
            {isSaving ? t('users.modal.processing') : t('users.modal.reset')}
          </AppButton>
        </>
      )}
    >
      <p className="text-xs text-slate-600">
        {t('users.modal.resetPasswordBody', { email: user.email })}
      </p>
      {error ? <p className="mt-2 text-xs text-red-600 font-semibold">{error}</p> : null}
    </CreateEditModalShell>
  );
};
