import React from 'react';
import { Wifi } from 'lucide-react';
import { AppButton, AppToast, QueryErrorPanel } from '../../../../shared/ui';
import { cn } from '../../../../lib/utils';
import { CacheSettingsFields } from '../../../cache/components/CacheSettingsFields';
import { useSettingsFormT } from '../../hooks/useSettingsFormT';
import {
  SETTINGS_SURFACE_STACK_CLASS,
  SettingsDisabledFieldset,
  SettingsFormGroup,
  SettingsToggleField,
} from '../form/SettingsFormPrimitives';
import { getSettingsTypography } from '../../settingsSectionTypography';
import type { CacheSettingsSectionModel } from './useCacheSettingsSection';

type CacheSettingsSectionProps = {
  page: CacheSettingsSectionModel;
};

export const CacheSettingsSection: React.FC<CacheSettingsSectionProps> = ({ page }) => {
  const t = useSettingsFormT();
  const typo = getSettingsTypography('cache');

  if (page.isLoading) {
    return <div className={typo.loadingText}>{t('settings.forms.cache.loading')}</div>;
  }

  if (page.isError && page.loadError) {
    return (
      <QueryErrorPanel
        message={t('settings.forms.cache.loadError')}
        detail={page.loadError}
        onRetry={() => void page.retryLoad()}
      />
    );
  }

  const isRedis = page.draftForm.driver === 'redis';
  const cacheFieldsDisabled = !page.draftForm.isEnabled;

  return (
    <div className={SETTINGS_SURFACE_STACK_CLASS}>
      <SettingsFormGroup title={t('settings.forms.cache.title')} sectionId="cache">
        <SettingsToggleField
          id="cache-enabled"
          checked={page.draftForm.isEnabled}
          onChange={(checked) => page.setDraftForm({ ...page.draftForm, isEnabled: checked })}
          title={t('settings.forms.cache.enabled')}
          description={t('settings.forms.cache.enabledInfo')}
        />
      </SettingsFormGroup>

      {page.formError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {page.formError}
        </div>
      ) : null}

      <SettingsFormGroup title={t('settings.forms.cache.storageDefaults')} sectionId="cache" divided>
        <SettingsDisabledFieldset disabled={cacheFieldsDisabled}>
          <CacheSettingsFields form={page.draftForm} onFormChange={page.setDraftForm} />
        </SettingsDisabledFieldset>
      </SettingsFormGroup>

      {isRedis ? (
        <SettingsFormGroup title={t('settings.forms.cache.connectionStatus')} sectionId="cache" divided>
          <SettingsDisabledFieldset disabled={cacheFieldsDisabled}>
            <AppButton
              intent="utility"
              size="sm"
              onClick={() => void page.handleTest()}
              disabled={page.isTesting || cacheFieldsDisabled}
            >
              <Wifi className={cn('w-3.5 h-3.5 text-slate-600', page.isTesting && 'animate-pulse text-cyan-600')} />
              {t('settings.forms.cache.testConnection')}
            </AppButton>
          </SettingsDisabledFieldset>
        </SettingsFormGroup>
      ) : null}

      {page.testMessage ? (
        <AppToast type={page.testMessage.type} text={page.testMessage.text} />
      ) : null}
    </div>
  );
};
