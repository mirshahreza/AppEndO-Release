import React, { useMemo, useState } from 'react';
import { Palette } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  AppButton,
  FormField,
  FormSection,
  UiVariableColorPicker,
  UiSelect,
  type UiVariableColorPickerSize,
  type UiVariableColorPickerVariant,
} from '../../../shared/ui';
import {
  createDefaultRgb,
  type RgbDefinition,
} from '../../../shared/lib/rgbDefinition';
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

export type VariableColorPickerBaseComponentsConfig = {
  variant: UiVariableColorPickerVariant;
  size: UiVariableColorPickerSize;
  showCssOutput: boolean;
  showSourceSelector: boolean;
  showPresets: boolean;
  compact: boolean;
  disabled: boolean;
};

const DEFAULT_CONFIG: VariableColorPickerBaseComponentsConfig = {
  variant: 'inline',
  size: 'md',
  showCssOutput: true,
  showSourceSelector: true,
  showPresets: true,
  compact: true,
  disabled: false,
};

export const resolveVariableColorPickerPreviewModel = (config: VariableColorPickerBaseComponentsConfig) => ({
  variant: config.variant,
  size: config.size,
  controls: {
    sourceSelector: config.showSourceSelector,
    cssOutput: config.showCssOutput,
    presets: config.showPresets,
  },
  compact: config.compact,
  disabled: config.disabled,
});

export const exportVariableColorPickerBaseComponentsConfig = (config: VariableColorPickerBaseComponentsConfig) => ({
  variant: config.variant,
  size: config.size,
  showCssOutput: config.showCssOutput,
  showSourceSelector: config.showSourceSelector,
  showPresets: config.showPresets,
  compact: config.compact,
  disabled: config.disabled,
});

export const VariableColorPickerBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<VariableColorPickerBaseComponentsConfig>(DEFAULT_CONFIG);
  const [colorValue, setColorValue] = useState<RgbDefinition>(() => createDefaultRgb());
  const configJson = useMemo(
    () => JSON.stringify(exportVariableColorPickerBaseComponentsConfig(config), null, 2),
    [config],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="variable-color-picker" json={configJson}>
          <BaseComponentsResetButton onClick={() => {
            setConfig(DEFAULT_CONFIG);
            setColorValue(createDefaultRgb());
          }} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Variable color picker" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Variant" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.variant}
                    onChange={(event) => setConfig((current) => ({
                      ...current,
                      variant: event.target.value as UiVariableColorPickerVariant,
                    }))}
                    ariaLabel="Variable color picker variant"
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
                      size: event.target.value as UiVariableColorPickerSize,
                    }))}
                    ariaLabel="Variable color picker size"
                  >
                    {(['sm', 'md', 'lg'] as const).map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </UiSelect>
                </FormField>
                {([
                  ['showCssOutput', 'Show CSS output'],
                  ['showSourceSelector', 'Show source selector'],
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

        <BaseComponentsPreviewFrame sectionId="variable-color-picker">
          <div className={BASE_COMPONENTS_PREVIEW_BODY_CLASS}>
            <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Palette className="size-4 text-cyan-500" aria-hidden />
                UiVariableColorPicker
              </div>
              <UiVariableColorPicker
                label="Variable color"
                value={colorValue}
                onChange={(next) => setColorValue(next)}
                variant={config.variant}
                size={config.size}
                disabled={config.disabled}
                showCssOutput={config.showCssOutput}
                showSourceSelector={config.showSourceSelector}
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
