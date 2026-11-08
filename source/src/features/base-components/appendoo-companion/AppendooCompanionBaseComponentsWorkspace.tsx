import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../../lib/utils';
import { useAccentTheme } from '../../../contexts/AccentThemeContext';
import {
  AppButton,
  FormField,
  FormSection,
  UiSelect,
} from '../../../shared/ui';
import { AppendooCompanionFace } from '../../../shared/ui/shell/appendooCompanion/AppendooCompanionFace';
import {
  APPENDOO_DEFAULT_BODY,
  APPENDOO_LEAN_IDS,
  APPENDOO_LEAN_META,
  APPENDOO_SHAPE_IDS,
  APPENDOO_SHAPE_META,
  APPENDOO_SIZE_MAX,
  APPENDOO_SIZE_MIN,
  APPENDOO_SIZE_STEPS,
  APPENDOO_WONK_MAX,
  APPENDOO_WONK_MIN,
  APPENDOO_WONK_STEPS,
  isAppendooLeanId,
  isAppendooShapeId,
  mergeAppendooBodyRig,
  nearestAppendooSizeStep,
  nearestAppendooWonkStep,
  nextAppendooWonkSeed,
  resolveAppendooBodyGeometry,
  resolveAppendooCompanionBox,
  type AppendooBodyRig,
  type AppendooLeanId,
  type AppendooShapeId,
} from '../../../shared/ui/shell/appendooCompanion/appendooBodyShape';
import { applyAppendooEmotionRim } from '../../../shared/ui/shell/appendooCompanion/appendooEmotionRim';
import { useAppendooEmotionRim } from '../../../shared/ui/shell/appendooCompanion/useAppendooEmotionRim';
import {
  APPENDOO_EMOTION_IDS,
  APPENDOO_EMOTION_META,
  isAppendooEmotionId,
  resolveAppendooFaceRig,
  type AppendooEmotionId,
  type AppendooFaceRig,
} from '../../../shared/ui/shell/appendooCompanion/appendooFaceRig';
import {
  APPENDOO_DEFAULT_TRAVEL,
  APPENDOO_TRAVEL_EASING_IDS,
  APPENDOO_TRAVEL_EASING_META,
  applyAppendooTravelEasing,
  cssAppendooTravelEasing,
  isAppendooTravelEasingId,
  mergeAppendooTravelRig,
  sampleAppendooTravel,
  type AppendooTravelEasingId,
  type AppendooTravelRig,
} from '../../../shared/ui/shell/appendooCompanion/appendooTravel';
import { useAppendooTravelPlayback } from '../../../shared/ui/shell/appendooCompanion/useAppendooTravelPlayback';
import { useAppendooPointerLook } from '../../../shared/ui/shell/appendooCompanion/useAppendooPointerLook';
import { useAppendooPlaygroundDrag } from '../../../shared/ui/shell/appendooCompanion/useAppendooPlaygroundDrag';
import { useAppendooMorphPlayback } from '../../../shared/ui/shell/appendooCompanion/useAppendooMorphPlayback';
import {
  APPENDOO_DEFAULT_MORPH,
  APPENDOO_MORPH_TARGET_IDS,
  APPENDOO_MORPH_TARGET_META,
  applyAppendooMorphEasing,
  cssAppendooMorphEasing,
  geometryFromAppendooMorphLayers,
  isAppendooMorphShapeTarget,
  isAppendooMorphTargetId,
  mergeAppendooMorphRig,
  mixAppendooFaceLayout,
  sampleAppendooMorphSourceLayers,
  sampleAppendooMorphTargetLayers,
  type AppendooMorphRig,
  type AppendooMorphTargetId,
} from '../../../shared/ui/shell/appendooCompanion/appendooMorph';
import {
  APPENDOO_DEFAULT_LOOK,
  APPENDOO_LOOK_IDS,
  APPENDOO_LOOK_META,
  appendooLookShowsAccessories,
  appendooLookShowsColor,
  appendooLookShowsGel,
  isAppendooLookId,
  type AppendooLookId,
} from '../../../shared/ui/shell/appendooCompanion/appendooLook';
import {
  APPENDOO_COLOR_MODE_IDS,
  APPENDOO_COLOR_MODE_META,
  APPENDOO_DEFAULT_COLOR_MODE,
  APPENDOO_DEFAULT_PALETTE_SWATCH_ID,
  isAppendooColorMode,
  mixAppendooGelPalette,
  resolveAppendooGelPalette,
  type AppendooColorMode,
} from '../../../shared/ui/shell/appendooCompanion/appendooColor';
import {
  APPENDOO_ACCESSORY_IDS,
  APPENDOO_ACCESSORY_META,
  APPENDOO_ACCESSORY_PAINT,
  APPENDOO_ACCESSORY_PAINT_IDS,
  APPENDOO_DEFAULT_ACCESSORIES,
  APPENDOO_DEFAULT_ACCESSORY_PAINT_ID,
  isAppendooAccessoryPaintId,
  mergeAppendooAccessories,
  resolveAppendooAccessoryMood,
  resolveAppendooAccessoryPaint,
  type AppendooAccessoryFlags,
  type AppendooAccessoryId,
  type AppendooAccessoryPaintId,
} from '../../../shared/ui/shell/appendooCompanion/appendooAccessories';
import {
  APPENDOO_DEFAULT_FACE_PARTS,
  APPENDOO_FACE_PART_IDS,
  APPENDOO_FACE_PART_META,
  mergeAppendooFaceParts,
  type AppendooFacePartFlags,
  type AppendooFacePartId,
} from '../../../shared/ui/shell/appendooCompanion/appendooFaceParts';
import {
  ACCENT_COLOR_MATRIX,
  ACCENT_INTENSITY_LABELS,
  isAccentMatrixSwatchId,
} from '../../../shared/theme/accentPalettes';
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
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
  BASE_COMPONENTS_PREVIEW_BODY_CLASS,
} from '../baseComponentsConfiguratorLayout';

type RigNumberKey = Exclude<keyof AppendooFaceRig, 'spark' | 'zzz'>;

type RigNumberField = {
  key: RigNumberKey;
  label: string;
  min: number;
  max: number;
  step: number;
};

type BodyNumberKey = {
  [K in keyof AppendooBodyRig]: AppendooBodyRig[K] extends number ? K : never;
}[keyof AppendooBodyRig];

