import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, KeyRound, Pencil, Trash2, X } from 'lucide-react';
import type { ProfileFieldValueItem } from '../../shared/api/contracts/profile/profileFieldSettings';
import { getProfileImageSrc } from '../../features/users/utils';
import type { UserProfileRecord } from '../../shared/api/queries/profile';
import {
  buildProfileFieldValuesPayload,
  profileFieldValuesToFormState,
  useMyEditableProfileFieldsQuery,
  useUpdateMyEditableProfileFieldsMutation,
  isProfileFieldValueItemEditable,
} from '../../shared/api/queries/profileFieldValues';
import { profileQueryKeys } from '../../shared/api/queries/profile';
import { normalizeBaseInfoOptions, type BaseInfoOption } from '../../shared/api/queries/users';
import { ProfileFieldsForm } from './ProfileFieldsForm';
import { isPasswordStrong } from '../../shared/lib/passwordStrength';
import {
  AppButton,
  AppToast,
  ConfirmDialogShell,
  CreateEditModalShell,
  DestructiveConfirmBody,
  FormSection,
  PasswordStrengthHints,
  UiCheckboxChoice,
  UiPasswordInput,
  resolveFormFieldPairGridClass,
  PhoneNumberDisplay,
} from '../../shared/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useCultureT } from '../../core/culture/CultureContext';
import { useBaseInfoOptionsQuery } from '../../shared/api/queries/base-info';
import {
  PROFILE_GENDER_BASE_INFO_ROOT,
  PROFILE_PERSON_TYPE_BASE_INFO_ROOT,
} from '../../shared/profile/profileBaseInfoRoots';
import { profileKey } from '../../core/culture/translations/cultureKeyHelpers';
import { resolvePhoneContactLinks } from '../../shared/lib/phoneContactLinks';

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="text-[10px] font-normal uppercase text-slate-500 tracking-wider ps-[4px]">{children}</label>
);

const formatReadOnlyValue = (value: string | null | undefined, emptyValue: string) => {
  if (value === null || value === undefined) return emptyValue;
  const trimmed = value.trim();
  return trimmed || emptyValue;
};

const ReadOnlyDetail: React.FC<{
  label: string;
  value: string | null | undefined;
  className?: string;
  phoneContactActions?: boolean;
}> = ({ label, value, className, phoneContactActions = false }) => {
  const t = useCultureT();
  const emptyValue = t(profileKey('emptyValue'));
  const display = formatReadOnlyValue(value, emptyValue);
  const phoneText = value?.trim() ?? '';

  const links = phoneContactActions ? resolvePhoneContactLinks(phoneText) : null;

  return (
  <div className={`flex flex-col gap-[2px] ${className ?? ''}`}>
    <FieldLabel>{label}</FieldLabel>
    {links ? (
      <PhoneNumberDisplay
        phone={phoneText}
        className="max-w-full"
        textClassName="text-xs font-semibold text-slate-900 tabular-nums"
      />
    ) : (
      <div className="flex h-8 min-h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-900">
        {display}
      </div>
    )}
  </div>
  );
};

const ProfileImageReadOnlySection: React.FC<{ previewSrc: string | null }> = ({ previewSrc }) => {
  const t = useCultureT();
  return (
  <section className="rounded-lg border border-slate-200 p-3">
    <div className="flex flex-col items-center gap-[2px]">
      <FieldLabel>{t(profileKey('sections.profileImage'))}</FieldLabel>
      <div
        className="w-[112px] h-[112px] rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden"
        aria-label={t(profileKey('image.previewAria'))}
      >
        {previewSrc ? (
          <img src={previewSrc} alt={t(profileKey('image.alt'))} className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs text-slate-400">{t(profileKey('image.noImage'))}</span>
        )}
      </div>
    </div>
  </section>
  );
};

const resolveOptionLabel = (options: BaseInfoOption[], code: string | null | undefined) => {
  if (!code?.trim()) return null;
  return options.find((option) => option.id === code)?.label ?? code;
};

export type ProfileMoreModalProps = {
  open: boolean;
  profile: UserProfileRecord | null;
  userId?: number | null;
  onClose: () => void;
};

