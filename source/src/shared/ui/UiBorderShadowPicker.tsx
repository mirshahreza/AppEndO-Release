import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, BoxSelect, Copy, GripVertical, Plus, Search, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { UiInput } from './ai-field-assist/AiAssistInput';
import { AppButton } from './AppButton';
import { UiColorPicker } from './UiColorPicker';
import { ShellResponsivePopover } from './shell-foundation/ShellResponsivePopover';
import { UiSwitch } from './UiSwitch';
import {
  BORDER_SHADOW_PRESET_CATEGORIES,
  BORDER_SHADOW_PRESETS,
  getBorderShadowPresetsByCategory,
  type BorderShadowPresetCategoryId,
} from '../lib/borderShadowPresetCatalog';
import {
  addShadowLayer,
  applyBorderShadowPreset,
  buildBorderShadowCssOutput,
  buildBorderShadowPreviewStyle,
  buildShadowPreviewStyle,
  clampBorderValue,
  clampShadowOffset,
  clampShadowRadius,
  createDefaultBorderShadow,
  removeShadowLayer,
  reverseShadowLayers,
  updateBorder,
  updateShadowLayer,
  type BorderShadowCssOutput,
  type BorderShadowDefinition,
  type BorderStyle,
  type ShadowLayer,
} from '../lib/borderShadowDefinition';

export type UiBorderShadowPickerVariant = 'field' | 'popover' | 'inline' | 'swatch' | 'minimal';
export type UiBorderShadowPickerSize = 'sm' | 'md' | 'lg';

export type UiBorderShadowPickerProps = {
  value?: BorderShadowDefinition;
  defaultValue?: BorderShadowDefinition;
  onChange?: (definition: BorderShadowDefinition, css: BorderShadowCssOutput) => void;
  variant?: UiBorderShadowPickerVariant;
  size?: UiBorderShadowPickerSize;
  label?: string;
  helperText?: string;
  ariaLabel?: string;
  disabled?: boolean;
  compact?: boolean;
  showCssOutput?: boolean;
  showReverse?: boolean;
  showPresets?: boolean;
  showTriggerCss?: boolean;
  /** When `shadow-only`, edits box-shadow CSS and hides border controls. */
  pickerMode?: 'border-shadow' | 'shadow-only';
  /** Initial Border/Shadow tab when the designer opens. */
  defaultDesignerFocus?: 'border' | 'shadow';
  className?: string;
};

const SIZE_CLASS: Record<UiBorderShadowPickerSize, { shell: string; preview: string; compact: boolean; input: 'sm' | 'md' | 'lg' }> = {
  sm: { shell: 'max-w-sm', preview: 'h-16', compact: true, input: 'sm' },
  md: { shell: 'max-w-md', preview: 'h-20', compact: true, input: 'sm' },
  lg: { shell: 'max-w-lg', preview: 'h-24', compact: false, input: 'md' },
};

/** Auto height shell — popover scroll wrapper owns height, not the inner panel. */
const BORDER_SHADOW_PICKER_SHELL_HEIGHT_CLASS = 'h-auto';
const BORDER_SHADOW_PICKER_POPOVER_WIDTH_CLASS = 'w-[min(400px,calc(100vw-2rem))]';
const BORDER_SHADOW_PICKER_POPOVER_SHELL_CLASS =
  'shadow-[0_24px_64px_-16px_rgba(15,23,42,0.32),0_12px_28px_-12px_rgba(99,102,241,0.18)]';
const BORDER_SHADOW_PICKER_POPOVER_PANEL_CLASS =
  'flex max-h-full min-h-0 flex-col overflow-visible border-0 bg-transparent p-0 shadow-none';