type BodyNumberField = {
  key: BodyNumberKey;
  label: string;
  min: number;
  max: number;
  step: number;
};

type TravelNumberKey = Exclude<keyof AppendooTravelRig, 'easing' | 'loop'>;

type TravelNumberField = {
  key: TravelNumberKey;
  label: string;
  min: number;
  max: number;
  step: number;
};

export type AppendooCompanionBaseComponentsConfig = {
  emotion: AppendooEmotionId;
  blinking: boolean;
  override: Partial<AppendooFaceRig>;
  body: AppendooBodyRig;
  travel: AppendooTravelRig;
  colorMode: AppendooColorMode;
  paletteSwatchId: string;
  accessories: AppendooAccessoryFlags;
  accessoryPaintId: AppendooAccessoryPaintId;
  parts: AppendooFacePartFlags;
  followPointer: boolean;
  draggable: boolean;
  morph: AppendooMorphRig;
  look: AppendooLookId;
};

const DEFAULT_CONFIG: AppendooCompanionBaseComponentsConfig = {
  emotion: 'neutral',
  blinking: false,
  override: {},
  body: APPENDOO_DEFAULT_BODY,
  travel: APPENDOO_DEFAULT_TRAVEL,
  colorMode: APPENDOO_DEFAULT_COLOR_MODE,
  paletteSwatchId: APPENDOO_DEFAULT_PALETTE_SWATCH_ID,
  accessories: APPENDOO_DEFAULT_ACCESSORIES,
  accessoryPaintId: APPENDOO_DEFAULT_ACCESSORY_PAINT_ID,
  parts: APPENDOO_DEFAULT_FACE_PARTS,
  followPointer: false,
  draggable: false,
  morph: APPENDOO_DEFAULT_MORPH,
  look: APPENDOO_DEFAULT_LOOK,
};

const BROW_FIELDS: readonly RigNumberField[] = [
  { key: 'browInnerY', label: 'Inner raise', min: -1, max: 1, step: 0.02 },
  { key: 'browOuterY', label: 'Outer raise', min: -1, max: 1, step: 0.02 },
  { key: 'browKnit', label: 'Knit', min: 0, max: 1, step: 0.02 },
  { key: 'browAsym', label: 'Asymmetry', min: -1, max: 1, step: 0.02 },
  { key: 'browY', label: 'Height above eyes', min: 4, max: 14, step: 0.1 },
  { key: 'browGap', label: 'Gap', min: 16, max: 36, step: 0.2 },
  { key: 'browLength', label: 'Length', min: 6, max: 16, step: 0.1 },
  { key: 'browWeight', label: 'Weight', min: 1, max: 3, step: 0.05 },
];

const EYE_FIELDS: readonly RigNumberField[] = [
  { key: 'eyeOpen', label: 'Openness', min: 0, max: 1.4, step: 0.02 },
  { key: 'eyeSize', label: 'Size', min: 2.6, max: 6, step: 0.05 },
  { key: 'eyeGap', label: 'Gap', min: 16, max: 36, step: 0.2 },
  { key: 'eyeY', label: 'Vertical position', min: 48, max: 64, step: 0.2 },
  { key: 'winkLeft', label: 'Left wink', min: 0, max: 1, step: 0.05 },
  { key: 'winkRight', label: 'Right wink', min: 0, max: 1, step: 0.05 },
  { key: 'cheekRaise', label: 'Cheek raise', min: 0, max: 1, step: 0.02 },
];

const MOUTH_FIELDS: readonly RigNumberField[] = [
  { key: 'mouthCurve', label: 'Curve', min: -1, max: 1, step: 0.02 },
  { key: 'mouthOpen', label: 'Open', min: 0, max: 1, step: 0.02 },
  { key: 'mouthWidth', label: 'Width', min: 2.4, max: 12, step: 0.1 },
  { key: 'mouthY', label: 'Vertical position', min: 62, max: 78, step: 0.2 },
  { key: 'mouthAsym', label: 'Asymmetry', min: -1, max: 1, step: 0.02 },
];

const GAZE_FIELDS: readonly RigNumberField[] = [
  { key: 'lookX', label: 'Look X', min: -1, max: 1, step: 0.02 },
  { key: 'lookY', label: 'Look Y', min: -1, max: 1, step: 0.02 },
  { key: 'blush', label: 'Blush', min: 0, max: 1, step: 0.02 },
  { key: 'noseWrinkle', label: 'Nose wrinkle', min: 0, max: 1, step: 0.02 },
];

const BODY_FIELDS: readonly BodyNumberField[] = [
  { key: 'size', label: 'Size', min: APPENDOO_SIZE_MIN, max: APPENDOO_SIZE_MAX, step: 1 },
  { key: 'wonk', label: 'Wonk', min: APPENDOO_WONK_MIN, max: APPENDOO_WONK_MAX, step: 1 },
  { key: 'bodyAsym', label: 'Body asymmetry', min: 0, max: 1, step: 0.02 },
];

const RIM_FIELDS: readonly BodyNumberField[] = [
  { key: 'rimAsym', label: 'Rim asymmetry', min: 0, max: 1, step: 0.02 },
  { key: 'rimWeight', label: 'Rim weight', min: 0.4, max: 4, step: 0.05 },
  { key: 'rimScale', label: 'Rim scale', min: 0.92, max: 1.18, step: 0.005 },
  { key: 'rimShiftX', label: 'Rim shift X', min: -1, max: 1, step: 0.02 },
  { key: 'rimShiftY', label: 'Rim shift Y', min: -1, max: 1, step: 0.02 },
  { key: 'trimMotion', label: 'Trim motion', min: 0, max: 1, step: 0.02 },
];

const TRAVEL_POINT_FIELDS: readonly TravelNumberField[] = [
  { key: 'fromX', label: 'From X', min: 0, max: 100, step: 1 },
  { key: 'fromY', label: 'From Y', min: 0, max: 100, step: 1 },
  { key: 'toX', label: 'To X', min: 0, max: 100, step: 1 },
  { key: 'toY', label: 'To Y', min: 0, max: 100, step: 1 },
];

const TRAVEL_DURATION_FIELDS: readonly TravelNumberField[] = [
  { key: 'durationMs', label: 'Duration (ms)', min: 120, max: 6000, step: 50 },
];

