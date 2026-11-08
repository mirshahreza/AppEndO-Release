import React, { useMemo, useState } from 'react';
import {
  AppButton,
  AppSurfaceBox,
  FormField,
  FormSection,
  UiSelect,
  type AppSurfaceBoxLayout,
} from '../../../shared/ui';
import { ArrowRight, Loader2, Package } from 'lucide-react';
import type { AppSurfaceBoxTone } from '../../../shared/ui/surfaceClasses';
import { cn } from '../../../lib/utils';
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

const TONE_OPTIONS: AppSurfaceBoxTone[] = ['slate', 'violet', 'cyan', 'indigo', 'emerald', 'amber', 'rose'];

export type SurfaceBoxBaseComponentsConfig = {
  preset: 'static' | 'actionable' | 'selectable';
  orientation: 'vertical' | 'horizontal';
  surface: 'plain' | 'card' | 'inset';
  depth: 'flat' | 'bordered' | 'raised';
  density: 'compact' | 'default';
  state: 'default' | 'hover' | 'selected' | 'disabled' | 'loading';
  tone: AppSurfaceBoxTone;
  layout: AppSurfaceBoxLayout;
  fill: boolean;
  showTitle: boolean;
  showHeaderExtra: boolean;
  showSubtitle: boolean;
  showIcon: boolean;
  showFooter: boolean;
  collapsible: boolean;
};

export const DEFAULT_SURFACE_BOX_BASE_COMPONENTS_CONFIG: SurfaceBoxBaseComponentsConfig = {
  preset: 'static',
  orientation: 'vertical',
  surface: 'plain',
  depth: 'bordered',
  density: 'default',
  state: 'default',
  tone: 'cyan',
  layout: 'panel',
  fill: true,
  showTitle: true,
  showHeaderExtra: false,
  showSubtitle: true,
  showIcon: true,
  showFooter: false,
  collapsible: false,
};

export function resolveSurfaceBoxPreviewModel(config: SurfaceBoxBaseComponentsConfig) {
  const panel = config.layout === 'panel';
  const hasTitle = panel && config.showTitle;
  return {
    root: 'surface-box',
    props: {
      tone: config.tone,
      layout: config.layout,
      fill: panel && config.fill,
      collapsible: panel && config.collapsible,
    },
    recipe: {
      preset: config.preset,
      surface: config.surface,
      depth: config.depth,
      orientation: panel ? config.orientation : null,
      density: panel ? config.density : null,
      state: config.state,
    },
    slots: {
      title: hasTitle,
      subtitle: hasTitle && config.showSubtitle,
      icon: hasTitle && config.showIcon,
      headerExtra: panel && config.showHeaderExtra,
      footer: panel && config.preset === 'actionable' && config.showFooter,
    },
    controls: {
      panelOnly: panel,
      titleDetails: hasTitle,
      footer: panel && config.preset === 'actionable',
    },
    interactive: config.preset === 'selectable',
  };
}

export function applySurfaceBoxPreset(
  config: SurfaceBoxBaseComponentsConfig,
  preset: SurfaceBoxBaseComponentsConfig['preset'],
): SurfaceBoxBaseComponentsConfig {
  return {
    ...config,
    preset,
    showFooter: preset === 'actionable',
    state: preset === 'selectable' ? 'selected' : 'default',
  };
}

type SurfaceBoxBaseComponentsPreviewProps = {
  config: SurfaceBoxBaseComponentsConfig;
};

