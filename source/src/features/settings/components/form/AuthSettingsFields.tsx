import React from 'react';
import { UiInput, UiSelect } from '../../../../shared/ui';
import { useNodeSettingsQuery } from '../../../../shared/api/queries/settingsScope';
import { isAuthHardeningLocked } from '../../../../shared/api/contracts/settings/authPolicy';
import type { SettingsPageModel } from '../../hooks/useSettingsPage';
import { useSettingsFormT } from '../../hooks/useSettingsFormT';
import { cn } from '../../../../lib/utils';
import {
  SETTINGS_CONTROL_CLASS,
  SETTINGS_FORM_GRID_GAP_CLASS,
  SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS,
  SETTINGS_SURFACE_STACK_CLASS,
  SettingsCheckboxCard,
  SettingsDisabledFieldset,
  SettingsField,
  SettingsFormGroup,
  SettingsInlineCheckbox,
  SettingsToggleField,
  SettingsToggleTrailingRow,
} from './SettingsFormPrimitives';

type AuthSettingsFieldsProps = {
  page: SettingsPageModel;
};

export const AuthSettingsFields: React.FC<AuthSettingsFieldsProps> = ({ page }) => {
  const t = useSettingsFormT();
  const nodeQuery = useNodeSettingsQuery();
  const hardeningLocked = isAuthHardeningLocked(nodeQuery.data?.nodeEnv ?? 'development');
  const otpFieldsDisabled = hardeningLocked || !page.draftSettings.authOtpEnabled;
  const emailVerifyFieldsDisabled = hardeningLocked || !page.draftSettings.authEmailVerifyEnabled;
  const mobileVerifyFieldsDisabled = hardeningLocked || !page.draftSettings.authMobileVerifyEnabled;
  const registrationFieldsDisabled = hardeningLocked || !page.draftSettings.authRegistrationEnabled;
  const lockoutFieldsDisabled = !page.draftSettings.authLockoutEnabled;

  return (
    <div className={SETTINGS_SURFACE_STACK_CLASS}>
      {hardeningLocked ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-snug text-amber-900">
          {t('settings.forms.auth.devNotice')}
        </div>
      ) : null}

      <SettingsFormGroup
        title={t('settings.forms.auth.loginOptions.title')}
        sectionId="auth"
        titleInfo={t('settings.forms.auth.loginOptions.info')}
      >
        <div className={cn('flex flex-wrap', SETTINGS_FORM_GRID_GAP_CLASS)}>
          <SettingsCheckboxCard
            id="authAllowUsername"
            checked={page.draftSettings.authAllowUsername}
            onChange={(checked) => page.setDraftSettings((prev) => ({ ...prev, authAllowUsername: checked }))}
            label={t('settings.forms.auth.loginOptions.allowUsername')}
          />
          <SettingsCheckboxCard
            id="authAllowEmail"
            checked={page.draftSettings.authAllowEmail}
            onChange={(checked) => page.setDraftSettings((prev) => ({ ...prev, authAllowEmail: checked }))}
            label={t('settings.forms.auth.loginOptions.allowEmail')}
          />
          <SettingsCheckboxCard
            id="authAllowMobile"
            checked={page.draftSettings.authAllowMobile}
            onChange={(checked) => page.setDraftSettings((prev) => ({ ...prev, authAllowMobile: checked }))}
            label={t('settings.forms.auth.loginOptions.allowMobile')}
          />
        </div>
      </SettingsFormGroup>

      <SettingsFormGroup
        title={t('settings.forms.auth.otp.title')}
        sectionId="auth"
        divided
        titleInfo={t('settings.forms.auth.otp.info')}
      >
        <SettingsToggleField
          id="authOtpEnabled"
          checked={page.draftSettings.authOtpEnabled}
          disabled={hardeningLocked}
          onChange={(checked) => page.setDraftSettings((prev) => ({ ...prev, authOtpEnabled: checked }))}
          title={t('settings.forms.auth.otp.enable')}
        />
        <SettingsDisabledFieldset disabled={otpFieldsDisabled}>
          <SettingsField
            label={t('settings.forms.auth.otp.channels')}
            labelInfo={t('settings.forms.auth.otp.channelsInfo')}
          >
            <div className={cn('flex flex-wrap', SETTINGS_FORM_GRID_GAP_CLASS)}>
              <SettingsCheckboxCard
                id="authOtpChannelEmail"
                checked={page.draftSettings.authOtpChannelEmail}
                onChange={(checked) => page.setDraftSettings((prev) => ({ ...prev, authOtpChannelEmail: checked }))}
                label={t('settings.forms.common.email')}
              />
              <SettingsCheckboxCard
                id="authOtpChannelSms"
                checked={page.draftSettings.authOtpChannelSms}
                onChange={(checked) => page.setDraftSettings((prev) => ({ ...prev, authOtpChannelSms: checked }))}
                label={t('settings.forms.common.sms')}
              />
            </div>
          </SettingsField>

          <div className={SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS}>
            <SettingsField
              label={t('settings.forms.auth.otp.expiry')}
              labelInfo={t('settings.forms.auth.otp.expiryInfo')}
            >
              <UiSelect
                value={page.draftSettings.authOtpExpirySeconds}
                onChange={(e) => page.setDraftSettings((prev) => ({ ...prev, authOtpExpirySeconds: Number(e.target.value) }))}
                className={SETTINGS_CONTROL_CLASS}
                size="sm"
              >
                <option value={120}>{t('settings.forms.common.minutes2')}</option>
                <option value={300}>{t('settings.forms.common.minutes5Default')}</option>
                <option value={600}>{t('settings.forms.common.minutes10')}</option>
                <option value={900}>{t('settings.forms.common.minutes15')}</option>
              </UiSelect>
            </SettingsField>

            <SettingsField
              label={t('settings.forms.auth.otp.maxAttempts')}
              labelInfo={t('settings.forms.auth.otp.maxAttemptsInfo')}
            >
              <UiSelect
                value={page.draftSettings.authOtpMaxAttempts}
                onChange={(e) => page.setDraftSettings((prev) => ({ ...prev, authOtpMaxAttempts: Number(e.target.value) }))}
                className={SETTINGS_CONTROL_CLASS}
                size="sm"
              >
                <option value={3}>{t('settings.forms.common.attempts', { count: 3 })}</option>
                <option value={5}>{t('settings.forms.common.attemptsDefault', { count: 5 })}</option>
                <option value={10}>{t('settings.forms.common.attempts', { count: 10 })}</option>
              </UiSelect>
            </SettingsField>
          </div>
        </SettingsDisabledFieldset>
      </SettingsFormGroup>

      <SettingsFormGroup
        title={t('settings.forms.auth.verification.title')}
        sectionId="auth"
        divided
        titleInfo={t('settings.forms.auth.verification.info')}
      >
        <SettingsToggleTrailingRow
          trailing={(
            <SettingsInlineCheckbox
              id="authEmailVerifyRequired"
              checked={page.draftSettings.authEmailVerifyRequired}
              disabled={emailVerifyFieldsDisabled}
              onChange={(checked) => page.setDraftSettings((prev) => ({ ...prev, authEmailVerifyRequired: checked }))}
              label={t('settings.forms.common.requiredBeforeLogin')}
              className={SETTINGS_CONTROL_CLASS}
            />
          )}
        >
          <SettingsToggleField
            id="authEmailVerifyEnabled"
            checked={page.draftSettings.authEmailVerifyEnabled}
            disabled={hardeningLocked}
            onChange={(checked) => page.setDraftSettings((prev) => ({
              ...prev,
              authEmailVerifyEnabled: checked,
              authEmailVerifyRequired: checked ? prev.authEmailVerifyRequired : false,
            }))}
            title={t('settings.forms.auth.verification.emailTitle')}
            titleInfo={t('settings.forms.auth.verification.emailInfo')}
          />
        </SettingsToggleTrailingRow>

        <SettingsToggleTrailingRow
          trailing={(
            <SettingsInlineCheckbox
              id="authMobileVerifyRequired"
              checked={page.draftSettings.authMobileVerifyRequired}
              disabled={mobileVerifyFieldsDisabled}
              onChange={(checked) => page.setDraftSettings((prev) => ({ ...prev, authMobileVerifyRequired: checked }))}
              label={t('settings.forms.common.requiredBeforeLogin')}
              className={SETTINGS_CONTROL_CLASS}
            />
          )}
        >
          <SettingsToggleField
            id="authMobileVerifyEnabled"
            checked={page.draftSettings.authMobileVerifyEnabled}
            disabled={hardeningLocked}
            onChange={(checked) => page.setDraftSettings((prev) => ({
              ...prev,
              authMobileVerifyEnabled: checked,
              authMobileVerifyRequired: checked ? prev.authMobileVerifyRequired : false,
            }))}
            title={t('settings.forms.auth.verification.mobileTitle')}
            titleInfo={t('settings.forms.auth.verification.mobileInfo')}
          />
        </SettingsToggleTrailingRow>

        <SettingsToggleTrailingRow
          trailing={(
            <SettingsInlineCheckbox
              id="authRegistrationRequireTerms"
              checked={page.draftSettings.authRegistrationRequireTerms}
              disabled={registrationFieldsDisabled}
              onChange={(checked) => page.setDraftSettings((prev) => ({ ...prev, authRegistrationRequireTerms: checked }))}
              label={t('settings.forms.auth.verification.requireTerms')}
              className={SETTINGS_CONTROL_CLASS}
            />
          )}
        >
          <SettingsToggleField
            id="authRegistrationEnabled"
            checked={page.draftSettings.authRegistrationEnabled}
            disabled={hardeningLocked}
            onChange={(checked) => page.setDraftSettings((prev) => ({ ...prev, authRegistrationEnabled: checked }))}
            title={t('settings.forms.auth.verification.registrationTitle')}
            titleInfo={t('settings.forms.auth.verification.registrationInfo')}
          />
        </SettingsToggleTrailingRow>

        <SettingsDisabledFieldset disabled={registrationFieldsDisabled}>
          <div className={SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS}>
            <SettingsField
              label={t('settings.forms.auth.verification.defaultRole')}
              htmlFor="authRegistrationDefaultRole"
              labelInfo={t('settings.forms.auth.verification.defaultRoleInfo')}
            >
              <UiInput
                id="authRegistrationDefaultRole"
                value={page.draftSettings.authRegistrationDefaultRole}
                onChange={(e) => page.setDraftSettings((prev) => ({ ...prev, authRegistrationDefaultRole: e.target.value.toUpperCase() }))}
                className={SETTINGS_CONTROL_CLASS}
                size="sm"
              />
            </SettingsField>
          </div>
        </SettingsDisabledFieldset>
      </SettingsFormGroup>

      <SettingsFormGroup
        title={t('settings.forms.auth.lockout.title')}
        sectionId="auth"
        divided
        titleInfo={t('settings.forms.auth.lockout.info')}
      >
        <SettingsToggleField
          id="authLockoutEnabled"
          checked={page.draftSettings.authLockoutEnabled}
          onChange={(checked) => page.setDraftSettings((prev) => ({ ...prev, authLockoutEnabled: checked }))}
          title={t('settings.forms.auth.lockout.enable')}
        />
        <SettingsDisabledFieldset disabled={lockoutFieldsDisabled}>
          <div className={SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS}>
            <SettingsField
              label={t('settings.forms.auth.lockout.maxFailures')}
              labelInfo={t('settings.forms.auth.lockout.maxFailuresInfo')}
            >
              <UiSelect
                value={page.draftSettings.authLockoutMaxFailures}
                onChange={(e) => page.setDraftSettings((prev) => ({ ...prev, authLockoutMaxFailures: Number(e.target.value) }))}
                className={SETTINGS_CONTROL_CLASS}
                size="sm"
              >
                <option value={3}>{t('settings.forms.common.attempts', { count: 3 })}</option>
                <option value={5}>{t('settings.forms.common.attemptsDefault', { count: 5 })}</option>
                <option value={10}>{t('settings.forms.common.attempts', { count: 10 })}</option>
              </UiSelect>
            </SettingsField>

            <SettingsField
              label={t('settings.forms.auth.lockout.window')}
              labelInfo={t('settings.forms.auth.lockout.windowInfo')}
            >
              <UiSelect
                value={page.draftSettings.authLockoutWindowSeconds}
                onChange={(e) => page.setDraftSettings((prev) => ({ ...prev, authLockoutWindowSeconds: Number(e.target.value) }))}
                className={SETTINGS_CONTROL_CLASS}
                size="sm"
              >
                <option value={300}>{t('settings.forms.common.minutes', { count: 5 })}</option>
                <option value={900}>{t('settings.forms.common.minutes15Default')}</option>
                <option value={1800}>{t('settings.forms.common.minutes30')}</option>
                <option value={3600}>{t('settings.forms.common.hour1')}</option>
              </UiSelect>
            </SettingsField>
          </div>
        </SettingsDisabledFieldset>
      </SettingsFormGroup>
    </div>
  );
};