export const ProfileMoreModal: React.FC<ProfileMoreModalProps> = ({
  open,
  profile,
  userId,
  onClose,
}) => {
  const t = useCultureT();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const editableQuery = useMyEditableProfileFieldsQuery(userId, open);
  const profileFieldItems = editableQuery.data ?? [];
  const canEditProfileFields = profileFieldItems.some(isProfileFieldValueItemEditable);

  const genderOptionsQuery = useBaseInfoOptionsQuery(PROFILE_GENDER_BASE_INFO_ROOT, { enabled: open });
  const personTypeOptionsQuery = useBaseInfoOptionsQuery(PROFILE_PERSON_TYPE_BASE_INFO_ROOT, { enabled: open });
  const genderOptions = genderOptionsQuery.data
    ? normalizeBaseInfoOptions(genderOptionsQuery.data, PROFILE_GENDER_BASE_INFO_ROOT)
    : [];
  const personTypeOptions = personTypeOptionsQuery.data
    ? normalizeBaseInfoOptions(personTypeOptionsQuery.data, PROFILE_PERSON_TYPE_BASE_INFO_ROOT)
    : [];

  useEffect(() => {
    if (!open) {
      setIsEditOpen(false);
    }
  }, [open]);

  if (!open || !profile) return null;

  const profilePreviewSrc = getProfileImageSrc(profile, 'full') ?? getProfileImageSrc(profile, 'xs');
  const genderLabel = resolveOptionLabel(genderOptions, profile.gender_code);
  const personTypeLabel = resolveOptionLabel(personTypeOptions, profile.person_type_code);

  return (
    <>
      <CreateEditModalShell
        size="xl"
        backdropClassName="z-[170]"
        title={t(profileKey('modals.accountDetails'))}
        onClose={onClose}
        footer={(
          <>
            <AppButton intent="cancel" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
              {t(profileKey('actions.close'))}
            </AppButton>
            {canEditProfileFields ? (
              <AppButton intent="primary" onClick={() => setIsEditOpen(true)}>
                <Pencil className="w-3.5 h-3.5" />
                {t(profileKey('actions.editProfile'))}
              </AppButton>
            ) : null}
          </>
        )}
      >
        <div className="flex flex-col gap-1">
          <ProfileImageReadOnlySection previewSrc={profilePreviewSrc} />

          <FormSection title={t(profileKey('sections.accountAccess'))} ink="accent">
            <div className={resolveFormFieldPairGridClass(true)}>
              <ReadOnlyDetail label={t(profileKey('fields.username'))} value={profile.username} />
              <ReadOnlyDetail label={t(profileKey('fields.phone'))} value={profile.phone} phoneContactActions />
            </div>
            <ReadOnlyDetail label={t(profileKey('fields.email'))} value={profile.email} />
          </FormSection>

          <FormSection title={t(profileKey('sections.personalInformation'))} ink="complement" divided>
            <div className={resolveFormFieldPairGridClass(true)}>
              <ReadOnlyDetail label={t(profileKey('fields.firstName'))} value={profile.firstname} />
              <ReadOnlyDetail label={t(profileKey('fields.lastName'))} value={profile.lastname} />
              <ReadOnlyDetail label={t(profileKey('fields.fatherName'))} value={profile.fathername} />
              <ReadOnlyDetail label={t(profileKey('fields.grandfatherName'))} value={profile.grandfathername} />
            </div>
            <ReadOnlyDetail label={t(profileKey('fields.nickname'))} value={profile.nickname} />
          </FormSection>

          <FormSection title={t(profileKey('sections.identity'))} ink="contrast" divided>
            <div className={resolveFormFieldPairGridClass(true)}>
              <ReadOnlyDetail label={t(profileKey('fields.nationalCode'))} value={profile.national_code} />
              <ReadOnlyDetail label={t(profileKey('fields.gender'))} value={genderLabel} />
            </div>
            <ReadOnlyDetail label={t(profileKey('fields.personType'))} value={personTypeLabel} />
          </FormSection>

          <FormSection title={t(profileKey('sections.birthDate'))} ink="accent" divided>
            <div className="grid grid-cols-3 gap-2">
              <ReadOnlyDetail label={t(profileKey('fields.year'))} value={profile.birth_year} />
              <ReadOnlyDetail label={t(profileKey('fields.month'))} value={profile.birth_month} />
              <ReadOnlyDetail label={t(profileKey('fields.day'))} value={profile.birth_day} />
            </div>
          </FormSection>
        </div>
      </CreateEditModalShell>

      <ProfileFieldsEditModal
        open={isEditOpen}
        items={profileFieldItems}
        onClose={() => setIsEditOpen(false)}
      />
    </>
  );
};

