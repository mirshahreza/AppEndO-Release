import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Copy, GripVertical, Palette, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { UiInput } from './ai-field-assist/AiAssistInput';
import { AppButton } from './AppButton';
import { UiColorPicker } from './UiColorPicker';
import { ShellResponsivePopover } from './shell-foundation/ShellResponsivePopover';
import {
  RGB_PRESET_CATEGORIES,
  RGB_PRESETS,
  getRgbPresetsByCategory,
  getRgbVariableOptions,
  type RgbPresetCategoryId,
} from '../lib/rgbPresetCatalog';
import {
  applyRgbCssToDefinition,
  buildRgbCss,
  createDefaultRgb,
  DEFAULT_RGB_VARIABLES,
  formatRgbChannels,
  isCssVariableName,
  parseRgbChannels,
  resolveRgbPreviewCss,
  withRgbAlpha,
  withRgbLiteral,
  withRgbVariable,
  type RgbDefinition,
  type RgbSourceMode,
  type RgbVariableOption,
} from '../lib/rgbDefinition';
import { rgbToHex } from '../lib/colorMath';

export type UiVariableColorPickerVariant = 'field' | 'popover' | 'inline' | 'swatch' | 'minimal';
export type UiVariableColorPickerSize = 'sm' | 'md' | 'lg';

export type UiVariableColorPickerProps = {
  value?: RgbDefinition;
  defaultValue?: RgbDefinition;
  onChange?: (definition: RgbDefinition, css: string) => void;
  variant?: UiVariableColorPickerVariant;
  size?: UiVariableColorPickerSize;
  label?: string;
  helperText?: string;
  ariaLabel?: string;
  disabled?: boolean;
  compact?: boolean;
  showSourceSelector?: boolean;
  showCssOutput?: boolean;
  showPresets?: boolean;
  showTriggerCss?: boolean;
  triggerBackground?: string;
  variables?: readonly RgbVariableOption[];
  className?: string;
};

const SIZE_CLASS: Record<UiVariableColorPickerSize, { shell: string; preview: string; compact: boolean; input: 'sm' | 'md' | 'lg' }> = {
  sm: { shell: 'max-w-sm', preview: 'h-16', compact: true, input: 'sm' },
  md: { shell: 'max-w-md', preview: 'h-20', compact: true, input: 'sm' },
  lg: { shell: 'max-w-lg', preview: 'h-24', compact: false, input: 'md' },
};

const VARIABLE_COLOR_PICKER_SHELL_HEIGHT_CLASS = 'h-auto';
const VARIABLE_COLOR_PICKER_POPOVER_WIDTH_CLASS = 'w-[min(400px,calc(100vw-2rem))]';
const VARIABLE_COLOR_PICKER_POPOVER_SHELL_CLASS =
  'shadow-[0_24px_64px_-16px_rgba(15,23,42,0.32),0_12px_28px_-12px_rgba(99,102,241,0.18)]';
const VARIABLE_COLOR_PICKER_POPOVER_PANEL_CLASS =
  'flex max-h-full min-h-0 flex-col overflow-visible border-0 bg-transparent p-0 shadow-none';
const VARIABLE_COLOR_PICKER_POPOVER_SURFACE_CLASS = cn(
  VARIABLE_COLOR_PICKER_POPOVER_SHELL_CLASS,
  'flex max-h-full min-h-0 flex-col overflow-visible rounded-lg',
);
const VARIABLE_COLOR_PICKER_POPOVER_SCROLL_CLASS = 'min-h-0 flex-1 overflow-y-auto overscroll-contain';
const SWATCH_PRESET_LIMIT = 18;
const VARIABLE_COLOR_PICKER_NO_SELECT_CLASS = 'select-none [&_input]:select-text [&_textarea]:select-text';
const CHECKERBOARD_STYLE: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(45deg, #cbd5e1 25%, transparent 25%), linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cbd5e1 75%), linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)',
  backgroundSize: '10px 10px',
  backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0',
};

