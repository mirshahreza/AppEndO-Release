import * as React from 'react';
import { Menu, MoreHorizontal, Save } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  AppButton,
  FormField,
  FormSection,
  ShellAccentControl,
  ShellAside,
  ShellBackToTop,
  ShellContentHost,
  ShellFooter,
  ShellFrame,
  ShellHeader,
  ShellHeaderActions,
  ShellHeaderContext,
  ShellHero,
  ShellLogoRegion,
  ShellMotionControl,
  ShellRegion,
  ShellResponsiveDrawer,
  ShellResponsivePopover,
  ShellSidebar,
  ShellSurface,
  UiSelect,
  type ShellDirection,
  type ShellViewportTier,
  type ShellBoundedEdge,
  type ShellBoundedMaxWidth,
  type ShellLayoutWidth,
} from '../../../shared/ui';
import {
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_PREVIEW_BODY_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
} from '../baseComponentsConfiguratorLayout';
import { BaseComponentsConfigToolbarControls, BaseComponentsResetButton } from '../components/BaseComponentsConfigDialog';
import { BaseComponentsConfigAccordion } from '../components/BaseComponentsConfigAccordion';
import { BaseComponentsConfigBoolField } from '../components/BaseComponentsConfigBoolField';
import { BaseComponentsHeaderActions } from '../components/BaseComponentsPageHeaderContext';
import {
  BaseComponentsPreviewFrame,
  BASE_COMPONENTS_WORKSPACE_INSET_CLASS,
} from '../components/BaseComponentsWorkspacePanel';

export const SHELL_FOUNDATION_COMPONENT_IDS = [
  'ShellFrame',
  'ShellRegion',
  'ShellHeader',
  'ShellSidebar',
  'ShellContentHost',
  'ShellAside',
  'ShellHero',
  'ShellFooter',
  'ShellSurface',
  'ShellLogoRegion',
  'ShellHeaderContext',
  'ShellHeaderActions',
  'ShellResponsiveDrawer',
  'ShellResponsivePopover',
  'ShellAccentControl',
  'ShellMotionControl',
  'ShellBackToTop',
] as const;

type FoundationComponentId = (typeof SHELL_FOUNDATION_COMPONENT_IDS)[number];
type FoundationState = 'default' | 'sticky' | 'shrunk' | 'collapsed' | 'open' | 'loading' | 'empty';
type SurfacePreset = 'neutral' | 'raised' | 'inset' | 'glass';

export type ShellFoundationGalleryConfig = {
  component: FoundationComponentId;
  layoutWidth: ShellLayoutWidth;
  boundedMaxWidth: ShellBoundedMaxWidth;
  boundedEdge: ShellBoundedEdge;
  preset: 'component-default' | 'compact' | 'floating' | 'editorial' | 'glass';
  surface: SurfacePreset;
  state: FoundationState;
  viewport: ShellViewportTier;
  direction: ShellDirection;
  forcedColors: boolean;
  focusTrace: boolean;
};

export const DEFAULT_SHELL_FOUNDATION_GALLERY_CONFIG: ShellFoundationGalleryConfig = {
  component: 'ShellFrame',
  layoutWidth: 'fluid',
  boundedMaxWidth: 'lg',
  boundedEdge: 'outset',
  preset: 'component-default',
  surface: 'neutral',
  state: 'default',
  viewport: 'desktop',
  direction: 'ltr',
  forcedColors: false,
  focusTrace: false,
};

const FOUNDATION_STATE_OPTIONS: Partial<Record<FoundationComponentId, readonly FoundationState[]>> = {
  ShellFrame: ['default', 'loading', 'empty'],
  ShellRegion: ['default', 'loading', 'empty'],
  ShellHeader: ['default', 'sticky', 'shrunk'],
  ShellSidebar: ['default', 'collapsed'],
  ShellContentHost: ['default', 'loading', 'empty'],
  ShellAside: ['default', 'collapsed'],
  ShellHero: ['default', 'loading', 'empty'],
  ShellFooter: ['default', 'sticky'],
  ShellSurface: ['default', 'loading', 'empty'],
  ShellLogoRegion: ['default', 'collapsed'],
  ShellHeaderActions: ['default', 'open'],
  ShellResponsiveDrawer: ['default', 'open'],
  ShellResponsivePopover: ['default', 'open'],
  ShellAccentControl: ['default', 'loading'],
};

