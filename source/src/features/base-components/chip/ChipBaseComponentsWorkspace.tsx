import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  AppSelectionToggle,
  FormField,
  FormSection,
  UiChip,
  UiInput,
  UiSelect,
  type UiChipProps,
} from '../../../shared/ui';
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

const COLOR_OPTIONS: NonNullable<UiChipProps['color']>[] = ['default', 'accent', 'success', 'warning', 'danger'];
const SIZE_OPTIONS: NonNullable<UiChipProps['size']>[] = ['sm', 'md', 'lg'];
const VARIANT_OPTIONS: NonNullable<UiChipProps['variant']>[] = ['primary', 'secondary', 'soft', 'tertiary'];

export type ChipBaseComponentsConfig = {
  preset: 'status' | 'count' | 'input' | 'filter' | 'choice' | 'action';
  color: NonNullable<UiChipProps['color']>;
  size: NonNullable<UiChipProps['size']>;
  variant: NonNullable<UiChipProps['variant']>;
  label: string;
  content: 'label' | 'icon-label' | 'avatar-label';
  removable: boolean;
  selectable: boolean;
  selected: boolean;
  state: 'default' | 'selected' | 'disabled' | 'invalid';
  collection: 'single' | 'wrap' | 'overflow-summary';
};

const DEFAULT_CONFIG: ChipBaseComponentsConfig = {
  preset: 'status',
  color: 'accent',
  size: 'md',
  variant: 'soft',
  label: 'Active',
  content: 'label',
  removable: false,
  selectable: false,
  selected: false,
  state: 'default',
  collection: 'single',
};

export const resolveChipPreviewModel = (config: ChipBaseComponentsConfig) => {
  const interactive = config.preset === 'filter' || config.preset === 'choice' || config.preset === 'action';
  return {
    renderer: interactive ? 'AppSelectionToggle' : 'UiChip',
    interactive,
    selectable: config.selectable,
    selected: config.selectable || config.selected || config.state === 'selected',
    removable: !interactive && config.removable,
    displayedLabel: config.preset === 'count' ? (config.label || '0') : config.label,
    controls: {
      appearance: !interactive,
      content: config.preset !== 'count',
      selectedState: interactive,
    },
    collectionCount: config.collection === 'single' ? 1 : config.collection === 'overflow-summary' ? 3 : 4,
    overflowSummary: config.collection === 'overflow-summary' ? 1 : 0,
  } as const;
};

export const exportChipBaseComponentsConfig = (config: ChipBaseComponentsConfig) => {
  const { interactive } = resolveChipPreviewModel(config);
  return {
    preset: config.preset,
    label: config.preset === 'count' ? config.label || '0' : config.label,
    content: config.preset === 'count' ? 'label' : config.content,
    collection: config.collection,
    state: config.state,
    ...(interactive
      ? { selectable: config.selectable, selected: config.selectable || config.selected || config.state === 'selected' }
      : {
        color: config.color,
        size: config.size,
        variant: config.variant,
        removable: config.removable,
      }),
  };
};

