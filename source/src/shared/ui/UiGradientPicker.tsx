import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, Blend, Copy, GripVertical, Plus, Search, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { UiInput } from './ai-field-assist/AiAssistInput';
import { AppButton } from './AppButton';
import { UiColorPicker } from './UiColorPicker';
import { UiSelect } from './HeroFieldControls';
import { ShellResponsivePopover } from './shell-foundation/ShellResponsivePopover';
import { UiSwitch } from './UiSwitch';
import {
  GRADIENT_PRESET_CATEGORIES,
  GRADIENT_PRESETS,
  getGradientPresetsByCategory,
  type GradientPresetCategoryId,
} from '../lib/gradientPresetCatalog';
import {
  addGradientStop,
  applyGradientCssToDefinition,
  buildGradientCss,
  createDefaultGradient,
  isConicFamily,
  isLinearFamily,
  isRadialFamily,
  isRepeatingGradient,
  removeGradientStop,
  reverseGradientStops,
  updateGradientStop,
  type GradientDefinition,
  type GradientStop,
  type GradientType,
  type RadialShape,
  type RadialSize,
} from '../lib/gradientDefinition';

export type UiGradientPickerVariant = 'field' | 'popover' | 'inline' | 'swatch' | 'minimal';
export type UiGradientPickerSize = 'sm' | 'md' | 'lg';

export type UiGradientPickerProps = {
  value?: GradientDefinition;
  defaultValue?: GradientDefinition;
  onChange?: (definition: GradientDefinition, css: string) => void;
  variant?: UiGradientPickerVariant;
  size?: UiGradientPickerSize;
  label?: string;
  helperText?: string;
  ariaLabel?: string;
  disabled?: boolean;
  compact?: boolean;
  showTypeSelector?: boolean;
  showCssOutput?: boolean;
  showReverse?: boolean;
  showPresets?: boolean;
  showTriggerCss?: boolean;
  triggerBackground?: string;
  className?: string;
};

const SIZE_CLASS: Record<UiGradientPickerSize, { shell: string; preview: string; compact: boolean; input: 'sm' | 'md' | 'lg' }> = {
  sm: { shell: 'max-w-sm', preview: 'h-16', compact: true, input: 'sm' },
  md: { shell: 'max-w-md', preview: 'h-20', compact: true, input: 'sm' },
  lg: { shell: 'max-w-lg', preview: 'h-24', compact: false, input: 'md' },
};

/** Auto height shell — popover scroll wrapper owns height, not the inner panel. */
const GRADIENT_PICKER_SHELL_HEIGHT_CLASS = 'h-auto';

const GRADIENT_PICKER_POPOVER_WIDTH_CLASS = 'w-[min(400px,calc(100vw-2rem))]';

const GRADIENT_PICKER_POPOVER_SHELL_CLASS =
  'shadow-[0_24px_64px_-16px_rgba(15,23,42,0.32),0_12px_28px_-12px_rgba(99,102,241,0.18)]';

const GRADIENT_PICKER_POPOVER_PANEL_CLASS =
  'flex max-h-full min-h-0 flex-col overflow-visible border-0 bg-transparent p-0 shadow-none';

const GRADIENT_PICKER_POPOVER_SURFACE_CLASS = cn(
  GRADIENT_PICKER_POPOVER_SHELL_CLASS,
  'flex max-h-full min-h-0 flex-col overflow-visible rounded-lg',
);

const GRADIENT_PICKER_POPOVER_SCROLL_CLASS = 'min-h-0 flex-1 overflow-y-auto overscroll-contain';

const SWATCH_PRESET_LIMIT = 18;

/** Prevent accidental text selection on dials, labels, and chrome; keep inputs editable. */
const GRADIENT_PICKER_NO_SELECT_CLASS = 'select-none [&_input]:select-text [&_textarea]:select-text';

type GradientBaseType = 'linear' | 'radial' | 'conic';

const GRADIENT_BASE_TYPES: GradientBaseType[] = ['linear', 'radial', 'conic'];
const RADIAL_SHAPES: RadialShape[] = ['circle', 'ellipse'];
const RADIAL_SIZES: RadialSize[] = ['closest-side', 'closest-corner', 'farthest-side', 'farthest-corner'];

const clampPercent = (value: number): number => Math.min(100, Math.max(0, Math.round(value)));

