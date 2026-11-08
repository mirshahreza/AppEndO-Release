import * as React from 'react';
import { Activity, Gauge, PauseCircle, ShieldCheck } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  FormField,
  FormSection,
  SHELL_EFFECT_CATALOG,
  SHELL_EFFECT_IDS,
  ShellEffectStack,
  UiSelect,
  getShellEffectPreset,
  getShellEffectStackCost,
  resolveShellEffectFallback,
  validateShellEffectStack,
  type ShellEffectFallback,
  type ShellEffectId,
  type ShellEffectLayerConfig,
  type ShellEffectPlane,
  type ShellEffectTarget,
  type ShellViewport,
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
import { BaseComponentsPreviewFrame, BASE_COMPONENTS_WORKSPACE_INSET_CLASS } from '../components/BaseComponentsWorkspacePanel';

type PresetTone = 'subtle' | 'expressive';
type LayerCount = 1 | 2 | 3 | 4;

export type ShellEffectsGalleryConfig = {
  effectId: ShellEffectId;
  preset: PresetTone;
  layerCount: LayerCount;
  target: ShellEffectTarget;
  plane: ShellEffectPlane;
  viewport: ShellViewport;
  fallback: ShellEffectFallback;
  reducedMotion: boolean;
  reducedTransparency: boolean;
  reducedData: boolean;
  paused: boolean;
  diagnostics: boolean;
  parameters: 'preset-default' | 'low-cost' | 'high-contrast';
  interaction: 'none' | 'scroll' | 'pointer' | 'reveal';
};

export const DEFAULT_SHELL_EFFECTS_GALLERY_CONFIG: ShellEffectsGalleryConfig = {
  effectId: 'aurora',
  preset: 'subtle',
  layerCount: 1,
  target: 'hero',
  plane: 'background',
  viewport: 'desktop',
  fallback: 'runtime',
  reducedMotion: false,
  reducedTransparency: false,
  reducedData: false,
  paused: false,
  diagnostics: true,
  parameters: 'preset-default',
  interaction: 'none',
};

export const buildShellEffectGalleryLayers = (config: ShellEffectsGalleryConfig): ShellEffectLayerConfig[] => {
  const compatibleIds = SHELL_EFFECT_IDS.filter((effectId) => SHELL_EFFECT_CATALOG[effectId].targets.includes(config.target));
  const selectedIndex = Math.max(0, compatibleIds.indexOf(config.effectId));
  return Array.from({ length: config.layerCount }, (_, index) => {
    const effectId = compatibleIds[(selectedIndex + index) % compatibleIds.length] ?? config.effectId;
    const tone = config.parameters === 'low-cost'
      ? 'subtle'
      : config.parameters === 'high-contrast'
        ? 'expressive'
        : config.preset;
    const preset = getShellEffectPreset(effectId, tone);
    return {
      ...preset.layer,
      id: `layer-${index + 1}`,
      target: config.target,
      plane: config.plane,
    } as ShellEffectLayerConfig;
  });
};

export const exportShellEffectsGalleryConfig = (config: ShellEffectsGalleryConfig) => {
  const layers = buildShellEffectGalleryLayers(config);
  const preferences = config.fallback === 'runtime'
    ? {
      reducedMotion: config.reducedMotion,
      ...(config.preset === 'expressive' ? { reducedTransparency: config.reducedTransparency } : {}),
      ...(layers.some((layer) => SHELL_EFFECT_CATALOG[layer.effectId].cost !== 'low') ? { reducedData: config.reducedData } : {}),
    }
    : {};
  return {
  public: {
    fallback: config.fallback,
    ...(config.fallback === 'runtime' ? { paused: config.paused } : {}),
    viewport: config.viewport,
  },
  composition: {
    effectId: config.effectId,
    presetId: `${config.preset}-${config.effectId}`,
    parameters: config.parameters,
    interaction: config.interaction,
    target: config.target,
    plane: config.plane,
    layers,
  },
  demo: {
    fixtures: { layerCount: config.layerCount },
    scenarios: {
      preferences,
      diagnostics: config.diagnostics,
    },
  },
  };
};

