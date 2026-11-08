import React, { useMemo, useState } from 'react';
import { Droplet } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  AppButton,
  FormField,
  FormSection,
  UiColorPicker,
  UiSelect,
  type UiColorPickerSize,
  type UiColorPickerVariant,
} from '../../../shared/ui';
import type { ColorFormat } from '../../../shared/lib/colorMath';
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

export type ColorPickerBaseComponentsConfig = {
  variant: UiColorPickerVariant;
  format: ColorFormat;
  size: UiColorPickerSize;
  showAlpha: boolean;
  showPresets: boolean;
  showEyeDropper: boolean;
  showInput: boolean;
  clearable: boolean;
  disabled: boolean;
};

const DEFAULT_CONFIG: ColorPickerBaseComponentsConfig = {
  variant: 'field',
  format: 'hex',
  size: 'md',
  showAlpha: false,
  showPresets: true,
  showEyeDropper: true,
  showInput: true,
  clearable: false,
  disabled: false,
};

export const resolveColorPickerPreviewModel = (config: ColorPickerBaseComponentsConfig) => ({
  variant: config.variant,
  format: config.format,
  size: config.size,
  controls: {
    alpha: config.showAlpha,
    presets: config.showPresets,
    eyeDropper: config.showEyeDropper,
    input: config.showInput,
    clearable: config.clearable,
  },
  disabled: config.disabled,
});

export const exportColorPickerBaseComponentsConfig = (config: ColorPickerBaseComponentsConfig) => ({
  variant: config.variant,
  format: config.format,
  size: config.size,
  showAlpha: config.showAlpha,
  showPresets: config.showPresets,
  showEyeDropper: config.showEyeDropper,
  showInput: config.showInput,
  clearable: config.clearable,
  disabled: config.disabled,
});

export const ColorPickerBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<ColorPickerBaseComponentsConfig>(DEFAULT_CONFIG);
  const [colorValue, setColorValue] = useState('#00A28A');
  const configJson = useMemo(() => JSON.stringify(exportColorPickerBaseComponentsConfig(config), null, 2), [config]);
  const previewModel = resolveColorPickerPreviewModel(config);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="color-picker" json={configJson}>
          <BaseComponentsResetButton onClick={() => {
            setConfig(DEFAULT_CONFIG);
            setColorValue('#00A28A');
          }} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Color Picker" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Variant" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.variant}
                    onChange={(event) => setConfig((current) => ({
                      ...current,
                      variant: event.target.value as UiColorPickerVariant,
                    }))}
                    ariaLabel="Color picker variant"
                  >
                    {(['field', 'popover', 'inline', 'swatch', 'minimal'] as const).map((variant) => (
                      <option key={variant} value={variant}>{variant}</option>
                    ))}
                  </UiSelect>
                </FormField>
                <FormField label="Format" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.format}
                    onChange={(event) => setConfig((current) => ({
                      ...current,
                      format: event.target.value as ColorFormat,
                    }))}
                    ariaLabel="Color format"
                  >
                    {(['hex', 'rgb', 'hsl'] as const).map((format) => (
                      <option key={format} value={format}>{format}</option>
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
                      size: event.target.value as UiColorPickerSize,
                    }))}
                    ariaLabel="Color picker size"
                  >
                    {(['sm', 'md', 'lg'] as const).map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </UiSelect>
                </FormField>
                {([
                  ['showAlpha', 'Show alpha'],
                  ['showPresets', 'Show presets'],
                  ['showEyeDropper', 'Show eyedropper'],
                  ['showInput', 'Show input'],
                  ['clearable', 'Clearable'],
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

        <BaseComponentsPreviewFrame sectionId="color-picker">
          <div className={BASE_COMPONENTS_PREVIEW_BODY_CLASS}>
            <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Droplet className="size-4 text-rose-500" aria-hidden />
                UiColorPicker
              </div>
              <UiColorPicker
                label="Brand color"
                helperText="Spectrum picker with configurable format, alpha, presets, and eyedropper."
                value={colorValue}
                onChange={setColorValue}
                variant={config.variant}
                format={config.format}
                size={config.size}
                showAlpha={config.showAlpha}
                showPresets={config.showPresets}
                showEyeDropper={config.showEyeDropper}
                showInput={config.showInput}
                clearable={config.clearable}
                disabled={config.disabled}
              />
              <div
                className="h-24 rounded-md border border-slate-200 shadow-inner"
                style={{ backgroundColor: colorValue || '#ffffff' }}
                aria-label="Selected color preview"
              />
            </div>
            <pre className="rounded-md border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
              {JSON.stringify(previewModel, null, 2)}
            </pre>
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