const findAddedGradientStop = (
  before: GradientStop[],
  after: GradientStop[],
): GradientStop | undefined => {
  const beforeIds = new Set(before.map((stop) => stop.id));
  return after.find((stop) => !beforeIds.has(stop.id));
};

const getBaseType = (type: GradientType): GradientBaseType => {
  if (isLinearFamily(type)) {
    return 'linear';
  }
  if (isRadialFamily(type)) {
    return 'radial';
  }
  return 'conic';
};

const withBaseType = (definition: GradientDefinition, base: GradientBaseType): GradientDefinition => {
  const type: GradientType = isRepeatingGradient(definition.type)
    ? `repeating-${base}`
    : base;
  return { ...definition, type };
};

const withRepeating = (definition: GradientDefinition, repeating: boolean): GradientDefinition => {
  const base = getBaseType(definition.type);
  const type: GradientType = repeating ? `repeating-${base}` : base;
  return { ...definition, type };
};

const buildStopTrackCss = (stops: GradientStop[]): string => {
  const sorted = [...stops].sort((left, right) => left.position - right.position);
  return `linear-gradient(90deg, ${sorted.map((stop) => `${stop.color} ${stop.position}%`).join(', ')})`;
};

const DesignerCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  tight?: boolean;
  stacked?: boolean;
}> = ({ children, className, tight = false, stacked = false }) => (
  <div
    className={cn(
      stacked
        ? 'border-b border-slate-200/80 bg-white last:border-b-0'
        : 'rounded-lg border border-white/80 bg-white shadow-[0_6px_24px_rgba(99,102,241,0.07)]',
      tight ? 'px-3 py-2.5' : 'p-3',
      stacked && 'rounded-none border-x-0 shadow-none',
      className,
    )}
  >
    {children}
  </div>
);

const SectionLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn('mb-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400', className)}>
    {children}
  </div>
);

const GradientTypeSegmented: React.FC<{
  value: GradientBaseType;
  disabled?: boolean;
  onChange: (value: GradientBaseType) => void;
}> = ({ value, disabled, onChange }) => (
  <div
    role="radiogroup"
    aria-label="Gradient type"
    className="grid grid-cols-3 gap-0.5 rounded-md bg-indigo-50/90 p-0.5"
  >
    {GRADIENT_BASE_TYPES.map((type) => {
      const active = value === type;
      return (
        <button
          key={type}
          type="button"
          role="radio"
          aria-checked={active}
          disabled={disabled}
          onClick={() => onChange(type)}
          className={cn(
            'rounded-md px-2 py-1.5 text-xs font-semibold capitalize transition',
            active
              ? 'bg-indigo-500 text-white shadow-[0_4px_14px_rgba(99,102,241,0.28)]'
              : 'text-indigo-400 hover:bg-white/70 hover:text-indigo-600',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          {type}
        </button>
      );
    })}
  </div>
);

const GradientStopTrack: React.FC<{
  trackCss: string;
  stops: GradientStop[];
  selectedStopId: string | null;
  disabled?: boolean;
  onSelect: (stopId: string) => void;
  onAdd: (position: number) => void;
  onMove: (stopId: string, position: number) => void;
}> = ({ trackCss, stops, selectedStopId, disabled, onSelect, onAdd, onMove }) => {
  const trackRef = useRef<HTMLDivElement>(null);

  const handleTrackPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }
    event.preventDefault();
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const position = clampPercent(((event.clientX - rect.left) / rect.width) * 100);
    if (event.detail === 2) {
      onAdd(position);
      return;
    }
    if (selectedStopId) {
      onMove(selectedStopId, position);
    }
  };

  return (
    <div className="relative px-0.5 select-none">
      <div
        ref={trackRef}
        className={cn(
          'relative h-2 overflow-hidden rounded-full border border-white/70 shadow-inner',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-crosshair',
        )}
        style={{ background: trackCss }}
        onPointerDown={handleTrackPointer}
        aria-label="Gradient stops"
      />
      {stops.map((stop) => (
        <button
          key={stop.id}
          type="button"
          disabled={disabled}
          aria-label={`Stop at ${stop.position}%`}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(stop.id);
          }}
          className={cn(
            'absolute -top-0.5 z-[2] size-4 -translate-x-1/2 rounded-full border-2 border-white shadow-sm transition',
            selectedStopId === stop.id ? 'scale-110 ring-2 ring-indigo-300' : 'hover:scale-105',
          )}
          style={{
            left: `${stop.position}%`,
            backgroundColor: stop.color,
          }}
        />
      ))}
    </div>
  );
};

