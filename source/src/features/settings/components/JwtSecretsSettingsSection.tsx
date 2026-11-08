import React, { useState } from 'react';
import { AppButton, UiInput } from '../../../shared/ui';
import {
  usePlatformSecurityQuery,
  useUpdatePlatformSecurityMutation,
} from '../../../shared/api/queries/settingsScope';
import { useSettingsFormT } from '../hooks/useSettingsFormT';
import {
  SETTINGS_CONTROL_CLASS,
  SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS,
  SettingsField,
  SettingsFormGroup,
} from './form/SettingsFormPrimitives';

export const JwtSecretsSettingsSection: React.FC = () => {
  const t = useSettingsFormT();
  const securityQuery = usePlatformSecurityQuery();
  const updateSecurity = useUpdatePlatformSecurityMutation();

  const [accessSecret, setAccessSecret] = useState('');
  const [refreshSecret, setRefreshSecret] = useState('');

  if (securityQuery.isLoading) {
    return <div className="text-sm text-slate-500">{t('settings.forms.jwt.loading')}</div>;
  }

  const accessPreview = securityQuery.data?.accessTokenSecretPreview ?? '—';
  const refreshPreview = securityQuery.data?.refreshTokenSecretPreview ?? '—';

  return (
    <SettingsFormGroup
      title={t('settings.forms.jwt.title')}
      sectionId="jwt-secrets"
      titleInfo={t('settings.forms.jwt.info')}
    >
      <div className={SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS}>
        <SettingsField
          label={t('settings.forms.jwt.accessSecret')}
          htmlFor="jwtAccessTokenSecret"
          hint={t('settings.forms.jwt.current', { preview: accessPreview })}
          labelInfo={t('settings.forms.jwt.accessSecretInfo')}
        >
          <UiInput
            id="jwtAccessTokenSecret"
            type="password"
            value={accessSecret}
            onChange={(e) => setAccessSecret(e.target.value)}
            placeholder={t('settings.forms.jwt.keepCurrent')}
            className={SETTINGS_CONTROL_CLASS}
            size="sm"
          />
        </SettingsField>

        <SettingsField
          label={t('settings.forms.jwt.refreshSecret')}
          htmlFor="jwtRefreshTokenSecret"
          hint={t('settings.forms.jwt.current', { preview: refreshPreview })}
          labelInfo={t('settings.forms.jwt.refreshSecretInfo')}
        >
          <UiInput
            id="jwtRefreshTokenSecret"
            type="password"
            value={refreshSecret}
            onChange={(e) => setRefreshSecret(e.target.value)}
            placeholder={t('settings.forms.jwt.keepCurrent')}
            className={SETTINGS_CONTROL_CLASS}
            size="sm"
          />
        </SettingsField>
      </div>

      <AppButton
        intent="primary"
        onClick={() => updateSecurity.mutate({
          ...(accessSecret.trim() ? { accessTokenSecret: accessSecret.trim() } : {}),
          ...(refreshSecret.trim() ? { refreshTokenSecret: refreshSecret.trim() } : {}),
        })}
        disabled={updateSecurity.isPending || (!accessSecret.trim() && !refreshSecret.trim())}
      >
        {t('settings.forms.jwt.rotate')}
      </AppButton>
    </SettingsFormGroup>
  );
};
