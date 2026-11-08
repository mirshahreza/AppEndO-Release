import React, { useMemo, useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import {
  AppButton,
  FormField,
  FormSection,
  OrbitBgFrame,
  clampOrbitBlobCount,
  clampOrbitColorSteps,
  clampOrbitCoverage,
  clampOrbitBgSize,
  type OrbitBgEffect,
  type OrbitBgMotion,
  type OrbitBgPreset,
  type OrbitBgShape,
  UiInput,
  UiSelect,
} from '../../../shared/ui';
import { cn } from '../../../lib/utils';
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
  BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
  BASE_COMPONENTS_PREVIEW_BODY_CLASS,
  BASE_COMPONENTS_CONFIG_SUBSECTION_LABEL_CLASS,
} from '../baseComponentsConfiguratorLayout';

const PRESET_OPTIONS: OrbitBgPreset[] = ['rainbow', 'accent', 'sunset', 'ocean', 'mono'];
const EFFECT_OPTIONS: OrbitBgEffect[] = ['orbs', 'aurora', 'mesh', 'beam', 'ripple'];
const MOTION_OPTIONS: Array<{ value: OrbitBgMotion; label: string }> = [
  { value: 'orbit', label: 'Orbit' },
  { value: 'edges', label: 'Corners & edges' },
  { value: 'drift', label: 'Cloud drift' },
];
const SHAPE_OPTIONS: Array<{ value: OrbitBgShape; label: string }> = [
  { value: 'circle', label: 'Circle' },
  { value: 'line', label: 'Straight line' },
  { value: 'scribble', label: 'Irregular line' },
];

const RADIUS_OPTIONS = [
  { value: 'var(--app-radius-xl)', label: 'XL (default)' },
  { value: 'var(--app-radius-3xl)', label: '3XL' },
  { value: '1rem', label: '16px' },
  { value: '9999px', label: 'Pill / circle' },
  { value: '0.5rem', label: '8px' },
] as const;

const ORBIT_SPEED_DURATION_SECONDS = [180, 90, 48, 24, 12, 8, 5, 3.5, 2, 1] as const;

const SPEED_RANGE_CLASS = [
  'absolute inset-0 z-[1] h-full w-full cursor-pointer appearance-none bg-transparent',
  '[&::-webkit-slider-thumb]:size-0 [&::-webkit-slider-thumb]:appearance-none',
  '[&::-moz-range-thumb]:size-0 [&::-moz-range-thumb]:border-0',
].join(' ');

export const clampOrbitSpeed = (value: number) => Math.min(10, Math.max(1, Math.round(value)));

export const durationFromOrbitSpeed = (speed: number) => (
  ORBIT_SPEED_DURATION_SECONDS[clampOrbitSpeed(speed) - 1]
);

export type OrbitBgBaseComponentsConfig = {
  enabled: boolean;
  intensity: 'subtle' | 'standard' | 'expressive';
  preset: OrbitBgPreset;
  effect: OrbitBgEffect;
  motion: OrbitBgMotion;
  shape: OrbitBgShape;
  borderRadius: string;
  hostBackground: string;
  showGlow: boolean;
  glowBlur: number;
  glowOpacity: number;
  /** 1 = slowest, 10 = fastest. */
  speed: number;
  direction: 'forward' | 'reverse';
  motionPreference: 'normal' | 'reduced';
  coverage: number;
  /** Body size as a percent of the host’s shorter side (8–100). */
  size: number;
  blobCount: number;
  showWash: boolean;
  colorSteps: number;
  reverseColors: boolean;
};

const DEFAULT_CONFIG: OrbitBgBaseComponentsConfig = {
  enabled: true,
  intensity: 'standard',
  preset: 'rainbow',
  effect: 'orbs',
  motion: 'orbit',
  shape: 'circle',
  borderRadius: 'var(--app-radius-3xl)',
  hostBackground: 'white',
  showGlow: true,
  glowBlur: 16,
  glowOpacity: 0.7,
  speed: 5,
  direction: 'forward',
  motionPreference: 'normal',
  coverage: 58,
  size: 40,
  blobCount: 3,
  showWash: true,
  colorSteps: 6,
  reverseColors: true,
};