const FOUNDATION_PRESET_OPTIONS: Partial<Record<FoundationComponentId, readonly ShellFoundationGalleryConfig['preset'][]>> = {
  ShellHeader: ['component-default', 'floating'],
  ShellSidebar: ['component-default', 'floating'],
  ShellContentHost: ['component-default', 'compact'],
  ShellHero: ['component-default', 'editorial'],
  ShellFooter: ['component-default', 'editorial'],
};

export const getShellFoundationGalleryOptions = (component: FoundationComponentId) => ({
  states: FOUNDATION_STATE_OPTIONS[component] ?? ['default'],
  presets: FOUNDATION_PRESET_OPTIONS[component] ?? ['component-default'],
  surfaces: component === 'ShellSurface'
    ? ['neutral', 'raised', 'inset', 'glass'] as readonly SurfacePreset[]
    : component === 'ShellContentHost'
      ? ['neutral', 'raised', 'inset'] as readonly SurfacePreset[]
      : [] as readonly SurfacePreset[],
});

export const exportShellFoundationGalleryConfig = (config: ShellFoundationGalleryConfig) => ({
  public: {
    layoutWidth: config.layoutWidth,
    boundedMaxWidth: config.boundedMaxWidth,
    boundedEdge: config.boundedEdge,
    direction: config.direction,
    viewport: config.viewport,
  },
  composition: {
    component: config.component,
    ...(getShellFoundationGalleryOptions(config.component).presets.length > 1 ? { preset: config.preset } : {}),
    ...(getShellFoundationGalleryOptions(config.component).surfaces.length ? { surface: config.surface } : {}),
  },
  demo: {
    fixtures: { slots: config.state === 'empty' ? 'minimal-frame' : 'all-regions' },
    scenarios: {
      state: config.state,
      forcedColors: config.forcedColors,
      focusTrace: config.focusTrace,
    },
  },
});

const SelectField = <T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) => (
  <FormField label={label} className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
    <UiSelect
      size="sm"
      className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
      value={value}
      ariaLabel={label}
      onChange={(event) => onChange(event.target.value as T)}
    >
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </UiSelect>
  </FormField>
);

const PreviewCopy: React.FC<{ title: string; state: FoundationState }> = ({ title, state }) => (
  <div className="min-w-0">
    <p className="text-sm font-bold text-slate-900">{title}</p>
    <p className="mt-1 text-xs text-slate-600">
      {state === 'loading' ? 'Loading registered shell content…' : state === 'empty' ? 'No shell content is configured.' : 'Production shell primitive preview.'}
    </p>
  </div>
);

const surfaceProps = (surface: SurfacePreset) => ({
  tone: surface === 'inset' ? 'content2' : 'content1',
  depth: surface === 'raised' ? 'raised' : surface === 'neutral' ? 'bordered' : 'flat',
  backdrop: surface === 'glass' ? 'glass' : 'solid',
} as const);

