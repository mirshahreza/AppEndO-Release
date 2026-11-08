import * as React from 'react';
import { cn } from '../../../lib/utils';
import {
  FormField,
  FormSection,
  clampUiScrollAreaNudgeIconSize,
  UiScrollArea,
  UiSelect,
  UI_SCROLL_AREA_AXES,
  UI_SCROLL_AREA_BAR_SIDES,
  UI_SCROLL_AREA_DEFAULT_STEP_PX,
  UI_SCROLL_AREA_NUDGE_OPACITY,
  UI_SCROLL_AREA_NUDGE_ICON_SIZE_DEFAULT,
  UI_SCROLL_AREA_NUDGE_ICON_SIZE_MAX,
  UI_SCROLL_AREA_NUDGE_ICON_SIZE_MIN,
  UI_SCROLL_AREA_NUDGE_MARKS,
  UI_SCROLL_AREA_NUDGE_MARK_SHAPES,
  UI_SCROLL_AREA_NUDGE_PLACEMENT,
  UI_SCROLL_AREA_NUDGE_REVEAL,
  UI_SCROLL_AREA_NUDGE_SLOT,
  UI_SCROLL_AREA_VARIANTS,
  type UiScrollAreaAxis,
  type UiScrollAreaBarSide,
  type UiScrollAreaDirection,
  type UiScrollAreaNudgePlacement,
  type UiScrollAreaNudgeReveal,
  type UiScrollAreaNudgeMark,
  type UiScrollAreaNudgeMarkShape,
  type UiScrollAreaNudgeSlot,
  type UiScrollAreaVariant,
} from '../../../shared/ui';
import { BaseComponentsConfigToolbarControls, BaseComponentsResetButton } from '../components/BaseComponentsConfigDialog';
import { BaseComponentsConfigAccordion } from '../components/BaseComponentsConfigAccordion';
import { BaseComponentsConfigBoolField } from '../components/BaseComponentsConfigBoolField';
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

const STEP_OPTIONS = [48, 72, 120, 240] as const;

const DEMO_ITEMS = [
  'Signed the deployment package',
  'Promoted the staging snapshot',
  'Rotated the signing certificate',
  'Verified record-policy coverage',
  'Synced culture pack strings',
  'Rebuilt the catalog evidence index',
  'Closed the overnight incident',
  'Published the changelog draft',
  'Aligned the toolbar density tokens',
  'Restored the archived workflow',
  'Queued the nightly backup',
  'Confirmed the desktop-only gate',
  'Trimmed unused shell chrome',
  'Mapped the nested editor title',
  'Checked the English-only copy gate',
  'Sealed the release candidate',
] as const;

export type ScrollAreaBaseComponentsConfig = {
  variant: UiScrollAreaVariant;
  axis: UiScrollAreaAxis;
  dir: UiScrollAreaDirection;
  barSide: UiScrollAreaBarSide;
  drag: boolean;
  stepPx: number;
  nudgeReveal: UiScrollAreaNudgeReveal;
  nudgePlacement: UiScrollAreaNudgePlacement;
  nudgeSlot: UiScrollAreaNudgeSlot;
  nudgeOpacity: number;
  nudgeIconSize: number;
  nudgeMark: UiScrollAreaNudgeMark;
  nudgeMarkShape: UiScrollAreaNudgeMarkShape;
};

export const DEFAULT_SCROLL_AREA_BASE_COMPONENTS_CONFIG: ScrollAreaBaseComponentsConfig = {
  variant: 'bar',
  axis: 'vertical',
  dir: 'ltr',
  barSide: 'direction',
  drag: true,
  stepPx: UI_SCROLL_AREA_DEFAULT_STEP_PX,
  nudgeReveal: 'always',
  nudgePlacement: 'reserve',
  nudgeSlot: 'band',
  nudgeOpacity: 0.75,
  nudgeIconSize: UI_SCROLL_AREA_NUDGE_ICON_SIZE_DEFAULT,
  nudgeMark: 'icon',
  nudgeMarkShape: 'circle',
};