export type ProfileFieldsEditModalProps = {
  open: boolean;
  items: ProfileFieldValueItem[];
  onClose: () => void;
};

export const ProfileFieldsEditModal: React.FC<ProfileFieldsEditModalProps> = ({
  open,
  items,
  onClose,
}) => {
  const t = useCultureT();
  const { refreshSession } = useAuth();
  const queryClient = useQueryClient();
  const updateMutation = useUpdateMyEditableProfileFieldsMutation();
  const [valuesByProfileField, setValuesByProfileField] = useState<Record<string, unknown>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }

    if (!wasOpenRef.current) {
      setValuesByProfileField(profileFieldValuesToFormState(items));
      setSaveError(null);
      wasOpenRef.current = true;
      return;
    }

    setValuesByProfileField((current) => (
      Object.keys(current).length > 0 ? current : profileFieldValuesToFormState(items)
    ));
  }, [open, items]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!open) return null;

  const handleSave = async () => {
    setSaveError(null);
    const payload = buildProfileFieldValuesPayload(items, valuesByProfileField);
    const { data, response } = await updateMutation.mutateAsync(payload);

    if (!response.ok || !data.success) {
      const message = typeof data.error === 'string' && data.error.trim()
        ? data.error
        : t(profileKey('errors.saveProfileFields'));
      setSaveError(message);
      setToast({ type: 'error', text: message });
      return;
    }

    await Promise.all([
      refreshSession(),
      queryClient.refetchQueries({ queryKey: profileQueryKeys.all }),
    ]);
    setToast({ type: 'success', text: t(profileKey('success.profileFieldsSaved')) });
    onClose();
  };

  return (
    <>
      {toast ? <AppToast type={toast.type} text={toast.text} /> : null}
      <CreateEditModalShell
        size="lg"
        backdropClassName="z-[180]"
        title={t(profileKey('modals.editProfile'))}
        onClose={onClose}
        footer={(
          <>
            <AppButton intent="cancel" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
              {t(profileKey('actions.cancel'))}
            </AppButton>
            <AppButton intent="primary" onClick={() => void handleSave()} disabled={updateMutation.isPending}>
              <Check className="w-3.5 h-3.5" />
              {updateMutation.isPending ? t(profileKey('actions.saving')) : t(profileKey('actions.saveChanges'))}
            </AppButton>
          </>
        )}
      >
        <ProfileFieldsForm
          items={items}
          valuesByProfileField={valuesByProfileField}
          onValueChange={(profileField, value) => {
            setValuesByProfileField((current) => ({ ...current, [profileField]: value }));
          }}
          disabled={updateMutation.isPending}
        />
        {saveError ? <p className="mt-3 text-xs text-rose-600 font-semibold">{saveError}</p> : null}
      </CreateEditModalShell>
    </>
  );
};