const AngleDial: React.FC<{
  angle: number;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onChange: (angle: number) => void;
}> = ({ angle, disabled, size = 'sm', onChange }) => {
  const dialRef = useRef<HTMLDivElement>(null);
  const radians = ((angle - 90) * Math.PI) / 180;
  const dotRadius = size === 'lg' ? 40 : size === 'md' ? 38 : 36;
  const dotLeft = 50 + Math.cos(radians) * dotRadius;
  const dotTop = 50 + Math.sin(radians) * dotRadius;

  const updateAngle = (clientX: number, clientY: number) => {
    const rect = dialRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const nextRadians = Math.atan2(clientY - cy, clientX - cx);
    const degrees = (nextRadians * 180) / Math.PI + 90;
    onChange(Math.round((degrees + 360) % 360));
  };

  return (
    <div
      ref={dialRef}
      role="slider"
      aria-label="Gradient angle"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={angle}
      tabIndex={disabled ? -1 : 0}
      className={cn(
        'relative mx-auto shrink-0 rounded-full border border-dashed border-slate-200 bg-white select-none',
        size === 'lg' ? 'size-32' : size === 'md' ? 'size-24' : 'size-16',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
      )}
      onPointerDown={(event) => {
        if (disabled) {
          return;
        }
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        updateAngle(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        if (event.buttons !== 1 || disabled) {
          return;
        }
        updateAngle(event.clientX, event.clientY);
      }}
    >
      <div className={cn(
        'pointer-events-none absolute inset-0 grid select-none place-items-center font-semibold text-slate-700',
        size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-xl' : 'text-lg',
      )}>
        {angle}°
      </div>
      <span
        className={cn(
          'absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500 shadow-[0_0_0_3px_rgba(99,102,241,0.12)]',
          size === 'lg' ? 'size-3.5' : size === 'md' ? 'size-3' : 'size-2.5',
        )}
        style={{ left: `${dotLeft}%`, top: `${dotTop}%` }}
      />
    </div>
  );
};

const RANGE_INPUT_CLASS = [
  'absolute inset-0 z-[1] h-full w-full cursor-pointer appearance-none bg-transparent disabled:cursor-not-allowed',
  '[&::-webkit-slider-thumb]:size-0 [&::-webkit-slider-thumb]:appearance-none',
  '[&::-moz-range-thumb]:size-0 [&::-moz-range-thumb]:border-0',
].join(' ');

const AxisSlider: React.FC<{
  label: string;
  value: number;
  disabled?: boolean;
  compact?: boolean;
  onChange: (value: number) => void;
}> = ({ label, value, disabled, compact = false, onChange }) => (
  <div className="min-w-0 select-none">
    <div className={cn('flex items-center justify-end gap-2', compact ? 'mb-0.5' : 'mb-1')}>
      <span className="select-none text-[11px] font-semibold text-indigo-500">{value}%</span>
    </div>
    <div className={cn('relative rounded-full bg-slate-100', compact ? 'h-1.5' : 'h-2')}>
      <div
        className="absolute inset-y-0 start-0 rounded-full bg-gradient-to-r from-indigo-400 to-violet-500"
        style={{ width: `${value}%` }}
      />
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(clampPercent(Number(event.target.value)))}
        className={RANGE_INPUT_CLASS}
      />
      <div
        className={cn(
          'pointer-events-none absolute top-1/2 z-[2] flex -translate-y-1/2 items-center justify-center rounded border border-slate-200 bg-white shadow-sm',
          compact ? 'h-4 w-2.5' : 'h-5 w-3',
        )}
        style={{ left: `calc(${value}% - ${compact ? 5 : 6}px)` }}
      >
        <GripVertical className={cn('text-slate-400', compact ? 'size-2' : 'size-2.5')} aria-hidden />
      </div>
    </div>
  </div>
);

type DesignerPanelView = 'designer' | 'presets';

const DESIGNER_VIEW_TABS: Array<{ id: DesignerPanelView; label: string }> = [
  { id: 'designer', label: 'Designer' },
  { id: 'presets', label: 'Presets' },
];

