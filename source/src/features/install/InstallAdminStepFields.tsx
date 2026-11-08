import React, { useMemo } from 'react';
import { Wand2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  FormField,
  FormSection,
  UiImageField,
  UiInput,
  UiPasswordInput,
} from '../../shared/ui';
import { FORM_FIELD_LABEL_CLASS } from '../../shared/ui/FormSection';
import { encodeProfileImageFieldFromFile, PROFILE_IMAGE_ACCEPT } from '../../shared/lib/profileImageField';
import { generateRandomPassword } from '../../shared/lib/generateRandomPassword';
import { InstallAdminPasswordHints } from './InstallAdminPasswordHints';
import { getInstallAdminExistingAccountMessage } from './installWizardI18n';
import { installWizardFieldProps, type InstallWizardFieldState } from './installWizardFieldErrors';
import { useCultureT } from '../../core/culture/CultureContext';
import { installKey } from '../../core/culture/translations/cultureKeyHelpers';

export type InstallAdminStepValues = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  phone: string;
  profileImageBody: string | null;
  profileImageBodyXs: string | null;
  profileImageMime: string | null;
};

type InstallAdminStepFieldsProps = {
  values: InstallAdminStepValues;
  fieldsDisabled?: boolean;
  fieldErrors?: {
    username?: InstallWizardFieldState;
    email?: InstallWizardFieldState;
    password?: InstallWizardFieldState;
    confirmPassword?: InstallWizardFieldState;
  };
  onUsernameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onProfileImageChange: (patch: Pick<InstallAdminStepValues, 'profileImageBody' | 'profileImageBodyXs' | 'profileImageMime'>) => void;
  onImageReadError: () => void;
};

const PROFILE_TABLE_LABEL_CLASS = cn(
  FORM_FIELD_LABEL_CLASS,
  'w-[5.5rem] shrink-0 normal-case tracking-normal',
);

const ProfileTableFieldCell: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <div className="flex items-center gap-2 p-0">
    <label className={PROFILE_TABLE_LABEL_CLASS}>{label}</label>
    <div className="min-w-0 flex-1">{children}</div>
  </div>
);