const FoundationPreview: React.FC<{
  config: ShellFoundationGalleryConfig;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  popoverOpen: boolean;
  setPopoverOpen: (open: boolean) => void;
  accent: string;
  setAccent: (accent: string) => void;
  paused: boolean;
  setPaused: (paused: boolean) => void;
}> = ({ config, drawerOpen, setDrawerOpen, popoverOpen, setPopoverOpen, accent, setAccent, paused, setPaused }) => {
  const copy = <PreviewCopy title={config.component} state={config.state} />;
  const commonClass = cn(
    'min-h-40 w-full border border-slate-200 bg-white p-4',
    config.focusTrace && 'ring-2 ring-cyan-400 ring-offset-2',
    config.forcedColors && 'outline outline-2 outline-slate-900',
  );

  switch (config.component) {
    case 'ShellFrame':
      return (
        <ShellFrame
          direction={config.direction}
          viewport="content"
          layoutWidth={config.layoutWidth}
          boundedMaxWidth={config.boundedMaxWidth}
          boundedEdge={config.boundedEdge}
          className={cn(commonClass, 'overflow-hidden rounded-lg p-0')}
          header={<ShellHeader height="compact" className="border-b border-slate-200 px-3"><strong>Workspace shell</strong></ShellHeader>}
          sidebar={<ShellSidebar layout="rail" className="!static !h-auto border-e border-slate-200 p-2"><Menu className="h-4 w-4" /></ShellSidebar>}
          footer={<ShellFooter className="!p-2 text-xs">Shell footer</ShellFooter>}
        >
          <ShellContentHost density="compact">{copy}</ShellContentHost>
        </ShellFrame>
      );
    case 'ShellRegion':
      return <ShellRegion regionId="gallery-region" padding="md" gap="sm" separator="hairline" placement="space-between" className={commonClass}>{copy}<span className="text-xs text-violet-700">Registered region</span></ShellRegion>;
    case 'ShellHeader':
      return <div className={commonClass}><ShellHeader behavior={config.state === 'sticky' || config.state === 'shrunk' ? 'sticky-shrink' : config.preset === 'floating' ? 'floating' : 'static'} shrunk={config.state === 'shrunk'} className="px-4"><ShellHeaderContext title="Shell header" context="Sticky, shrinking, and floating states" /></ShellHeader></div>;
    case 'ShellSidebar':
      return <div className={cn(commonClass, 'flex p-0')}><ShellSidebar layout={config.preset === 'floating' ? 'floating' : config.state === 'collapsed' ? 'rail' : 'fixed'} className="!static !h-48 p-3"><PreviewCopy title="Shell sidebar" state={config.state} /></ShellSidebar><div className="flex-1 p-4 text-xs text-slate-500">Content area</div></div>;
    case 'ShellContentHost':
      return <ShellContentHost variant={config.surface === 'inset' ? 'inset' : config.surface === 'raised' ? 'card' : 'plain'} density={config.preset === 'compact' ? 'compact' : 'comfortable'} scrollOwner="content-host" className={commonClass}>{copy}</ShellContentHost>;
    case 'ShellAside':
      return <div className={cn(commonClass, 'flex justify-end p-0')}><ShellAside behavior="collapsible" collapsed={config.state === 'collapsed'} onCollapsedChange={() => undefined} className="p-3">{copy}</ShellAside></div>;
    case 'ShellHero':
      return <ShellHero mode={config.preset === 'editorial' ? 'full-bleed' : 'compact'} background={<div className="size-full bg-gradient-to-br from-violet-100 to-cyan-50" />} className={commonClass}>{copy}</ShellHero>;
    case 'ShellFooter':
      return <div className={cn(commonClass, 'flex items-end p-0')}><ShellFooter mode={config.preset === 'editorial' ? 'multi-column' : 'action-bar'} behavior={config.state === 'sticky' ? 'sticky' : 'static'} className="w-full"><span className="text-xs">Release channel: stable</span><AppButton intent="primary" size="sm"><Save className="h-3.5 w-3.5" />Save</AppButton></ShellFooter></div>;
    case 'ShellSurface':
      return <div className={commonClass}><ShellSurface {...surfaceProps(config.surface)} className="p-5">{copy}</ShellSurface></div>;
    case 'ShellLogoRegion':
      return <div className={commonClass}><ShellLogoRegion asset={{ source: 'platform-default', node: <span className="text-xl font-black tracking-tight text-violet-700">AppEndO</span> }} compact={config.state === 'collapsed'} alt="AppEndO" display={config.state === 'collapsed' ? 'mark-only' : 'text-and-mark'} /></div>;
    case 'ShellHeaderContext':
      return <div className={commonClass}><ShellHeaderContext title="Deployment workspace" context="Production / Europe West" breadcrumbs={[{ key: 'studio', label: 'Studio', href: '#' }, { key: 'shell', label: 'Shell' }]} /></div>;
    case 'ShellHeaderActions':
      return <div className={commonClass}><ShellHeaderActions mode="workspace-actions" overflow={<span className="text-xs">Export configuration</span>} overflowOpen={config.state === 'open'}><AppButton intent="primary" size="sm"><Save className="h-3.5 w-3.5" />Save</AppButton></ShellHeaderActions></div>;
    case 'ShellResponsiveDrawer':
      return <div className={commonClass}><AppButton intent="utility" size="sm" onClick={() => setDrawerOpen(true)}><Menu className="h-3.5 w-3.5" />Open drawer</AppButton><ShellResponsiveDrawer open={drawerOpen || config.state === 'open'} onOpenChange={setDrawerOpen} title="Shell navigation" portal={false}><div className="p-4">{copy}</div></ShellResponsiveDrawer></div>;
    case 'ShellResponsivePopover':
      return <div className={commonClass}><ShellResponsivePopover open={popoverOpen || config.state === 'open'} onOpenChange={setPopoverOpen} trigger={<AppButton intent="utility" size="sm"><MoreHorizontal className="h-3.5 w-3.5" />Open popover</AppButton>}><div className="p-2">{copy}</div></ShellResponsivePopover></div>;
    case 'ShellAccentControl':
      return <div className={commonClass}><p className="mb-3 text-xs font-semibold text-slate-600">Accent preference</p><ShellAccentControl value={accent} onValueChange={setAccent} disabled={config.state === 'loading'} options={[{ value: 'violet', label: 'Violet', swatchClassName: 'bg-violet-500 text-white' }, { value: 'cyan', label: 'Cyan', swatchClassName: 'bg-cyan-500 text-white' }, { value: 'emerald', label: 'Emerald', swatchClassName: 'bg-emerald-500 text-white' }]} /></div>;
    case 'ShellMotionControl':
      return <div className={commonClass}><ShellMotionControl paused={paused} onPausedChange={setPaused} showLabel /></div>;
    case 'ShellBackToTop':
      return <div className={cn(commonClass, 'relative')}><PreviewCopy title="Back-to-top utility" state={config.state} /><ShellBackToTop visible className="!absolute bottom-3 end-3" /></div>;
  }
};

