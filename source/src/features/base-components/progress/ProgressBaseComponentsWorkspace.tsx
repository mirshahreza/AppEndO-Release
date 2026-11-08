import React, { useMemo, useState } from 'react';
import { cn } from '../../../lib/utils';
import {
  FormField,
  FormSection,
  LoadingSpinner,
  UiInput,
  UiProgress,
  UiSelect,
  type UiProgressProps,
} from '../../../shared/ui';
import { BaseComponentsHeaderActions } from '../components/BaseComponentsPageHeaderContext';
import {
  BaseComponentsPreviewFrame,
  BASE_COMPONENTS_WORKSPACE_INSET_CLASS,
} from '../components/BaseComponentsWorkspacePanel';
import { BaseComponentsResetButton, BaseComponentsConfigToolbarControls } from '../components/BaseComponentsConfigDialog';
import { BaseComponentsConfigAccordion } from '../components/BaseComponentsConfigAccordion';
import { BaseComponentsConfigBoolField } from '../components/BaseComponentsConfigBoolField';
import {
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
  BASE_COMPONENTS_PREVIEW_BODY_CLASS,
} from '../baseComponentsConfiguratorLayout';

const COLOR_OPTIONS: NonNullable<UiProgressProps['color']>[] = ['default', 'accent', 'success', 'warning', 'danger'];
const SIZE_OPTIONS: NonNullable<UiProgressProps['size']>[] = ['sm', 'md'];

export type ProgressBaseComponentsConfig = {
  preset: 'bar' | 'spinner' | 'inline-operation' | 'steps';
  value: number;
  color: NonNullable<UiProgressProps['color']>;
  size: NonNullable<UiProgressProps['size']>;
  isIndeterminate: boolean;
  showOutput: boolean;
  status: 'inactive' | 'active' | 'success' | 'error' | 'paused';
  presentation: 'inline' | 'block' | 'overlay';
  showLabel: boolean;
};

const DEFAULT_CONFIG: ProgressBaseComponentsConfig = {
  preset: 'bar',
  value: 60,
  color: 'accent',
  size: 'md',
  isIndeterminate: false,
  showOutput: true,
  status: 'active',
  presentation: 'block',
  showLabel: true,
};

export const resolveProgressPreviewModel = (config: ProgressBaseComponentsConfig) => {
  const usesBar = config.preset === 'bar' || config.preset === 'inline-operation';
  const color = config.status === 'success' ? 'success' : config.status === 'error' ? 'danger' : config.status === 'paused' ? 'warning' : config.color;
  return {
    renderer: config.preset === 'spinner' ? 'LoadingSpinner' : config.preset === 'steps' ? 'steps' : 'UiProgress',
    progressProps: usesBar ? {
      value: config.value,
      color,
      size: config.size,
      isIndeterminate: config.isIndeterminate || config.preset === 'inline-operation',
      showOutput: config.showLabel && config.showOutput,
      label: config.showLabel ? `${config.status === 'active' ? 'Uploading' : config.status}…` : undefined,
    } : null,
    controls: {
      value: config.preset !== 'spinner' && config.preset !== 'inline-operation',
      color: usesBar && (config.status === 'active' || config.status === 'inactive'),
      status: usesBar,
      size: usesBar,
      indeterminate: config.preset === 'bar',
      label: config.preset !== 'steps',
      output: usesBar && config.showLabel,
    },
  } as const;
};

export const exportProgressBaseComponentsConfig = (config: ProgressBaseComponentsConfig) => ({
  preset: config.preset,
  presentation: config.presentation,
  ...(config.preset === 'bar' || config.preset === 'inline-operation'
    ? {
      value: config.preset === 'bar' && !config.isIndeterminate ? config.value : undefined,
      color: config.status === 'success' ? 'success' : config.status === 'error' ? 'danger' : config.status === 'paused' ? 'warning' : config.color,
      size: config.size,
      isIndeterminate: config.preset === 'inline-operation' || config.isIndeterminate,
      showOutput: config.showLabel && config.showOutput,
      showLabel: config.showLabel,
      status: config.status,
    }
    : config.preset === 'steps'
      ? { value: config.value }
      : { showLabel: config.showLabel }),
});