export const ChipBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<ChipBaseComponentsConfig>(DEFAULT_CONFIG);
  const configJson = useMemo(() => JSON.stringify(exportChipBaseComponentsConfig(config), null, 2), [config]);
  const previewModel = resolveChipPreviewModel(config);
  const interactive = previewModel.interactive;
  const selected = previewModel.selected;
  const renderContent = (label: string) => (
    <>
      {config.content === 'icon-label' ? <Tag className="h-3 w-3" aria-hidden /> : null}
      {config.content === 'avatar-label' ? <span className="grid h-4 w-4 place-items-center rounded-full bg-slate-200 text-[8px]">AM</span> : null}
      {config.preset === 'count' ? (config.label || '0') : label}
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="chip" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Chip" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Preset" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.preset} onChange={(event) => {
                    const preset = event.target.value as ChipBaseComponentsConfig['preset'];
                    setConfig((current) => ({ ...current, preset, removable: preset === 'input', selectable: false, selected: false, state: 'default' }));
                  }} ariaLabel="Chip preset">
                    {['status', 'count', 'input', 'filter', 'choice', 'action'].map((preset) => <option key={preset} value={preset}>{preset}</option>)}
                  </UiSelect>
                </FormField>
                {previewModel.controls.appearance ? <FormField label="Color" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.color}
                    onChange={(event) => setConfig((current) => ({ ...current, color: event.target.value as ChipBaseComponentsConfig['color'] }))}
                    ariaLabel="Chip color"
                  >
                    {COLOR_OPTIONS.map((color) => (
                      <option key={color} value={color}>{color}</option>
                    ))}
                  </UiSelect>
                </FormField> : null}

                {previewModel.controls.appearance ? <FormField label="Size" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.size}
                    onChange={(event) => setConfig((current) => ({ ...current, size: event.target.value as ChipBaseComponentsConfig['size'] }))}
                    ariaLabel="Chip size"
                  >
                    {SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </UiSelect>
                </FormField> : null}

                {previewModel.controls.appearance ? <FormField label="Variant" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.variant}
                    onChange={(event) => setConfig((current) => ({ ...current, variant: event.target.value as ChipBaseComponentsConfig['variant'] }))}
                    ariaLabel="Chip variant"
                  >
                    {VARIANT_OPTIONS.map((variant) => (
                      <option key={variant} value={variant}>{variant}</option>
                    ))}
                  </UiSelect>
                </FormField> : null}

                <FormField label="Label" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiInput
                    size="sm"
                    value={config.label}
                    onChange={(event) => setConfig((current) => ({ ...current, label: event.target.value }))}
                  />
                </FormField>
                {previewModel.controls.content ? <FormField label="Content" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.content} onChange={(event) => setConfig((current) => ({ ...current, content: event.target.value as ChipBaseComponentsConfig['content'] }))} ariaLabel="Chip content">
                    <option value="label">label</option><option value="icon-label">icon and label</option><option value="avatar-label">avatar and label</option>
                  </UiSelect>
                </FormField> : null}
                <FormField label="Interaction" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={`${interactive ? config.selectable || config.selected ? 'selected' : 'unselected' : config.removable ? 'removable' : 'passive'}`} onChange={(event) => setConfig((current) => ({ ...current, removable: event.target.value === 'removable', selectable: event.target.value === 'selected', selected: event.target.value === 'selected' }))} ariaLabel="Chip interaction">
                    {interactive ? <><option value="unselected">unselected</option><option value="selected">selected</option></> : <><option value="passive">passive</option><option value="removable">removable</option></>}
                  </UiSelect>
                </FormField>
                <FormField label="State" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.state} onChange={(event) => setConfig((current) => ({ ...current, state: event.target.value as ChipBaseComponentsConfig['state'] }))} ariaLabel="Chip state">
                    {(interactive ? ['default', 'selected', 'disabled', 'invalid'] : ['default', 'disabled', 'invalid']).map((state) => <option key={state} value={state}>{state}</option>)}
                  </UiSelect>
                </FormField>
                <FormField label="Collection" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.collection} onChange={(event) => setConfig((current) => ({ ...current, collection: event.target.value as ChipBaseComponentsConfig['collection'] }))} ariaLabel="Chip collection">
                    <option value="single">single</option><option value="wrap">wrapping</option><option value="overflow-summary">overflow summary</option>
                  </UiSelect>
                </FormField>
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>

        <BaseComponentsPreviewFrame sectionId="chip">
          <div className={cn(BASE_COMPONENTS_PREVIEW_BODY_CLASS, 'gap-3')}>
            <div className={cn('flex items-center gap-2', config.collection === 'wrap' && 'max-w-xs flex-wrap')}>
              {(config.collection === 'single' ? [config.label] : ['Active', 'Priority', 'Assigned', 'Reviewed']).slice(0, config.collection === 'overflow-summary' ? 3 : undefined).map((label) => (
                <div key={label} className={cn('inline-flex items-center gap-1', config.state === 'disabled' && 'pointer-events-none opacity-45', config.state === 'invalid' && 'rounded-full ring-2 ring-rose-300')}>
                  {interactive ? (
                    <AppSelectionToggle type="button" selected={selected}>
                      {renderContent(label)}
                    </AppSelectionToggle>
                  ) : (
                    <UiChip color={config.color} size={config.size} variant={config.variant}>
                      <span className="inline-flex items-center gap-1">
                        {renderContent(label)}
                        {previewModel.removable ? <X className="h-3 w-3" aria-label={`Remove ${label}`} /> : null}
                      </span>
                    </UiChip>
                  )}
                </div>
              ))}
              {config.collection === 'overflow-summary' ? <UiChip size={config.size} variant="tertiary">+1</UiChip> : null}
            </div>
            <p className="text-xs text-slate-500">Passive status and count chips remain non-interactive; filter, choice, action, and removable modes expose explicit behavior.</p>
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