const BORDER_SHADOW_PICKER_POPOVER_SURFACE_CLASS = cn(
  BORDER_SHADOW_PICKER_POPOVER_SHELL_CLASS,
  'flex max-h-full min-h-0 flex-col overflow-visible rounded-lg',
);
const BORDER_SHADOW_PICKER_POPOVER_SCROLL_CLASS = 'min-h-0 flex-1 overflow-y-auto overscroll-contain';
const SWATCH_PRESET_LIMIT = 18;
const BORDER_SHADOW_PICKER_NO_SELECT_CLASS = 'select-none [&_input]:select-text [&_textarea]:select-text';
const BORDER_STYLES: BorderStyle[] = ['solid', 'dashed', 'dotted', 'double', 'none'];
const OFFSET_DIAL_MAX = 40;

type BorderWidthSide = 'top' | 'right' | 'bottom' | 'left';
type BorderRadiusCorner = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft';

const BORDER_WIDTH_SIDES: BorderWidthSide[] = ['top', 'right', 'bottom', 'left'];
const BORDER_RADIUS_CORNERS: BorderRadiusCorner[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];

const BORDER_WIDTH_SIDE_LABEL: Record<BorderWidthSide, string> = {
  top: 'Top',
  right: 'Right',
  bottom: 'Bottom',
  left: 'Left',
};

const BORDER_RADIUS_CORNER_LABEL: Record<BorderRadiusCorner, string> = {
  topLeft: 'Top left',
  topRight: 'Top right',
  bottomRight: 'Bottom right',
  bottomLeft: 'Bottom left',
};

const RANGE_INPUT_CLASS = [
  'absolute inset-0 z-[1] h-full w-full cursor-pointer appearance-none bg-transparent disabled:cursor-not-allowed',
  '[&::-webkit-slider-thumb]:size-0 [&::-webkit-slider-thumb]:appearance-none',
  '[&::-moz-range-thumb]:size-0 [&::-moz-range-thumb]:border-0',
].join(' ');

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

type DesignerFocus = 'border' | 'shadow';