const RANGE_INPUT_CLASS = [
  'absolute inset-0 z-[1] h-full w-full cursor-pointer appearance-none bg-transparent disabled:cursor-not-allowed',
  '[&::-webkit-slider-thumb]:size-0 [&::-webkit-slider-thumb]:appearance-none',
  '[&::-moz-range-thumb]:size-0 [&::-moz-range-thumb]:border-0',
].join(' ');

const SOURCE_MODES: Array<{ id: RgbSourceMode; label: string }> = [
  { id: 'variable', label: 'Variable' },
  { id: 'literal', label: 'Custom' },
];

type DesignerPanelView = 'designer' | 'presets';

const DESIGNER_VIEW_TABS: Array<{ id: DesignerPanelView; label: string }> = [
  { id: 'designer', label: 'Designer' },
  { id: 'presets', label: 'Presets' },
];

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

const RgbSourceSegmented: React.FC<{
  value: RgbSourceMode;
  disabled?: boolean;
  onChange: (value: RgbSourceMode) => void;
}> = ({ value, disabled, onChange }) => (
  <div
    role="radiogroup"
    aria-label="RGB source"
    className="grid grid-cols-2 gap-0.5 rounded-md bg-indigo-50/90 p-0.5"
  >
    {SOURCE_MODES.map((mode) => {
      const active = value === mode.id;
      return (
        <button
          key={mode.id}
          type="button"
          role="radio"
          aria-checked={active}
          disabled={disabled}
          onClick={() => onChange(mode.id)}
          className={cn(
            'rounded-md px-2 py-1.5 text-xs font-semibold transition',
            active
              ? 'bg-indigo-500 text-white shadow-[0_4px_14px_rgba(99,102,241,0.28)]'
              : 'text-indigo-400 hover:bg-white/70 hover:text-indigo-600',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          {mode.label}
        </button>
      );
    })}
  </div>
);

const ChannelSlider: React.FC<{
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  displayValue: string;
  disabled?: boolean;
  trackCss: string;
  onChange: (value: number) => void;
}> = ({ label, value, min = 0, max = 255, step = 1, displayValue, disabled, trackCss, onChange }) => {
  const ratio = max === min ? 0 : ((value - min) / (max - min)) * 100;
  return (
    <div className="min-w-0 select-none">
      <div className="mb-0.5 flex items-center justify-between gap-2">
        <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</span>
        <span className="select-none text-[11px] font-semibold text-indigo-500">{displayValue}</span>
      </div>
      <div className="relative h-1.5 rounded-full border border-white/70 shadow-inner" style={{ background: trackCss }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-label={label}
          onChange={(event) => onChange(Number(event.target.value))}
          className={RANGE_INPUT_CLASS}
        />
        <div
          className="pointer-events-none absolute top-1/2 z-[2] flex h-4 w-2.5 -translate-y-1/2 items-center justify-center rounded border border-slate-200 bg-white shadow-sm"
          style={{ left: `calc(${ratio}% - 5px)` }}
        >
          <GripVertical className="size-2 text-slate-400" aria-hidden />
        </div>
      </div>
    </div>
  );
};

const RgbPreviewSwatch: React.FC<{
  css: string;
  className?: string;
}> = ({ css, className }) => (
  <div className={cn('relative overflow-hidden', className)} style={CHECKERBOARD_STYLE}>
    <div className="absolute inset-0" style={{ background: css }} aria-hidden />
  </div>
);

const VariableColorPickerViewTabs: React.FC<{
  value: DesignerPanelView;
  disabled?: boolean;
  onChange: (value: DesignerPanelView) => void;
}> = ({ value, disabled, onChange }) => (
  <div
    role="tablist"
    aria-label="Variable color picker views"
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

const RgbPresetsPanel: React.FC<{
  disabled?: boolean;
  onSelect: (css: string) => void;
}> = ({ disabled, onSelect }) => {
  const [category, setCategory] = useState<RgbPresetCategoryId | 'all'>('all');
  const [query, setQuery] = useState('');
  const presets = useMemo(() => {
    const byCategory = getRgbPresetsByCategory(category);
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return byCategory;
    }
    return byCategory.filter((preset) => (
      preset.name.toLowerCase().includes(normalized)
      || preset.category.toLowerCase().includes(normalized)
      || preset.css.toLowerCase().includes(normalized)
    ));
  }, [category, query]);

  return (
    <div className={cn('flex flex-col', VARIABLE_COLOR_PICKER_NO_SELECT_CLASS)}>
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
        {RGB_PRESET_CATEGORIES.map((entry) => {
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
            <RgbPreviewSwatch css={preset.css} className="h-14 w-full border-b border-slate-100" />
            <div className="px-2 py-1.5">
              <div className="truncate text-[10px] font-semibold text-slate-700 group-hover:text-indigo-600">
                {preset.name}
              </div>
              <div className="mt-0.5 truncate font-mono text-[9px] font-medium text-slate-400">
                {preset.css}
              </div>
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

export const UiVariableColorPicker: React.FC<UiVariableColorPickerProps> = ({
  value,
  defaultValue = createDefaultRgb(),
  onChange,
  variant = 'inline',
  size = 'md',
  label,
  helperText,
  ariaLabel = 'Variable color picker',
  disabled = false,
  compact,
  showSourceSelector = true,
  showCssOutput = false,
  showPresets = true,
  showTriggerCss = true,
  triggerBackground,
  variables,
  className,
}) => {
  const fieldId = useId();
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(value ?? defaultValue);
  const [copied, setCopied] = useState(false);
  const [panelView, setPanelView] = useState<DesignerPanelView>('designer');
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [variableDraft, setVariableDraft] = useState((value ?? defaultValue).variable);
  const designerContentRef = useRef<HTMLDivElement>(null);
  const [lockedTabContentHeight, setLockedTabContentHeight] = useState<number | undefined>();
  const sizeConfig = SIZE_CLASS[size];
  const resolvedCompact = compact ?? sizeConfig.compact;
  const showExtendedControls = variant === 'inline' || variant === 'popover' || variant === 'field';
  const shellWidthClass = variant === 'popover' || variant === 'field'
    ? VARIABLE_COLOR_PICKER_POPOVER_WIDTH_CLASS
    : sizeConfig.shell;
  const variableOptions = useMemo(() => getRgbVariableOptions(variables ?? []), [variables]);

  useEffect(() => {
    if (isControlled) {
      setInternalValue(value);
      setVariableDraft(value.variable);
    }
  }, [isControlled, value]);

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

  const definition = internalValue;
  const css = useMemo(() => buildRgbCss(definition), [definition]);
  const previewCss = useMemo(() => resolveRgbPreviewCss(definition), [definition]);

  const commit = useCallback((next: RgbDefinition) => {
    setInternalValue(next);
    setVariableDraft(next.variable);
    onChange?.(next, buildRgbCss(next));
  }, [onChange]);

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
    const next = applyRgbCssToDefinition(presetCss);
    if (!next) {
      return;
    }
    commit(next);
    setPanelView('designer');
  };

  const handleSourceChange = (mode: RgbSourceMode) => {
    if (mode === 'variable') {
      const selected = variableOptions.find((entry) => entry.name === definition.variable)
        ?? variableOptions[0]
        ?? DEFAULT_RGB_VARIABLES[0];
      commit(withRgbVariable(definition, selected));
      return;
    }
    commit(withRgbLiteral(definition, definition));
  };

  const handleVariableSelect = (option: RgbVariableOption) => {
    commit(withRgbVariable(definition, option));
  };

  const handleVariableCommit = () => {
    const nextName = variableDraft.trim();
    if (!isCssVariableName(nextName)) {
      setVariableDraft(definition.variable);
      return;
    }
    const known = variableOptions.find((entry) => entry.name === nextName);
    commit(withRgbVariable(definition, known ?? nextName));
  };

  const handleLiteralColor = (color: string) => {
    const channels = parseRgbChannels(color);
    if (!channels) {
      return;
    }
    commit(withRgbLiteral(definition, channels));
  };

  const previewHeight = resolvedCompact ? sizeConfig.preview : SIZE_CLASS.lg.preview;
  const triggerPreviewBackground = triggerBackground?.trim() || previewCss;
  const literalHex = rgbToHex(definition.r, definition.g, definition.b);
  const alphaPercent = Math.round(definition.alpha * 1000) / 10;
  const alphaTrackCss = definition.mode === 'variable' && isCssVariableName(definition.variable)
    ? `linear-gradient(90deg, rgb(var(${definition.variable}) / 0), rgb(var(${definition.variable}) / 1))`
    : `linear-gradient(90deg, rgb(${formatRgbChannels(definition.r, definition.g, definition.b)} / 0), rgb(${formatRgbChannels(definition.r, definition.g, definition.b)} / 1))`;

  const rgbPreview = (
    <RgbPreviewSwatch
      css={triggerPreviewBackground}
      className={cn(
        'overflow-hidden border border-slate-200 shadow-inner',
        showTriggerCss ? 'h-8 w-12 shrink-0 rounded-md' : 'h-full w-full rounded-[2px] border-0 shadow-none',
      )}
    />
  );

  const designerBody = (
    <div className={cn('flex flex-col', lockedTabContentHeight && 'min-h-full bg-white')}>
      <DesignerCard stacked>
        <RgbPreviewSwatch
          css={previewCss}
          className={cn('overflow-hidden rounded-md border border-slate-100 shadow-inner', previewHeight)}
        />

        {showSourceSelector ? (
          <div className="mt-2.5">
            <RgbSourceSegmented
              value={definition.mode}
              disabled={disabled}
              onChange={handleSourceChange}
            />
          </div>
        ) : null}

        {definition.mode === 'variable' ? (
          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
            {variableOptions.map((option) => {
              const active = definition.variable === option.name;
              const swatchCss = `rgb(var(${option.name}${option.fallback ? `, ${option.fallback}` : ''}))`;
              return (
                <button
                  key={option.name}
                  type="button"
                  disabled={disabled}
                  aria-pressed={active}
                  onClick={() => handleVariableSelect(option)}
                  className={cn(
                    'overflow-hidden rounded-md border text-start transition',
                    active
                      ? 'border-indigo-400 ring-2 ring-indigo-200'
                      : 'border-slate-200 hover:border-indigo-300',
                    disabled && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <RgbPreviewSwatch css={swatchCss} className="h-8 w-full" />
                  <div className="px-1.5 py-1">
                    <div className="truncate text-[10px] font-semibold text-slate-700">{option.label}</div>
                    <div className="truncate font-mono text-[9px] text-slate-400">{option.name}</div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-2.5">
            <UiColorPicker
              label="Color"
              variant="popover"
              size="sm"
              value={literalHex}
              disabled={disabled}
              showEyeDropper
              onChange={handleLiteralColor}
            />
          </div>
        )}
      </DesignerCard>

      {showExtendedControls ? (
        <>
          {definition.mode === 'variable' ? (
            <DesignerCard stacked tight>
              <SectionLabel>CSS variable</SectionLabel>
              <UiInput
                aiAssist={false}
                autoDir={false}
                size="sm"
                value={variableDraft}
                disabled={disabled}
                ariaLabel="RGB CSS variable"
                className="font-mono text-xs"
                onChange={(event) => setVariableDraft(event.target.value)}
                onBlur={handleVariableCommit}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur();
                  }
                }}
              />
            </DesignerCard>
          ) : (
            <DesignerCard stacked>
              <div className="flex flex-col gap-2">
                <ChannelSlider
                  label="Red"
                  value={definition.r}
                  displayValue={String(definition.r)}
                  disabled={disabled}
                  trackCss="linear-gradient(90deg, rgb(0 0 0), rgb(255 0 0))"
                  onChange={(r) => commit(withRgbLiteral(definition, { ...definition, r }))}
                />
                <ChannelSlider
                  label="Green"
                  value={definition.g}
                  displayValue={String(definition.g)}
                  disabled={disabled}
                  trackCss="linear-gradient(90deg, rgb(0 0 0), rgb(0 255 0))"
                  onChange={(g) => commit(withRgbLiteral(definition, { ...definition, g }))}
                />
                <ChannelSlider
                  label="Blue"
                  value={definition.b}
                  displayValue={String(definition.b)}
                  disabled={disabled}
                  trackCss="linear-gradient(90deg, rgb(0 0 0), rgb(0 0 255))"
                  onChange={(b) => commit(withRgbLiteral(definition, { ...definition, b }))}
                />
              </div>
            </DesignerCard>
          )}

          <DesignerCard stacked>
            <ChannelSlider
              label="Alpha"
              value={Math.round(definition.alpha * 1000)}
              min={0}
              max={1000}
              step={1}
              displayValue={`${alphaPercent}%`}
              disabled={disabled}
              trackCss={alphaTrackCss}
              onChange={(next) => commit(withRgbAlpha(definition, next / 1000))}
            />
            <label className="mt-2 flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Alpha value</span>
              <input
                type="number"
                min={0}
                max={1}
                step="any"
                value={definition.alpha}
                disabled={disabled}
                aria-label="Alpha value"
                onChange={(event) => commit(withRgbAlpha(definition, Number(event.target.value)))}
                className="h-8 rounded-md border border-slate-200 bg-white px-2 font-mono text-[11px] font-semibold text-slate-700 outline-none focus:border-indigo-300 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
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
    showSourceSelector,
  ]);

  const lockedTabContentStyle = showDesignerTabs && lockedTabContentHeight
    ? { height: lockedTabContentHeight, maxHeight: lockedTabContentHeight }
    : undefined;

  const designerPanel = (
    <div
      className={cn(
        shellWidthClass,
        VARIABLE_COLOR_PICKER_SHELL_HEIGHT_CLASS,
        'flex flex-col overflow-hidden rounded-lg border border-slate-200/80 bg-[#f3f5f9]',
        VARIABLE_COLOR_PICKER_NO_SELECT_CLASS,
      )}
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.28) 1px, transparent 1px)',
        backgroundSize: '14px 14px',
      }}
    >
      {showDesignerTabs ? (
        <div className="shrink-0 border-b border-slate-200/70 bg-white/90 px-2 py-2">
          <VariableColorPickerViewTabs
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
            <RgbPresetsPanel
              disabled={disabled}
              onSelect={handlePresetSelect}
            />
          </div>
        ) : null}
      </div>
    </div>
  );

  const popoverPanelContent = (
    <div className={VARIABLE_COLOR_PICKER_POPOVER_SURFACE_CLASS}>
      <div
        className={cn(
          VARIABLE_COLOR_PICKER_POPOVER_SCROLL_CLASS,
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
      className={VARIABLE_COLOR_PICKER_POPOVER_PANEL_CLASS}
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
          {rgbPreview}
          {showTriggerCss ? (
            <>
              <span className="max-w-[12rem] truncate font-mono text-[11px]">{css}</span>
              <Palette className="size-3.5 text-slate-400" aria-hidden />
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
      <div className={cn('flex flex-col gap-2', VARIABLE_COLOR_PICKER_NO_SELECT_CLASS, className)}>
        {label ? <span className="text-xs font-semibold text-slate-700">{label}</span> : null}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {RGB_PRESETS.slice(0, SWATCH_PRESET_LIMIT).map((preset) => (
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
              title={preset.name}
            >
              <RgbPreviewSwatch css={preset.css} className="h-full w-full" />
            </button>
          ))}
        </div>
        {helperText ? <p className="text-[11px] text-slate-500">{helperText}</p> : null}
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <div className={cn('flex flex-col gap-2', VARIABLE_COLOR_PICKER_NO_SELECT_CLASS, className)}>
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
        VARIABLE_COLOR_PICKER_NO_SELECT_CLASS,
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
      <div className={cn('relative flex flex-col gap-1', VARIABLE_COLOR_PICKER_NO_SELECT_CLASS, className)}>
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
              ariaLabel="Open Variable color picker"
              className={VARIABLE_COLOR_PICKER_POPOVER_PANEL_CLASS}
              trigger={(
                <button
                  type="button"
                  disabled={disabled}
                  aria-label="Open Variable color picker"
                  className={cn('relative flex items-center justify-center', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}
                >
                  {rgbPreview}
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
    <div className={cn('flex flex-col gap-2', VARIABLE_COLOR_PICKER_NO_SELECT_CLASS, className)}>
      {label ? <span className="text-xs font-semibold text-slate-700">{label}</span> : null}
      {designerPanel}
      {helperText ? <p className="text-[11px] text-slate-500">{helperText}</p> : null}
    </div>
  );
};