const SelectField = <T extends string | number>({ label, value, options, onChange }: {
  label: string; value: T; options: readonly T[]; onChange: (value: T) => void;
}) => (
  <FormField label={label} className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
    <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={String(value)} ariaLabel={label} onChange={(event) => {
      const next = options.find((option) => String(option) === event.target.value);
      if (next !== undefined) onChange(next);
    }}>
      {options.map((option) => <option key={String(option)} value={String(option)}>{String(option)}</option>)}
    </UiSelect>
  </FormField>
);

export const ShellEffectsBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = React.useState(DEFAULT_SHELL_EFFECTS_GALLERY_CONFIG);
  const update = <K extends keyof ShellEffectsGalleryConfig>(key: K, value: ShellEffectsGalleryConfig[K]) =>
    setConfig((current) => ({ ...current, [key]: value }));
  const layers = React.useMemo(() => buildShellEffectGalleryLayers(config), [config]);
  const preferences = React.useMemo(() => ({
    reducedMotion: config.reducedMotion,
    reducedTransparency: config.reducedTransparency,
    reducedData: config.reducedData,
  }), [config.reducedData, config.reducedMotion, config.reducedTransparency]);
  const effectiveFallback = layers
    .map((layer) => resolveShellEffectFallback(layer, config.viewport, config.fallback, preferences))
    .sort((left, right) => (
      ['hidden', 'static', 'simplified', 'runtime'].indexOf(left) -
      ['hidden', 'static', 'simplified', 'runtime'].indexOf(right)
    ))[0] ?? config.fallback;
  const validation = validateShellEffectStack({ layers, reducedMotionFallback: 'static' }, config.viewport);
  const cost = getShellEffectStackCost(layers, config.viewport, effectiveFallback);
  const meta = SHELL_EFFECT_CATALOG[config.effectId];
  const targetOptions = meta.targets;
  const preferencesActive = config.fallback === 'runtime';
  const reducedDataRelevant = layers.some((layer) => SHELL_EFFECT_CATALOG[layer.effectId].cost !== 'low');
  const reducedTransparencyRelevant = config.preset === 'expressive';
  const json = JSON.stringify(exportShellEffectsGalleryConfig(config), null, 2);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="shell-effects" json={json}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_SHELL_EFFECTS_GALLERY_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>
      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Effect composer" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <SelectField label="Effect ID" value={config.effectId} options={SHELL_EFFECT_IDS} onChange={(value) => setConfig((current) => ({
                  ...current,
                  effectId: value,
                  target: SHELL_EFFECT_CATALOG[value].targets.includes(current.target)
                    ? current.target
                    : SHELL_EFFECT_CATALOG[value].targets[0],
                }))} />
                <SelectField label="Preset" value={config.preset} options={['subtle', 'expressive']} onChange={(value) => update('preset', value)} />
                <SelectField label="Layer count" value={config.layerCount} options={[1, 2, 3, 4]} onChange={(value) => update('layerCount', value)} />
                <SelectField label="Target" value={config.target} options={targetOptions} onChange={(value) => update('target', value)} />
                <SelectField label="Plane" value={config.plane} options={['underlay', 'background', 'overlay']} onChange={(value) => update('plane', value)} />
                <SelectField label="Parameters" value={config.parameters} options={['preset-default', 'low-cost', 'high-contrast']} onChange={(value) => update('parameters', value)} />
                <SelectField label="Interaction" value={config.interaction} options={['none', 'scroll', 'pointer', 'reveal']} onChange={(value) => update('interaction', value)} />
              </div>
            </FormSection>
            <FormSection title="Fallback preferences" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE} divided>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <SelectField label="Viewport" value={config.viewport} options={['desktop', 'tablet', 'phone']} onChange={(value) => update('viewport', value)} />
                <SelectField label="Requested fallback" value={config.fallback} options={['runtime', 'static', 'simplified', 'hidden']} onChange={(value) => update('fallback', value)} />
                {preferencesActive ? (
                  <BaseComponentsConfigBoolField
                    label="Reduced motion"
                    checked={config.reducedMotion}
                    ariaLabel="Reduced motion"
                    onChange={(checked) => update('reducedMotion', checked)}
                  />
                ) : null}
                {preferencesActive && reducedTransparencyRelevant ? (
                  <BaseComponentsConfigBoolField
                    label="Reduced transparency"
                    checked={config.reducedTransparency}
                    ariaLabel="Reduced transparency"
                    onChange={(checked) => update('reducedTransparency', checked)}
                  />
                ) : null}
                {preferencesActive && reducedDataRelevant ? (
                  <BaseComponentsConfigBoolField
                    label="Reduced data"
                    checked={config.reducedData}
                    ariaLabel="Reduced data"
                    onChange={(checked) => update('reducedData', checked)}
                  />
                ) : null}
                {effectiveFallback === 'runtime' ? (
                  <BaseComponentsConfigBoolField
                    label="Pause motion"
                    checked={config.paused}
                    ariaLabel="Pause motion"
                    onChange={(checked) => update('paused', checked)}
                  />
                ) : null}
                <BaseComponentsConfigBoolField
                  label="Diagnostics"
                  checked={config.diagnostics}
                  ariaLabel="Show diagnostics"
                  onChange={(checked) => update('diagnostics', checked)}
                />
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>
        <BaseComponentsPreviewFrame sectionId="shell-effects">
          <div className={BASE_COMPONENTS_PREVIEW_BODY_CLASS}>
            <ShellEffectStack
              layers={layers}
              target={config.target}
              viewport={config.viewport}
              fallback={effectiveFallback}
              paused={config.paused}
              className="relative min-h-[22rem] overflow-hidden rounded-xl border border-slate-200 bg-slate-950"
            >
              <div className="relative z-10 flex min-h-[22rem] flex-col justify-between p-6 text-white">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Shell effect preview</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight">{meta.componentName}</h2>
                  <p className="mt-2 max-w-lg text-sm text-slate-200">
                    {config.layerCount} registered {config.layerCount === 1 ? 'layer' : 'layers'} on the {config.target} target.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-white/10 px-2.5 py-1">Parameters: {config.parameters}</span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1">Interaction: {config.interaction}</span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1">Preset: {config.preset}</span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1">Fallback: {effectiveFallback}</span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1">Cost: {meta.cost}</span>
                </div>
              </div>
            </ShellEffectStack>
            {config.diagnostics ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Effect diagnostics">
                <div className="rounded-lg border border-slate-200 p-3"><Gauge className="h-4 w-4 text-cyan-700" /><p className="mt-2 text-xs font-bold text-slate-800">Motion budget</p><p className="text-xs text-slate-500">{cost.units} / {cost.limit} units</p></div>
                <div className="rounded-lg border border-slate-200 p-3"><ShieldCheck className="h-4 w-4 text-emerald-700" /><p className="mt-2 text-xs font-bold text-slate-800">Validation</p><p className="text-xs text-slate-500">{validation.valid ? 'Valid stack' : `${validation.issues.length} issues`}</p></div>
                <div className="rounded-lg border border-slate-200 p-3"><PauseCircle className="h-4 w-4 text-amber-700" /><p className="mt-2 text-xs font-bold text-slate-800">Runtime</p><p className="text-xs text-slate-500">{config.paused ? 'Paused' : effectiveFallback}</p></div>
                <div className="rounded-lg border border-slate-200 p-3"><Activity className="h-4 w-4 text-violet-700" /><p className="mt-2 text-xs font-bold text-slate-800">Coverage</p><p className="text-xs text-slate-500">{SHELL_EFFECT_IDS.length} registered IDs</p></div>
              </div>
            ) : null}
            {!validation.valid ? (
              <ul className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                {validation.issues.map((issue) => <li key={`${issue.code}-${issue.path}`}>{issue.message}</li>)}
              </ul>
            ) : null}
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
