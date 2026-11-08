import React, { useMemo, useState } from 'react';
import { ArrowLeft, Home } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  FormField,
  FormSection,
  UiBreadcrumbs,
  UiInput,
  UiSelect,
  type UiBreadcrumbItem,
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
  BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
  BASE_COMPONENTS_PREVIEW_BODY_CLASS,
} from '../baseComponentsConfiguratorLayout';

export type BreadcrumbsBaseComponentsConfig = {
  trail: string;
  preset: 'full' | 'collapsed-middle' | 'back-context';
  maxVisible: number;
  showHome: boolean;
  separator: 'chevron' | 'slash' | 'dot';
  longLabels: boolean;
  direction: 'ltr' | 'rtl';
  viewport: 'desktop' | 'tablet' | 'phone';
};

export const DEFAULT_BREADCRUMBS_BASE_COMPONENTS_CONFIG: BreadcrumbsBaseComponentsConfig = {
  trail: 'Studio, Data Studio, CMS, Contents',
  preset: 'full',
  maxVisible: 5,
  showHome: true,
  separator: 'chevron',
  longLabels: false,
  direction: 'ltr',
  viewport: 'desktop',
};

export function resolveBreadcrumbsPreviewModel(config: BreadcrumbsBaseComponentsConfig) {
  let labels = config.trail.split(',').map((label) => label.trim()).filter(Boolean);
  if (config.longLabels) {
    labels = labels.map((label, index) => index === labels.length - 1 ? `${label} with an intentionally long destination label` : label);
  }
  if (config.showHome) labels = ['Home', ...labels];
  if (config.preset === 'back-context') {
    const parent = labels.at(-2) ?? labels.at(-1) ?? 'Home';
    return {
      root: 'breadcrumbs',
      labels: [`Back to ${parent}`],
      parent,
      separator: null,
      direction: config.direction,
      viewport: config.viewport,
      showSeparatorControl: false,
      showMaximumVisibleControl: false,
    };
  }
  const minimum = config.preset === 'collapsed-middle' ? 4 : 2;
  const maxVisible = Math.max(minimum, Math.min(8, config.maxVisible));
  if (config.preset === 'collapsed-middle' && labels.length > 3) {
    labels = [labels[0]!, '…', ...labels.slice(-(Math.max(2, maxVisible - 2)))];
  } else if (labels.length > maxVisible) {
    labels = labels.slice(-maxVisible);
  }
  return {
    root: 'breadcrumbs',
    labels,
    parent: null,
    separator: config.separator,
    direction: config.direction,
    viewport: config.viewport,
    showSeparatorControl: true,
    showMaximumVisibleControl: true,
  };
}

export function applyBreadcrumbsPreset(
  config: BreadcrumbsBaseComponentsConfig,
  preset: BreadcrumbsBaseComponentsConfig['preset'],
): BreadcrumbsBaseComponentsConfig {
  return {
    ...config,
    preset,
    maxVisible: preset === 'collapsed-middle' ? Math.max(4, config.maxVisible) : config.maxVisible,
  };
}

export const BreadcrumbsBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<BreadcrumbsBaseComponentsConfig>(DEFAULT_BREADCRUMBS_BASE_COMPONENTS_CONFIG);
  const [navigationEvent, setNavigationEvent] = useState('Choose a breadcrumb destination.');
  const configJson = useMemo(() => JSON.stringify({
    public: {
      preset: config.preset,
      maxVisibleItems: config.maxVisible,
      showHome: config.showHome,
      separator: config.separator,
    },
    composition: {},
    demo: {
      fixtures: { trail: config.trail },
      scenarios: { longLabels: config.longLabels, direction: config.direction, viewport: config.viewport },
    },
  }, null, 2), [config]);

  const items: UiBreadcrumbItem[] = useMemo(() => {
    const model = resolveBreadcrumbsPreviewModel(config);
    const labels = model.labels;
    if (config.preset === 'back-context') {
      const parent = model.parent ?? 'Home';
      return [{ key: 'back', label: <span className="inline-flex items-center gap-1"><ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" /> Back to {parent}</span>, onPress: () => setNavigationEvent(`Navigated back to ${parent}.`) }];
    }
    return labels.map((label, index) => ({
      key: `${index}-${label}`,
      label: label === 'Home' && config.showHome ? <span className="inline-flex items-center gap-1"><Home className="h-3.5 w-3.5" /> Home</span> : label,
      onPress: index < labels.length - 1 ? () => setNavigationEvent(`Navigated to ${label}.`) : undefined,
    }));
  }, [config]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="breadcrumbs" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_BREADCRUMBS_BASE_COMPONENTS_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Breadcrumbs" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                {([
                  ['Preset', 'preset', ['full', 'collapsed-middle', 'back-context']],
                  ['Separator', 'separator', ['chevron', 'slash', 'dot']],
                  ['Direction', 'direction', ['ltr', 'rtl']],
                  ['Viewport', 'viewport', ['desktop', 'tablet', 'phone']],
                ] as const).filter(([label]) => config.preset !== 'back-context' || label !== 'Separator').map(([label, field, options]) => (
                  <FormField key={field} label={label} className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS} value={config[field]} onChange={(event) => setConfig((current) => (
                      field === 'preset'
                        ? applyBreadcrumbsPreset(current, event.target.value as BreadcrumbsBaseComponentsConfig['preset'])
                        : { ...current, [field]: event.target.value }
                    ))} ariaLabel={label}>
                      {options.map((value) => <option key={value} value={value}>{value}</option>)}
                    </UiSelect>
                  </FormField>
                ))}
                {config.preset !== 'back-context' ? <FormField label="Maximum visible" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiInput size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS} type="number" min={config.preset === 'collapsed-middle' ? 4 : 2} max={8} value={String(config.maxVisible)} onChange={(event) => {
                    const minimum = config.preset === 'collapsed-middle' ? 4 : 2;
                    setConfig((current) => ({ ...current, maxVisible: Math.max(minimum, Math.min(8, Number(event.target.value) || minimum)) }));
                  }} autoDir={false} />
                </FormField> : null}
                {([
                  ['Home item', 'showHome'],
                  ['Long labels', 'longLabels'],
                ] as const).map(([label, field]) => (
                  <FormField key={field} label={label} className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS} value={config[field] ? 'yes' : 'no'} onChange={(event) => setConfig((current) => ({ ...current, [field]: event.target.value === 'yes' }))} ariaLabel={label}>
                      <option value="yes">show</option><option value="no">hide</option>
                    </UiSelect>
                  </FormField>
                ))}
                <FormField label="Trail (comma-separated)" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiInput
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS}
                    value={config.trail}
                    onChange={(event) => setConfig((current) => ({ ...current, trail: event.target.value }))}
                  />
                </FormField>
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>

        <BaseComponentsPreviewFrame sectionId="breadcrumbs">
          <div data-bc-preview-root="breadcrumbs" className={cn(
            BASE_COMPONENTS_PREVIEW_BODY_CLASS,
            config.viewport === 'tablet' && 'mx-auto max-w-3xl',
            config.viewport === 'phone' && 'mx-auto max-w-sm',
          )} dir={config.direction}>
            <UiBreadcrumbs items={items} separator={config.separator} />
            <p className="text-xs text-slate-500">
              {navigationEvent}
            </p>
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