const MORPH_DURATION_FIELDS: readonly { key: 'durationMs'; label: string; min: number; max: number; step: number }[] = [
  { key: 'durationMs', label: 'Duration (ms)', min: 200, max: 4000, step: 50 },
];

const TRAVEL_BEZIER_FIELDS: readonly TravelNumberField[] = [
  { key: 'bezierX1', label: 'Bezier X1', min: 0, max: 1, step: 0.01 },
  { key: 'bezierY1', label: 'Bezier Y1', min: -1, max: 2, step: 0.01 },
  { key: 'bezierX2', label: 'Bezier X2', min: 0, max: 1, step: 0.01 },
  { key: 'bezierY2', label: 'Bezier Y2', min: -1, max: 2, step: 0.01 },
];

const MORPH_BEZIER_FIELDS = TRAVEL_BEZIER_FIELDS.map((field) => ({
  key: field.key as 'bezierX1' | 'bezierY1' | 'bezierX2' | 'bezierY2',
  label: field.label,
  min: field.min,
  max: field.max,
  step: field.step,
}));

const RANGE_INPUT_CLASS = [
  'absolute inset-0 z-[1] h-full w-full cursor-pointer appearance-none bg-transparent',
  '[&::-webkit-slider-thumb]:size-0 [&::-webkit-slider-thumb]:appearance-none',
  '[&::-moz-range-thumb]:size-0 [&::-moz-range-thumb]:border-0',
].join(' ');

const formatRigNumber = (value: number, step: number): string => {
  const digits = step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3;
  return value.toFixed(digits);
};

const snapRangeValue = (value: number, min: number, max: number, step: number): number => {
  const snapped = min + Math.round((value - min) / step) * step;
  const clamped = Math.min(max, Math.max(min, snapped));
  return Number(formatRigNumber(clamped, step));
};

const AppendooRangeSlider: React.FC<{
  value: number;
  min: number;
  max: number;
  step: number;
  ariaLabel: string;
  onChange: (value: number) => void;
}> = ({ value, min, max, step, ariaLabel, onChange }) => {
  const stepped = snapRangeValue(value, min, max, step);
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
          step={step}
          value={stepped}
          aria-label={ariaLabel}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={stepped}
          onChange={(event) => onChange(snapRangeValue(Number(event.target.value), min, max, step))}
          className={RANGE_INPUT_CLASS}
        />
        <div
          className="pointer-events-none absolute top-1/2 z-[2] h-4 w-2.5 -translate-y-1/2 rounded border border-slate-200 bg-white shadow-sm"
          style={{ insetInlineStart: `calc(${fill}% - 5px)` }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-slate-400">{formatRigNumber(min, step)}</span>
        <span className="text-[11px] font-semibold tabular-nums text-violet-700">{formatRigNumber(stepped, step)}</span>
        <span className="text-[10px] font-semibold text-slate-400">{formatRigNumber(max, step)}</span>
      </div>
    </div>
  );
};

