import React, { useMemo, useState } from 'react';
import { cn } from '../../../lib/utils';
import {
  FormField,
  FormSection,
  UiComponentLayout,
  UiSelect,
  type ComponentLayoutPreset,
} from '../../../shared/ui';
import { BaseComponentsConfigAccordion } from '../components/BaseComponentsConfigAccordion';
import { BaseComponentsConfigToolbarControls, BaseComponentsResetButton } from '../components/BaseComponentsConfigDialog';
import { BaseComponentsHeaderActions } from '../components/BaseComponentsPageHeaderContext';
import { BaseComponentsPreviewFrame, BASE_COMPONENTS_WORKSPACE_INSET_CLASS } from '../components/BaseComponentsWorkspacePanel';
import {
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_PREVIEW_BODY_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
} from '../baseComponentsConfiguratorLayout';

export type ComponentLayoutBaseComponentsConfig = {
  preset: ComponentLayoutPreset;
  density: 'compact' | 'default';
  heightMode: 'content' | 'fill';
  direction: 'ltr' | 'rtl';
};

const DEFAULT_CONFIG: ComponentLayoutBaseComponentsConfig = {
  preset: 'form',
  density: 'default',
  heightMode: 'content',
  direction: 'ltr',
};

const PRESETS: ComponentLayoutPreset[] = ['form', 'editor-rail', 'inspector', 'settings-nav', 'dashboard', 'single'];

export const resolveComponentLayoutOptionLiveness = (config: ComponentLayoutBaseComponentsConfig) => ({
  visibleOptions: ['preset', 'density', 'heightMode', 'direction'],
  layoutProps: {
    preset: config.preset,
    density: config.density,
    heightMode: config.heightMode,
    direction: config.direction,
  },
});

export const ComponentLayoutBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<ComponentLayoutBaseComponentsConfig>(DEFAULT_CONFIG);
  const liveness = resolveComponentLayoutOptionLiveness(config);
  const configJson = useMemo(() => JSON.stringify(liveness.layoutProps, null, 2), [liveness]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="component-layout" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>
      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Component layout" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Preset" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.preset} onChange={(event) => setConfig((current) => ({ ...current, preset: event.target.value as ComponentLayoutPreset }))} ariaLabel="Preset">
                    {PRESETS.map((preset) => <option key={preset} value={preset}>{preset}</option>)}
                  </UiSelect>
                </FormField>
                <FormField label="Density" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.density} onChange={(event) => setConfig((current) => ({ ...current, density: event.target.value as ComponentLayoutBaseComponentsConfig['density'] }))} ariaLabel="Density">
                    <option value="default">default</option>
                    <option value="compact">compact</option>
                  </UiSelect>
                </FormField>
                <FormField label="Height" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.heightMode} onChange={(event) => setConfig((current) => ({ ...current, heightMode: event.target.value as ComponentLayoutBaseComponentsConfig['heightMode'] }))} ariaLabel="Height mode">
                    <option value="content">content</option>
                    <option value="fill">fill</option>
                  </UiSelect>
                </FormField>
                <FormField label="Direction" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.direction} onChange={(event) => setConfig((current) => ({ ...current, direction: event.target.value as ComponentLayoutBaseComponentsConfig['direction'] }))} ariaLabel="Direction">
                    <option value="ltr">ltr</option>
                    <option value="rtl">rtl</option>
                  </UiSelect>
                </FormField>
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>
        <BaseComponentsPreviewFrame sectionId="component-layout" fill={config.heightMode === 'fill'}>
          <div data-bc-preview-root="component-layout" className={BASE_COMPONENTS_PREVIEW_BODY_CLASS}>
            <UiComponentLayout
              className={cn('rounded-lg border border-slate-200 bg-white', config.heightMode === 'fill' && 'h-full min-h-0')}
              {...liveness.layoutProps}
              headerConfig={{ title: 'Header' }}
              footerConfig={{ title: 'Footer' }}
              startAsideConfig={{ title: 'Start' }}
              endAsideConfig={{ title: 'End' }}
              mainConfig={{ title: 'Main' }}
            >
              <p className="text-sm text-slate-600">Main region — page body, form, or canvas.</p>
            </UiComponentLayout>
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
