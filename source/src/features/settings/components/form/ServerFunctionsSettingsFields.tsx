import React from 'react';
import { UiSelect } from '../../../../shared/ui';
import type { SettingsPageModel } from '../../hooks/useSettingsPage';
import { useSettingsFormT } from '../../hooks/useSettingsFormT';
import {
  SETTINGS_CONTROL_CLASS,
  SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS,
  SETTINGS_SURFACE_STACK_CLASS,
  SettingsField,
  SettingsFormGroup,
  SettingsToggleField,
} from './SettingsFormPrimitives';

type ServerFunctionsSettingsFieldsProps = {
  page: SettingsPageModel;
};

export const ServerFunctionsSettingsFields: React.FC<ServerFunctionsSettingsFieldsProps> = ({ page }) => {
  const t = useSettingsFormT();

  return (
    <div className={SETTINGS_SURFACE_STACK_CLASS}>
      <SettingsFormGroup title={t('settings.forms.serverFunctions.execution.title')} sectionId="server-functions">
        <div className={SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS}>
          <SettingsField
            label={t('settings.forms.serverFunctions.vmMode')}
            labelInfo={t('settings.forms.serverFunctions.vmModeInfo')}
          >
            <UiSelect
              value={page.draftSettings.serverFunctionVmMode}
              onChange={(e) => page.setDraftSettings((prev) => ({ ...prev, serverFunctionVmMode: e.target.value }))}
              className={SETTINGS_CONTROL_CLASS}
              size="sm"
            >
              <option value="v20.x">{t('settings.forms.serverFunctions.vmMode.v20')}</option>
              <option value="v18.x">{t('settings.forms.serverFunctions.vmMode.v18')}</option>
            </UiSelect>
          </SettingsField>

          <SettingsField
            label={t('settings.forms.serverFunctions.ram')}
            labelInfo={t('settings.forms.serverFunctions.ramInfo')}
          >
            <UiSelect
              value={page.draftSettings.serverFunctionRamAllocation}
              onChange={(e) => page.setDraftSettings((prev) => ({ ...prev, serverFunctionRamAllocation: Number(e.target.value) }))}
              className={SETTINGS_CONTROL_CLASS}
              size="sm"
            >
              <option value={64}>{t('settings.forms.serverFunctions.ram.64')}</option>
              <option value={128}>{t('settings.forms.serverFunctions.ram.128')}</option>
              <option value={256}>{t('settings.forms.serverFunctions.ram.256')}</option>
            </UiSelect>
          </SettingsField>
        </div>

        <div className={SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS}>
          <SettingsField
            label={t('settings.forms.serverFunctions.timeout')}
            labelInfo={t('settings.forms.serverFunctions.timeoutInfo')}
          >
            <UiSelect
              value={page.draftSettings.serverFunctionTimeout}
              onChange={(e) => page.setDraftSettings((prev) => ({ ...prev, serverFunctionTimeout: Number(e.target.value) }))}
              className={SETTINGS_CONTROL_CLASS}
              size="sm"
            >
              <option value={1000}>{t('settings.forms.serverFunctions.timeout.1000')}</option>
              <option value={1500}>{t('settings.forms.serverFunctions.timeout.1500')}</option>
              <option value={3000}>{t('settings.forms.serverFunctions.timeout.3000')}</option>
              <option value={5000}>{t('settings.forms.serverFunctions.timeout.5000')}</option>
            </UiSelect>
          </SettingsField>
        </div>
      </SettingsFormGroup>

      <SettingsFormGroup title={t('settings.forms.serverFunctions.dataApiList.title')} sectionId="server-functions" divided>
        <SettingsToggleField
          id="dataApiListIncludeCountEnabled"
          checked={page.draftSettings.dataApiListIncludeCountEnabled}
          onChange={(checked) => page.setDraftSettings((prev) => ({
            ...prev,
            dataApiListIncludeCountEnabled: checked,
          }))}
          title={t('settings.forms.serverFunctions.dataApiList.includeCount')}
          titleInfo={t('settings.forms.serverFunctions.dataApiList.includeCountInfo')}
        />
        <SettingsToggleField
          id="dataApiListCacheDefaultEnabled"
          checked={page.draftSettings.dataApiListCacheDefaultEnabled}
          onChange={(checked) => page.setDraftSettings((prev) => ({
            ...prev,
            dataApiListCacheDefaultEnabled: checked,
          }))}
          title={t('settings.forms.serverFunctions.dataApiList.cacheDefault')}
          titleInfo={t('settings.forms.serverFunctions.dataApiList.cacheDefaultInfo')}
        />
        <SettingsField
          label={t('settings.forms.serverFunctions.dataApiList.cacheTtlMs')}
          labelInfo={t('settings.forms.serverFunctions.dataApiList.cacheTtlInfo')}
        >
          <UiSelect
            value={String(page.draftSettings.dataApiListCacheDefaultTtlMs)}
            onChange={(e) => page.setDraftSettings((prev) => ({
              ...prev,
              dataApiListCacheDefaultTtlMs: Number(e.target.value),
            }))}
            className={SETTINGS_CONTROL_CLASS}
            size="sm"
            disabled={!page.draftSettings.dataApiListCacheDefaultEnabled}
          >
            <option value={30_000}>{t('settings.forms.serverFunctions.dataApiList.cacheTtl.30s')}</option>
            <option value={60_000}>{t('settings.forms.serverFunctions.dataApiList.cacheTtl.60s')}</option>
            <option value={120_000}>{t('settings.forms.serverFunctions.dataApiList.cacheTtl.120s')}</option>
            <option value={300_000}>{t('settings.forms.serverFunctions.dataApiList.cacheTtl.300s')}</option>
          </UiSelect>
        </SettingsField>
      </SettingsFormGroup>

      <SettingsFormGroup title={t('settings.forms.serverFunctions.diagnostics.title')} sectionId="server-functions" divided>
        <SettingsToggleField
          id="autoLogging"
          checked={page.draftSettings.serverFunctionAutoLogging}
          onChange={(checked) => page.setDraftSettings((prev) => ({ ...prev, serverFunctionAutoLogging: checked }))}
          title={t('settings.forms.serverFunctions.autoLogging')}
          titleInfo={t('settings.forms.serverFunctions.autoLoggingInfo')}
        />
        <SettingsToggleField
          id="developerToolbar"
          checked={page.draftSettings.developerToolbar}
          onChange={(checked) => page.setDraftSettings((prev) => ({ ...prev, developerToolbar: checked }))}
          title={t('settings.forms.serverFunctions.developerToolbar')}
          titleInfo={t('settings.forms.serverFunctions.developerToolbarInfo')}
        />
      </SettingsFormGroup>
    </div>
  );
};
