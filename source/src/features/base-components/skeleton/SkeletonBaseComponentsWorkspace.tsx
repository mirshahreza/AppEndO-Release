import React, { useMemo, useState } from 'react';
import { cn } from '../../../lib/utils';
import {
  FormField,
  FormSection,
  UiSelect,
  UiSkeleton,
  type UiSkeletonProps,
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

const ANIMATION_OPTIONS: NonNullable<UiSkeletonProps['animationType']>[] = ['pulse', 'shimmer', 'none'];

export type SkeletonBaseComponentsConfig = {
  preset: 'text' | 'avatar' | 'card' | 'form' | 'table' | 'list';
  animationType: NonNullable<UiSkeletonProps['animationType']>;
  density: 'compact' | 'default';
  rows: number;
  reducedMotion: boolean;
};

const DEFAULT_CONFIG: SkeletonBaseComponentsConfig = {
  preset: 'text',
  animationType: 'shimmer',
  density: 'default',
  rows: 3,
  reducedMotion: false,
};

const PRESET_OPTIONS: SkeletonBaseComponentsConfig['preset'][] = ['text', 'avatar', 'card', 'form', 'table', 'list'];
const ROW_PRESETS: SkeletonBaseComponentsConfig['preset'][] = ['text', 'form', 'table', 'list'];

export const resolveSkeletonPreviewModel = (config: SkeletonBaseComponentsConfig) => ({
  animationType: config.reducedMotion ? 'none' as const : config.animationType,
  gapClass: config.density === 'compact' ? 'gap-1.5' : 'gap-3',
  rowCount: ROW_PRESETS.includes(config.preset) ? config.rows : null,
  showAnimationControl: !config.reducedMotion,
  showRowsControl: ROW_PRESETS.includes(config.preset),
});

export const exportSkeletonBaseComponentsConfig = (config: SkeletonBaseComponentsConfig) => ({
  preset: config.preset,
  animationType: config.reducedMotion ? 'none' : config.animationType,
  density: config.density,
  ...(ROW_PRESETS.includes(config.preset) ? { rows: config.rows } : {}),
  reducedMotion: config.reducedMotion,
});

const SkeletonPresetPreview: React.FC<{ config: SkeletonBaseComponentsConfig }> = ({ config }) => {
  const model = resolveSkeletonPreviewModel(config);
  const animationType = model.animationType;
  const gap = model.gapClass;
  const rows = Array.from({ length: config.rows }, (_, index) => index);

  if (config.preset === 'avatar') {
    return <div className={cn('flex items-center', gap)}><UiSkeleton animationType={animationType} className="h-10 w-10 rounded-full" /><UiSkeleton animationType={animationType} className="h-3 w-40 rounded" /></div>;
  }
  if (config.preset === 'card') {
    return <div className={cn('flex max-w-md flex-col', gap)}><UiSkeleton animationType={animationType} className="h-28 w-full rounded-lg" /><UiSkeleton animationType={animationType} className="h-3 w-2/3 rounded" /><UiSkeleton animationType={animationType} className="h-3 w-1/2 rounded" /></div>;
  }
  if (config.preset === 'form') {
    return <div className={cn('flex max-w-md flex-col', gap)}>{rows.map((row) => <div key={row} className="space-y-1"><UiSkeleton animationType={animationType} className="h-2.5 w-24 rounded" /><UiSkeleton animationType={animationType} className="h-8 w-full rounded-md" /></div>)}</div>;
  }
  if (config.preset === 'table') {
    return <div className={cn('grid max-w-xl grid-cols-3', gap)}>{rows.flatMap((row) => [0, 1, 2].map((column) => <UiSkeleton key={`${row}-${column}`} animationType={animationType} className="h-7 rounded" />))}</div>;
  }
  if (config.preset === 'list') {
    return <div className={cn('flex max-w-md flex-col', gap)}>{rows.map((row) => <div key={row} className="flex items-center gap-2"><UiSkeleton animationType={animationType} className="h-7 w-7 rounded" /><UiSkeleton animationType={animationType} className="h-3 flex-1 rounded" /></div>)}</div>;
  }
  return <div className={cn('flex max-w-md flex-col', gap)}>{rows.map((row) => <UiSkeleton key={row} animationType={animationType} className={cn('h-3 rounded', row % 2 ? 'w-2/3' : 'w-full')} />)}</div>;
};

export const SkeletonBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<SkeletonBaseComponentsConfig>(DEFAULT_CONFIG);
  const configJson = useMemo(() => JSON.stringify(exportSkeletonBaseComponentsConfig(config), null, 2), [config]);
  const previewModel = resolveSkeletonPreviewModel(config);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="skeleton" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Skeleton" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Preset" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.preset} onChange={(event) => setConfig((current) => ({ ...current, preset: event.target.value as SkeletonBaseComponentsConfig['preset'] }))} ariaLabel="Skeleton preset">
                    {PRESET_OPTIONS.map((preset) => <option key={preset} value={preset}>{preset}</option>)}
                  </UiSelect>
                </FormField>
                {previewModel.showAnimationControl ? <FormField label="Animation" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.animationType}
                    onChange={(event) => setConfig((current) => ({ ...current, animationType: event.target.value as SkeletonBaseComponentsConfig['animationType'] }))}
                    ariaLabel="Skeleton animation"
                  >
                    {ANIMATION_OPTIONS.map((animationType) => (
                      <option key={animationType} value={animationType}>{animationType}</option>
                    ))}
                  </UiSelect>
                </FormField> : null}
                <FormField label="Density" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.density} onChange={(event) => setConfig((current) => ({ ...current, density: event.target.value as SkeletonBaseComponentsConfig['density'] }))} ariaLabel="Skeleton density">
                    <option value="compact">compact</option><option value="default">default</option>
                  </UiSelect>
                </FormField>
                {previewModel.showRowsControl ? <FormField label="Rows" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={String(config.rows)} onChange={(event) => setConfig((current) => ({ ...current, rows: Number(event.target.value) }))} ariaLabel="Skeleton rows">
                    {[1, 2, 3, 4, 5, 6].map((rows) => <option key={rows} value={rows}>{rows}</option>)}
                  </UiSelect>
                </FormField> : null}
                <FormField label="Reduced motion" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.reducedMotion ? 'yes' : 'no'} onChange={(event) => setConfig((current) => ({ ...current, reducedMotion: event.target.value === 'yes' }))} ariaLabel="Reduced motion">
                    <option value="no">normal</option><option value="yes">static</option>
                  </UiSelect>
                </FormField>
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>

        <BaseComponentsPreviewFrame sectionId="skeleton">
          <div className={cn(BASE_COMPONENTS_PREVIEW_BODY_CLASS, 'gap-3')} aria-busy="true" aria-label={`${config.preset} content loading`}>
            <SkeletonPresetPreview config={config} />
            <p className="text-xs text-slate-500">The content host owns aria-busy; reduced motion forces a static placeholder.</p>
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