const GradientPickerViewTabs: React.FC<{
  value: DesignerPanelView;
  disabled?: boolean;
  onChange: (value: DesignerPanelView) => void;
}> = ({ value, disabled, onChange }) => (
  <div
    role="tablist"
    aria-label="Gradient picker views"
    className="grid grid-cols-2 gap-0.5 rounded-md border border-slate-200/80 bg-indigo-50/90 p-0.5"
  >
    {DESIGNER_VIEW_TABS.map((tab) => {
      const active = value === tab.id;
      return (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active}
          disabled={disabled}
          onClick={() => onChange(tab.id)}
          className={cn(
            'rounded-md px-2 py-1.5 text-xs font-semibold transition',
            active
              ? 'bg-indigo-500 text-white shadow-[0_4px_14px_rgba(99,102,241,0.28)]'
              : 'text-indigo-400 hover:bg-indigo-50 hover:text-indigo-600',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          {tab.label}
        </button>
      );
    })}
  </div>
);

const GradientPresetsPanel: React.FC<{
  disabled?: boolean;
  onSelect: (css: string) => void;
}> = ({ disabled, onSelect }) => {
  const [category, setCategory] = useState<GradientPresetCategoryId | 'all'>('all');
  const [query, setQuery] = useState('');
  const presets = useMemo(() => {
    const byCategory = getGradientPresetsByCategory(category);
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return byCategory;
    }
    return byCategory.filter((preset) => (
      preset.name.toLowerCase().includes(normalized)
      || preset.category.toLowerCase().includes(normalized)
    ));
  }, [category, query]);

  return (
    <div className={cn('flex flex-col', GRADIENT_PICKER_NO_SELECT_CLASS)}>
      <div className="relative border-b border-slate-200/80 bg-white px-3 py-2">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          type="search"
          value={query}
          disabled={disabled}
          placeholder="Search presets..."
          onChange={(event) => setQuery(event.target.value)}
          className="h-8 w-full rounded-md border border-slate-200 bg-white ps-8 pe-2 text-[11px] font-medium text-slate-700 outline-none focus:border-indigo-300 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200/80 bg-white px-3 py-2">
        {GRADIENT_PRESET_CATEGORIES.map((entry) => {
          const active = category === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              disabled={disabled}
              onClick={() => setCategory(entry.id)}
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold transition',
                active
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'bg-white text-slate-500 hover:bg-indigo-50 hover:text-indigo-600',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              {entry.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2 bg-white p-3">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(preset.css)}
            className={cn(
              'group overflow-hidden rounded-md border border-slate-200/90 bg-white text-start shadow-sm transition',
              'hover:border-indigo-300 hover:shadow-[0_6px_18px_rgba(99,102,241,0.14)]',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <div
              className="h-14 w-full border-b border-slate-100"
              style={{ background: preset.css }}
              aria-hidden
            />
            <div className="truncate px-2 py-1.5 text-[10px] leading-snug">
              <span className="font-semibold text-slate-700 group-hover:text-indigo-600">{preset.name}</span>
              <span className="font-medium text-slate-400">
                {' · '}
                {GRADIENT_PRESET_CATEGORIES.find((entry) => entry.id === preset.category)?.label ?? preset.category}
              </span>
            </div>
          </button>
        ))}
      </div>

      {presets.length === 0 ? (
        <div className="border-t border-dashed border-slate-200 bg-white px-3 py-6 text-center text-[11px] text-slate-500">
          No presets match your search.
        </div>
      ) : null}
    </div>
  );
};

export const UiGradientPicker: React.FC<UiGradientPickerProps> = ({
  value,
  defaultValue = createDefaultGradient(),
  onChange,
  variant = 'inline',
  size = 'md',
  label,
  helperText,
  ariaLabel = 'Gradient picker',
  disabled = false,
  compact,
  showTypeSelector = true,
  showCssOutput = false,
  showReverse = true,
  showPresets = true,
  showTriggerCss = true,
  triggerBackground,
  className,
}) => {
  const fieldId = useId();
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(value ?? defaultValue);
  const [selectedStopId, setSelectedStopId] = useState<string | null>((value ?? defaultValue).stops[0]?.id ?? null);
  const [gradientEasing, setGradientEasing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [panelView, setPanelView] = useState<DesignerPanelView>('designer');
  const [popoverOpen, setPopoverOpen] = useState(false);
  const designerContentRef = useRef<HTMLDivElement>(null);
  const [lockedTabContentHeight, setLockedTabContentHeight] = useState<number | undefined>();
  const sizeConfig = SIZE_CLASS[size];
  const resolvedCompact = compact ?? sizeConfig.compact;
  const showExtendedControls = variant === 'inline' || variant === 'popover' || variant === 'field';
  const shellWidthClass = variant === 'popover' || variant === 'field'
    ? GRADIENT_PICKER_POPOVER_WIDTH_CLASS
    : sizeConfig.shell;

  useEffect(() => {
    if (isControlled) {
      setInternalValue(value);
    }
  }, [isControlled, value]);

  const definition = internalValue;
  const css = useMemo(() => buildGradientCss(definition), [definition]);
  const trackCss = useMemo(() => buildStopTrackCss(definition.stops), [definition.stops]);
  const selectedStop = definition.stops.find((stop) => stop.id === selectedStopId) ?? definition.stops[0];
  const baseType = getBaseType(definition.type);
  const repeating = isRepeatingGradient(definition.type);

  const measureDesignerContentHeight = useCallback(() => {
    if (!designerContentRef.current) {
      return;
    }
    const nextHeight = designerContentRef.current.offsetHeight;
    setLockedTabContentHeight((prev) => prev ?? nextHeight);
  }, []);

  useEffect(() => {
    if (!popoverOpen && (variant === 'popover' || variant === 'field')) {
      setLockedTabContentHeight(undefined);
    }
  }, [popoverOpen, variant]);

  const commit = useCallback((next: GradientDefinition) => {
    setInternalValue(next);
    onChange?.(next, buildGradientCss(next));
  }, [onChange]);

  const handleAddStop = (position?: number) => {
    const next = addGradientStop(definition, position);
    const added = findAddedGradientStop(definition.stops, next.stops);
    commit(next);
    setSelectedStopId(added?.id ?? next.stops[0]?.id ?? null);
  };

  const updateDefinition = (patch: Partial<GradientDefinition>) => {
    commit({ ...definition, ...patch });
  };

  const handleBaseTypeChange = (nextBase: GradientBaseType) => {
    const next = withBaseType(definition, nextBase);
    commit(next);
    setSelectedStopId(next.stops[0]?.id ?? null);
  };

  const handleCopyCss = async () => {
    try {
      await navigator.clipboard.writeText(css);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const handlePresetSelect = (presetCss: string) => {
    const next = applyGradientCssToDefinition(presetCss);
    if (!next) {
      return;
    }
    commit(next);
    setSelectedStopId(next.stops[0]?.id ?? null);
    setPanelView('designer');
  };

  const isLinearOnly = isLinearFamily(definition.type);
  const isRadialOnly = isRadialFamily(definition.type);
  const isConicOnly = isConicFamily(definition.type);
  const previewHeight = resolvedCompact ? sizeConfig.preview : SIZE_CLASS.lg.preview;

  const triggerPreviewBackground = triggerBackground?.trim() || css;

  const gradientPreview = (
    <div
      className={cn(
        'overflow-hidden border border-slate-200 shadow-inner',
        showTriggerCss ? 'h-8 w-12 shrink-0 rounded-md' : 'h-full w-full rounded-[2px] border-0 shadow-none',
      )}
      style={{ background: triggerPreviewBackground }}
      aria-hidden
    />
  );

  const designerBody = (
    <div className={cn('flex flex-col', lockedTabContentHeight && 'min-h-full bg-white')}>
        <DesignerCard stacked>
          <GradientStopTrack
            trackCss={trackCss}
            stops={definition.stops}
            selectedStopId={selectedStop?.id ?? null}
            disabled={disabled}
            onSelect={setSelectedStopId}
            onAdd={(position) => handleAddStop(position)}
            onMove={(stopId, position) => {
              commit(updateGradientStop(definition, stopId, { position: clampPercent(position) }));
            }}
          />

          <div
            className={cn('mt-3 overflow-hidden rounded-md border border-slate-100 shadow-inner', previewHeight)}
            style={{ background: css }}
            aria-label="Gradient preview"
          />

          {selectedStop ? (
            <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_4.5rem] items-end gap-2 border-t border-slate-100 pt-2.5">
              <UiColorPicker
                label="Color"
                variant="popover"
                size="sm"
                value={selectedStop.color}
                disabled={disabled}
                showEyeDropper
                onChange={(color) => commit(updateGradientStop(definition, selectedStop.id, { color }))}
              />
              <label className="flex flex-col gap-1">
                <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Pos</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={selectedStop.position}
                  disabled={disabled}
                  onChange={(event) => commit(updateGradientStop(definition, selectedStop.id, {
                    position: clampPercent(Number(event.target.value)),
                  }))}
                  className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 outline-none focus:border-indigo-300 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>
            </div>
          ) : null}

          <div className="mt-2 flex items-center gap-1 border-t border-slate-100 pt-2">
            <AppButton size="sm" intent="secondary" disabled={disabled} onClick={() => handleAddStop()} title="Add stop">
              <Plus className="size-3" aria-hidden />
            </AppButton>
            {showReverse ? (
              <AppButton
                size="sm"
                intent="secondary"
                disabled={disabled}
                title="Reverse stops"
                onClick={() => commit({ ...definition, stops: reverseGradientStops(definition.stops) })}
              >
                <ArrowLeftRight className="size-3" aria-hidden />
              </AppButton>
            ) : null}
            <AppButton
              size="sm"
              intent="secondary"
              disabled={disabled || definition.stops.length <= 2 || !selectedStop}
              title="Remove stop"
              onClick={() => {
                if (!selectedStop) {
                  return;
                }
                const next = removeGradientStop(definition, selectedStop.id);
                commit(next);
                setSelectedStopId(next.stops[0]?.id ?? null);
              }}
            >
              <Trash2 className="size-3" aria-hidden />
            </AppButton>
          </div>
        </DesignerCard>

        {showExtendedControls ? (
          <>
        <DesignerCard stacked tight>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-[5px]">
              <UiSwitch aria-label="Gradient easing" isSelected={gradientEasing} isDisabled={disabled} onChange={setGradientEasing} />
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Easing</span>
            </div>
            <div className="flex items-center gap-[5px]">
              <UiSwitch
                aria-label="Repeating pattern"
                isSelected={repeating}
                isDisabled={disabled}
                onChange={(next) => commit(withRepeating(definition, next))}
              />
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Repeat</span>
            </div>
          </div>
        </DesignerCard>

        <DesignerCard stacked>
          {showTypeSelector ? (
            <div className="mb-2 shrink-0">
              <GradientTypeSegmented value={baseType} disabled={disabled} onChange={handleBaseTypeChange} />
            </div>
          ) : null}

          <div className="flex flex-col">
            {isLinearOnly ? (
              <div className="flex shrink-0 items-center justify-center py-1">
                <AngleDial
                  size={resolvedCompact ? 'md' : 'lg'}
                  angle={definition.angle}
                  disabled={disabled}
                  onChange={(angle) => updateDefinition({ angle })}
                />
              </div>
            ) : isRadialOnly ? (
              <>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <AxisSlider
                    compact
                    label="Center X"
                    value={definition.centerX}
                    disabled={disabled}
                    onChange={(centerX) => updateDefinition({ centerX })}
                  />
                  <AxisSlider
                    compact
                    label="Center Y"
                    value={definition.centerY}
                    disabled={disabled}
                    onChange={(centerY) => updateDefinition({ centerY })}
                  />
                </div>
                <div className="my-[10px] grid shrink-0 grid-cols-2 gap-2 border-t border-slate-200/80 pt-2">
                  <UiSelect
                    nested
                    size="sm"
                    className="w-full"
                    ariaLabel="Radial shape"
                    value={definition.radialShape}
                    disabled={disabled}
                    onChange={(event) => updateDefinition({ radialShape: event.target.value as RadialShape })}
                  >
                    {RADIAL_SHAPES.map((shape) => (
                      <option key={shape} value={shape}>{shape}</option>
                    ))}
                  </UiSelect>
                  <UiSelect
                    nested
                    size="sm"
                    className="w-full"
                    ariaLabel="Radial size"
                    value={definition.radialSize}
                    disabled={disabled}
                    onChange={(event) => updateDefinition({ radialSize: event.target.value as RadialSize })}
                  >
                    {RADIAL_SIZES.map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </UiSelect>
                </div>
              </>
            ) : isConicOnly ? (
              <div className="flex shrink-0 flex-col">
                <div className="flex shrink-0 flex-col gap-1.5">
                  <AxisSlider
                    compact
                    label="Center X"
                    value={definition.centerX}
                    disabled={disabled}
                    onChange={(centerX) => updateDefinition({ centerX })}
                  />
                  <AxisSlider
                    compact
                    label="Center Y"
                    value={definition.centerY}
                    disabled={disabled}
                    onChange={(centerY) => updateDefinition({ centerY })}
                  />
                </div>
                <div className="flex shrink-0 items-center justify-center py-1">
                  <AngleDial
                    size={resolvedCompact ? 'md' : 'lg'}
                    angle={definition.angle}
                    disabled={disabled}
                    onChange={(angle) => updateDefinition({ angle })}
                  />
                </div>
              </div>
            ) : null}

            {repeating ? (
              <div className="shrink-0 border-t border-slate-100 pt-2">
                <AxisSlider
                  label="Repeat length"
                  value={definition.repeatLength}
                  disabled={disabled || !repeating}
                  onChange={(repeatLength) => updateDefinition({ repeatLength })}
                />
              </div>
            ) : null}
          </div>
        </DesignerCard>
          </>
        ) : null}

        {showCssOutput && showExtendedControls ? (
          <DesignerCard stacked tight>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <SectionLabel className="mb-0">CSS</SectionLabel>
              <AppButton size="sm" intent="secondary" disabled={disabled} onClick={handleCopyCss}>
                <Copy className="size-3" aria-hidden />
                {copied ? 'Copied' : 'Copy'}
              </AppButton>
            </div>
            <pre className="overflow-x-auto rounded-md border border-slate-100 bg-slate-50/80 p-2 text-[10px] leading-relaxed text-slate-600">
              {css}
            </pre>
          </DesignerCard>
        ) : null}
    </div>
  );

  const showDesignerTabs = showPresets && showExtendedControls;

  const isPresetsView = showDesignerTabs && panelView === 'presets';

  useLayoutEffect(() => {
    if (!showDesignerTabs) {
      return;
    }
    if ((variant === 'popover' || variant === 'field') && !popoverOpen) {
      return;
    }
    measureDesignerContentHeight();
    window.requestAnimationFrame(measureDesignerContentHeight);
  }, [
    showDesignerTabs,
    popoverOpen,
    variant,
    measureDesignerContentHeight,
    showCssOutput,
    showTypeSelector,
  ]);

  const lockedTabContentStyle = showDesignerTabs && lockedTabContentHeight
    ? { height: lockedTabContentHeight, maxHeight: lockedTabContentHeight }
    : undefined;

  const designerPanel = (
    <div
      className={cn(
        shellWidthClass,
        GRADIENT_PICKER_SHELL_HEIGHT_CLASS,
        'flex flex-col overflow-hidden rounded-lg border border-slate-200/80 bg-[#f3f5f9]',
        GRADIENT_PICKER_NO_SELECT_CLASS,
      )}
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.28) 1px, transparent 1px)',
        backgroundSize: '14px 14px',
      }}
    >
      {showDesignerTabs ? (
        <div className="shrink-0 border-b border-slate-200/70 bg-white/90 px-2 py-2">
          <GradientPickerViewTabs
            value={panelView}
            disabled={disabled}
            onChange={setPanelView}
          />
        </div>
      ) : null}

      <div
        className={cn('relative shrink-0 overflow-hidden', lockedTabContentHeight && 'bg-white')}
        style={lockedTabContentStyle}
      >
        <div
          ref={designerContentRef}
          className={cn(
            lockedTabContentHeight && 'absolute inset-0 overflow-y-auto overscroll-contain bg-white',
            isPresetsView && lockedTabContentHeight && 'hidden',
          )}
        >
          {designerBody}
        </div>
        {lockedTabContentHeight || isPresetsView ? (
          <div
            className={cn(
              lockedTabContentHeight && 'absolute inset-0 overflow-y-auto overscroll-contain bg-white',
              !isPresetsView && lockedTabContentHeight && 'hidden',
            )}
          >
            <GradientPresetsPanel
              disabled={disabled}
              onSelect={handlePresetSelect}
            />
          </div>
        ) : null}
      </div>
    </div>
  );

  const popoverPanelContent = (
    <div className={GRADIENT_PICKER_POPOVER_SURFACE_CLASS}>
      <div
        className={cn(
          GRADIENT_PICKER_POPOVER_SCROLL_CLASS,
          lockedTabContentHeight && 'overflow-hidden',
        )}
      >
        {designerPanel}
      </div>
    </div>
  );

  const embeddedSwatchTrigger = !showTriggerCss;

  const designerPopover = (
    <ShellResponsivePopover
      open={popoverOpen}
      onOpenChange={setPopoverOpen}
      placement="bottom-start"
      fallbackPlacement="top-start"
      portal
      portalMaxHeight={false}
      fillTrigger={embeddedSwatchTrigger}
      ariaLabel={ariaLabel}
      className={GRADIENT_PICKER_POPOVER_PANEL_CLASS}
      trigger={(
        <button
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            showTriggerCss
              ? 'inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50'
              : 'flex h-full min-h-0 w-full min-w-0 flex-1 items-stretch self-stretch bg-white p-0 transition hover:bg-slate-50',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          {gradientPreview}
          {showTriggerCss ? (
            <>
              <span className="max-w-[12rem] truncate font-mono text-[11px]">{css}</span>
              <Blend className="size-3.5 text-slate-400" aria-hidden />
            </>
          ) : null}
        </button>
      )}
    >
      {popoverPanelContent}
    </ShellResponsivePopover>
  );

  if (variant === 'swatch') {
    return (
      <div className={cn('flex flex-col gap-2', GRADIENT_PICKER_NO_SELECT_CLASS, className)}>
        {label ? <span className="text-xs font-semibold text-slate-700">{label}</span> : null}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {GRADIENT_PRESETS.slice(0, SWATCH_PRESET_LIMIT).map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              aria-label={preset.name}
              onClick={() => handlePresetSelect(preset.css)}
              className={cn(
                'h-10 overflow-hidden rounded-md border border-slate-200 shadow-sm transition hover:border-indigo-300',
                css === preset.css && 'ring-2 ring-indigo-400',
                disabled && 'cursor-not-allowed opacity-60',
              )}
              style={{ background: preset.css }}
              title={preset.name}
            />
          ))}
        </div>
        {helperText ? <p className="text-[11px] text-slate-500">{helperText}</p> : null}
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <div className={cn('flex flex-col gap-2', GRADIENT_PICKER_NO_SELECT_CLASS, className)}>
        {label ? <span className="text-xs font-semibold text-slate-700">{label}</span> : null}
        {designerPanel}
        {helperText ? <p className="text-[11px] text-slate-500">{helperText}</p> : null}
      </div>
    );
  }

  if (variant === 'popover') {
    return (
      <div className={cn(
        showTriggerCss ? 'flex flex-col gap-2' : 'h-full w-full',
        GRADIENT_PICKER_NO_SELECT_CLASS,
        className,
      )}>
        {label ? <span className="text-xs font-semibold text-slate-700">{label}</span> : null}
        {designerPopover}
        {helperText ? <p className="text-[11px] text-slate-500">{helperText}</p> : null}
      </div>
    );
  }

  if (variant === 'field') {
    return (
      <div className={cn('relative flex flex-col gap-1', GRADIENT_PICKER_NO_SELECT_CLASS, className)}>
        {label ? <label htmlFor={fieldId} className="text-xs font-semibold text-slate-700">{label}</label> : null}
        <UiInput
          id={fieldId}
          aiAssist={false}
          autoDir={false}
          type="text"
          size={sizeConfig.input}
          value={css}
          disabled={disabled}
          readOnly
          ariaLabel={ariaLabel}
          className="font-mono text-xs"
          startContent={(
            <ShellResponsivePopover
              open={popoverOpen}
              onOpenChange={setPopoverOpen}
              placement="bottom-start"
              fallbackPlacement="top-start"
              portal
              portalMaxHeight={false}
              ariaLabel="Open gradient picker"
              className={GRADIENT_PICKER_POPOVER_PANEL_CLASS}
              trigger={(
                <button
                  type="button"
                  disabled={disabled}
                  aria-label="Open gradient picker"
                  className={cn('relative flex items-center justify-center', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}
                >
                  {gradientPreview}
                </button>
              )}
            >
              {popoverPanelContent}
            </ShellResponsivePopover>
          )}
        />
        {helperText ? <p className="text-[11px] text-slate-500">{helperText}</p> : null}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2', GRADIENT_PICKER_NO_SELECT_CLASS, className)}>
      {label ? <span className="text-xs font-semibold text-slate-700">{label}</span> : null}
      {designerPanel}
      {helperText ? <p className="text-[11px] text-slate-500">{helperText}</p> : null}
    </div>
  );
};