export const ShellFoundationBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = React.useState(DEFAULT_SHELL_FOUNDATION_GALLERY_CONFIG);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [accent, setAccent] = React.useState('violet');
  const [paused, setPaused] = React.useState(false);
  const update = <K extends keyof ShellFoundationGalleryConfig>(key: K, value: ShellFoundationGalleryConfig[K]) =>
    setConfig((current) => {
      if (key !== 'component') return { ...current, [key]: value };
      const component = value as FoundationComponentId;
      const options = getShellFoundationGalleryOptions(component);
      return {
        ...current,
        component,
        state: options.states[0],
        preset: options.presets[0],
        surface: options.surfaces.length && options.surfaces.includes(current.surface) ? current.surface : 'neutral',
      };
    });
  const componentOptions = getShellFoundationGalleryOptions(config.component);
  const json = JSON.stringify(exportShellFoundationGalleryConfig(config), null, 2);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="shell-foundation" json={json}>
          <BaseComponentsResetButton onClick={() => { setConfig(DEFAULT_SHELL_FOUNDATION_GALLERY_CONFIG); setDrawerOpen(false); setPopoverOpen(false); setAccent('violet'); setPaused(false); }} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>
      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Layout width" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <SelectField label="Layout width" value={config.layoutWidth} options={['fluid', 'bounded']} onChange={(value) => update('layoutWidth', value)} />
                {config.layoutWidth === 'bounded' ? (
                  <>
                    <SelectField label="Bounded max width" value={config.boundedMaxWidth} options={['sm', 'md', 'lg']} onChange={(value) => update('boundedMaxWidth', value)} />
                    <SelectField label="Bounded edge" value={config.boundedEdge} options={['hairline', 'shadow', 'outset']} onChange={(value) => update('boundedEdge', value)} />
                  </>
                ) : null}
              </div>
            </FormSection>
            <FormSection title="Component" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE} divided>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <SelectField label="Production export" value={config.component} options={SHELL_FOUNDATION_COMPONENT_IDS} onChange={(value) => update('component', value)} />
                {componentOptions.presets.length > 1 ? <SelectField label="Preset" value={config.preset} options={componentOptions.presets} onChange={(value) => update('preset', value)} /> : null}
                {componentOptions.surfaces.length ? <SelectField label="Surface" value={config.surface} options={componentOptions.surfaces} onChange={(value) => update('surface', value)} /> : null}
              </div>
            </FormSection>
            <FormSection title="Scenario" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE} divided>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                {componentOptions.states.length > 1 ? <SelectField label="State" value={config.state} options={componentOptions.states} onChange={(value) => update('state', value)} /> : null}
                <SelectField label="Viewport" value={config.viewport} options={['desktop', 'tablet', 'phone']} onChange={(value) => update('viewport', value)} />
                <SelectField label="Direction" value={config.direction} options={['ltr', 'rtl']} onChange={(value) => update('direction', value)} />
                <BaseComponentsConfigBoolField
                  label="Forced colors"
                  checked={config.forcedColors}
                  ariaLabel="Forced-colors trace"
                  onChange={(checked) => update('forcedColors', checked)}
                />
                <BaseComponentsConfigBoolField
                  label="Focus trace"
                  checked={config.focusTrace}
                  ariaLabel="Focus trace"
                  onChange={(checked) => update('focusTrace', checked)}
                />
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>
        <BaseComponentsPreviewFrame sectionId="shell-foundation">
          <div className={cn(BASE_COMPONENTS_PREVIEW_BODY_CLASS, 'mx-auto transition-[max-width]', config.viewport === 'phone' ? 'max-w-[22rem]' : config.viewport === 'tablet' ? 'max-w-[42rem]' : 'max-w-none')} dir={config.direction} data-viewport={config.viewport}>
            <FoundationPreview config={config} drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen} popoverOpen={popoverOpen} setPopoverOpen={setPopoverOpen} accent={accent} setAccent={setAccent} paused={paused} setPaused={setPaused} />
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