export const ProgressBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<ProgressBaseComponentsConfig>(DEFAULT_CONFIG);
  const configJson = useMemo(() => JSON.stringify(exportProgressBaseComponentsConfig(config), null, 2), [config]);
  const previewModel = resolveProgressPreviewModel(config);
  const usesBar = previewModel.controls.status;
  const resolvedColor = previewModel.progressProps?.color ?? config.color;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="progress" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Progress" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Preset" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.preset} onChange={(event) => setConfig((current) => ({ ...current, preset: event.target.value as ProgressBaseComponentsConfig['preset'] }))} ariaLabel="Progress preset">
                    <option value="bar">bar</option><option value="spinner">spinner</option><option value="inline-operation">inline operation</option><option value="steps">steps</option>
                  </UiSelect>
                </FormField>
                {previewModel.controls.value ? <FormField label="Value" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiInput
                    size="sm"
                    type="number"
                    min={0}
                    max={100}
                    className={BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS}
                    value={config.value}
                    onChange={(event) => setConfig((current) => ({ ...current, value: Number(event.target.value) || 0 }))}
                    disabled={config.isIndeterminate}
                  />
                </FormField> : null}

                {previewModel.controls.color ? <FormField label="Color" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.color}
                    onChange={(event) => setConfig((current) => ({ ...current, color: event.target.value as ProgressBaseComponentsConfig['color'] }))}
                    ariaLabel="Progress color"
                  >
                    {COLOR_OPTIONS.map((color) => (
                      <option key={color} value={color}>{color}</option>
                    ))}
                  </UiSelect>
                </FormField> : null}
                {usesBar ? <FormField label="Status" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.status} onChange={(event) => setConfig((current) => ({ ...current, status: event.target.value as ProgressBaseComponentsConfig['status'] }))} ariaLabel="Progress status">
                    {['inactive', 'active', 'success', 'error', 'paused'].map((status) => <option key={status} value={status}>{status}</option>)}
                  </UiSelect>
                </FormField> : null}
                <FormField label="Presentation" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.presentation} onChange={(event) => setConfig((current) => ({ ...current, presentation: event.target.value as ProgressBaseComponentsConfig['presentation'] }))} ariaLabel="Progress presentation">
                    <option value="inline">inline</option><option value="block">block</option><option value="overlay">overlay</option>
                  </UiSelect>
                </FormField>

                {usesBar ? <FormField label="Size" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.size}
                    onChange={(event) => setConfig((current) => ({ ...current, size: event.target.value as ProgressBaseComponentsConfig['size'] }))}
                    ariaLabel="Progress size"
                  >
                    {SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </UiSelect>
                </FormField> : null}

                {previewModel.controls.indeterminate ? (
                  <BaseComponentsConfigBoolField
                    label="Indeterminate"
                    checked={config.isIndeterminate}
                    ariaLabel="Indeterminate"
                    onChange={(checked) => setConfig((current) => ({ ...current, isIndeterminate: checked }))}
                  />
                ) : null}
                {previewModel.controls.label ? (
                  <BaseComponentsConfigBoolField
                    label="Show label"
                    checked={config.showLabel}
                    ariaLabel="Show label"
                    onChange={(checked) => setConfig((current) => ({ ...current, showLabel: checked }))}
                  />
                ) : null}

                {previewModel.controls.output ? (
                  <BaseComponentsConfigBoolField
                    label="Show output"
                    checked={config.showOutput}
                    ariaLabel="Show output"
                    onChange={(checked) => setConfig((current) => ({ ...current, showOutput: checked }))}
                  />
                ) : null}
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>

        <BaseComponentsPreviewFrame sectionId="progress">
          <div className={cn(BASE_COMPONENTS_PREVIEW_BODY_CLASS, config.presentation === 'inline' && 'w-fit self-start flex-row items-center rounded-md bg-slate-50 px-3 py-2', config.presentation === 'overlay' && 'relative rounded-lg border border-slate-200 bg-slate-50 p-8')}>
            {config.preset === 'spinner' ? (
              <div className="flex items-center gap-2" role="status"><LoadingSpinner className="h-5 w-5 animate-spin text-indigo-500" label="Uploading" /><span className="text-sm text-slate-600">{config.showLabel ? 'Uploading…' : null}</span></div>
            ) : config.preset === 'steps' ? (
              <ol className="flex w-full max-w-md items-center gap-2" aria-label="Upload progress">{['Prepare', 'Upload', 'Verify'].map((step, index) => <li key={step} className={cn('flex flex-1 items-center gap-1 text-xs', index * 50 <= config.value ? 'text-indigo-700' : 'text-slate-400')}><span className="grid h-5 w-5 place-items-center rounded-full border">{index + 1}</span>{step}</li>)}</ol>
            ) : (
              <UiProgress value={previewModel.progressProps?.value} color={resolvedColor} size={previewModel.progressProps?.size} isIndeterminate={previewModel.progressProps?.isIndeterminate} showOutput={previewModel.progressProps?.showOutput} label={previewModel.progressProps?.label} className={cn('w-full max-w-sm', config.status === 'inactive' && 'opacity-50', config.status === 'paused' && 'saturate-50')} />
            )}
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