const DesignerFocusTabs: React.FC<{
  value: DesignerFocus;
  disabled?: boolean;
  onChange: (value: DesignerFocus) => void;
}> = ({ value, disabled, onChange }) => (
  <div
    role="tablist"
    aria-label="Border and shadow picker focus"
    className="grid grid-cols-2 gap-0.5 rounded-md bg-indigo-50/90 p-0.5"
  >
    {(['border', 'shadow'] as const).map((focus) => {
      const active = value === focus;
      return (
        <button
          key={focus}
          type="button"
          role="tab"
          aria-selected={active}
          disabled={disabled}
          onClick={() => onChange(focus)}
          className={cn(
            'rounded-md px-2 py-1.5 text-xs font-semibold capitalize transition',
            active
              ? 'bg-indigo-500 text-white shadow-[0_4px_14px_rgba(99,102,241,0.28)]'
              : 'text-indigo-400 hover:bg-white/70 hover:text-indigo-600',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          {focus}
        </button>
      );
    })}
  </div>
);

const BorderStyleSegmented: React.FC<{
  value: BorderStyle;
  disabled?: boolean;
  onChange: (value: BorderStyle) => void;
}> = ({ value, disabled, onChange }) => (
  <div
    role="radiogroup"
    aria-label="Border style"
    className="flex flex-wrap gap-0.5 rounded-md bg-indigo-50/90 p-0.5"
  >
    {BORDER_STYLES.map((style) => {
      const active = value === style;
      return (
        <button
          key={style}
          type="button"
          role="radio"
          aria-checked={active}
          disabled={disabled}
          onClick={() => onChange(style)}
          className={cn(
            'rounded-md px-2 py-1 text-[10px] font-semibold capitalize transition',
            active
              ? 'bg-indigo-500 text-white shadow-[0_4px_14px_rgba(99,102,241,0.28)]'
              : 'text-indigo-400 hover:bg-white/70 hover:text-indigo-600',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          {style}
        </button>
      );
    })}
  </div>
);

const AxisSlider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  compact?: boolean;
  onChange: (value: number) => void;
}> = ({ label, value, min, max, disabled, compact = false, onChange }) => {
  const range = max - min;
  const percent = range === 0 ? 0 : ((value - min) / range) * 100;
  return (
    <div className="min-w-0 select-none">
      <div className={cn('flex items-center justify-between gap-2', compact ? 'mb-0.5' : 'mb-1')}>
        <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</span>
        <span className="select-none text-[11px] font-semibold text-indigo-500">{value}px</span>
      </div>
      <div className={cn('relative rounded-full bg-slate-100', compact ? 'h-1.5' : 'h-2')}>
        <div
          className="absolute inset-y-0 start-0 rounded-full bg-gradient-to-r from-indigo-400 to-violet-500"
          style={{ width: `${percent}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          aria-label={label}
          onChange={(event) => onChange(Number(event.target.value))}
          className={RANGE_INPUT_CLASS}
        />
        <div
          className={cn(
            'pointer-events-none absolute top-1/2 z-[2] flex -translate-y-1/2 items-center justify-center rounded border border-slate-200 bg-white shadow-sm',
            compact ? 'h-4 w-2.5' : 'h-5 w-3',
          )}
          style={{ left: `calc(${percent}% - ${compact ? 5 : 6}px)` }}
        >
          <GripVertical className={cn('text-slate-400', compact ? 'size-2' : 'size-2.5')} aria-hidden />
        </div>
      </div>
    </div>
  );
};

const PerAxisSliderRow: React.FC<{
  active: boolean;
  disabled?: boolean;
  onActivate: () => void;
  children: React.ReactNode;
}> = ({ active, disabled, onActivate, children }) => (
  <div
    className={cn(
      'rounded-md transition',
      active ? 'opacity-100' : 'opacity-55',
      !disabled && !active && 'cursor-pointer hover:opacity-75',
      disabled && 'cursor-not-allowed',
    )}
    onClick={() => {
      if (!disabled && !active) {
        onActivate();
      }
    }}
  >
    {children}
  </div>
);

const OffsetDial: React.FC<{
  offsetX: number;
  offsetY: number;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onChange: (offsetX: number, offsetY: number) => void;
}> = ({ offsetX, offsetY, disabled, size = 'sm', onChange }) => {
  const dialRef = useRef<HTMLDivElement>(null);
  const dotLeft = 50 + (offsetX / OFFSET_DIAL_MAX) * 42;
  const dotTop = 50 + (offsetY / OFFSET_DIAL_MAX) * 42;

  const updateOffset = (clientX: number, clientY: number) => {
    const rect = dialRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const ratioX = (clientX - cx) / (rect.width / 2);
    const ratioY = (clientY - cy) / (rect.height / 2);
    onChange(
      clampShadowOffset(ratioX * OFFSET_DIAL_MAX, OFFSET_DIAL_MAX),
      clampShadowOffset(ratioY * OFFSET_DIAL_MAX, OFFSET_DIAL_MAX),
    );
  };

  return (
    <div
      ref={dialRef}
      role="slider"
      aria-label="Shadow offset"
      tabIndex={disabled ? -1 : 0}
      className={cn(
        'relative mx-auto shrink-0 rounded-full border border-dashed border-slate-200 bg-white select-none',
        size === 'lg' ? 'size-32' : size === 'md' ? 'size-24' : 'size-14',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
      )}
      onPointerDown={(event) => {
        if (disabled) {
          return;
        }
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        updateOffset(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        if (event.buttons !== 1 || disabled) {
          return;
        }
        updateOffset(event.clientX, event.clientY);
      }}
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className={cn(
            'rounded-md border border-slate-200 bg-white shadow-sm',
            size === 'lg' ? 'size-8' : size === 'md' ? 'size-6' : 'size-4',
          )}
          aria-hidden
        />
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

const ShadowLayerStrip: React.FC<{
  layers: ShadowLayer[];
  selectedLayerId: string | null;
  disabled?: boolean;
  onSelect: (layerId: string) => void;
}> = ({ layers, selectedLayerId, disabled, onSelect }) => (
  <div className="flex flex-wrap gap-1.5">
    {layers.map((layer, index) => {
      const active = selectedLayerId === layer.id;
      return (
        <button
          key={layer.id}
          type="button"
          disabled={disabled}
          aria-label={`Shadow layer ${index + 1}`}
          onClick={() => onSelect(layer.id)}
          className={cn(
            'flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold transition',
            active
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200'
              : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/50',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <span
            className="size-3 rounded-full border border-white shadow-sm"
            style={{ backgroundColor: layer.color }}
            aria-hidden
          />
          Layer {index + 1}
          {layer.inset ? <span className="text-[8px] uppercase text-slate-400">inset</span> : null}
        </button>
      );
    })}
  </div>
);

type DesignerPanelView = 'designer' | 'presets';

const DESIGNER_VIEW_TABS: Array<{ id: DesignerPanelView; label: string }> = [
  { id: 'designer', label: 'Designer' },
  { id: 'presets', label: 'Presets' },
];

const BorderShadowPickerViewTabs: React.FC<{
  value: DesignerPanelView;
  disabled?: boolean;
  onChange: (value: DesignerPanelView) => void;
}> = ({ value, disabled, onChange }) => (
  <div
    role="tablist"
    aria-label="Border and shadow picker views"
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

const BorderShadowPresetsPanel: React.FC<{
  disabled?: boolean;
  onSelect: (definition: BorderShadowDefinition) => void;
}> = ({ disabled, onSelect }) => {
  const [category, setCategory] = useState<BorderShadowPresetCategoryId | 'all'>('all');
  const [query, setQuery] = useState('');
  const presets = useMemo(() => {
    const byCategory = getBorderShadowPresetsByCategory(category);
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
    <div className={cn('flex flex-col', BORDER_SHADOW_PICKER_NO_SELECT_CLASS)}>
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
        {BORDER_SHADOW_PRESET_CATEGORIES.map((entry) => {
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
            onClick={() => onSelect(preset.definition)}
            className={cn(
              'group overflow-hidden rounded-md border border-slate-200/90 bg-white text-start shadow-sm transition',
              'hover:border-indigo-300 hover:shadow-[0_6px_18px_rgba(99,102,241,0.14)]',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <div className="flex h-14 w-full items-center justify-center border-b border-slate-100 bg-[#f3f5f9] p-3">
              <div
                className="size-10 rounded-md bg-white"
                style={buildBorderShadowPreviewStyle(preset.definition)}
                aria-hidden
              />
            </div>
            <div className="truncate px-2 py-1.5 text-[10px] leading-snug">
              <span className="font-semibold text-slate-700 group-hover:text-indigo-600">{preset.name}</span>
              <span className="font-medium text-slate-400">
                {' · '}
                {BORDER_SHADOW_PRESET_CATEGORIES.find((entry) => entry.id === preset.category)?.label ?? preset.category}
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

const findAddedShadowLayer = (
  before: ShadowLayer[],
  after: ShadowLayer[],
): ShadowLayer | undefined => {
  const beforeIds = new Set(before.map((layer) => layer.id));
  return after.find((layer) => !beforeIds.has(layer.id));
};

export const UiBorderShadowPicker: React.FC<UiBorderShadowPickerProps> = ({
  value,
  defaultValue = createDefaultBorderShadow(),
  onChange,
  variant = 'inline',
  size = 'md',
  label,
  helperText,
  ariaLabel = 'Border and shadow picker',
  disabled = false,
  compact,
  showCssOutput = false,
  showReverse = true,
  showPresets = true,
  showTriggerCss = true,
  pickerMode = 'border-shadow',
  defaultDesignerFocus = 'border',
  className,
}) => {
  const isShadowOnly = pickerMode === 'shadow-only';
  const fieldId = useId();
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(value ?? defaultValue);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>((value ?? defaultValue).shadow.layers[0]?.id ?? null);
  const [designerFocus, setDesignerFocus] = useState<DesignerFocus>(
    isShadowOnly ? 'shadow' : defaultDesignerFocus,
  );
  const [copied, setCopied] = useState(false);
  const [panelView, setPanelView] = useState<DesignerPanelView>('designer');
  const [popoverOpen, setPopoverOpen] = useState(false);
  const designerContentRef = useRef<HTMLDivElement>(null);
  const [lockedTabContentHeight, setLockedTabContentHeight] = useState<number | undefined>();
  const sizeConfig = SIZE_CLASS[size];
  const resolvedCompact = compact ?? sizeConfig.compact;
  const showExtendedControls = variant === 'inline' || variant === 'popover' || variant === 'field';
  const shellWidthClass = variant === 'popover' || variant === 'field'
    ? BORDER_SHADOW_PICKER_POPOVER_WIDTH_CLASS
    : sizeConfig.shell;

  useEffect(() => {
    if (isControlled) {
      setInternalValue(value);
    }
  }, [isControlled, value]);

  const definition = internalValue;
  const cssOutput = useMemo(() => buildBorderShadowCssOutput(definition), [definition]);
  const displayCssValue = isShadowOnly ? cssOutput.shadow : cssOutput.combined;
  const previewStyle = useMemo(
    () => (isShadowOnly
      ? buildShadowPreviewStyle(cssOutput.shadow)
      : buildBorderShadowPreviewStyle(definition)),
    [cssOutput.shadow, definition, isShadowOnly],
  );
  const selectedLayer = definition.shadow.layers.find((layer) => layer.id === selectedLayerId) ?? definition.shadow.layers[0];
  const previewHeight = resolvedCompact ? sizeConfig.preview : SIZE_CLASS.lg.preview;
  const border = definition.border;

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

  const commit = useCallback((next: BorderShadowDefinition) => {
    setInternalValue(next);
    onChange?.(next, buildBorderShadowCssOutput(next));
  }, [onChange]);

  const commitBorder = (patch: Parameters<typeof updateBorder>[1]) => {
    commit({ ...definition, border: updateBorder(definition.border, patch) });
  };

  const commitShadow = (shadow: BorderShadowDefinition['shadow']) => {
    commit({ ...definition, shadow });
  };

  const handleAddLayer = () => {
    const nextShadow = addShadowLayer(definition.shadow);
    const added = findAddedShadowLayer(definition.shadow.layers, nextShadow.layers);
    commitShadow(nextShadow);
    setSelectedLayerId(added?.id ?? nextShadow.layers[0]?.id ?? null);
  };

  const handleCopyCss = async () => {
    try {
      await navigator.clipboard.writeText(displayCssValue);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const handlePresetSelect = (presetDefinition: BorderShadowDefinition) => {
    const next = applyBorderShadowPreset(presetDefinition);
    commit(next);
    setSelectedLayerId(next.shadow.layers[0]?.id ?? null);
    setPanelView('designer');
  };

  const triggerPreview = showTriggerCss ? (
    <div
      className="flex h-8 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-[#f3f5f9]"
      aria-hidden
    >
      <div className="size-5 shrink-0 rounded bg-white" style={previewStyle} />
    </div>
  ) : (
    <div className="h-full w-full overflow-hidden rounded-[2px] bg-[#f3f5f9]" aria-hidden>
      <div className="h-full w-full rounded-[2px] bg-white" style={previewStyle} />
    </div>
  );

  const designerBody = (
    <div className={cn('flex flex-col', lockedTabContentHeight && 'min-h-full bg-white')}>
      <DesignerCard stacked>
        <div className={cn(
          'flex items-center justify-center overflow-hidden rounded-md border border-slate-100 bg-[#f3f5f9]',
          previewHeight,
        )}>
          <div
            className="size-16 shrink-0 bg-white"
            style={previewStyle}
            aria-label="Border and shadow preview"
          />
        </div>
        {showExtendedControls && !isShadowOnly ? (
          <div className="mt-3">
            <DesignerFocusTabs value={designerFocus} disabled={disabled} onChange={setDesignerFocus} />
          </div>
        ) : null}
      </DesignerCard>

      {!isShadowOnly && (designerFocus === 'border' || !showExtendedControls) ? (
        <DesignerCard stacked className={cn(designerFocus !== 'border' && showExtendedControls && 'hidden')}>
          <SectionLabel>Border</SectionLabel>
          <div className="mb-2">
            <BorderStyleSegmented
              value={border.style}
              disabled={disabled}
              onChange={(style) => commitBorder({ style })}
            />
          </div>
          <UiColorPicker
            label="Color"
            variant="popover"
            size="sm"
            value={border.color}
            disabled={disabled || border.style === 'none'}
            showEyeDropper
            onChange={(color) => commitBorder({ color })}
          />
          <div className="mt-2.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-[5px]">
              <UiSwitch
                aria-label="Uniform border width"
                isSelected={border.uniformWidth}
                isDisabled={disabled || border.style === 'none'}
                onChange={(uniformWidth) => commitBorder({ uniformWidth })}
              />
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Uniform width</span>
            </div>
            {BORDER_WIDTH_SIDES.map((side, index) => {
              const sideDisabled = disabled || border.style === 'none';
              const isFirst = index === 0;
              const rowLocked = border.uniformWidth && !isFirst;
              const sliderValue = border.uniformWidth ? border.width : border.sides[side];
              const slider = (
                <AxisSlider
                  compact
                  label={`Width ${BORDER_WIDTH_SIDE_LABEL[side]}`}
                  value={sliderValue}
                  min={0}
                  max={16}
                  disabled={sideDisabled || rowLocked}
                  onChange={(sideWidth) => {
                    const nextWidth = clampBorderValue(sideWidth, 16);
                    if (border.uniformWidth) {
                      commitBorder({ width: nextWidth });
                      return;
                    }
                    commitBorder({
                      sides: { ...border.sides, [side]: nextWidth },
                      uniformWidth: false,
                    });
                  }}
                />
              );

              if (!border.uniformWidth) {
                return <div key={side}>{slider}</div>;
              }

              return (
                <PerAxisSliderRow
                  key={side}
                  active={isFirst}
                  disabled={sideDisabled || rowLocked}
                  onActivate={() => undefined}
                >
                  {slider}
                </PerAxisSliderRow>
              );
            })}
            <div className="flex items-center gap-[5px]">
              <UiSwitch
                aria-label="Uniform corner radius"
                isSelected={border.uniformRadius}
                isDisabled={disabled}
                onChange={(uniformRadius) => commitBorder({ uniformRadius })}
              />
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Uniform radius</span>
            </div>
            {BORDER_RADIUS_CORNERS.map((corner, index) => {
              const isFirst = index === 0;
              const rowLocked = border.uniformRadius && !isFirst;
              const sliderValue = border.uniformRadius ? border.radius : border.corners[corner];
              const slider = (
                <AxisSlider
                  compact
                  label={`Radius ${BORDER_RADIUS_CORNER_LABEL[corner]}`}
                  value={sliderValue}
                  min={0}
                  max={48}
                  disabled={disabled || rowLocked}
                  onChange={(cornerRadius) => {
                    const nextRadius = clampBorderValue(cornerRadius, 48);
                    if (border.uniformRadius) {
                      commitBorder({ radius: nextRadius });
                      return;
                    }
                    commitBorder({
                      corners: { ...border.corners, [corner]: nextRadius },
                      uniformRadius: false,
                    });
                  }}
                />
              );

              if (!border.uniformRadius) {
                return <div key={corner}>{slider}</div>;
              }

              return (
                <PerAxisSliderRow
                  key={corner}
                  active={isFirst}
                  disabled={disabled || rowLocked}
                  onActivate={() => undefined}
                >
                  {slider}
                </PerAxisSliderRow>
              );
            })}
          </div>
        </DesignerCard>
      ) : null}

      {(isShadowOnly || designerFocus === 'shadow') && showExtendedControls ? (
        <>
          <DesignerCard stacked>
            <SectionLabel>Shadow layers</SectionLabel>
            <ShadowLayerStrip
              layers={definition.shadow.layers}
              selectedLayerId={selectedLayer?.id ?? null}
              disabled={disabled}
              onSelect={setSelectedLayerId}
            />
            {selectedLayer ? (
              <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 border-t border-slate-100 pt-2.5">
                <UiColorPicker
                  label="Color"
                  variant="popover"
                  size="sm"
                  value={selectedLayer.color}
                  disabled={disabled}
                  showEyeDropper
                  onChange={(color) => commitShadow(updateShadowLayer(definition.shadow, selectedLayer.id, { color }))}
                />
                <div className="flex items-center gap-[5px] pb-1">
                  <UiSwitch
                    aria-label="Inset shadow"
                    isSelected={selectedLayer.inset}
                    isDisabled={disabled}
                    onChange={(inset) => commitShadow(updateShadowLayer(definition.shadow, selectedLayer.id, { inset }))}
                  />
                  <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Inset</span>
                </div>
              </div>
            ) : null}
            <div className="mt-2 flex items-center gap-1 border-t border-slate-100 pt-2">
              <AppButton size="sm" intent="secondary" disabled={disabled} onClick={handleAddLayer} title="Add layer">
                <Plus className="size-3" aria-hidden />
              </AppButton>
              {showReverse ? (
                <AppButton
                  size="sm"
                  intent="secondary"
                  disabled={disabled}
                  title="Reverse layers"
                  onClick={() => commitShadow({ ...definition.shadow, layers: reverseShadowLayers(definition.shadow.layers) })}
                >
                  <ArrowLeftRight className="size-3" aria-hidden />
                </AppButton>
              ) : null}
              <AppButton
                size="sm"
                intent="secondary"
                disabled={disabled || definition.shadow.layers.length <= 1 || !selectedLayer}
                title="Remove layer"
                onClick={() => {
                  if (!selectedLayer) {
                    return;
                  }
                  const nextShadow = removeShadowLayer(definition.shadow, selectedLayer.id);
                  commitShadow(nextShadow);
                  setSelectedLayerId(nextShadow.layers[0]?.id ?? null);
                }}
              >
                <Trash2 className="size-3" aria-hidden />
              </AppButton>
            </div>
          </DesignerCard>

          {selectedLayer ? (
            <DesignerCard stacked>
              <div className="flex flex-col gap-2">
                <div className="flex shrink-0 items-center justify-center py-0.5">
                  <OffsetDial
                    size="sm"
                    offsetX={selectedLayer.offsetX}
                    offsetY={selectedLayer.offsetY}
                    disabled={disabled}
                    onChange={(offsetX, offsetY) => commitShadow(updateShadowLayer(definition.shadow, selectedLayer.id, { offsetX, offsetY }))}
                  />
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <AxisSlider compact label="Offset X" value={selectedLayer.offsetX} min={-OFFSET_DIAL_MAX} max={OFFSET_DIAL_MAX} disabled={disabled}
                    onChange={(offsetX) => commitShadow(updateShadowLayer(definition.shadow, selectedLayer.id, { offsetX: clampShadowOffset(offsetX, OFFSET_DIAL_MAX) }))} />
                  <AxisSlider compact label="Offset Y" value={selectedLayer.offsetY} min={-OFFSET_DIAL_MAX} max={OFFSET_DIAL_MAX} disabled={disabled}
                    onChange={(offsetY) => commitShadow(updateShadowLayer(definition.shadow, selectedLayer.id, { offsetY: clampShadowOffset(offsetY, OFFSET_DIAL_MAX) }))} />
                  <AxisSlider compact label="Blur" value={selectedLayer.blur} min={0} max={80} disabled={disabled}
                    onChange={(blur) => commitShadow(updateShadowLayer(definition.shadow, selectedLayer.id, { blur: clampShadowRadius(blur, 80) }))} />
                  <AxisSlider compact label="Spread" value={selectedLayer.spread} min={-40} max={40} disabled={disabled}
                    onChange={(spread) => commitShadow(updateShadowLayer(definition.shadow, selectedLayer.id, { spread: clampShadowOffset(spread, 40) }))} />
                </div>
              </div>
            </DesignerCard>
          ) : null}
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
            {displayCssValue}
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
    designerFocus,
    isShadowOnly,
    showCssOutput,
  ]);

  const lockedTabContentStyle = showDesignerTabs && lockedTabContentHeight
    ? { height: lockedTabContentHeight, maxHeight: lockedTabContentHeight }
    : undefined;

  const designerPanel = (
    <div
      className={cn(
        shellWidthClass,
        BORDER_SHADOW_PICKER_SHELL_HEIGHT_CLASS,
        'flex flex-col overflow-hidden rounded-lg border border-slate-200/80 bg-[#f3f5f9]',
        BORDER_SHADOW_PICKER_NO_SELECT_CLASS,
      )}
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.28) 1px, transparent 1px)',
        backgroundSize: '14px 14px',
      }}
    >
      {showDesignerTabs ? (
        <div className="shrink-0 border-b border-slate-200/70 bg-white/90 px-2 py-2">
          <BorderShadowPickerViewTabs value={panelView} disabled={disabled} onChange={setPanelView} />
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
            <BorderShadowPresetsPanel disabled={disabled} onSelect={handlePresetSelect} />
          </div>
        ) : null}
      </div>
    </div>
  );

  const popoverPanelContent = (
    <div className={BORDER_SHADOW_PICKER_POPOVER_SURFACE_CLASS}>
      <div
        className={cn(
          BORDER_SHADOW_PICKER_POPOVER_SCROLL_CLASS,
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
      className={BORDER_SHADOW_PICKER_POPOVER_PANEL_CLASS}
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
          {triggerPreview}
          {showTriggerCss ? (
            <>
              <span className="max-w-[12rem] truncate font-mono text-[11px]">{displayCssValue}</span>
              <BoxSelect className="size-3.5 text-slate-400" aria-hidden />
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
      <div className={cn('flex flex-col gap-2', BORDER_SHADOW_PICKER_NO_SELECT_CLASS, className)}>
        {label ? <span className="text-xs font-semibold text-slate-700">{label}</span> : null}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {BORDER_SHADOW_PRESETS.slice(0, SWATCH_PRESET_LIMIT).map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              aria-label={preset.name}
              onClick={() => handlePresetSelect(preset.definition)}
              className={cn(
                'flex h-10 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-[#f3f5f9] shadow-sm transition hover:border-indigo-300',
                disabled && 'cursor-not-allowed opacity-60',
              )}
              title={preset.name}
            >
              <div className="size-6 rounded bg-white" style={buildBorderShadowPreviewStyle(preset.definition)} aria-hidden />
            </button>
          ))}
        </div>
        {helperText ? <p className="text-[11px] text-slate-500">{helperText}</p> : null}
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <div className={cn('flex flex-col gap-2', BORDER_SHADOW_PICKER_NO_SELECT_CLASS, className)}>
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
        BORDER_SHADOW_PICKER_NO_SELECT_CLASS,
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
      <div className={cn('relative flex flex-col gap-1', BORDER_SHADOW_PICKER_NO_SELECT_CLASS, className)}>
        {label ? <label htmlFor={fieldId} className="text-xs font-semibold text-slate-700">{label}</label> : null}
        <UiInput
          id={fieldId}
          aiAssist={false}
          autoDir={false}
          type="text"
          size={sizeConfig.input}
          value={displayCssValue}
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
              ariaLabel="Open border and shadow picker"
              className={BORDER_SHADOW_PICKER_POPOVER_PANEL_CLASS}
              trigger={(
                <button
                  type="button"
                  disabled={disabled}
                  aria-label="Open border and shadow picker"
                  className={cn('relative flex items-center justify-center', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}
                >
                  {triggerPreview}
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
    <div className={cn('flex flex-col gap-2', BORDER_SHADOW_PICKER_NO_SELECT_CLASS, className)}>
      {label ? <span className="text-xs font-semibold text-slate-700">{label}</span> : null}
      {designerPanel}
      {helperText ? <p className="text-[11px] text-slate-500">{helperText}</p> : null}
    </div>
  );
};