export function applyScrollAreaVariant(
  config: ScrollAreaBaseComponentsConfig,
  variant: UiScrollAreaVariant,
): ScrollAreaBaseComponentsConfig {
  return {
    ...config,
    variant,
    drag: variant === 'nudge' ? true : config.drag,
  };
}

export function resolveScrollAreaPreviewModel(config: ScrollAreaBaseComponentsConfig) {
  const nudge = config.variant === 'nudge';
  const hidden = config.variant === 'hidden';
  return {
    root: 'scroll-area',
    component: 'UiScrollArea',
    variant: config.variant,
    axis: config.axis,
    drag: nudge && config.drag,
    stepPx: nudge ? config.stepPx : null,
    showNudgeMarks: nudge,
    showBarThumb: config.variant === 'bar',
    hideThumb: hidden || nudge,
    barSide: config.variant === 'bar' && config.axis === 'vertical' ? config.barSide : null,
    dir: config.dir,
    nudgeReveal: nudge ? config.nudgeReveal : null,
    nudgePlacement: nudge ? config.nudgePlacement : null,
    nudgeSlot: nudge ? config.nudgeSlot : null,
    nudgeOpacity: nudge && config.nudgePlacement === 'overlay' ? config.nudgeOpacity : null,
    nudgeIconSize: nudge ? config.nudgeIconSize : null,
    nudgeMark: nudge ? config.nudgeMark : null,
    nudgeMarkShape: nudge && config.nudgeMark === 'button' ? config.nudgeMarkShape : null,
    controls: {
      drag: nudge,
      stepPx: nudge,
      marks: nudge,
      opacity: nudge && config.nudgePlacement === 'overlay',
      iconSize: nudge,
      markShape: nudge && config.nudgeMark === 'button',
      barSide: config.variant === 'bar' && config.axis === 'vertical',
    },
  };
}

export function exportScrollAreaBaseComponentsConfig(config: ScrollAreaBaseComponentsConfig) {
  return {
    variant: config.variant,
    axis: config.axis,
    dir: config.dir,
    ...(config.variant === 'bar' && config.axis === 'vertical' ? { barSide: config.barSide } : {}),
    ...(config.variant === 'nudge' ? {
      drag: config.drag,
      stepPx: config.stepPx,
      nudgeReveal: config.nudgeReveal,
      nudgePlacement: config.nudgePlacement,
      nudgeSlot: config.nudgeSlot,
      nudgeIconSize: config.nudgeIconSize,
      nudgeMark: config.nudgeMark,
      ...(config.nudgeMark === 'button' ? { nudgeMarkShape: config.nudgeMarkShape } : {}),
      ...(config.nudgePlacement === 'overlay' ? { nudgeOpacity: config.nudgeOpacity } : {}),
    } : {}),
  };
}

const VARIANT_LABEL: Record<UiScrollAreaVariant, string> = {
  bar: 'Default',
  hidden: 'Hidden',
  nudge: 'Without bar',
};

const RANGE_INPUT_CLASS = [
  'absolute inset-0 z-[1] h-full w-full cursor-pointer appearance-none bg-transparent',
  '[&::-webkit-slider-thumb]:size-0 [&::-webkit-slider-thumb]:appearance-none',
  '[&::-moz-range-thumb]:size-0 [&::-moz-range-thumb]:border-0',
].join(' ');

