import React from 'react';
import { UiInput } from '../../../../shared/ui';
import type { SettingsPageModel } from '../../hooks/useSettingsPage';
import { useSettingsFormT } from '../../hooks/useSettingsFormT';
import { SmtpEncryptionField } from '../../../../shared/ui/SmtpEncryptionField';
import {
  SETTINGS_CONTROL_CLASS,
  SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS,
  SETTINGS_SURFACE_STACK_CLASS,
  SettingsDisabledFieldset,
  SettingsField,
  SettingsFormGroup,
  SettingsToggleField,
} from './SettingsFormPrimitives';

type EmailSettingsFieldsProps = {
  page: SettingsPageModel;
};

export const EmailSettingsFields: React.FC<EmailSettingsFieldsProps> = ({ page }) => {
  const t = useSettingsFormT();
  const smtpFieldsDisabled = !page.draftSettings.smtpEnabled;

  return (
    <div className={SETTINGS_SURFACE_STACK_CLASS}>
      <SettingsFormGroup title={t('settings.forms.email.delivery.title')} sectionId="email">
        <SettingsToggleField
          id="smtpEnabled"
          checked={page.draftSettings.smtpEnabled}
          onChange={(checked) => page.setDraftSettings((prev) => ({ ...prev, smtpEnabled: checked }))}
          title={t('settings.forms.email.smtpEnable')}
          titleInfo={t('settings.forms.email.smtpEnableInfo')}
        />
      </SettingsFormGroup>

      <SettingsFormGroup
        title={t('settings.forms.email.connection.title')}
        sectionId="email"
        divided
        titleInfo={t('settings.forms.email.connection.info')}
      >
        <SettingsDisabledFieldset disabled={smtpFieldsDisabled}>
          <div className={SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS}>
            <SettingsField label={t('settings.forms.email.fromEmail')} htmlFor="smtpFromEmail">
              <UiInput
                id="smtpFromEmail"
                value={page.draftSettings.smtpFromEmail}
                onChange={(e) => page.setDraftSettings((prev) => ({ ...prev, smtpFromEmail: e.target.value }))}
                className={SETTINGS_CONTROL_CLASS}
                size="sm"
              />
            </SettingsField>

            <SettingsField label={t('settings.forms.email.fromName')} htmlFor="smtpFromName">
              <UiInput
                id="smtpFromName"
                value={page.draftSettings.smtpFromName}
                onChange={(e) => page.setDraftSettings((prev) => ({ ...prev, smtpFromName: e.target.value }))}
                className={SETTINGS_CONTROL_CLASS}
                size="sm"
              />
            </SettingsField>
          </div>

          <div className={SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS}>
            <SettingsField label={t('settings.forms.email.host')} htmlFor="smtpHost">
              <UiInput
                id="smtpHost"
                value={page.draftSettings.smtpHost}
                onChange={(e) => page.setDraftSettings((prev) => ({ ...prev, smtpHost: e.target.value }))}
                className={SETTINGS_CONTROL_CLASS}
                size="sm"
              />
            </SettingsField>

            <SettingsField label={t('settings.forms.email.port')} htmlFor="smtpPort">
              <UiInput
                id="smtpPort"
                type="number"
                value={page.draftSettings.smtpPort}
                onChange={(e) => page.setDraftSettings((prev) => ({ ...prev, smtpPort: Number(e.target.value) || 465 }))}
                className={SETTINGS_CONTROL_CLASS}
                size="sm"
              />
            </SettingsField>
          </div>

          <div className={SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS}>
            <SettingsField label={t('settings.forms.email.username')} htmlFor="smtpUser">
              <UiInput
                id="smtpUser"
                value={page.draftSettings.smtpUser}
                onChange={(e) => page.setDraftSettings((prev) => ({ ...prev, smtpUser: e.target.value }))}
                className={SETTINGS_CONTROL_CLASS}
                size="sm"
              />
            </SettingsField>

            <SettingsField label={t('settings.forms.email.password')} htmlFor="smtpPass">
              <UiInput
                id="smtpPass"
                type="password"
                value={page.draftSettings.smtpPass}
                onChange={(e) => page.setDraftSettings((prev) => ({ ...prev, smtpPass: e.target.value }))}
                placeholder={page.draftSettings.smtpHasPassword ? t('settings.forms.email.keepSecret') : undefined}
                className={SETTINGS_CONTROL_CLASS}
                size="sm"
              />
            </SettingsField>
          </div>

          <SmtpEncryptionField
            value={page.draftSettings.smtpSecure}
            onChange={({ secure, port }) => page.setDraftSettings((prev) => ({
              ...prev,
              smtpSecure: secure,
              smtpPort: port,
            }))}
            accentClassName="border-indigo-300 bg-indigo-50/50"
            accentIconClassName="text-indigo-700"
          />
        </SettingsDisabledFieldset>
      </SettingsFormGroup>
    </div>
  );
};