const AppendooNumberSliders = <K extends string>({
  fields,
  valueOf,
  onPatch,
}: {
  fields: readonly { key: K; label: string; min: number; max: number; step: number }[];
  valueOf: (key: K) => number;
  onPatch: (key: K, value: number) => void;
}) => (
  <>
    {fields.map((field) => (
      <FormField
        key={field.key}
        label={field.label}
        className={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
        reserveHintSlot={false}
      >
        <AppendooRangeSlider
          value={valueOf(field.key)}
          min={field.min}
          max={field.max}
          step={field.step}
          ariaLabel={field.label}
          onChange={(next) => onPatch(field.key, next)}
        />
      </FormField>
    ))}
  </>
);

export const resolveAppendooCompanionPreviewModel = (
  config: AppendooCompanionBaseComponentsConfig,
  themeHex?: string,
) => {
  const body = mergeAppendooBodyRig(config.body);
  const travel = mergeAppendooTravelRig(config.travel);
  const morph = mergeAppendooMorphRig(config.morph);
  const moodBody = applyAppendooEmotionRim(body, config.emotion);
  const geometry = resolveAppendooBodyGeometry(moodBody);
  const rig = resolveAppendooFaceRig({
    emotion: config.emotion,
    blinking: config.blinking,
    layout: geometry.face,
    override: config.override,
  });
  const meta = APPENDOO_EMOTION_META[config.emotion];
  const shape = APPENDOO_SHAPE_META[body.shape];
  const easing = APPENDOO_TRAVEL_EASING_META[travel.easing];
  const gel = resolveAppendooGelPalette({
    mode: config.colorMode,
    shape: body.shape,
    themeHex,
    paletteSwatchId: config.paletteSwatchId,
  });
  const parts = mergeAppendooFaceParts(config.parts);
  return {
    rig,
    body,
    travel,
    geometry,
    meta,
    shape,
    easing,
    cssEasing: cssAppendooTravelEasing(travel),
    restPoint: sampleAppendooTravel(travel, 0),
    box: resolveAppendooCompanionBox(body.size),
    sizeStep: nearestAppendooSizeStep(body.size),
    wonkStep: nearestAppendooWonkStep(body.wonk),
    colorMode: config.colorMode,
    paletteSwatchId: config.paletteSwatchId,
    gel,
    accessories: mergeAppendooAccessories(config.accessories),
    accessoryPaint: resolveAppendooAccessoryPaint(config.accessoryPaintId),
    accessoryMood: resolveAppendooAccessoryMood(config.emotion),
    parts,
    followPointer: config.followPointer,
    draggable: config.draggable,
    morph,
    morphMeta: APPENDOO_MORPH_TARGET_META[morph.target],
    morphCssEasing: cssAppendooMorphEasing(morph),
    look: config.look,
    lookMeta: APPENDOO_LOOK_META[config.look],
    hasBrows: parts.brows,
    spark: rig.spark,
    zzz: rig.zzz,
    overrideCount: Object.keys(config.override).length,
  };
};

export const exportAppendooCompanionConfig = (config: AppendooCompanionBaseComponentsConfig) => {
  const travel = mergeAppendooTravelRig(config.travel);
  const morph = mergeAppendooMorphRig(config.morph);
  const parts = mergeAppendooFaceParts(config.parts);
  return {
    emotion: config.emotion,
    blinking: config.blinking,
    shape: config.body.shape,
    size: config.body.size,
    wonk: config.body.wonk,
    wonkScatter: config.body.wonkScatter,
    wonkSeed: config.body.wonkSeed,
    lean: config.body.lean,
    bodyAsym: config.body.bodyAsym,
    rimAsym: config.body.rimAsym,
    rimWeight: config.body.rimWeight,
    rimScale: config.body.rimScale,
    rimShiftX: config.body.rimShiftX,
    rimShiftY: config.body.rimShiftY,
    trimMotion: config.body.trimMotion,
    fromX: travel.fromX,
    fromY: travel.fromY,
    toX: travel.toX,
    toY: travel.toY,
    durationMs: travel.durationMs,
    easing: travel.easing,
    bezierX1: travel.bezierX1,
    bezierY1: travel.bezierY1,
    bezierX2: travel.bezierX2,
    bezierY2: travel.bezierY2,
    loop: travel.loop,
    colorMode: config.colorMode,
    paletteSwatchId: config.paletteSwatchId,
    hat: config.accessories.hat,
    glasses: config.accessories.glasses,
    headphones: config.accessories.headphones,
    accessoryPaint: config.accessoryPaintId,
    followPointer: config.followPointer,
    draggable: config.draggable,
    morphTarget: morph.target,
    morphDurationMs: morph.durationMs,
    morphEasing: morph.easing,
    morphBezierX1: morph.bezierX1,
    morphBezierY1: morph.bezierY1,
    morphBezierX2: morph.bezierX2,
    morphBezierY2: morph.bezierY2,
    morphSeed: morph.seed,
    look: config.look,
    showBrows: parts.brows,
    showEyes: parts.eyes,
    showMouth: parts.mouth,
    showBlush: parts.blush,
    showNose: parts.nose,
    showSpark: parts.spark,
    showZzz: parts.zzz,
    override: config.override,
  };
};

const AppendooPaletteSwatchGrid: React.FC<{
  selectedId: string;
  onSelect: (id: string) => void;
}> = ({ selectedId, onSelect }) => (
  <div className="grid grid-cols-[44px_repeat(5,minmax(0,1fr))] items-center gap-x-1 gap-y-1">
    <div />
    {ACCENT_INTENSITY_LABELS.map((label) => (
      <div
        key={label}
        className="pb-0.5 text-center text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500"
      >
        {label}
      </div>
    ))}
    {ACCENT_COLOR_MATRIX.map((row) => (
      <React.Fragment key={row.id}>
        <div className="truncate pe-1 text-[10px] font-semibold text-slate-600">{row.name}</div>
        {row.swatches.map((swatch) => {
          const selected = selectedId === swatch.id;
          return (
            <button
              key={swatch.id}
              type="button"
              aria-label={`${row.name} ${ACCENT_INTENSITY_LABELS[swatch.intensity - 1]}`}
              aria-pressed={selected}
              title={`${row.name} — ${ACCENT_INTENSITY_LABELS[swatch.intensity - 1]}`}
              onClick={() => onSelect(swatch.id)}
              className={cn(
                'h-7 w-full rounded-md border transition',
                selected
                  ? 'scale-105 border-slate-700 shadow-sm'
                  : 'border-white/80 shadow-sm hover:scale-105',
              )}
              style={{ backgroundColor: swatch.hex }}
            />
          );
        })}
      </React.Fragment>
    ))}
  </div>
);

const AppendooAccessoryPaintSwatches: React.FC<{
  selectedId: AppendooAccessoryPaintId;
  onSelect: (id: AppendooAccessoryPaintId) => void;
}> = ({ selectedId, onSelect }) => (
  <div className="flex flex-wrap gap-1.5">
    {APPENDOO_ACCESSORY_PAINT_IDS.map((id) => {
      const paint = APPENDOO_ACCESSORY_PAINT[id];
      const selected = selectedId === id;
      return (
        <button
          key={id}
          type="button"
          aria-label={paint.label}
          aria-pressed={selected}
          title={paint.label}
          onClick={() => onSelect(id)}
          className={cn(
            'h-7 w-7 rounded-full border transition',
            selected
              ? 'scale-110 border-slate-700 shadow-sm'
              : 'border-white/80 shadow-sm hover:scale-105',
          )}
          style={{ backgroundColor: paint.mid }}
        />
      );
    })}
  </div>
);

export const AppendooCompanionBaseComponentsWorkspace: React.FC = () => {
  const { accentHex } = useAccentTheme();
  const companionHostRef = useRef<HTMLDivElement>(null);
  const playgroundBoardRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<AppendooCompanionBaseComponentsConfig>(DEFAULT_CONFIG);
  const configJson = useMemo(() => JSON.stringify(exportAppendooCompanionConfig(config), null, 2), [config]);
  const previewModel = resolveAppendooCompanionPreviewModel(config, accentHex);
  const rimMood = useAppendooEmotionRim(config.emotion);
  const pointerLook = useAppendooPointerLook(companionHostRef, config.followPointer);
  const liveBox = resolveAppendooCompanionBox(previewModel.body.size, rimMood.size);

  const setEmotion = (emotion: AppendooEmotionId) => {
    setConfig((current) => ({ ...current, emotion, override: {} }));
  };

  const setShape = (shape: AppendooShapeId) => {
    setConfig((current) => ({ ...current, body: { ...current.body, shape } }));
  };

  const setSizePreset = (size: number) => {
    setConfig((current) => ({
      ...current,
      body: { ...current.body, size },
    }));
  };

  const setWonkPreset = (wonk: number) => {
    setConfig((current) => ({
      ...current,
      body: { ...current.body, wonk },
    }));
  };

  const setWonkScatter = (wonkScatter: boolean) => {
    setConfig((current) => ({
      ...current,
      body: { ...current.body, wonkScatter },
    }));
  };

  const shuffleWonkSeed = () => {
    setConfig((current) => ({
      ...current,
      body: { ...current.body, wonkSeed: nextAppendooWonkSeed(current.body.wonkSeed) },
    }));
  };

  const setLean = (lean: AppendooLeanId) => {
    setConfig((current) => ({
      ...current,
      body: { ...current.body, lean },
    }));
  };

  const setLook = (look: AppendooLookId) => {
    setConfig((current) => ({ ...current, look }));
  };

  const setColorMode = (colorMode: AppendooColorMode) => {
    setConfig((current) => ({ ...current, colorMode }));
  };

  const setPaletteSwatch = (paletteSwatchId: string) => {
    setConfig((current) => ({
      ...current,
      colorMode: 'palette',
      paletteSwatchId,
    }));
  };

  const setAccessory = (id: AppendooAccessoryId, on: boolean) => {
    setConfig((current) => ({
      ...current,
      accessories: { ...current.accessories, [id]: on },
    }));
  };

  const setAccessoryPaint = (accessoryPaintId: AppendooAccessoryPaintId) => {
    setConfig((current) => ({ ...current, accessoryPaintId }));
  };

  const setFacePart = (id: AppendooFacePartId, on: boolean) => {
    setConfig((current) => ({
      ...current,
      parts: { ...current.parts, [id]: on },
    }));
  };

  const patchNumber = (key: RigNumberKey, value: number) => {
    setConfig((current) => ({
      ...current,
      override: { ...current.override, [key]: value },
    }));
  };

  const patchBody = (key: BodyNumberKey, value: number) => {
    setConfig((current) => ({
      ...current,
      body: { ...current.body, [key]: value },
    }));
  };

  const patchTravel = (key: TravelNumberKey, value: number) => {
    setConfig((current) => ({
      ...current,
      travel: mergeAppendooTravelRig(current.travel, { [key]: value, easing: 'custom' }),
    }));
  };

  const patchTravelPoint = (key: TravelNumberKey, value: number) => {
    setConfig((current) => ({
      ...current,
      travel: mergeAppendooTravelRig(current.travel, { [key]: value }),
    }));
  };

  const setEasing = (easing: AppendooTravelEasingId) => {
    setConfig((current) => ({
      ...current,
      travel: applyAppendooTravelEasing(current.travel, easing),
    }));
  };

  const travelPlayback = useAppendooTravelPlayback(previewModel.travel);
  const morphPlayback = useAppendooMorphPlayback(previewModel.morph);
  const playgroundDrag = useAppendooPlaygroundDrag(
    playgroundBoardRef,
    config.draggable,
    travelPlayback.point,
    travelPlayback.playing,
    travelPlayback.stop,
  );
  const moodBody = applyAppendooEmotionRim(previewModel.body, rimMood);
  const morphTargetShape = isAppendooMorphShapeTarget(previewModel.morph.target)
    ? previewModel.morph.target
    : null;
  const morphTargetGeometry = morphTargetShape
    ? resolveAppendooBodyGeometry({ ...moodBody, shape: morphTargetShape })
    : null;
  const morphGeometry = morphPlayback.layers
    ? {
      ...geometryFromAppendooMorphLayers(morphPlayback.layers, previewModel.geometry),
      face: morphTargetGeometry
        ? mixAppendooFaceLayout(
          previewModel.geometry.face,
          morphTargetGeometry.face,
          morphPlayback.progress,
        )
        : previewModel.geometry.face,
    }
    : undefined;
  const liveGel = morphPlayback.layers && morphTargetShape && config.colorMode === 'character'
    ? mixAppendooGelPalette(
      previewModel.gel,
      resolveAppendooGelPalette({ mode: 'character', shape: morphTargetShape }),
      morphPlayback.progress,
    )
    : previewModel.gel;

  const patchMorph = (key: 'durationMs' | 'bezierX1' | 'bezierY1' | 'bezierX2' | 'bezierY2', value: number) => {
    setConfig((current) => ({
      ...current,
      morph: mergeAppendooMorphRig(current.morph, {
        [key]: value,
        ...(key.startsWith('bezier') ? { easing: 'custom' as const } : {}),
      }),
    }));
  };

  const setMorphTarget = (target: AppendooMorphTargetId) => {
    setConfig((current) => ({
      ...current,
      morph: mergeAppendooMorphRig(current.morph, { target }),
    }));
  };

  const setMorphEasing = (easing: AppendooTravelEasingId) => {
    setConfig((current) => ({
      ...current,
      morph: applyAppendooMorphEasing(current.morph, easing),
    }));
  };

  const startMorph = (target: AppendooMorphTargetId = previewModel.morph.target) => {
    if (isAppendooMorphShapeTarget(target) && target === config.body.shape && !morphPlayback.layers) {
      return;
    }
    const nextSeed = target === 'random' ? previewModel.morph.seed + 1 : previewModel.morph.seed;
    if (target !== previewModel.morph.target || nextSeed !== previewModel.morph.seed) {
      setConfig((current) => ({
        ...current,
        morph: mergeAppendooMorphRig(current.morph, { target, seed: nextSeed }),
      }));
    }
    const from = morphPlayback.layers ?? sampleAppendooMorphSourceLayers(moodBody);
    const to = sampleAppendooMorphTargetLayers(target, nextSeed, moodBody);
    morphPlayback.play(from, to);
  };

  const goToShape = (shape: AppendooShapeId) => {
    if (shape === config.body.shape) return;
    if (isAppendooMorphShapeTarget(shape)) {
      startMorph(shape);
      return;
    }
    morphPlayback.rest();
    setShape(shape);
  };

  useEffect(() => {
    if (morphPlayback.playing || morphPlayback.time < 1) return;
    const target = previewModel.morph.target;
    if (!isAppendooMorphShapeTarget(target) || target === config.body.shape) return;
    setShape(target);
    morphPlayback.rest();
  }, [config.body.shape, morphPlayback.playing, morphPlayback.time, previewModel.morph.target]);

  const patchFlag = (key: 'spark' | 'zzz', value: boolean) => {
    setConfig((current) => ({
      ...current,
      override: { ...current.override, [key]: value },
    }));
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="appendoo-companion" json={configJson}>
          <BaseComponentsResetButton onClick={() => {
            morphPlayback.rest();
            setConfig(DEFAULT_CONFIG);
          }} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Silhouette" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Shape" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.body.shape}
                    ariaLabel="Body shape"
                    onChange={(event) => {
                      if (isAppendooShapeId(event.target.value)) goToShape(event.target.value);
                    }}
                  >
                    {APPENDOO_SHAPE_IDS.map((id) => (
                      <option key={id} value={id}>{APPENDOO_SHAPE_META[id].label}</option>
                    ))}
                  </UiSelect>
                </FormField>
                <AppendooNumberSliders fields={BODY_FIELDS} valueOf={(key) => previewModel.body[key]} onPatch={patchBody} />
                <BaseComponentsConfigBoolField
                  label="Wonk scatter"
                  checked={previewModel.body.wonkScatter}
                  ariaLabel="Random points"
                  onChange={setWonkScatter}
                />
                <FormField
                  label="Lean"
                  hint={APPENDOO_LEAN_META[config.body.lean].note}
                  className={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                >
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.body.lean}
                    ariaLabel="Body lean"
                    onChange={(event) => {
                      if (isAppendooLeanId(event.target.value)) setLean(event.target.value);
                    }}
                  >
                    {APPENDOO_LEAN_IDS.map((id) => (
                      <option key={id} value={id}>{APPENDOO_LEAN_META[id].label}</option>
                    ))}
                  </UiSelect>
                </FormField>
                <FormField
                  label="Look"
                  hint={APPENDOO_LOOK_META[config.look].note}
                  className={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                >
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.look}
                    ariaLabel="Companion look"
                    onChange={(event) => {
                      if (isAppendooLookId(event.target.value)) setLook(event.target.value);
                    }}
                  >
                    {APPENDOO_LOOK_IDS.map((id) => (
                      <option key={id} value={id}>{APPENDOO_LOOK_META[id].label}</option>
                    ))}
                  </UiSelect>
                </FormField>
              </div>
            </FormSection>

            {appendooLookShowsColor(config.look) ? (
            <FormSection title="Color" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField
                  label="Paint"
                  hint={APPENDOO_COLOR_MODE_META[config.colorMode].note}
                  className={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                >
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.colorMode}
                    ariaLabel="Companion paint"
                    onChange={(event) => {
                      if (isAppendooColorMode(event.target.value)) setColorMode(event.target.value);
                    }}
                  >
                    {APPENDOO_COLOR_MODE_IDS.map((id) => (
                      <option key={id} value={id}>{APPENDOO_COLOR_MODE_META[id].label}</option>
                    ))}
                  </UiSelect>
                </FormField>
                {config.colorMode === 'palette' ? (
                  <FormField label="Palette" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                    <AppendooPaletteSwatchGrid
                      selectedId={config.paletteSwatchId}
                      onSelect={(id) => {
                        if (isAccentMatrixSwatchId(id)) setPaletteSwatch(id);
                      }}
                    />
                  </FormField>
                ) : null}
              </div>
            </FormSection>
            ) : null}

            {appendooLookShowsAccessories(config.look) ? (
            <FormSection title="Accessories" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                {APPENDOO_ACCESSORY_IDS.map((id) => (
                  <BaseComponentsConfigBoolField
                    key={id}
                    label={APPENDOO_ACCESSORY_META[id].label}
                    checked={config.accessories[id]}
                    ariaLabel={APPENDOO_ACCESSORY_META[id].label}
                    onChange={(checked) => setAccessory(id, checked)}
                  />
                ))}
                <FormField
                  label="Accessory color"
                  hint={APPENDOO_ACCESSORY_PAINT[config.accessoryPaintId].note}
                  className={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                >
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.accessoryPaintId}
                    ariaLabel="Accessory color"
                    onChange={(event) => {
                      if (isAppendooAccessoryPaintId(event.target.value)) setAccessoryPaint(event.target.value);
                    }}
                  >
                    {APPENDOO_ACCESSORY_PAINT_IDS.map((id) => (
                      <option key={id} value={id}>{APPENDOO_ACCESSORY_PAINT[id].label}</option>
                    ))}
                  </UiSelect>
                </FormField>
                <AppendooAccessoryPaintSwatches
                  selectedId={config.accessoryPaintId}
                  onSelect={setAccessoryPaint}
                />
              </div>
            </FormSection>
            ) : null}

            <FormSection title="Travel" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <AppendooNumberSliders fields={TRAVEL_POINT_FIELDS} valueOf={(key) => previewModel.travel[key]} onPatch={patchTravelPoint} />
                <AppendooNumberSliders fields={TRAVEL_DURATION_FIELDS} valueOf={(key) => previewModel.travel[key]} onPatch={patchTravelPoint} />
                <FormField label="Easing" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} hint={previewModel.easing.note} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={previewModel.travel.easing}
                    ariaLabel="Travel easing"
                    onChange={(event) => {
                      if (isAppendooTravelEasingId(event.target.value)) setEasing(event.target.value);
                    }}
                  >
                    {APPENDOO_TRAVEL_EASING_IDS.map((id) => (
                      <option key={id} value={id}>{APPENDOO_TRAVEL_EASING_META[id].label}</option>
                    ))}
                  </UiSelect>
                </FormField>
                <AppendooNumberSliders fields={TRAVEL_BEZIER_FIELDS} valueOf={(key) => previewModel.travel[key]} onPatch={patchTravel} />
                <BaseComponentsConfigBoolField
                  label="Loop"
                  checked={previewModel.travel.loop}
                  ariaLabel="Ping-pong until stop"
                  onChange={(checked) => setConfig((current) => ({
                    ...current,
                    travel: mergeAppendooTravelRig(current.travel, { loop: checked }),
                  }))}
                />
                <div className="flex flex-wrap gap-1.5">
                  <AppButton size="sm" intent="primary" onClick={travelPlayback.play}>
                    Play
                  </AppButton>
                  <AppButton size="sm" intent="secondary" onClick={travelPlayback.reverse}>
                    Reverse
                  </AppButton>
                  <AppButton size="sm" intent="cancel" onClick={travelPlayback.stop} disabled={!travelPlayback.playing}>
                    Stop
                  </AppButton>
                </div>
              </div>
            </FormSection>

            <FormSection title="Morph to" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField
                  label="Target"
                  hint={previewModel.morphMeta.note}
                  className={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                >
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={previewModel.morph.target}
                    ariaLabel="Morph target"
                    onChange={(event) => {
                      if (isAppendooMorphTargetId(event.target.value)) setMorphTarget(event.target.value);
                    }}
                  >
                    {APPENDOO_MORPH_TARGET_IDS.map((id) => (
                      <option key={id} value={id}>{APPENDOO_MORPH_TARGET_META[id].label}</option>
                    ))}
                  </UiSelect>
                </FormField>
                <AppendooNumberSliders fields={MORPH_DURATION_FIELDS} valueOf={(key) => previewModel.morph[key]} onPatch={patchMorph} />
                <FormField
                  label="Easing"
                  hint={APPENDOO_TRAVEL_EASING_META[previewModel.morph.easing].note}
                  className={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                >
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={previewModel.morph.easing}
                    ariaLabel="Morph easing"
                    onChange={(event) => {
                      if (isAppendooTravelEasingId(event.target.value)) setMorphEasing(event.target.value);
                    }}
                  >
                    {APPENDOO_TRAVEL_EASING_IDS.map((id) => (
                      <option key={id} value={id}>{APPENDOO_TRAVEL_EASING_META[id].label}</option>
                    ))}
                  </UiSelect>
                </FormField>
                <AppendooNumberSliders fields={MORPH_BEZIER_FIELDS} valueOf={(key) => previewModel.morph[key]} onPatch={patchMorph} />
                <p className="font-mono text-[11px] text-slate-500">{previewModel.morphCssEasing}</p>
                <div className="flex flex-wrap gap-1.5">
                  <AppButton size="sm" intent="primary" onClick={() => startMorph()}>
                    Morph
                  </AppButton>
                  <AppButton
                    size="sm"
                    intent="secondary"
                    onClick={morphPlayback.reverse}
                    disabled={morphPlayback.time <= 0}
                  >
                    Reverse
                  </AppButton>
                  <AppButton
                    size="sm"
                    intent="cancel"
                    onClick={morphPlayback.rest}
                    disabled={morphPlayback.time <= 0 && !morphPlayback.playing}
                  >
                    Rest
                  </AppButton>
                </div>
              </div>
            </FormSection>

            {appendooLookShowsGel(config.look) ? (
            <FormSection title="Rim and trims" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <AppendooNumberSliders fields={RIM_FIELDS} valueOf={(key) => previewModel.body[key]} onPatch={patchBody} />
              </div>
            </FormSection>
            ) : null}

            <FormSection title="Emotion" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Preset" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.emotion}
                    ariaLabel="Emotion preset"
                    onChange={(event) => {
                      if (isAppendooEmotionId(event.target.value)) setEmotion(event.target.value);
                    }}
                  >
                    {APPENDOO_EMOTION_IDS.map((id) => (
                      <option key={id} value={id}>{APPENDOO_EMOTION_META[id].label}</option>
                    ))}
                  </UiSelect>
                </FormField>
                <BaseComponentsConfigBoolField
                  label="Blink"
                  checked={config.blinking}
                  ariaLabel="Close both lids"
                  onChange={(checked) => setConfig((current) => ({ ...current, blinking: checked }))}
                />
                <BaseComponentsConfigBoolField
                  label="Spark"
                  checked={previewModel.spark}
                  ariaLabel="Thinking spark"
                  onChange={(checked) => patchFlag('spark', checked)}
                />
                <BaseComponentsConfigBoolField
                  label="Sleep marks"
                  checked={previewModel.zzz}
                  ariaLabel="Show zzz"
                  onChange={(checked) => patchFlag('zzz', checked)}
                />
              </div>
            </FormSection>

            <FormSection title="Face parts" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                {APPENDOO_FACE_PART_IDS.map((id) => (
                  <BaseComponentsConfigBoolField
                    key={id}
                    label={APPENDOO_FACE_PART_META[id].label}
                    checked={previewModel.parts[id]}
                    ariaLabel={APPENDOO_FACE_PART_META[id].label}
                    onChange={(checked) => setFacePart(id, checked)}
                  />
                ))}
              </div>
            </FormSection>

            <FormSection title="Brows" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <AppendooNumberSliders fields={BROW_FIELDS} valueOf={(key) => previewModel.rig[key]} onPatch={patchNumber} />
              </div>
            </FormSection>

            <FormSection title="Eyes" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <AppendooNumberSliders fields={EYE_FIELDS} valueOf={(key) => previewModel.rig[key]} onPatch={patchNumber} />
              </div>
            </FormSection>

            <FormSection title="Mouth" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <AppendooNumberSliders fields={MOUTH_FIELDS} valueOf={(key) => previewModel.rig[key]} onPatch={patchNumber} />
              </div>
            </FormSection>

            <FormSection title="Gaze and cues" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <BaseComponentsConfigBoolField
                  label="Follow pointer"
                  checked={config.followPointer}
                  ariaLabel="Follow pointer"
                  onChange={(checked) => setConfig((current) => ({ ...current, followPointer: checked }))}
                />
                <BaseComponentsConfigBoolField
                  label="Drag to move"
                  checked={config.draggable}
                  ariaLabel="Drag to move"
                  onChange={(checked) => setConfig((current) => ({ ...current, draggable: checked }))}
                />
                <AppendooNumberSliders
                  fields={config.followPointer
                    ? GAZE_FIELDS.filter((field) => field.key !== 'lookX' && field.key !== 'lookY')
                    : GAZE_FIELDS}
                  valueOf={(key) => previewModel.rig[key]}
                  onPatch={patchNumber}
                />
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>

        <BaseComponentsPreviewFrame sectionId="appendoo-companion">
          <div className={cn(BASE_COMPONENTS_PREVIEW_BODY_CLASS, 'gap-4')}>
            <div
              ref={playgroundBoardRef}
              className="relative min-h-[320px] flex-1 overflow-hidden rounded-2xl bg-slate-50"
            >
              <span
                className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-600"
                style={{ left: `${previewModel.travel.fromX}%`, top: `${previewModel.travel.fromY}%` }}
              />
              <span
                className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-600"
                style={{ left: `${previewModel.travel.toX}%`, top: `${previewModel.travel.toY}%` }}
              />
              <p className="pointer-events-none absolute start-3 top-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {previewModel.easing.label}
              </p>
              <p className="pointer-events-none absolute end-3 top-3 font-mono text-[11px] text-slate-500">
                {previewModel.cssEasing}
              </p>
              <div
                ref={companionHostRef}
                className={cn(
                  'absolute -translate-x-1/2 -translate-y-1/2 overflow-visible',
                  config.draggable && 'select-none',
                  config.draggable && (playgroundDrag.dragging ? 'cursor-grabbing' : 'cursor-grab'),
                )}
                style={{
                  left: `${playgroundDrag.point.x}%`,
                  top: `${playgroundDrag.point.y}%`,
                  width: liveBox.width,
                  height: liveBox.height,
                  touchAction: config.draggable ? 'none' : undefined,
                }}
                onPointerDown={config.draggable ? playgroundDrag.onPointerDown : undefined}
                onPointerMove={config.draggable ? playgroundDrag.onPointerMove : undefined}
                onPointerUp={config.draggable ? playgroundDrag.onPointerUp : undefined}
                onPointerCancel={config.draggable ? playgroundDrag.onPointerCancel : undefined}
              >
                <AppendooCompanionFace
                  emotion={config.emotion}
                  blinking={config.blinking}
                  override={config.override}
                  body={config.body}
                  emotionMood={rimMood}
                  colorMode={config.colorMode}
                  gel={liveGel}
                  accessories={config.accessories}
                  accessoryPaint={previewModel.accessoryPaint}
                  accessoryMood={previewModel.accessoryMood}
                  pointerLook={config.followPointer ? pointerLook : undefined}
                  followCssLook={false}
                  geometryOverride={morphGeometry}
                  extrasOpacity={morphPlayback.extrasOpacity}
                  morphTarget={morphPlayback.layers ? previewModel.morph.target : undefined}
                  look={config.look}
                  parts={previewModel.parts}
                  className="appendoo-companion-studio"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {APPENDOO_LOOK_IDS.map((id) => (
                <AppButton
                  key={id}
                  size="sm"
                  intent={config.look === id ? 'secondary' : 'cancel'}
                  onClick={() => setLook(id)}
                >
                  {APPENDOO_LOOK_META[id].label}
                </AppButton>
              ))}
            </div>
            {appendooLookShowsColor(config.look) ? (
              <div className="flex flex-wrap gap-1.5">
                {APPENDOO_COLOR_MODE_IDS.map((id) => (
                  <AppButton
                    key={id}
                    size="sm"
                    intent={config.colorMode === id ? 'secondary' : 'cancel'}
                    onClick={() => setColorMode(id)}
                  >
                    {APPENDOO_COLOR_MODE_META[id].label}
                  </AppButton>
                ))}
              </div>
            ) : null}
            {appendooLookShowsColor(config.look) && config.colorMode === 'palette' ? (
              <AppendooPaletteSwatchGrid
                selectedId={config.paletteSwatchId}
                onSelect={(id) => {
                  if (isAccentMatrixSwatchId(id)) setPaletteSwatch(id);
                }}
              />
            ) : null}
            {appendooLookShowsAccessories(config.look) ? (
              <div className="flex flex-wrap gap-1.5">
                {APPENDOO_ACCESSORY_IDS.map((id) => (
                  <AppButton
                    key={id}
                    size="sm"
                    intent={config.accessories[id] ? 'secondary' : 'cancel'}
                    onClick={() => setAccessory(id, !config.accessories[id])}
                  >
                    {APPENDOO_ACCESSORY_META[id].label}
                  </AppButton>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
              {APPENDOO_FACE_PART_IDS.map((id) => (
                <AppButton
                  key={id}
                  size="sm"
                  intent={previewModel.parts[id] ? 'secondary' : 'cancel'}
                  onClick={() => setFacePart(id, !previewModel.parts[id])}
                >
                  {APPENDOO_FACE_PART_META[id].label}
                </AppButton>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <AppButton
                size="sm"
                intent={config.followPointer ? 'secondary' : 'cancel'}
                onClick={() => setConfig((current) => ({ ...current, followPointer: !current.followPointer }))}
              >
                Follow pointer
              </AppButton>
              <AppButton
                size="sm"
                intent={config.draggable ? 'secondary' : 'cancel'}
                onClick={() => setConfig((current) => ({ ...current, draggable: !current.draggable }))}
              >
                Drag to move
              </AppButton>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {APPENDOO_SIZE_STEPS.map((step) => (
                <AppButton
                  key={step}
                  size="sm"
                  intent={previewModel.sizeStep === step ? 'secondary' : 'cancel'}
                  onClick={() => setSizePreset(step)}
                  aria-label={`Size ${step}`}
                >
                  {step}
                </AppButton>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {APPENDOO_WONK_STEPS.map((step) => (
                <AppButton
                  key={`wonk-${step}`}
                  size="sm"
                  intent={previewModel.wonkStep === step ? 'secondary' : 'cancel'}
                  onClick={() => setWonkPreset(step)}
                  aria-label={`Wonk ${step}`}
                >
                  {step}
                </AppButton>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <AppButton
                size="sm"
                intent={previewModel.body.wonkScatter ? 'secondary' : 'cancel'}
                onClick={() => setWonkScatter(!previewModel.body.wonkScatter)}
              >
                Scatter
              </AppButton>
              <AppButton
                size="sm"
                intent="cancel"
                disabled={!previewModel.body.wonkScatter}
                onClick={shuffleWonkSeed}
              >
                Shuffle
              </AppButton>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {APPENDOO_LEAN_IDS.map((id) => (
                <AppButton
                  key={`lean-${id}`}
                  size="sm"
                  intent={previewModel.body.lean === id ? 'secondary' : 'cancel'}
                  onClick={() => setLean(id)}
                  aria-label={`Lean ${APPENDOO_LEAN_META[id].label}`}
                >
                  {APPENDOO_LEAN_META[id].label}
                </AppButton>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {APPENDOO_MORPH_TARGET_IDS.map((id) => (
                <AppButton
                  key={id}
                  size="sm"
                  intent={previewModel.morph.target === id ? 'secondary' : 'cancel'}
                  onClick={() => startMorph(id)}
                >
                  {APPENDOO_MORPH_TARGET_META[id].label}
                </AppButton>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {APPENDOO_SHAPE_IDS.map((id) => (
                <AppButton
                  key={id}
                  size="sm"
                  intent={config.body.shape === id ? 'secondary' : 'cancel'}
                  onClick={() => goToShape(id)}
                >
                  {APPENDOO_SHAPE_META[id].label}
                </AppButton>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {APPENDOO_EMOTION_IDS.map((id) => (
                <AppButton
                  key={id}
                  size="sm"
                  intent={config.emotion === id ? 'secondary' : 'cancel'}
                  onClick={() => setEmotion(id)}
                >
                  {APPENDOO_EMOTION_META[id].label}
                </AppButton>
              ))}
            </div>
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