export const InstallAdminStepFields: React.FC<InstallAdminStepFieldsProps> = ({
  values,
  fieldsDisabled = false,
  fieldErrors = {},
  onUsernameChange,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onFirstNameChange,
  onLastNameChange,
  onPhoneChange,
  onProfileImageChange,
  onImageReadError,
}) => {
  const t = useCultureT();
  const profilePreviewSrc = useMemo(() => {
    if (!values.profileImageBodyXs) return null;
    const mime = values.profileImageMime || 'image/jpeg';
    return `data:${mime};base64,${values.profileImageBodyXs}`;
  }, [values.profileImageBodyXs, values.profileImageMime]);

  const handleGeneratePassword = () => {
    const next = generateRandomPassword();
    onPasswordChange(next);
    onConfirmPasswordChange(next);
  };

  const handleProfileImageSelected = async (file?: File | null) => {
    if (!file) {
      onProfileImageChange({
        profileImageBody: null,
        profileImageBodyXs: null,
        profileImageMime: null,
      });
      return;
    }

    try {
      const encoded = await encodeProfileImageFieldFromFile(file);
      onProfileImageChange({
        profileImageBody: encoded.profileImageBody ?? null,
        profileImageBodyXs: encoded.profileImageBodyXs ?? null,
        profileImageMime: encoded.profileImageMime ?? null,
      });
    } catch {
      onImageReadError();
    }
  };

  const generatePasswordButton = (
    <button
      type="button"
      className="inline-flex h-full items-center justify-center text-slate-500 transition-colors hover:text-violet-600"
      onClick={handleGeneratePassword}
      title={t(installKey('admin.generatePassword'))}
      aria-label={t(installKey('admin.generatePassword'))}
    >
      <Wand2 className="h-3.5 w-3.5" aria-hidden />
    </button>
  );

  if (fieldsDisabled) {
    return (
      <div className="flex min-h-[14rem] items-center justify-center overflow-x-auto px-2">
        <p className="whitespace-nowrap text-lg font-bold text-blue-700">
          {getInstallAdminExistingAccountMessage(t)}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <FormSection
        title={t(installKey('admin.section.account'))}
        ink="accent"
        hint={t(installKey('admin.section.accountDescription'))}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label={t(installKey('admin.username'))} required {...installWizardFieldProps(fieldErrors.username)}>
            <UiInput
              value={values.username}
              onChange={(e) => onUsernameChange(e.target.value)}
              ariaLabel={t(installKey('admin.usernameAria'))}
            />
          </FormField>
          <FormField label={t(installKey('admin.email'))} required {...installWizardFieldProps(fieldErrors.email)}>
            <UiInput
              type="email"
              value={values.email}
              onChange={(e) => onEmailChange(e.target.value)}
              ariaLabel={t(installKey('admin.emailAria'))}
            />
          </FormField>
          <FormField label={t(installKey('admin.password'))} required {...installWizardFieldProps(fieldErrors.password)}>
            <UiPasswordInput
              value={values.password}
              onChange={(e) => onPasswordChange(e.target.value)}
              ariaLabel={t(installKey('admin.passwordAria'))}
              leadingAddon={generatePasswordButton}
              leadingAddonClassName="px-[7.5px]"
            />
          </FormField>
          <FormField label={t(installKey('admin.confirmPassword'))} required {...installWizardFieldProps(fieldErrors.confirmPassword)}>
            <UiPasswordInput
              value={values.confirmPassword}
              onChange={(e) => onConfirmPasswordChange(e.target.value)}
              ariaLabel={t(installKey('admin.confirmPasswordAria'))}
            />
          </FormField>
        </div>
        <InstallAdminPasswordHints password={values.password} />
      </FormSection>

      <FormSection
        title={t(installKey('admin.section.profile'))}
        ink="complement"
        divided
        hint={t(installKey('admin.section.profileDescription'))}
      >
        <div className="overflow-hidden">
          <div className="grid grid-cols-[8.75rem_minmax(0,1fr)]">
            <div className="row-span-3 flex items-center justify-center p-0">
              <UiImageField
                accept={PROFILE_IMAGE_ACCEPT}
                previewSrc={profilePreviewSrc}
                previewMimeType={values.profileImageMime || 'image/jpeg'}
                ariaLabel={t(installKey('admin.profileImageAria'))}
                editorTitle={t(installKey('admin.profileImageEditorTitle'))}
                emptyHint={t(installKey('admin.uploadImage'))}
                size={126}
                showFileName={false}
                enableAiPanel={false}
                openEditorOnPick={false}
                onChange={(file) => void handleProfileImageSelected(file)}
                onError={onImageReadError}
              />
            </div>
            <ProfileTableFieldCell label={t(installKey('admin.firstName'))}>
              <UiInput
                value={values.firstName}
                onChange={(e) => onFirstNameChange(e.target.value)}
                ariaLabel={t(installKey('admin.firstNameAria'))}
                placeholder={t(installKey('admin.optional'))}
              />
            </ProfileTableFieldCell>
            <ProfileTableFieldCell label={t(installKey('admin.lastName'))}>
              <UiInput
                value={values.lastName}
                onChange={(e) => onLastNameChange(e.target.value)}
                ariaLabel={t(installKey('admin.lastNameAria'))}
                placeholder={t(installKey('admin.optional'))}
              />
            </ProfileTableFieldCell>
            <ProfileTableFieldCell label={t(installKey('admin.phone'))}>
              <UiInput
                value={values.phone}
                onChange={(e) => onPhoneChange(e.target.value)}
                ariaLabel={t(installKey('admin.phoneAria'))}
                placeholder={t(installKey('admin.optional'))}
                inputMode="tel"
                autoComplete="tel"
                phoneContactActions
              />
            </ProfileTableFieldCell>
          </div>
        </div>
      </FormSection>
    </div>
  );
};
