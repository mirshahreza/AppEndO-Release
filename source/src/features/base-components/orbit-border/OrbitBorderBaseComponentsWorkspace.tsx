import React, { useMemo, useState } from 'react';
import { X, ArrowRight, Sparkles } from 'lucide-react';
import {
  AppButton,
  FormField,
  FormSection,
  OrbitBorderFrame,
  clampOrbitColorSteps,
  clampOrbitCometCount,
  type OrbitBorderPreset,
  UiAvatar,
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

const PRESET_OPTIONS: OrbitBorderPreset[] = ['rainbow', 'accent', 'sunset', 'fire', 'ocean', 'mono'];

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

const clampTailPercent = (value: number) => Math.min(100, Math.max(5, value));

export type OrbitBorderBaseComponentsConfig = {
  enabled: boolean;
  intensity: 'subtle' | 'standard' | 'expressive';
  preset: OrbitBorderPreset;
  borderWidth: number;
  borderRadius: string;
  hostBackground: string;
  showGlow: boolean;
  glowBlur: number;
  glowOpacity: number;
  /** 1 = slowest, 10 = fastest. */
  speed: number;
  direction: 'forward' | 'reverse';
  motionPreference: 'normal' | 'reduced';
  tailLength: number;
  cometCount: number;
  showTrack: boolean;
  colorSteps: number;
  reverseColors: boolean;
};

const DEFAULT_CONFIG: OrbitBorderBaseComponentsConfig = {
  enabled: true,
  intensity: 'standard',
  preset: 'rainbow',
  borderWidth: 1.5,
  borderRadius: 'var(--app-radius-3xl)',
  hostBackground: 'transparent',
  showGlow: true,
  glowBlur: 8,
  glowOpacity: 0.5,
  speed: 5,
  direction: 'forward',
  motionPreference: 'normal',
  tailLength: 5,
  cometCount: 1,
  showTrack: true,
  colorSteps: 6,
  reverseColors: true,
};

const intensityFor = (width: number, tail: number, count: number): OrbitBorderBaseComponentsConfig['intensity'] => {
  if (count >= 3 || tail >= 24 || width >= 3) return 'expressive';
  if (tail <= 12 && width <= 2) return 'subtle';
  return 'standard';
};

const resolveDuration = (config: OrbitBorderBaseComponentsConfig) => durationFromOrbitSpeed(config.speed);

export const exportOrbitBorderBaseComponentsConfig = (config: OrbitBorderBaseComponentsConfig) => config.enabled
  ? {
    enabled: true,
    preset: config.preset,
    borderWidth: config.borderWidth,
    borderRadius: config.borderRadius,
    hostBackground: config.hostBackground,
    durationSeconds: resolveDuration(config),
    direction: config.direction,
    motionPreference: config.motionPreference,
    showGlow: config.showGlow,
    tailLength: clampTailPercent(config.tailLength),
    cometCount: clampOrbitCometCount(config.cometCount),
    showTrack: config.showTrack,
    colorSteps: clampOrbitColorSteps(config.colorSteps),
    reverseColors: config.reverseColors,
    ...(config.showGlow ? { glowBlur: config.glowBlur, glowOpacity: config.glowOpacity } : {}),
  }
  : { enabled: false };

export const resolveOrbitBorderFrameProps = (config: OrbitBorderBaseComponentsConfig) => ({
  enabled: config.enabled,
  preset: config.preset,
  borderWidth: config.borderWidth,
  borderRadius: config.borderRadius,
  hostBackground: config.hostBackground,
  showGlow: config.showGlow,
  glowBlur: config.glowBlur,
  glowOpacity: config.glowOpacity,
  durationSeconds: resolveDuration(config),
  tailLength: clampTailPercent(config.tailLength),
  cometCount: clampOrbitCometCount(config.cometCount),
  showTrack: config.showTrack,
  colorSteps: clampOrbitColorSteps(config.colorSteps),
  reverseColors: config.reverseColors,
  direction: config.direction,
  reducedMotion: config.motionPreference === 'reduced',
});

export const resolveOrbitBorderControlVisibility = (config: OrbitBorderBaseComponentsConfig) => ({
  frame: config.enabled,
  glowDetails: config.enabled && config.showGlow,
  speed: config.enabled,
  tailDetails: config.enabled,
  cometCount: config.enabled,
  track: config.enabled,
  colorSteps: config.enabled,
  reverseColors: config.enabled,
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
    <div className="min-w-0 select-none px-[5px] pt-1">
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

type OrbitBorderBaseComponentsPreviewProps = {
  config: OrbitBorderBaseComponentsConfig;
};

const OrbitBorderBaseComponentsPreview: React.FC<OrbitBorderBaseComponentsPreviewProps> = ({ config }) => {
  const frameProps = resolveOrbitBorderFrameProps(config);

  return (
    <div className={BASE_COMPONENTS_PREVIEW_BODY_CLASS}>
      <div className="flex flex-col gap-5">
        <div className="space-y-2">
          <p className={BASE_COMPONENTS_CONFIG_SUBSECTION_LABEL_CLASS}>Any shape</p>
          <div className="flex flex-wrap items-center gap-3">
            <OrbitBorderFrame {...frameProps} borderRadius="9999px" className="w-fit">
              <UiAvatar fallback="C" size="lg" color="accent" alt="Comet avatar" />
            </OrbitBorderFrame>
            <OrbitBorderFrame {...frameProps} borderRadius="9999px" className="w-fit">
              <AppButton intent="primary" size="sm">
                <Sparkles className="h-3.5 w-3.5" />
                Launch
              </AppButton>
            </OrbitBorderFrame>
            <OrbitBorderFrame {...frameProps} borderRadius="0.5rem" className="w-fit">
              <div className="flex h-10 w-10 items-center justify-center bg-white text-violet-600 shadow-sm ring-1 ring-slate-200/80">
                <Sparkles className="h-4 w-4" />
              </div>
            </OrbitBorderFrame>
            <OrbitBorderFrame
              {...frameProps}
              borderRadius="var(--app-radius-lg)"
              hostBackground="white"
              className="min-w-[12rem] flex-1"
            >
              <UiInput
                size="sm"
                placeholder="Prompt…"
                className="!border-0 !bg-transparent !shadow-none"
                ariaLabel="Orbit input preview"
              />
            </OrbitBorderFrame>
          </div>
        </div>

        <div className="space-y-2">
          <p className={BASE_COMPONENTS_CONFIG_SUBSECTION_LABEL_CLASS}>Panel</p>
          <OrbitBorderFrame {...frameProps} className="max-w-md">
            <div className="bg-white p-3 shadow-sm ring-1 ring-slate-200/70">
              <p className="text-sm font-bold text-slate-800">Create workspace</p>
              <p className="mt-1 text-xs text-slate-500">The comet follows this panel’s rounded rect — not a spinning color wheel.</p>
              <div className="mt-4 flex justify-end gap-2">
                <AppButton intent="utility" size="sm">
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </AppButton>
                <AppButton intent="primary" size="sm">
                  <ArrowRight className="h-3.5 w-3.5" />
                  Continue
                </AppButton>
              </div>
            </div>
          </OrbitBorderFrame>
        </div>

        <div className="space-y-2">
          <p className={BASE_COMPONENTS_CONFIG_SUBSECTION_LABEL_CLASS}>Dark tile</p>
          <OrbitBorderFrame {...frameProps} className="w-fit" hostBackground="#0f172a">
            <div className="bg-slate-900 px-5 py-3">
              <p className="text-sm font-semibold text-white">Night surface</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Glow reads clearly on dark chrome.</p>
            </div>
          </OrbitBorderFrame>
        </div>
      </div>
    </div>
  );
};

export const OrbitBorderBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<OrbitBorderBaseComponentsConfig>(DEFAULT_CONFIG);
  const configJson = useMemo(() => JSON.stringify(exportOrbitBorderBaseComponentsConfig(config), null, 2), [config]);
  const visibility = resolveOrbitBorderControlVisibility(config);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="orbit-border" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Comet" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <BaseComponentsConfigBoolField
                  label="Enabled"
                  checked={config.enabled}
                  ariaLabel="Show orbit comet"
                  onChange={(checked) => setConfig((current) => ({ ...current, enabled: checked }))}
                />
                {visibility.frame ? <>
                <FormField label="Intensity" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} hint="Sets stroke, tail length, glow, and comet count together.">
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.intensity} onChange={(event) => {
                    const intensity = event.target.value as OrbitBorderBaseComponentsConfig['intensity'];
                    setConfig((current) => ({
                      ...current,
                      intensity,
                      borderWidth: intensity === 'subtle' ? 1 : intensity === 'standard' ? 1.5 : 3,
                      tailLength: intensity === 'subtle' ? 5 : intensity === 'standard' ? 5 : 18,
                      glowOpacity: intensity === 'subtle' ? 0.28 : intensity === 'standard' ? 0.5 : 0.72,
                      cometCount: intensity === 'expressive' ? 3 : 1,
                    }));
                  }} ariaLabel="Orbit intensity preset">
                    <option value="subtle">subtle</option><option value="standard">standard</option><option value="expressive">expressive</option>
                  </UiSelect>
                </FormField>

                <FormField label="Palette" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.preset}
                    onChange={(event) => {
                      const value = event.target.value as OrbitBorderPreset;
                      if (PRESET_OPTIONS.includes(value)) {
                        setConfig((current) => ({ ...current, preset: value }));
                      }
                    }}
                    ariaLabel="Comet palette"
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

                <FormField label="Color steps" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} hint="Bands along the comet tail. 4 is a short fade; 10 is a full rainbow ramp.">
                  <OrbitStepperSlider
                    min={4}
                    max={10}
                    value={config.colorSteps}
                    ariaLabel="Comet color steps"
                    formatValue={(steps) => `${steps} colors`}
                    onChange={(colorSteps) => setConfig((current) => ({ ...current, colorSteps }))}
                  />
                </FormField>

                <FormField label="Stroke (px)" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiInput
                    size="sm"
                    type="number"
                    min={1}
                    max={8}
                    step={0.5}
                    className={BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS}
                    value={String(config.borderWidth)}
                    onChange={(event) => {
                      const parsed = Number.parseFloat(event.target.value);
                      if (!Number.isNaN(parsed)) {
                        setConfig((current) => ({
                          ...current,
                          borderWidth: parsed,
                          intensity: intensityFor(parsed, current.tailLength, current.cometCount),
                        }));
                      }
                    }}
                  />
                </FormField>

                <FormField label="Tail length (%)" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} hint="Share of the perimeter the comet occupies. 5% is a short spark; 100% fills the whole orbit.">
                  <UiInput
                    size="sm"
                    type="number"
                    min={5}
                    max={100}
                    step={1}
                    className={BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS}
                    value={String(config.tailLength)}
                    onChange={(event) => {
                      const parsed = Number.parseFloat(event.target.value);
                      if (!Number.isNaN(parsed)) {
                        setConfig((current) => ({
                          ...current,
                          tailLength: parsed,
                          intensity: intensityFor(current.borderWidth, parsed, current.cometCount),
                        }));
                      }
                    }}
                    ariaLabel="Comet tail length percent"
                  />
                </FormField>

                <FormField label="Comets" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} hint="How many comets share the orbit. They stay evenly spaced.">
                  <OrbitStepperSlider
                    min={1}
                    max={10}
                    value={config.cometCount}
                    ariaLabel="Comet count"
                    formatValue={(count) => count === 1 ? '1 comet' : `${count} comets`}
                    onChange={(cometCount) => setConfig((current) => ({
                      ...current,
                      cometCount,
                      intensity: intensityFor(current.borderWidth, current.tailLength, cometCount),
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
                  </UiSelect>
                </FormField>
                </> : null}
              </div>
            </FormSection>

            {visibility.frame ? <FormSection title="Motion & glow" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Speed" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} hint="1 is the slowest lap; 10 is the fastest.">
                  <OrbitStepperSlider
                    min={1}
                    max={10}
                    value={config.speed}
                    ariaLabel="Orbit speed"
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
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.direction} onChange={(event) => setConfig((current) => ({ ...current, direction: event.target.value as OrbitBorderBaseComponentsConfig['direction'] }))} ariaLabel="Orbit direction">
                    <option value="forward">forward</option><option value="reverse">reverse</option>
                  </UiSelect>
                </FormField>
                <FormField label="Motion preference" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.motionPreference} onChange={(event) => setConfig((current) => ({ ...current, motionPreference: event.target.value as OrbitBorderBaseComponentsConfig['motionPreference'] }))} ariaLabel="Orbit motion preference">
                    <option value="normal">normal</option><option value="reduced">reduced (static)</option>
                  </UiSelect>
                </FormField>
                <BaseComponentsConfigBoolField
                  label="Orbit path"
                  checked={config.showTrack}
                  ariaLabel="Faint perimeter track"
                  onChange={(checked) => setConfig((current) => ({ ...current, showTrack: checked }))}
                />
                <BaseComponentsConfigBoolField
                  label="Glow"
                  checked={config.showGlow}
                  ariaLabel="Soft comet glow"
                  onChange={(checked) => setConfig((current) => ({ ...current, showGlow: checked }))}
                />

                {visibility.glowDetails ? <FormField label="Glow blur (px)" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiInput
                    size="sm"
                    type="number"
                    min={0}
                    max={24}
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
                        setConfig((current) => ({ ...current, glowOpacity: parsed }));
                      }
                    }}
                  />
                </FormField> : null}
              </div>
            </FormSection> : null}
          </BaseComponentsConfigAccordion>
        </div>

        <BaseComponentsPreviewFrame sectionId="orbit-border">
          <OrbitBorderBaseComponentsPreview config={config} />
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
