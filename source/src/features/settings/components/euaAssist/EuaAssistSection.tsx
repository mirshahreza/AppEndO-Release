import React from 'react';
import { AppButton } from '../../../../shared/ui/AppButton';
import { UiInput, UiSelect } from '../../../../shared/ui/HeroFieldControls';
import { UiCheckboxChoice } from '../../../../shared/ui';
import { cn } from '../../../../lib/utils';
import { useSettingsFormT } from '../../hooks/useSettingsFormT';
import {
  SETTINGS_CONTROL_CLASS,
  SETTINGS_FORM_GRID_GAP_CLASS,
  SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS,
  SETTINGS_PANEL_PADDING_X_CLASS,
  SettingsField,
  SettingsFormGroup,
  SettingsFormShell,
} from '../form/SettingsFormPrimitives';

import type { EuaAssistSectionModel } from './useEuaAssistSection';

type EuaAssistSectionProps = {
  section: EuaAssistSectionModel;
};

const renderModelSelectOptions = (
  options: EuaAssistSectionModel['textModelOptions'],
) => (
  options.map((option) => (
    <option key={option.id} value={option.id}>{option.label}</option>
  ))
);

export const EuaAssistSection: React.FC<EuaAssistSectionProps> = ({ section }) => {
  const t = useSettingsFormT();

  if (section.isLoading) {
    return (
      <SettingsFormShell>
        <p className="text-sm text-slate-500">{t('settings.forms.eua.loading')}</p>
      </SettingsFormShell>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <SettingsFormShell>
        <SettingsFormGroup
          title={t('settings.forms.eua.capabilities.title')}
          sectionId="eua-assist"
          description={t('settings.forms.eua.capabilities.info')}
        >
          <div className={SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS}>
            {section.capabilityKeys.map((key) => (
              <UiCheckboxChoice
                key={key}
                size="sm"
                checked={section.draft.capabilities[key]}
                onChange={(checked) => section.setCapability(key, checked)}
              >
                <span className="text-xs text-slate-700">{section.capabilityLabels[key]}</span>
              </UiCheckboxChoice>
            ))}
          </div>
        </SettingsFormGroup>

        <SettingsFormGroup
          title={t('settings.forms.eua.models.title')}
          sectionId="eua-assist"
          divided
          description={t('settings.forms.eua.models.info')}
        >
          <div className={SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS}>
            <SettingsField
              label={t('settings.forms.eua.defaultTextModel')}
              labelInfo={t('settings.forms.eua.defaultTextModelInfo')}
            >
              <UiSelect
                size="sm"
                className={SETTINGS_CONTROL_CLASS}
                value={section.selectedTextModelId}
                disabled={!section.modelsAvailable}
                onChange={(event) => section.setTextModelId(event.target.value)}
              >
                {section.modelsAvailable
                  ? renderModelSelectOptions(section.textModelOptions)
                  : <option value="">{t('settings.forms.eua.noChatModels')}</option>}
              </UiSelect>
            </SettingsField>
            <SettingsField
              label={t('settings.forms.eua.defaultVisionModel')}
              labelInfo={t('settings.forms.eua.defaultVisionModelInfo')}
            >
              <UiSelect
                size="sm"
                className={SETTINGS_CONTROL_CLASS}
                value={section.selectedVisionModelId}
                disabled={section.visionModelOptions.length === 0}
                onChange={(event) => section.setVisionModelId(event.target.value)}
              >
                {section.visionModelOptions.length > 0
                  ? renderModelSelectOptions(section.visionModelOptions)
                  : <option value="">{t('settings.forms.eua.noVisionModels')}</option>}
              </UiSelect>
            </SettingsField>
          </div>
        </SettingsFormGroup>

        <SettingsFormGroup title={t('settings.forms.eua.limits.title')} sectionId="eua-assist" divided>
          <div className={SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS}>
            <SettingsField label={t('settings.forms.eua.rateLimit')}>
              <UiInput
                size="sm"
                type="number"
                className={SETTINGS_CONTROL_CLASS}
                value={section.draft.userRateLimitPerMinute?.toString() ?? ''}
                onChange={(event) => {
                  const raw = event.target.value.trim();
                  section.setDraft((current) => ({
                    ...current,
                    userRateLimitPerMinute: raw ? Number(raw) : undefined,
                  }));
                }}
                placeholder={t('settings.forms.eua.rateLimitPlaceholder')}
                aiAssist={false}
              />
            </SettingsField>
          </div>
          <div className={cn('flex flex-col', SETTINGS_FORM_GRID_GAP_CLASS)}>
            <UiCheckboxChoice
              id="eua-pii-warning-enabled"
              size="sm"
              checked={section.draft.piiWarningEnabled}
              onChange={(checked) => section.setDraft((current) => ({
                ...current,
                piiWarningEnabled: checked,
              }))}
            >
              <span className="text-xs text-slate-700">{t('settings.forms.eua.piiWarning')}</span>
            </UiCheckboxChoice>
            <UiCheckboxChoice
              id="eua-pii-opt-in-required"
              size="sm"
              checked={section.draft.piiOptInRequired}
              onChange={(checked) => section.setDraft((current) => ({
                ...current,
                piiOptInRequired: checked,
              }))}
            >
              <span className="text-xs text-slate-700">{t('settings.forms.eua.piiOptIn')}</span>
            </UiCheckboxChoice>
          </div>
        </SettingsFormGroup>

        {section.formError ? (
          <p className="text-sm text-rose-600">{section.formError}</p>
        ) : null}
      </SettingsFormShell>

      <div className={cn('border-t border-slate-200 bg-slate-50 py-3', SETTINGS_PANEL_PADDING_X_CLASS)}>
        <div className="mx-auto flex w-full max-w-2xl justify-end">
          <AppButton
            intent="primary"
            size="sm"
            disabled={!section.isDirty || section.isSaving}
            onClick={() => { void section.handleSave(); }}
          >
            {section.isSaving ? t('settings.ui.saving') : t('settings.forms.eua.save')}
          </AppButton>
        </div>
      </div>
    </div>
  );
};