const SurfaceBoxBaseComponentsPreview: React.FC<SurfaceBoxBaseComponentsPreviewProps> = ({ config }) => {
  const model = resolveSurfaceBoxPreviewModel(config);
  const [selected, setSelected] = useState(config.state === 'selected');
  const [activity, setActivity] = useState('No surface action selected.');
  React.useEffect(() => setSelected(config.state === 'selected'), [config.state]);
  return (
  <div data-bc-preview-root="surface-box" className={BASE_COMPONENTS_PREVIEW_BODY_CLASS}>
    <div
      className={cn(
        config.preset === 'selectable' && 'cursor-pointer',
        config.fill && config.layout === 'panel' && 'flex h-full min-h-0 flex-1 flex-col',
      )}
      role={config.preset === 'selectable' ? 'button' : undefined}
      tabIndex={config.preset === 'selectable' ? 0 : undefined}
      onClick={config.preset === 'selectable' ? () => setSelected((value) => !value) : undefined}
      onKeyDown={config.preset === 'selectable' ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setSelected((value) => !value);
        }
      } : undefined}
    >
    <AppSurfaceBox
      tone={model.props.tone}
      layout={model.props.layout}
      fill={model.props.fill}
      title={config.showTitle ? (
        <span className="inline-flex items-center gap-2">
          {config.showIcon ? <Package className="h-4 w-4" /> : null}
          <span><span className="block">Deployment package</span>{config.showSubtitle ? <span className="block text-[10px] font-medium opacity-70">Ready for production</span> : null}</span>
        </span>
      ) : undefined}
      headerExtra={config.showHeaderExtra ? (
        <p className="truncate text-end text-[11px] font-medium text-slate-500">3 items selected</p>
      ) : undefined}
      className={cn(
        config.fill && 'h-full min-h-0',
        config.surface === 'plain' && 'bg-transparent',
        config.surface === 'card' && 'bg-white shadow-sm',
        config.surface === 'inset' && 'bg-slate-50',
        config.depth === 'flat' && '!border-transparent shadow-none',
        config.depth === 'raised' && 'shadow-lg',
        (config.state === 'selected' || selected) && 'ring-2 ring-primary-500',
        config.state === 'hover' && '-translate-y-0.5 shadow-md',
        config.state === 'disabled' && 'pointer-events-none opacity-50',
      )}
      collapsible={model.props.collapsible}
      defaultOpen
      bodyClassName={cn(
        config.density === 'compact' && '!p-2',
        config.orientation === 'horizontal' && 'flex items-center justify-between gap-4',
      )}
    >
      {config.layout === 'strip' ? (
        <p className="text-xs text-slate-600">Strip layout — inline metadata or compact summary row.</p>
      ) : (
        <div className={cn('space-y-2 p-3 text-xs text-slate-600', config.orientation === 'horizontal' && 'flex-1')}>
          {config.state === 'loading' ? <p className="inline-flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin" /> Loading package details…</p> : <p>Panel body scrolls when content exceeds the host.</p>}
          <p>Tone tints the header and border only — body stays neutral white.</p>
        </div>
      )}
      {config.showFooter && config.layout === 'panel' ? (
        <div className="flex items-center justify-end border-t border-slate-100 px-3 py-2">
          <AppButton intent="utility" size="sm" disabled={config.state === 'disabled'} onClick={(event) => { event.stopPropagation(); setActivity('Package details opened.'); }}>
            <ArrowRight className="h-3.5 w-3.5" /> View package
          </AppButton>
        </div>
      ) : null}
    </AppSurfaceBox>
    </div>
    <p className="mt-3 text-xs text-slate-500">
      {config.preset === 'selectable' ? (selected ? 'Surface selected.' : 'Surface not selected.') : activity}
    </p>
  </div>
  );
};