const intensityFor = (
  coverage: number,
  count: number,
  opacity: number,
): OrbitBgBaseComponentsConfig['intensity'] => {
  if (count >= 5 || coverage >= 78 || opacity >= 0.82) return 'expressive';
  if (coverage <= 42 && count <= 2 && opacity <= 0.45) return 'subtle';
  return 'standard';
};

const resolveDuration = (config: OrbitBgBaseComponentsConfig) => durationFromOrbitSpeed(config.speed);

export const exportOrbitBgBaseComponentsConfig = (config: OrbitBgBaseComponentsConfig) => config.enabled
  ? {
    enabled: true,
    preset: config.preset,
    effect: config.effect,
    motion: config.motion,
    shape: config.shape,
    borderRadius: config.borderRadius,
    hostBackground: config.hostBackground,
    durationSeconds: resolveDuration(config),
    direction: config.direction,
    motionPreference: config.motionPreference,
    showGlow: config.showGlow,
    coverage: clampOrbitCoverage(config.coverage),
    size: clampOrbitBgSize(config.size),
    blobCount: clampOrbitBlobCount(config.blobCount),
    showWash: config.showWash,
    colorSteps: clampOrbitColorSteps(config.colorSteps),
    reverseColors: config.reverseColors,
    ...(config.showGlow ? { glowBlur: config.glowBlur, glowOpacity: config.glowOpacity } : {}),
  }
  : { enabled: false };

export const resolveOrbitBgFrameProps = (config: OrbitBgBaseComponentsConfig) => ({
  enabled: config.enabled,
  preset: config.preset,
  effect: config.effect,
  motion: config.motion,
  shape: config.shape,
  borderRadius: config.borderRadius,
  hostBackground: config.hostBackground,
  showGlow: config.showGlow,
  glowBlur: config.glowBlur,
  glowOpacity: config.glowOpacity,
  durationSeconds: resolveDuration(config),
  coverage: clampOrbitCoverage(config.coverage),
  size: clampOrbitBgSize(config.size),
  blobCount: clampOrbitBlobCount(config.blobCount),
  showWash: config.showWash,
  colorSteps: clampOrbitColorSteps(config.colorSteps),
  reverseColors: config.reverseColors,
  direction: config.direction,
  reducedMotion: config.motionPreference === 'reduced',
});

export const resolveOrbitBgControlVisibility = (config: OrbitBgBaseComponentsConfig) => ({
  frame: config.enabled,
  glowDetails: config.enabled && config.showGlow,
  speed: config.enabled,
  coverage: config.enabled,
  size: config.enabled,
  blobCount: config.enabled,
  wash: config.enabled,
  colorSteps: config.enabled,
  reverseColors: config.enabled,
  effect: config.enabled,
  motion: config.enabled,
  shape: config.enabled,
});

type OrbitStepperSliderProps = {
  value: number;
  min: number;
  max: number;
  ariaLabel: string;
  formatValue?: (value: number) => React.ReactNode;
  onChange: (value: number) => void;
};

const clampStep = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(value)));

