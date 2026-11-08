import React, { useMemo, useState } from 'react';
import { cn } from '../../../lib/utils';
import { FormField, FormSection, PhoneNumberDisplay, UiSelect } from '../../../shared/ui';
import { BaseComponentsHeaderActions } from '../components/BaseComponentsPageHeaderContext';
import {
  BaseComponentsPreviewFrame,
  BASE_COMPONENTS_WORKSPACE_INSET_CLASS,
} from '../components/BaseComponentsWorkspacePanel';
import { BaseComponentsResetButton, BaseComponentsConfigToolbarControls } from '../components/BaseComponentsConfigDialog';
import { BaseComponentsConfigAccordion } from '../components/BaseComponentsConfigAccordion';
import {
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
  BASE_COMPONENTS_PREVIEW_BODY_CLASS,
} from '../baseComponentsConfiguratorLayout';

const SAMPLE_PHONES = {
  'iraq-mobile': '07701234567',
  intl: '+1 202 555 0142',
  invalid: '12345',
} as const;

export type PhoneNumberBaseComponentsConfig = {
  sample: keyof typeof SAMPLE_PHONES;
  textSize: 'sm' | 'md';
  showCopy: boolean;
};

const DEFAULT_CONFIG: PhoneNumberBaseComponentsConfig = {
  sample: 'iraq-mobile',
  textSize: 'sm',
  showCopy: false,
};

export const resolvePhoneNumberPreviewModel = (config: PhoneNumberBaseComponentsConfig) => {
  const phone = SAMPLE_PHONES[config.sample];
  const textClassName = config.textSize === 'md'
    ? 'text-base tabular-nums text-slate-800'
    : 'text-sm tabular-nums text-slate-800';
  return {
    phone,
    textClassName,
    copyAriaLabel: config.showCopy ? 'Copy phone number' : undefined,
    hasLinks: config.sample !== 'invalid',
  } as const;
};

export const exportPhoneNumberBaseComponentsConfig = (config: PhoneNumberBaseComponentsConfig) => ({
  sample: config.sample,
  textSize: config.textSize,
  showCopy: config.showCopy,
});

export const PhoneNumberBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<PhoneNumberBaseComponentsConfig>(DEFAULT_CONFIG);
  const configJson = useMemo(
    () => JSON.stringify(exportPhoneNumberBaseComponentsConfig(config), null, 2),
    [config],
  );
  const model = useMemo(() => resolvePhoneNumberPreviewModel(config), [config]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="phone-number" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Phone number" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Sample" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.sample}
                    onChange={(event) => setConfig((current) => ({
                      ...current,
                      sample: event.target.value as PhoneNumberBaseComponentsConfig['sample'],
                    }))}
                    ariaLabel="Sample phone"
                  >
                    <option value="iraq-mobile">Iraq mobile</option>
                    <option value="intl">International</option>
                    <option value="invalid">Invalid</option>
                  </UiSelect>
                </FormField>
                <FormField label="Text size" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.textSize}
                    onChange={(event) => setConfig((current) => ({
                      ...current,
                      textSize: event.target.value as PhoneNumberBaseComponentsConfig['textSize'],
                    }))}
                    ariaLabel="Text size"
                  >
                    <option value="sm">sm</option>
                    <option value="md">base</option>
                  </UiSelect>
                </FormField>
                <FormField label="Copy on click" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.showCopy ? 'yes' : 'no'}
                    onChange={(event) => setConfig((current) => ({
                      ...current,
                      showCopy: event.target.value === 'yes',
                    }))}
                    ariaLabel="Copy on click"
                  >
                    <option value="no">Off</option>
                    <option value="yes">On</option>
                  </UiSelect>
                </FormField>
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>
        <BaseComponentsPreviewFrame>
          <div className={BASE_COMPONENTS_PREVIEW_BODY_CLASS}>
            <PhoneNumberDisplay
              phone={model.phone}
              textClassName={model.textClassName}
              copyAriaLabel={model.copyAriaLabel}
              copiedToastMessage={model.copyAriaLabel ? 'Copied' : undefined}
              fallback={<span className="text-sm text-slate-400">{model.phone}</span>}
            />
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
