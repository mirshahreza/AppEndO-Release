import React, { useEffect, useMemo, useState } from 'react';
import { Check, KeyRound, Shield, User, UserPlus } from 'lucide-react';
import { useCultureT } from '@/core/culture/CultureContext';
import { columnCommonKey, profileKey, authPublicKey } from '@/core/culture/translations/cultureKeyHelpers';
import type { BaseInfoOption } from '@/shared/api/queries/users';
import { StepWizardShell, UiInput } from '@/shared/ui';
import type { StepWizardStepDef } from '@/shared/ui/StepWizardShell';
import type { NewUserForm } from '../types';
import { isValidEmail, validateMembershipForm } from '../userFormValidation';
import { UserProfileFields } from './UserProfileFields';
import { UserFormField, UserFormRoleOption, UserFormSection } from './userFormLayout';

export type UserCreateWizardModalProps = {
  open: boolean;
  form: NewUserForm;
  onFormChange: React.Dispatch<React.SetStateAction<NewUserForm>>;
  availableRoles: string[];
  genderOptions: BaseInfoOption[];
  personTypeOptions: BaseInfoOption[];
  formError: string | null;
  onFormError: (error: string | null) => void;
  isSaving: boolean;
  onToggleCreateRole: (role: string) => void;
  onCreateImageSelected: (file?: File | null) => Promise<void>;
  onClose: () => void;
  onSubmit: () => void;
  onImageReadError: () => void;
};

export const UserCreateWizardModal: React.FC<UserCreateWizardModalProps> = ({
  open,
  form,
  onFormChange,
  availableRoles,
  genderOptions,
  personTypeOptions,
  formError,
  onFormError,
  isSaving,
  onToggleCreateRole,
  onCreateImageSelected,
  onClose,
  onSubmit,
  onImageReadError,
}) => {
  const t = useCultureT();
  const [step, setStep] = useState(0);
  const [emailTouched, setEmailTouched] = useState(false);

  const wizardSteps = useMemo<readonly StepWizardStepDef[]>(() => [
    {
      title: t('users.wizard.membership'),
      icon: KeyRound,
      description: t('users.wizard.membershipDescription'),
    },
    {
      title: t('users.wizard.profile'),
      icon: User,
      description: t('users.wizard.profileDescription'),
    },
    {
      title: t('users.wizard.roles'),
      icon: Shield,
      description: t('users.wizard.rolesDescription'),
    },
  ], [t]);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setEmailTouched(false);
    onFormError(null);
  }, [open, onFormError]);

  const emailError = useMemo(() => {
    if (!emailTouched && !form.email.trim()) return null;
    if (!form.email.trim()) return t('users.validation.emailRequired');
    if (!isValidEmail(form.email)) return t('users.validation.emailInvalid');
    return null;
  }, [emailTouched, form.email, t]);

  const handleNext = (): boolean => {
    if (step === 0) {
      setEmailTouched(true);
      const validationError = validateMembershipForm(form);
      if (validationError) {
        onFormError(t(validationError));
        return false;
      }
    }
    onFormError(null);
    return true;
  };

  const handleSubmit = () => {
    setEmailTouched(true);
    const validationError = validateMembershipForm(form);
    if (validationError) {
      onFormError(t(validationError));
      setStep(0);
      return;
    }
    onSubmit();
  };

  if (!open) return null;

  return (
    <StepWizardShell
      size="5xl"
      title={t('users.modal.createUser')}
      titleIcon={UserPlus}
      steps={wizardSteps}
      step={step}
      onStepChange={(nextStep) => {
        onFormError(null);
        setStep(nextStep);
      }}
      onClose={onClose}
      onNext={handleNext}
      finalStepAction={{
        label: isSaving ? t('actions.saving') : t('actions.create'),
        icon: <Check className="w-3.5 h-3.5" />,
        disabled: isSaving,
        onClick: handleSubmit,
      }}
      bodyInnerClassName="!overflow-auto"
    >
      {formError ? (
        <div className="mb-3 shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {formError}
        </div>
      ) : null}

      {step === 0 ? (
        <UserFormSection
          title={t(profileKey('sections.accountAccess'))}
          tone="indigo"
          description={t('users.wizard.accountAccessDescription')}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <UserFormField
              label={t(profileKey('fields.email'))}
              required
              error={emailError}
              className="sm:col-span-2"
            >
              <UiInput
                size="sm"
                type="email"
                value={form.email}
                onChange={(e) => {
                  onFormChange((p) => ({ ...p, email: e.target.value }));
                  if (formError) onFormError(null);
                }}
                onBlur={() => setEmailTouched(true)}
                placeholder={t('users.wizard.emailPlaceholder')}
                aria-invalid={emailError ? true : undefined}
              />
            </UserFormField>
            <UserFormField label={t(authPublicKey('password'))} required className="sm:col-span-2">
              <UiInput
                size="sm"
                type="password"
                value={form.password}
                onChange={(e) => {
                  onFormChange((p) => ({ ...p, password: e.target.value }));
                  if (formError) onFormError(null);
                }}
                placeholder={t('users.wizard.passwordPlaceholder')}
              />
            </UserFormField>
          </div>
        </UserFormSection>
      ) : null}

      {step === 1 ? (
        <UserProfileFields
          values={form}
          onChange={(patch) => onFormChange((p) => ({ ...p, ...patch }))}
          genderOptions={genderOptions}
          personTypeOptions={personTypeOptions}
          profileImage={{
            onChange: onCreateImageSelected,
            onError: onImageReadError,
          }}
        />
      ) : null}

      {step === 2 ? (
        <UserFormSection
          title={t(columnCommonKey('roles'))}
          tone="violet"
          description={t('users.wizard.rolesSectionDescription')}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {availableRoles.map((role) => (
              <UserFormRoleOption
                key={role}
                id={`create-user-role-${role}`}
                role={role}
                checked={form.roles.includes(role)}
                onToggle={() => onToggleCreateRole(role)}
              />
            ))}
          </div>
        </UserFormSection>
      ) : null}
    </StepWizardShell>
  );
};