const OrbitStepperSlider: React.FC<OrbitStepperSliderProps> = ({
  value,
  min,
  max,
  ariaLabel,
  formatValue,
  onChange,
}) => {
  const stepped = clampStep(value, min, max);
  const fill = max === min ? 100 : ((stepped - min) / (max - min)) * 100;

  return (
    <div className="min-w-0 select-none pt-1">
      <div className="relative h-2 rounded-full bg-slate-100">
        <div
          className="absolute inset-y-0 start-0 rounded-full bg-gradient-to-r from-violet-400 to-cyan-400"
          style={{ width: `${fill}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={stepped}
          aria-label={ariaLabel}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={stepped}
          onChange={(event) => onChange(clampStep(Number(event.target.value), min, max))}
          className={SPEED_RANGE_CLASS}
        />
        <div
          className="pointer-events-none absolute top-1/2 z-[2] h-4 w-2.5 -translate-y-1/2 rounded border border-slate-200 bg-white shadow-sm"
          style={{ insetInlineStart: `calc(${fill}% - 5px)` }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-slate-400">{min}</span>
        <span className="text-[11px] font-semibold tabular-nums text-violet-700">
          {formatValue ? formatValue(stepped) : stepped}
        </span>
        <span className="text-[10px] font-semibold text-slate-400">{max}</span>
      </div>
    </div>
  );
};

type OrbitBgBaseComponentsPreviewProps = {
  config: OrbitBgBaseComponentsConfig;
};

const OrbitBgBaseComponentsPreview: React.FC<OrbitBgBaseComponentsPreviewProps> = ({ config }) => {
  const frameProps = resolveOrbitBgFrameProps(config);

  return (
    <div className={cn(BASE_COMPONENTS_PREVIEW_BODY_CLASS, 'overflow-auto')}>
      <div className="flex flex-col gap-5">
        <div className="space-y-2">
          <p className={BASE_COMPONENTS_CONFIG_SUBSECTION_LABEL_CLASS}>Hero wash</p>
          <OrbitBgFrame {...frameProps} className="min-h-[11rem] w-full">
            <div className="flex min-h-[11rem] flex-col justify-end p-5">
              <p className="text-lg font-bold tracking-tight text-slate-800">Orbit background</p>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                Wrap any surface. The fill moves — content stays still.
              </p>
              <div className="mt-4 flex gap-2">
                <AppButton intent="primary" size="sm">
                  <Sparkles className="h-3.5 w-3.5" />
                  Launch
                </AppButton>
                <AppButton intent="utility" size="sm">
                  <ArrowRight className="h-3.5 w-3.5" />
                  Continue
                </AppButton>
              </div>
            </div>
          </OrbitBgFrame>
        </div>

        <div className="space-y-2">
          <p className={BASE_COMPONENTS_CONFIG_SUBSECTION_LABEL_CLASS}>Any shape</p>
          <div className="flex flex-wrap items-stretch gap-3">
            <OrbitBgFrame {...frameProps} borderRadius="9999px" className="h-24 w-24 shrink-0">
              <div className="flex h-24 w-24 items-center justify-center">
                <Sparkles className="h-6 w-6 text-violet-600" />
              </div>
            </OrbitBgFrame>
            <OrbitBgFrame {...frameProps} borderRadius="0.5rem" className="min-w-[12rem] flex-1">
              <div className="p-4">
                <p className="text-sm font-bold text-slate-800">Tile</p>
                <p className="mt-1 text-[11px] text-slate-500">Clipped to this radius.</p>
              </div>
            </OrbitBgFrame>
            <OrbitBgFrame {...frameProps} borderRadius="9999px" className="w-fit">
              <div className="px-4 py-2">
                <p className="text-xs font-semibold text-slate-700">Pill surface</p>
              </div>
            </OrbitBgFrame>
          </div>
        </div>

        <div className="space-y-2">
          <p className={BASE_COMPONENTS_CONFIG_SUBSECTION_LABEL_CLASS}>Dark tile</p>
          <OrbitBgFrame {...frameProps} className="max-w-md" hostBackground="#0f172a">
            <div className="px-5 py-4">
              <p className="text-sm font-semibold text-white">Night surface</p>
              <p className="mt-0.5 text-[11px] text-slate-300">Glow reads clearly on dark chrome.</p>
            </div>
          </OrbitBgFrame>
        </div>
      </div>
    </div>
  );
};

export const OrbitBgBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<OrbitBgBaseComponentsConfig>(DEFAULT_CONFIG);
  const configJson = useMemo(() => JSON.stringify(exportOrbitBgBaseComponentsConfig(config), null, 2), [config]);
  const visibility = resolveOrbitBgControlVisibility(config);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="orbit-bg" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Fill" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <BaseComponentsConfigBoolField
                  label="Enabled"
                  checked={config.enabled}
                  ariaLabel="Show orbit background"
                  onChange={(checked) => setConfig((current) => ({ ...current, enabled: checked }))}
                />
                {visibility.frame ? <>
                <FormField label="Intensity" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} hint="Sets size, travel, blob count, and glow together.">
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.intensity} onChange={(event) => {
                    const intensity = event.target.value as OrbitBgBaseComponentsConfig['intensity'];
                    setConfig((current) => ({
                      ...current,
                      intensity,
                      coverage: intensity === 'subtle' ? 36 : intensity === 'standard' ? 58 : 82,
                      size: intensity === 'subtle' ? 22 : intensity === 'standard' ? 40 : 68,
                      glowOpacity: intensity === 'subtle' ? 0.42 : intensity === 'standard' ? 0.7 : 0.88,
                      blobCount: intensity === 'subtle' ? 2 : intensity === 'standard' ? 3 : 5,
                      glowBlur: intensity === 'subtle' ? 10 : intensity === 'standard' ? 16 : 22,
                    }));
                  }} ariaLabel="Orbit background intensity preset">
                    <option value="subtle">subtle</option><option value="standard">standard</option><option value="expressive">expressive</option>
                  </UiSelect>
                </FormField>

                <FormField label="Effect" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} hint="Look of the fill bodies. Motion path stays independent.">
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.effect}
                    onChange={(event) => {
                      const value = event.target.value as OrbitBgEffect;
                      if (EFFECT_OPTIONS.includes(value)) {
                        setConfig((current) => ({ ...current, effect: value }));
                      }
                    }}
                    ariaLabel="Orbit background effect"
                  >
                    {EFFECT_OPTIONS.map((effect) => (
                      <option key={effect} value={effect}>{effect}</option>
                    ))}
                  </UiSelect>
                </FormField>

                <FormField label="Motion" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} hint="Path the bodies travel. Orbit circles; corners & edges ride the perimeter; cloud drift is irregular wind.">
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.motion}
                    onChange={(event) => {
                      const value = event.target.value as OrbitBgMotion;
                      if (MOTION_OPTIONS.some((option) => option.value === value)) {
                        setConfig((current) => ({ ...current, motion: value }));
                      }
                    }}
                    ariaLabel="Orbit background motion pattern"
                  >
                    {MOTION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </UiSelect>
                </FormField>

                <FormField label="Shape" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} hint="Silhouette of each body. Circle is a disc; straight line is a bar; irregular line is a scribble stroke.">
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.shape}
                    onChange={(event) => {
                      const value = event.target.value as OrbitBgShape;
                      if (SHAPE_OPTIONS.some((option) => option.value === value)) {
                        setConfig((current) => ({ ...current, shape: value }));
                      }
                    }}
                    ariaLabel="Orbit background shape"
                  >
                    {SHAPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </UiSelect>
                </FormField>

                <FormField label="Palette" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.preset}
                    onChange={(event) => {
                      const value = event.target.value as OrbitBgPreset;
                      if (PRESET_OPTIONS.includes(value)) {
                        setConfig((current) => ({ ...current, preset: value }));
                      }
                    }}
                    ariaLabel="Orbit background palette"
                  >
                    {PRESET_OPTIONS.map((preset) => (
                      <option key={preset} value={preset}>{preset}</option>
                    ))}
                  </UiSelect>
                </FormField>

                <BaseComponentsConfigBoolField
                  label="Color order"
                  checked={config.reverseColors}
                  ariaLabel="Reverse colors"
                  onChange={(checked) => setConfig((current) => ({ ...current, reverseColors: checked }))}
                />

                <FormField label="Color steps" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} hint="Bands sampled into the moving bodies. 4 is a short fade; 10 is a full rainbow ramp.">
                  <OrbitStepperSlider
                    min={4}
                    max={10}
                    value={config.colorSteps}
                    ariaLabel="Orbit background color steps"
                    formatValue={(steps) => `${steps} colors`}
                    onChange={(colorSteps) => setConfig((current) => ({ ...current, colorSteps }))}
                  />
                </FormField>

                <FormField label="Size (%)" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} hint="Circle diameter, or line length, as a percent of the host. Scales with the wrapped surface.">
                  <OrbitStepperSlider
                    min={8}
                    max={100}
                    value={config.size}
                    ariaLabel="Orbit background size percent"
                    formatValue={(value) => `${value}%`}
                    onChange={(size) => setConfig((current) => ({ ...current, size }))}
                  />
                </FormField>

                <FormField label="Travel (%)" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} hint="How far the bodies move across the surface. Independent of shape size.">
                  <UiInput
                    size="sm"
                    type="number"
                    min={20}
                    max={100}
                    step={1}
                    className={BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS}
                    value={String(config.coverage)}
                    onChange={(event) => {
                      const parsed = Number.parseFloat(event.target.value);
                      if (!Number.isNaN(parsed)) {
                        setConfig((current) => ({
                          ...current,
                          coverage: parsed,
                          intensity: intensityFor(parsed, current.blobCount, current.glowOpacity),
                        }));
                      }
                    }}
                    ariaLabel="Orbit background travel percent"
                  />
                </FormField>

                <FormField label="Bodies" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} hint="How many orbs, bands, or ripples share the fill.">
                  <OrbitStepperSlider
                    min={1}
                    max={10}
                    value={config.blobCount}
                    ariaLabel="Orbit background body count"
                    formatValue={(count) => count === 1 ? '1 body' : `${count} bodies`}
                    onChange={(blobCount) => setConfig((current) => ({
                      ...current,
                      blobCount,
                      intensity: intensityFor(current.coverage, blobCount, current.glowOpacity),
                    }))}
                  />
                </FormField>

                <FormField label="Corner radius" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.borderRadius}
                    onChange={(event) => setConfig((current) => ({ ...current, borderRadius: event.target.value }))}
                    ariaLabel="Border radius"
                  >
                    {RADIUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </UiSelect>
                </FormField>

                <FormField label="Host background" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.hostBackground}
                    onChange={(event) => setConfig((current) => ({ ...current, hostBackground: event.target.value }))}
                    ariaLabel="Host background"
                  >
                    <option value="transparent">Transparent</option>
                    <option value="white">White</option>
                    <option value="rgb(241 245 249 / 0.9)">Slate tint</option>
                    <option value="#0f172a">Night</option>
                  </UiSelect>
                </FormField>
                </> : null}
              </div>
            </FormSection>

            {visibility.frame ? <FormSection title="Motion & glow" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Speed" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} hint="1 is the slowest cycle; 10 is the fastest.">
                  <OrbitStepperSlider
                    min={1}
                    max={10}
                    value={config.speed}
                    ariaLabel="Orbit background speed"
                    formatValue={(speed) => (
                      <>
                        {speed}
                        <span className="ms-1 font-medium text-slate-400">{durationFromOrbitSpeed(speed)}s</span>
                      </>
                    )}
                    onChange={(speed) => setConfig((current) => ({ ...current, speed }))}
                  />
                </FormField>
                <FormField label="Direction" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.direction} onChange={(event) => setConfig((current) => ({ ...current, direction: event.target.value as OrbitBgBaseComponentsConfig['direction'] }))} ariaLabel="Orbit background direction">
                    <option value="forward">forward</option><option value="reverse">reverse</option>
                  </UiSelect>
                </FormField>
                <FormField label="Motion preference" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.motionPreference} onChange={(event) => setConfig((current) => ({ ...current, motionPreference: event.target.value as OrbitBgBaseComponentsConfig['motionPreference'] }))} ariaLabel="Orbit background motion preference">
                    <option value="normal">normal</option><option value="reduced">reduced (static)</option>
                  </UiSelect>
                </FormField>
                <BaseComponentsConfigBoolField
                  label="Wash"
                  checked={config.showWash}
                  ariaLabel="Soft palette wash"
                  onChange={(checked) => setConfig((current) => ({ ...current, showWash: checked }))}
                />
                <BaseComponentsConfigBoolField
                  label="Glow"
                  checked={config.showGlow}
                  ariaLabel="Soft body glow"
                  onChange={(checked) => setConfig((current) => ({ ...current, showGlow: checked }))}
                />

                {visibility.glowDetails ? <FormField label="Glow blur (px)" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiInput
                    size="sm"
                    type="number"
                    min={0}
                    max={64}
                    className={BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS}
                    value={String(config.glowBlur)}
                    onChange={(event) => {
                      const parsed = Number.parseInt(event.target.value, 10);
                      if (!Number.isNaN(parsed)) {
                        setConfig((current) => ({ ...current, glowBlur: parsed }));
                      }
                    }}
                  />
                </FormField> : null}

                {visibility.glowDetails ? <FormField label="Glow opacity" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiInput
                    size="sm"
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    className={BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS}
                    value={String(config.glowOpacity)}
                    onChange={(event) => {
                      const parsed = Number.parseFloat(event.target.value);
                      if (!Number.isNaN(parsed)) {
                        setConfig((current) => ({
                          ...current,
                          glowOpacity: parsed,
                          intensity: intensityFor(current.coverage, current.blobCount, parsed),
                        }));
                      }
                    }}
                  />
                </FormField> : null}
              </div>
            </FormSection> : null}
          </BaseComponentsConfigAccordion>
        </div>

        <BaseComponentsPreviewFrame sectionId="orbit-bg">
          <OrbitBgBaseComponentsPreview config={config} />
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