export type ProfileChangePasswordModalProps = {
  open: boolean;
  error: string | null;
  isSaving: boolean;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export const ProfileChangePasswordModal: React.FC<ProfileChangePasswordModalProps> = ({
  open,
  error,
  isSaving,
  currentPassword,
  newPassword,
  confirmPassword,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onClose,
  onSubmit,
}) => {
  const t = useCultureT();
  const canSubmit = useMemo(
    () => Boolean(currentPassword.trim())
      && newPassword === confirmPassword
      && isPasswordStrong(newPassword),
    [confirmPassword, currentPassword, newPassword],
  );

  if (!open) return null;

  return (
    <CreateEditModalShell
      size="md"
      backdropClassName="z-[170]"
      title={t(profileKey('modals.changePassword'))}
      onClose={onClose}
      footer={(
        <>
          <AppButton intent="cancel" onClick={onClose}>
            <X className="w-3.5 h-3.5" />
            {t(profileKey('actions.cancel'))}
          </AppButton>
          <AppButton intent="primary" onClick={onSubmit} disabled={isSaving || !canSubmit}>
            <KeyRound className="w-3.5 h-3.5" />
            {isSaving ? t(profileKey('actions.saving')) : t(profileKey('actions.changePassword'))}
          </AppButton>
        </>
      )}
    >
      <div>
        <h2 className="text-sm font-bold text-slate-800">
          {t(profileKey('modals.changePasswordIntro'))}
        </h2>

        <div className="mt-3 flex flex-col gap-[2px]">
          <FieldLabel>{t(profileKey('fields.currentPassword'))}</FieldLabel>
          <UiPasswordInput
            size="md"
            value={currentPassword}
            onChange={(e) => onCurrentPasswordChange(e.target.value)}
            ariaLabel={t(profileKey('fields.currentPassword'))}
          />
        </div>

        <div className="mt-[20px] space-y-3">
          <div className="flex flex-col gap-[2px]">
            <FieldLabel>{t(profileKey('fields.newPassword'))}</FieldLabel>
            <UiPasswordInput
              size="md"
              value={newPassword}
              onChange={(e) => onNewPasswordChange(e.target.value)}
              ariaLabel={t(profileKey('fields.newPassword'))}
            />
          </div>

          <div className="flex flex-col gap-[2px]">
            <FieldLabel>{t(profileKey('fields.confirmNewPassword'))}</FieldLabel>
            <UiPasswordInput
              size="md"
              value={confirmPassword}
              onChange={(e) => onConfirmPasswordChange(e.target.value)}
              ariaLabel={t(profileKey('fields.confirmNewPassword'))}
            />
          </div>

          <PasswordStrengthHints password={newPassword} />
        </div>

        {error ? <p className="mt-3 text-xs text-red-600 font-semibold">{error}</p> : null}
      </div>
    </CreateEditModalShell>
  );
};

export type ProfileDeleteAccountModalProps = {
  open: boolean;
  error: string | null;
  isSaving: boolean;
  password: string;
  acknowledged: boolean;
  onPasswordChange: (value: string) => void;
  onAcknowledgedChange: (value: boolean) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export const ProfileDeleteAccountModal: React.FC<ProfileDeleteAccountModalProps> = ({
  open,
  error,
  isSaving,
  password,
  acknowledged,
  onPasswordChange,
  onAcknowledgedChange,
  onClose,
  onSubmit,
}) => {
  const t = useCultureT();
  if (!open) return null;

  return (
    <ConfirmDialogShell
      size="md"
      backdropClassName="z-[170]"
      title={t(profileKey('modals.deleteAccount'))}
      icon={<Trash2 className="h-4 w-4" />}
      onClose={onClose}
      closeOnEscape={!isSaving}
      footer={(
        <>
          <AppButton intent="cancel" size="sm" onClick={onClose} disabled={isSaving}>
            <X className="h-3.5 w-3.5" />
            {t(profileKey('actions.cancel'))}
          </AppButton>
          <AppButton
            intent="destructive"
            size="sm"
            onClick={onSubmit}
            disabled={isSaving || !acknowledged || !password}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {isSaving ? t(profileKey('actions.deleting')) : t(profileKey('actions.deleteMyAccount'))}
          </AppButton>
        </>
      )}
    >
      <div className="flex flex-col gap-4">
        <DestructiveConfirmBody
          question={t(profileKey('modals.deleteAccountQuestion'))}
          extra={(
            <div className="flex flex-col gap-2 text-xs text-slate-600">
              <p className="text-start">
                {t(profileKey('modals.deleteAccountBody1'))}
              </p>
              <p className="text-start">
                {t(profileKey('modals.deleteAccountBody2'))}
              </p>
            </div>
          )}
        />

        <UiCheckboxChoice
          checked={acknowledged}
          onChange={onAcknowledgedChange}
          className="text-xs text-slate-700"
        >
          {t(profileKey('modals.deleteAccountAck'))}
        </UiCheckboxChoice>

        <div className="flex flex-col gap-[2px]">
          <FieldLabel>{t(profileKey('fields.confirmWithPassword'))}</FieldLabel>
          <UiPasswordInput
            size="sm"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder={t(profileKey('modals.passwordPlaceholder'))}
            ariaLabel={t(profileKey('fields.confirmWithPassword'))}
          />
        </div>

        {error ? <p className="text-xs text-red-600 font-semibold">{error}</p> : null}
      </div>
    </ConfirmDialogShell>
  );
};
