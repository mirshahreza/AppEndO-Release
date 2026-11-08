import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  AppButton,
  FormField,
  FormSection,
  SmtpEncryptionField,
  UiInput,
  UiPasswordInput,
} from '../../shared/ui';
import type { InstallEmailPayload } from '../../shared/api/contracts/install/types';
import { useCultureT } from '../../core/culture/CultureContext';
import { installKey } from '../../core/culture/translations/cultureKeyHelpers';
import { installWizardFieldProps, type InstallWizardFieldsState } from './installWizardFieldErrors';

export const INSTALL_EMAIL_STEP_FROM_EMAIL_ID = 'install-wizard-from-email';
export const INSTALL_EMAIL_STEP_SMTP_PASSWORD_ID = 'install-wizard-smtp-password';

const focusInstallEmailSmtpPasswordWhenPrefilled = (): void => {
  const fromEmailInput = document.getElementById(INSTALL_EMAIL_STEP_FROM_EMAIL_ID);
  if (!(fromEmailInput instanceof HTMLInputElement) || !fromEmailInput.value.trim()) {
    return;
  }
  document.getElementById(INSTALL_EMAIL_STEP_SMTP_PASSWORD_ID)?.focus();
};

const useFocusInstallEmailSmtpPasswordOnPrefill = (): void => {
  useEffect(() => {
    let cancelled = false;
    const tryFocus = () => {
      if (!cancelled) {
        focusInstallEmailSmtpPasswordWhenPrefilled();
      }
    };
    const timerIds = [0, 50, 120].map((delay) => window.setTimeout(tryFocus, delay));
    return () => {
      cancelled = true;
      timerIds.forEach((id) => window.clearTimeout(id));
    };
  }, []);
};

type InstallEmailStepFieldsProps = {
  emailForm: InstallEmailPayload;
  emailFieldErrors: InstallWizardFieldsState;
  installServerWarning: string | null;
  isBusy: boolean;
  isTestingEmail: boolean;
  onTestEmailConnection: () => void | Promise<void>;
  onFromEmailChange: (value: string) => void;
  onFromNameChange: (value: string) => void;
  onSmtpHostChange: (value: string) => void;
  onEmailFormChange: (updater: (prev: InstallEmailPayload) => InstallEmailPayload) => void;
  onSmtpUserChange: (value: string) => void;
};

export const InstallEmailStepFields: React.FC<InstallEmailStepFieldsProps> = ({
  emailForm,
  emailFieldErrors,
  installServerWarning,
  isBusy,
  isTestingEmail,
  onTestEmailConnection,
  onFromEmailChange,
  onFromNameChange,
  onSmtpHostChange,
  onEmailFormChange,
  onSmtpUserChange,
}) => {
  const t = useCultureT();
  useFocusInstallEmailSmtpPasswordOnPrefill();

  return (
    <div className="flex flex-col gap-1">
      <FormSection title={t(installKey('email.section.sender'))} ink="accent">
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t(installKey('email.fromEmail'))} required {...installWizardFieldProps(emailFieldErrors.smtpFromEmail)}>
            <UiInput
              id={INSTALL_EMAIL_STEP_FROM_EMAIL_ID}
              type="email"
              value={emailForm.smtpFromEmail}
              onChange={(e) => onFromEmailChange(e.target.value)}
              ariaLabel={t(installKey('email.fromEmailAria'))}
            />
          </FormField>
          <FormField label={t(installKey('email.fromName'))}>
            <UiInput
              value={emailForm.smtpFromName}
              onChange={(e) => onFromNameChange(e.target.value)}
              ariaLabel={t(installKey('email.fromNameAria'))}
            />
          </FormField>
        </div>
      </FormSection>
      <FormSection
        title={t(installKey('email.section.smtp'))}
        ink="contrast"
        divided
        headerExtra={(
          <AppButton
            intent="secondary"
            onClick={() => void onTestEmailConnection()}
            disabled={isBusy || Boolean(installServerWarning)}
          >
            {isTestingEmail ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {t(installKey('email.testing'))}
              </>
            ) : (
              t(installKey('email.testOptional'))
            )}
          </AppButton>
        )}
      >
        {/^smtp\.gmail\.com$/i.test(emailForm.smtpHost.trim()) ? (
          <p className="ps-[4px] text-xs text-slate-600 leading-relaxed rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2">
            {t(installKey('email.gmailHintBefore'))}{' '}
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noreferrer"
              className="text-rose-700 underline underline-offset-2"
            >
              {t(installKey('email.gmailAppPasswordLink'))}
            </a>
            {t(installKey('email.gmailHintAfter'))}
          </p>
        ) : null}
        <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-3">
          <FormField label={t(installKey('email.host'))} required {...installWizardFieldProps(emailFieldErrors.smtpHost)}>
            <UiInput
              value={emailForm.smtpHost}
              onChange={(e) => onSmtpHostChange(e.target.value)}
              ariaLabel={t(installKey('email.hostAria'))}
            />
          </FormField>
          <FormField label={t(installKey('email.port'))} required {...installWizardFieldProps(emailFieldErrors.smtpPort)}>
            <UiInput
              type="number"
              value={emailForm.smtpPort}
              onChange={(e) => onEmailFormChange((prev) => ({
                ...prev,
                smtpPort: Number(e.target.value || 0),
              }))}
              ariaLabel={t(installKey('email.portAria'))}
            />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t(installKey('email.username'))} required {...installWizardFieldProps(emailFieldErrors.smtpUser)}>
            <UiInput
              value={emailForm.smtpUser}
              onChange={(e) => onSmtpUserChange(e.target.value)}
              ariaLabel={t(installKey('email.usernameAria'))}
            />
          </FormField>
          <FormField label={t(installKey('email.password'))} required {...installWizardFieldProps(emailFieldErrors.smtpPass)}>
            <UiPasswordInput
              id={INSTALL_EMAIL_STEP_SMTP_PASSWORD_ID}
              value={emailForm.smtpPass}
              onChange={(e) => onEmailFormChange((prev) => ({ ...prev, smtpPass: e.target.value }))}
              ariaLabel={t(installKey('email.passwordAria'))}
            />
          </FormField>
        </div>
        <SmtpEncryptionField
          density="compact"
          accentClassName="border-emerald-300 bg-emerald-50/50"
          accentIconClassName="text-emerald-700"
          value={emailForm.smtpSecure}
          onChange={({ secure, port }) => onEmailFormChange((prev) => ({
            ...prev,
            smtpSecure: secure,
            smtpPort: port,
          }))}
        />
      </FormSection>
    </div>
  );
};