export const SurfaceBoxBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<SurfaceBoxBaseComponentsConfig>(DEFAULT_SURFACE_BOX_BASE_COMPONENTS_CONFIG);
  const configJson = useMemo(() => JSON.stringify({
    public: {
      layout: config.layout,
      fill: config.fill,
      tone: config.tone,
      collapsible: config.collapsible,
    },
    composition: {
      recipe: {
        preset: config.preset,
        surface: config.surface,
        depth: config.depth,
        ...(config.layout === 'panel' ? { orientation: config.orientation, density: config.density } : {}),
      },
      slots: { title: config.showTitle, subtitle: config.showSubtitle, icon: config.showIcon, headerExtra: config.showHeaderExtra, footer: config.showFooter },
    },
    demo: { fixtures: { content: 'deployment-package' }, scenarios: { state: config.state } },
  }, null, 2), [config]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="surface-box" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_SURFACE_BOX_BASE_COMPONENTS_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Shell" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                {([
                  ['Preset', 'preset', ['static', 'actionable', 'selectable']],
                  ['Orientation', 'orientation', ['vertical', 'horizontal']],
                  ['Surface', 'surface', ['plain', 'card', 'inset']],
                  ['Depth', 'depth', ['flat', 'bordered', 'raised']],
                  ['Density', 'density', ['compact', 'default']],
                  ['State', 'state', ['default', 'hover', 'selected', 'disabled', 'loading']],
                ] as const).filter(([label]) => config.layout === 'panel' || (label !== 'Orientation' && label !== 'Density')).map(([label, field, options]) => (
                  <FormField key={field} label={label} className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect
                      size="sm"
                      className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                      value={config[field]}
                      onChange={(event) => {
                        if (field === 'preset') {
                          const preset = event.target.value as SurfaceBoxBaseComponentsConfig['preset'];
                          setConfig((current) => applySurfaceBoxPreset(current, preset));
                          return;
                        }
                        setConfig((current) => ({ ...current, [field]: event.target.value }));
                      }}
                      ariaLabel={label}
                    >
                      {options.map((value) => <option key={value} value={value}>{value}</option>)}
                    </UiSelect>
                  </FormField>
                ))}
                <FormField label="Tone" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.tone}
                    onChange={(event) => {
                      const value = event.target.value as AppSurfaceBoxTone;
                      if (TONE_OPTIONS.includes(value)) {
                        setConfig((current) => ({ ...current, tone: value }));
                      }
                    }}
                    ariaLabel="Surface tone"
                  >
                    {TONE_OPTIONS.map((tone) => (
                      <option key={tone} value={tone}>{tone}</option>
                    ))}
                  </UiSelect>
                </FormField>

                <FormField label="Layout" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.layout}
                    onChange={(event) => {
                      const value = event.target.value as AppSurfaceBoxLayout;
                      if (value === 'panel' || value === 'strip') {
                        setConfig((current) => ({ ...current, layout: value }));
                      }
                    }}
                    ariaLabel="Layout"
                  >
                    <option value="panel">panel</option>
                    <option value="strip">strip</option>
                  </UiSelect>
                </FormField>

                {config.layout === 'panel' ? <FormField label="Fill host" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.fill ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        fill: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Fill host"
                  >
                    <option value="yes">yes</option>
                    <option value="no">no</option>
                  </UiSelect>
                </FormField> : null}

                {config.layout === 'panel' ? <FormField label="Title" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.showTitle ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        showTitle: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Title"
                  >
                    <option value="yes">show</option>
                    <option value="no">hide</option>
                  </UiSelect>
                </FormField> : null}

                {config.layout === 'panel' ? <FormField label="Header extra" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.showHeaderExtra ? 'yes' : 'no'}
                    onChange={(event) => {
                      setConfig((current) => ({
                        ...current,
                        showHeaderExtra: event.target.value === 'yes',
                      }));
                    }}
                    ariaLabel="Header extra"
                  >
                    <option value="no">hide</option>
                    <option value="yes">show</option>
                  </UiSelect>
                </FormField> : null}
                {config.layout === 'panel' ? ([
                  ...(config.showTitle ? [['Subtitle', 'showSubtitle'], ['Title icon', 'showIcon']] as const : []),
                  ...(config.preset === 'actionable' ? [['Footer', 'showFooter']] as const : []),
                  ['Collapsible', 'collapsible'] as const,
                ] as const).map(([label, field]) => (
                  <FormField key={field} label={label} className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config[field] ? 'yes' : 'no'} onChange={(event) => setConfig((current) => ({ ...current, [field]: event.target.value === 'yes' }))} ariaLabel={label}>
                      <option value="yes">show</option><option value="no">hide</option>
                    </UiSelect>
                  </FormField>
                )) : null}
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>

        <BaseComponentsPreviewFrame sectionId="surface-box" fill={config.fill && config.layout === 'panel'}>
          <SurfaceBoxBaseComponentsPreview config={config} />
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
