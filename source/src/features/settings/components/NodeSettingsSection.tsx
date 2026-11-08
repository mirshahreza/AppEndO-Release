import React, { useEffect, useState } from 'react';
import { AppButton, UiCheckboxChoice, UiInput } from '../../../shared/ui';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { settingsScopeHintKey } from '../../../core/culture/translations/cultureKeyHelpers';
import { useSettingsFormT } from '../hooks/useSettingsFormT';
import { cn } from '../../../lib/utils';
import { SETTINGS_CONTROL_CLASS, SettingsFormGroup, SettingsField } from './form/SettingsFormPrimitives';
import {
  useNodeSettingsQuery,
  useUpdateNodeSettingsMutation,
} from '../../../shared/api/queries/settingsScope';

type NodeSettingsSectionProps = {
  variant: 'node-identity' | 'node-runtime';
};

export const NodeSettingsSection: React.FC<NodeSettingsSectionProps> = ({ variant }) => {
  const t = useSettingsFormT();
  const culture = useOptionalCulture();
  const nodeQuery = useNodeSettingsQuery();
  const updateNode = useUpdateNodeSettingsMutation();

  const [nodeName, setNodeName] = useState('');
  const [port, setPort] = useState(3000);
  const [logLevel, setLogLevel] = useState('debug');
  const [disableHmr, setDisableHmr] = useState(false);

  useEffect(() => {
    if (!nodeQuery.data) return;
    setNodeName(nodeQuery.data.nodeName);
    setPort(nodeQuery.data.port);
    setLogLevel(nodeQuery.data.logLevel);
    setDisableHmr(nodeQuery.data.disableHmr);
  }, [nodeQuery.data]);

  const scopeHint = culture?.ready
    ? culture.t(settingsScopeHintKey('node'))
    : '';

  if (nodeQuery.isLoading) {
    return <div className="text-sm text-slate-500">{t('settings.forms.node.loading')}</div>;
  }

  return (
    <>
      {scopeHint ? <p className="mb-4 text-sm text-slate-600">{scopeHint}</p> : null}

      {variant === 'node-identity' ? (
        <SettingsFormGroup title={t('settings.forms.node.identity.title')} sectionId="node-identity">
          <SettingsField
            label={t('settings.forms.node.identity.name')}
            hint={t('settings.forms.node.identity.nameHint')}
          >
            <UiInput value={nodeName} onChange={(e) => setNodeName(e.target.value)} className={cn(SETTINGS_CONTROL_CLASS, 'max-w-md')} size="sm" />
          </SettingsField>
          <AppButton
            intent="primary"
            onClick={() => updateNode.mutate({ nodeName })}
            disabled={updateNode.isPending}
          >
            {t('settings.forms.node.identity.save')}
          </AppButton>
        </SettingsFormGroup>
      ) : null}

      {variant === 'node-runtime' ? (
        <SettingsFormGroup title={t('settings.forms.node.runtime.title')} sectionId="node-runtime">
          <SettingsField label={t('settings.forms.node.runtime.port')}>
            <UiInput
              type="number"
              value={String(port)}
              onChange={(e) => setPort(Number(e.target.value) || 3000)}
              className={cn(SETTINGS_CONTROL_CLASS, 'max-w-xs')}
              size="sm"
            />
          </SettingsField>
          <SettingsField label={t('settings.forms.node.runtime.logLevel')}>
            <UiInput value={logLevel} onChange={(e) => setLogLevel(e.target.value)} className={cn(SETTINGS_CONTROL_CLASS, 'max-w-xs')} size="sm" />
          </SettingsField>
          <SettingsField label={t('settings.forms.node.runtime.disableHmr')}>
            <UiCheckboxChoice
              id="node-disable-hmr"
              checked={disableHmr}
              onChange={setDisableHmr}
              size="sm"
            >
              {t('settings.forms.node.runtime.disableHmrLabel')}
            </UiCheckboxChoice>
          </SettingsField>
          <AppButton
            intent="primary"
            onClick={() => updateNode.mutate({ port, logLevel, disableHmr })}
            disabled={updateNode.isPending}
          >
            {t('settings.forms.node.runtime.save')}
          </AppButton>
        </SettingsFormGroup>
      ) : null}
    </>
  );
};