const IconSizeSlider: React.FC<{
  value: number;
  onChange: (value: number) => void;
}> = ({ value, onChange }) => {
  const stepped = clampUiScrollAreaNudgeIconSize(value);
  const fill = ((stepped - UI_SCROLL_AREA_NUDGE_ICON_SIZE_MIN)
    / (UI_SCROLL_AREA_NUDGE_ICON_SIZE_MAX - UI_SCROLL_AREA_NUDGE_ICON_SIZE_MIN)) * 100;

  return (
    <div className="min-w-0 select-none px-[5px] pt-1">
      <div className="relative h-2 rounded-full bg-slate-100">
        <div
          className="absolute inset-y-0 start-0 rounded-full bg-slate-400"
          style={{ width: `${fill}%` }}
        />
        <input
          type="range"
          min={UI_SCROLL_AREA_NUDGE_ICON_SIZE_MIN}
          max={UI_SCROLL_AREA_NUDGE_ICON_SIZE_MAX}
          step={1}
          value={stepped}
          aria-label="Icon size"
          aria-valuemin={UI_SCROLL_AREA_NUDGE_ICON_SIZE_MIN}
          aria-valuemax={UI_SCROLL_AREA_NUDGE_ICON_SIZE_MAX}
          aria-valuenow={stepped}
          onChange={(event) => onChange(clampUiScrollAreaNudgeIconSize(Number(event.target.value)))}
          className={RANGE_INPUT_CLASS}
        />
        <div
          className="pointer-events-none absolute top-1/2 z-[2] h-4 w-2.5 -translate-y-1/2 rounded border border-slate-200 bg-white shadow-sm"
          style={{ insetInlineStart: `calc(${fill}% - 5px)` }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-slate-400">{UI_SCROLL_AREA_NUDGE_ICON_SIZE_MIN}</span>
        <span className="text-[11px] font-semibold tabular-nums text-slate-700">{stepped}px</span>
        <span className="text-[10px] font-semibold text-slate-400">{UI_SCROLL_AREA_NUDGE_ICON_SIZE_MAX}</span>
      </div>
    </div>
  );
};

export const ScrollAreaBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = React.useState(DEFAULT_SCROLL_AREA_BASE_COMPONENTS_CONFIG);
  const previewModel = resolveScrollAreaPreviewModel(config);
  const json = React.useMemo(
    () => JSON.stringify({ public: exportScrollAreaBaseComponentsConfig(config) }, null, 2),
    [config],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="scroll-area" json={json}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_SCROLL_AREA_BASE_COMPONENTS_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>
      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Model" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Scrollbar" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.variant}
                    onChange={(event) => {
                      const variant = event.target.value as UiScrollAreaVariant;
                      if (UI_SCROLL_AREA_VARIANTS.includes(variant)) {
                        setConfig((current) => applyScrollAreaVariant(current, variant));
                      }
                    }}
                    ariaLabel="Scrollbar"
                  >
                    {UI_SCROLL_AREA_VARIANTS.map((variant) => (
                      <option key={variant} value={variant}>{VARIANT_LABEL[variant]}</option>
                    ))}
                  </UiSelect>
                </FormField>
                <FormField label="Axis" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.axis}
                    onChange={(event) => {
                      const axis = event.target.value as UiScrollAreaAxis;
                      if (UI_SCROLL_AREA_AXES.includes(axis)) {
                        setConfig((current) => ({ ...current, axis }));
                      }
                    }}
                    ariaLabel="Axis"
                  >
                    {UI_SCROLL_AREA_AXES.map((axis) => (
                      <option key={axis} value={axis}>{axis}</option>
                    ))}
                  </UiSelect>
                </FormField>
                <FormField label="Direction" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.dir}
                    onChange={(event) => {
                      const nextDir = event.target.value as UiScrollAreaDirection;
                      if (nextDir === 'ltr' || nextDir === 'rtl') {
                        setConfig((current) => ({ ...current, dir: nextDir }));
                      }
                    }}
                    ariaLabel="Direction"
                  >
                    <option value="ltr">ltr</option>
                    <option value="rtl">rtl</option>
                  </UiSelect>
                </FormField>
                {previewModel.controls.barSide ? (
                  <FormField label="Side" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect
                      size="sm"
                      className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                      value={config.barSide}
                      onChange={(event) => {
                        const barSide = event.target.value as UiScrollAreaBarSide;
                        if (UI_SCROLL_AREA_BAR_SIDES.includes(barSide)) {
                          setConfig((current) => ({ ...current, barSide }));
                        }
                      }}
                      ariaLabel="Side"
                    >
                      <option value="direction">Follow direction</option>
                      <option value="right">Right</option>
                      <option value="left">Left</option>
                    </UiSelect>
                  </FormField>
                ) : null}
                {previewModel.controls.drag ? (
                  <BaseComponentsConfigBoolField
                    label="Drag canvas"
                    checked={config.drag}
                    ariaLabel="Grab and pan the content"
                    onChange={(drag) => setConfig((current) => ({ ...current, drag }))}
                  />
                ) : null}
                {previewModel.controls.stepPx ? (
                  <FormField label="Step" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <UiSelect
                      size="sm"
                      className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                      value={String(config.stepPx)}
                      onChange={(event) => {
                        const stepPx = Number(event.target.value);
                        if (STEP_OPTIONS.includes(stepPx as (typeof STEP_OPTIONS)[number])) {
                          setConfig((current) => ({ ...current, stepPx }));
                        }
                      }}
                      ariaLabel="Step"
                    >
                      {STEP_OPTIONS.map((stepPx) => (
                        <option key={stepPx} value={stepPx}>{stepPx}px</option>
                      ))}
                    </UiSelect>
                  </FormField>
                ) : null}
                {previewModel.controls.marks ? (
                  <>
                    <FormField label="Show marks" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                      <UiSelect
                        size="sm"
                        className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                        value={config.nudgeReveal}
                        onChange={(event) => {
                          const nudgeReveal = event.target.value as UiScrollAreaNudgeReveal;
                          if (UI_SCROLL_AREA_NUDGE_REVEAL.includes(nudgeReveal)) {
                            setConfig((current) => ({ ...current, nudgeReveal }));
                          }
                        }}
                        ariaLabel="Show marks"
                      >
                        <option value="always">When needed</option>
                        <option value="pointer">While pointer is over</option>
                      </UiSelect>
                    </FormField>
                    <FormField label="Placement" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                      <UiSelect
                        size="sm"
                        className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                        value={config.nudgePlacement}
                        onChange={(event) => {
                          const nudgePlacement = event.target.value as UiScrollAreaNudgePlacement;
                          if (UI_SCROLL_AREA_NUDGE_PLACEMENT.includes(nudgePlacement)) {
                            setConfig((current) => ({ ...current, nudgePlacement }));
                          }
                        }}
                        ariaLabel="Placement"
                      >
                        <option value="reserve">Occupy space</option>
                        <option value="overlay">Overlay</option>
                      </UiSelect>
                    </FormField>
                    <FormField label="Slot" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                      <UiSelect
                        size="sm"
                        className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                        value={config.nudgeSlot}
                        onChange={(event) => {
                          const nudgeSlot = event.target.value as UiScrollAreaNudgeSlot;
                          if (UI_SCROLL_AREA_NUDGE_SLOT.includes(nudgeSlot)) {
                            setConfig((current) => ({ ...current, nudgeSlot }));
                          }
                        }}
                        ariaLabel="Slot"
                      >
                        <option value="band">Show location</option>
                        <option value="icons">Icons only</option>
                      </UiSelect>
                    </FormField>
                    <FormField label="Icon size" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                      <IconSizeSlider
                        value={config.nudgeIconSize}
                        onChange={(nudgeIconSize) => setConfig((current) => ({ ...current, nudgeIconSize }))}
                      />
                    </FormField>
                    <FormField label="Mark" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                      <UiSelect
                        size="sm"
                        className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                        value={config.nudgeMark}
                        onChange={(event) => {
                          const nudgeMark = event.target.value as UiScrollAreaNudgeMark;
                          if (UI_SCROLL_AREA_NUDGE_MARKS.includes(nudgeMark)) {
                            setConfig((current) => ({ ...current, nudgeMark }));
                          }
                        }}
                        ariaLabel="Mark"
                      >
                        <option value="icon">Bare icon</option>
                        <option value="button">Button</option>
                      </UiSelect>
                    </FormField>
                    {previewModel.controls.markShape ? (
                      <FormField label="Button shape" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                        <UiSelect
                          size="sm"
                          className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                          value={config.nudgeMarkShape}
                          onChange={(event) => {
                            const nudgeMarkShape = event.target.value as UiScrollAreaNudgeMarkShape;
                            if (UI_SCROLL_AREA_NUDGE_MARK_SHAPES.includes(nudgeMarkShape)) {
                              setConfig((current) => ({ ...current, nudgeMarkShape }));
                            }
                          }}
                          ariaLabel="Button shape"
                        >
                          <option value="circle">Circle</option>
                          <option value="square">Square</option>
                        </UiSelect>
                      </FormField>
                    ) : null}
                    {previewModel.controls.opacity ? (
                      <FormField label="Overlay opacity" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                        <UiSelect
                          size="sm"
                          className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                          value={String(config.nudgeOpacity)}
                          onChange={(event) => {
                            const nudgeOpacity = Number(event.target.value);
                            if (UI_SCROLL_AREA_NUDGE_OPACITY.includes(nudgeOpacity as (typeof UI_SCROLL_AREA_NUDGE_OPACITY)[number])) {
                              setConfig((current) => ({ ...current, nudgeOpacity }));
                            }
                          }}
                          ariaLabel="Overlay opacity"
                        >
                          {UI_SCROLL_AREA_NUDGE_OPACITY.map((opacity) => (
                            <option key={opacity} value={opacity}>{Math.round(opacity * 100)}%</option>
                          ))}
                        </UiSelect>
                      </FormField>
                    ) : null}
                  </>
                ) : null}
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>
        <BaseComponentsPreviewFrame sectionId="scroll-area">
          <div data-bc-preview-root="scroll-area" className={BASE_COMPONENTS_PREVIEW_BODY_CLASS}>
            <div className="max-w-xl">
              <h2 className="mb-1 text-base font-bold text-slate-900">
                {config.variant === 'bar' ? 'Default scrollbar' : config.variant === 'hidden' ? 'Hidden scrollbar' : 'Without bar'}
              </h2>
              <p className="mb-3 text-xs text-slate-500">
                {config.variant === 'bar'
                  ? 'The slim overlay thumb sits on the chosen edge. Follow direction puts it on the right in LTR and the left in RTL.'
                  : config.variant === 'hidden'
                    ? 'The standard thumb is gone. Wheel and keys still move the canvas; there are no end marks.'
                    : 'The thumb is gone. Each mark and its slot appear only while that direction still has room to scroll.'}
              </p>
              <div className={cn(
                'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm',
                config.axis === 'horizontal' ? 'h-40' : 'h-72',
              )}>
                <UiScrollArea
                  variant={config.variant}
                  axis={config.axis}
                  drag={previewModel.drag}
                  stepPx={config.stepPx}
                  barSide={config.barSide}
                  dir={config.dir}
                  nudgeReveal={config.nudgeReveal}
                  nudgePlacement={config.nudgePlacement}
                  nudgeSlot={config.nudgeSlot}
                  nudgeOpacity={config.nudgeOpacity}
                  nudgeIconSize={config.nudgeIconSize}
                  nudgeMark={config.nudgeMark}
                  nudgeMarkShape={config.nudgeMarkShape}
                  className="h-full"
                  viewportClassName="p-3"
                  aria-label="Release activity"
                >
                  <ol className={cn(
                    config.axis === 'horizontal' ? 'flex h-full min-w-max items-stretch gap-3' : 'space-y-2',
                  )}>
                    {DEMO_ITEMS.map((item, index) => (
                      <li
                        key={item}
                        className={cn(
                          'rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm text-slate-700',
                          config.axis === 'horizontal' && 'flex w-52 shrink-0 flex-col justify-center',
                        )}
                      >
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        {item}
                      </li>
                    ))}
                  </ol>
                </UiScrollArea>
              </div>
            </div>
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
