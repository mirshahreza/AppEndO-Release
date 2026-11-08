import React, { useMemo, useState } from 'react';
import { Blend } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  AppButton,
  FormField,
  FormSection,
  UiGradientPicker,
  UiSelect,
  type UiGradientPickerSize,
  type UiGradientPickerVariant,
} from '../../../shared/ui';
import {
  createDefaultGradient,
  type GradientDefinition,
} from '../../../shared/lib/gradientDefinition';
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

export type GradientPickerBaseComponentsConfig = {
  variant: UiGradientPickerVariant;
  size: UiGradientPickerSize;
  showCssOutput: boolean;
  showTypeSelector: boolean;
  showReverse: boolean;
  showPresets: boolean;
  compact: boolean;
  disabled: boolean;
};

const DEFAULT_CONFIG: GradientPickerBaseComponentsConfig = {
  variant: 'inline',
  size: 'md',
  showCssOutput: false,
  showTypeSelector: true,
  showReverse: true,
  showPresets: true,
  compact: true,
  disabled: false,
};

export const resolveGradientPickerPreviewModel = (config: GradientPickerBaseComponentsConfig) => ({
  variant: config.variant,
  size: config.size,
  controls: {
    typeSelector: config.showTypeSelector,
    cssOutput: config.showCssOutput,
    reverse: config.showReverse,
    presets: config.showPresets,
  },
  compact: config.compact,
  disabled: config.disabled,
});

export const exportGradientPickerBaseComponentsConfig = (config: GradientPickerBaseComponentsConfig) => ({
  variant: config.variant,
  size: config.size,
  showCssOutput: config.showCssOutput,
  showTypeSelector: config.showTypeSelector,
  showReverse: config.showReverse,
  showPresets: config.showPresets,
  compact: config.compact,
  disabled: config.disabled,
});

export const GradientPickerBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<GradientPickerBaseComponentsConfig>(DEFAULT_CONFIG);
  const [gradientValue, setGradientValue] = useState<GradientDefinition>(() => createDefaultGradient('linear'));
  const configJson = useMemo(() => JSON.stringify(exportGradientPickerBaseComponentsConfig(config), null, 2), [config]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="gradient-picker" json={configJson}>
          <BaseComponentsResetButton onClick={() => {
            setConfig(DEFAULT_CONFIG);
            setGradientValue(createDefaultGradient('linear'));
          }} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Gradient picker" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Variant" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.variant}
                    onChange={(event) => setConfig((current) => ({
                      ...current,
                      variant: event.target.value as UiGradientPickerVariant,
                    }))}
                    ariaLabel="Gradient picker variant"
                  >
                    {(['field', 'popover', 'inline', 'swatch', 'minimal'] as const).map((variant) => (
                      <option key={variant} value={variant}>{variant}</option>
                    ))}
                  </UiSelect>
                </FormField>
                <FormField label="Size" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.size}
                    onChange={(event) => setConfig((current) => ({
                      ...current,
                      size: event.target.value as UiGradientPickerSize,
                    }))}
                    ariaLabel="Gradient picker size"
                  >
                    {(['sm', 'md', 'lg'] as const).map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </UiSelect>
                </FormField>
                {([
                  ['showCssOutput', 'Show CSS output'],
                  ['showTypeSelector', 'Show type selector'],
                  ['showReverse', 'Show reverse action'],
                  ['showPresets', 'Show presets panel'],
                  ['compact', 'Compact'],
                  ['disabled', 'Disabled'],
                ] as const).map(([key, label]) => (
                  <FormField key={key} label={label} className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <AppButton
                      size="sm"
                      intent={config[key] ? 'confirm' : 'secondary'}
                      onClick={() => setConfig((current) => ({ ...current, [key]: !current[key] }))}
                    >
                      {config[key] ? 'On' : 'Off'}
                    </AppButton>
                  </FormField>
                ))}
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>

        <BaseComponentsPreviewFrame sectionId="gradient-picker">
          <div className={BASE_COMPONENTS_PREVIEW_BODY_CLASS}>
            <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Blend className="size-4 text-violet-500" aria-hidden />
                UiGradientPicker
              </div>
              <UiGradientPicker
                label="Background gradient"
                value={gradientValue}
                onChange={(next) => setGradientValue(next)}
                variant={config.variant}
                size={config.size}
                disabled={config.disabled}
                showCssOutput={config.showCssOutput}
                showTypeSelector={config.showTypeSelector}
                showReverse={config.showReverse}
                showPresets={config.showPresets}
                compact={config.compact}
              />
            </div>
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
