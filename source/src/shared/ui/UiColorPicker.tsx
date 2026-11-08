import React, { useCallback, useId, useMemo, useRef, useState } from 'react';
import { Droplet, Pipette } from 'lucide-react';
import { cn } from '../../lib/utils';
import { UiInput } from './ai-field-assist/AiAssistInput';
import { ShellResponsivePopover } from './shell-foundation/ShellResponsivePopover';
import { COLOR_PICKER_DEFAULT_HEX } from './surfaceClasses';
import {
  clamp,
  colorToHex,
  colorToRgba,
  DEFAULT_COLOR_PRESETS,
  formatColorValue,
  hexToHsl,
  hslToHex,
  parseColorInput,
  type ColorFormat,
} from '../lib/colorMath';

export type UiColorPickerVariant = 'field' | 'popover' | 'inline' | 'swatch' | 'minimal';
export type UiColorPickerSize = 'sm' | 'md' | 'lg';

export type UiColorPickerProps = {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  variant?: UiColorPickerVariant;
  format?: ColorFormat;
  size?: UiColorPickerSize;
  label?: string;
  helperText?: string;
  ariaLabel?: string;
  disabled?: boolean;
  isInvalid?: boolean;
  clearable?: boolean;
  showInput?: boolean;
  showAlpha?: boolean;
  showPresets?: boolean;
  presets?: readonly string[];
  showEyeDropper?: boolean;
  className?: string;
};

const SIZE_CLASS: Record<UiColorPickerSize, { swatch: string; input: 'sm' | 'md' | 'lg' }> = {
  sm: { swatch: 'size-4', input: 'sm' },
  md: { swatch: 'size-5', input: 'sm' },
  lg: { swatch: 'size-6', input: 'md' },
};

/** Above parent picker popovers (`ShellResponsivePopover` default portal layer). */
const COLOR_PICKER_POPOVER_Z_INDEX = 1100;

const COLOR_PICKER_POPOVER_PANEL_CLASS = 'border-0 bg-transparent p-0 shadow-none';

const COLOR_PICKER_POPOVER_SURFACE_CLASS =
  'rounded-lg border border-white/80 bg-white p-3 shadow-[0_24px_64px_-16px_rgba(15,23,42,0.32),0_12px_28px_-12px_rgba(99,102,241,0.18)]';

const useEyeDropperSupported = (): boolean => (
  typeof window !== 'undefined' && 'EyeDropper' in window
);

type PickerSurfaceProps = {
  hex: string;
  alpha: number;
  format: ColorFormat;
  showAlpha: boolean;
  showPresets: boolean;
  presets: readonly string[];
  showEyeDropper: boolean;
  disabled?: boolean;
  onCommit: (hex: string, alpha: number) => void;
};

const rgbaToDisplay = (rgba: { r: number; g: number; b: number; a: number }): string => (
  `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})`
);

const ColorSwatchButton: React.FC<{
  hex: string;
  alpha: number;
  size: UiColorPickerSize;
  disabled?: boolean;
  ariaLabel: string;
  onClick?: () => void;
  className?: string;
}> = ({ hex, alpha, size, disabled, ariaLabel, onClick, className }) => {
  const rgba = colorToRgba(hex, alpha);
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        'relative shrink-0 rounded-full border border-slate-200 shadow-sm transition hover:ring-2 hover:ring-sky-200',
        SIZE_CLASS[size].swatch,
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
      style={{ backgroundColor: rgbaToDisplay(rgba) }}
    />
  );
};

const SpectrumArea: React.FC<{
  hue: number;
  saturation: number;
  lightness: number;
  disabled?: boolean;
  onChange: (saturation: number, lightness: number) => void;
}> = ({ hue, saturation, lightness, disabled, onChange }) => {
  const areaRef = useRef<HTMLDivElement>(null);

  const updateFromPointer = useCallback((clientX: number, clientY: number) => {
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const x = clamp((clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((clientY - rect.top) / rect.height, 0, 1);
    onChange(Math.round(x * 100), Math.round((1 - y) * 100));
  }, [onChange]);

  const handlePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(event.clientX, event.clientY);
  };

  return (
    <div
      ref={areaRef}
      role="slider"
      aria-label="Saturation and lightness"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={saturation}
      tabIndex={disabled ? -1 : 0}
      className={cn(
        'relative h-32 w-full cursor-crosshair overflow-hidden rounded-md border border-slate-200',
        disabled && 'cursor-not-allowed opacity-60',
      )}
      style={{ backgroundColor: `hsl(${hue}, 100%, 50%)` }}
      onPointerDown={handlePointer}
      onPointerMove={(event) => {
        if (event.buttons !== 1) {
          return;
        }
        updateFromPointer(event.clientX, event.clientY);
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
      <span
        className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
        style={{
          left: `${saturation}%`,
          top: `${100 - lightness}%`,
        }}
      />
    </div>
  );
};

const HueSlider: React.FC<{
  hue: number;
  disabled?: boolean;
  onChange: (hue: number) => void;
}> = ({ hue, disabled, onChange }) => (
  <input
    type="range"
    min={0}
    max={360}
    value={hue}
    disabled={disabled}
    aria-label="Hue"
    onChange={(event) => onChange(Number(event.target.value))}
    className="h-2 w-full cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed"
    style={{
      background: 'linear-gradient(90deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
    }}
  />
);

const AlphaSlider: React.FC<{
  hex: string;
  alpha: number;
  disabled?: boolean;
  onChange: (alpha: number) => void;
}> = ({ hex, alpha, disabled, onChange }) => {
  const rgb = colorToRgba(hex, 1);
  return (
    <div
      className="relative h-2 w-full overflow-hidden rounded-full border border-slate-200"
      style={{
        backgroundImage:
          'linear-gradient(45deg, #cbd5e1 25%, transparent 25%), linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cbd5e1 75%), linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)',
        backgroundSize: '8px 8px',
        backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(90deg, rgba(${rgb.r},${rgb.g},${rgb.b},0), rgba(${rgb.r},${rgb.g},${rgb.b},1))`,
        }}
      />
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(alpha * 100)}
        disabled={disabled}
        aria-label="Opacity"
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent disabled:cursor-not-allowed"
      />
    </div>
  );
};

const PresetSwatches: React.FC<{
  presets: readonly string[];
  activeHex: string;
  disabled?: boolean;
  onSelect: (hex: string) => void;
}> = ({ presets, activeHex, disabled, onSelect }) => (
  <div role="radiogroup" aria-label="Color presets" className="grid grid-cols-9 gap-1.5">
    {presets.map((preset) => {
      const hex = colorToHex(preset);
      const selected = hex === activeHex;
      return (
        <button
          key={preset}
          type="button"
          role="radio"
          aria-checked={selected}
          aria-label={hex}
          disabled={disabled}
          onClick={() => onSelect(hex)}
          className={cn(
            'size-5 rounded-sm border transition',
            selected ? 'border-sky-500 ring-2 ring-sky-200' : 'border-slate-200 hover:scale-105',
            disabled && 'cursor-not-allowed opacity-60',
          )}
          style={{ backgroundColor: hex }}
        />
      );
    })}
  </div>
);

const ColorPickerSurface: React.FC<PickerSurfaceProps> = ({
  hex,
  alpha,
  format,
  showAlpha,
  showPresets,
  presets,
  showEyeDropper,
  disabled,
  onCommit,
}) => {
  const hsl = useMemo(() => hexToHsl(hex) ?? { h: 180, s: 50, l: 50 }, [hex]);
  const eyeDropperSupported = useEyeDropperSupported();
  const [inputValue, setInputValue] = useState(() => formatColorValue(hex, format, alpha));
  const [inputInvalid, setInputInvalid] = useState(false);

  const commitHsl = useCallback((nextHue: number, nextSaturation: number, nextLightness: number, nextAlpha = alpha) => {
    const nextHex = hslToHex({ h: nextHue, s: nextSaturation, l: nextLightness });
    onCommit(nextHex, nextAlpha);
    setInputValue(formatColorValue(nextHex, format, nextAlpha));
    setInputInvalid(false);
  }, [alpha, format, onCommit]);

  const handleEyeDropper = async () => {
    if (!eyeDropperSupported || disabled) {
      return;
    }
    try {
      const eyeDropper = new (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper();
      const result = await eyeDropper.open();
      onCommit(colorToHex(result.sRGBHex), alpha);
      setInputValue(formatColorValue(result.sRGBHex, format, alpha));
    } catch {
      // User cancelled.
    }
  };

  const handleInputBlur = () => {
    const parsed = parseColorInput(inputValue);
    if (!parsed) {
      setInputInvalid(true);
      return;
    }
    onCommit(parsed.hex, parsed.alpha);
    setInputValue(formatColorValue(parsed.hex, format, parsed.alpha));
    setInputInvalid(false);
  };

  return (
    <div className="flex w-[min(18rem,100%)] flex-col gap-3">
      <SpectrumArea
        hue={hsl.h}
        saturation={hsl.s}
        lightness={hsl.l}
        disabled={disabled}
        onChange={(saturation, lightness) => commitHsl(hsl.h, saturation, lightness)}
      />
      <HueSlider
        hue={hsl.h}
        disabled={disabled}
        onChange={(hue) => commitHsl(hue, hsl.s, hsl.l)}
      />
      {showAlpha ? (
        <AlphaSlider
          hex={hex}
          alpha={alpha}
          disabled={disabled}
          onChange={(nextAlpha) => {
            onCommit(hex, nextAlpha);
            setInputValue(formatColorValue(hex, format, nextAlpha));
          }}
        />
      ) : null}
      <div className="flex items-center gap-2">
        <ColorSwatchButton
          hex={hex}
          alpha={alpha}
          size="md"
          disabled={disabled}
          ariaLabel="Current color"
        />
        <UiInput
          aiAssist={false}
          autoDir={false}
          size="sm"
          value={inputValue}
          disabled={disabled}
          isInvalid={inputInvalid}
          onChange={(event) => setInputValue(event.target.value)}
          onBlur={handleInputBlur}
          ariaLabel="Color value"
          className="min-w-0 flex-1 font-mono text-xs"
        />
        {showEyeDropper && eyeDropperSupported ? (
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            aria-label="Pick color from screen"
            title="Pick color from screen"
            onClick={handleEyeDropper}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Pipette className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
      {showPresets ? (
        <PresetSwatches
          presets={presets}
          activeHex={hex}
          disabled={disabled}
          onSelect={(nextHex) => {
            onCommit(nextHex, alpha);
            setInputValue(formatColorValue(nextHex, format, alpha));
          }}
        />
      ) : null}
    </div>
  );
};

export const UiColorPicker: React.FC<UiColorPickerProps> = ({
  value,
  defaultValue = COLOR_PICKER_DEFAULT_HEX,
  onChange,
  variant = 'field',
  format = 'hex',
  size = 'md',
  label,
  helperText,
  ariaLabel = 'Color picker',
  disabled = false,
  isInvalid = false,
  clearable = false,
  showInput = true,
  showAlpha = false,
  showPresets = false,
  presets = DEFAULT_COLOR_PRESETS,
  showEyeDropper = false,
  className,
}) => {
  const fieldId = useId();
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [internalAlpha, setInternalAlpha] = useState(1);
  const [open, setOpen] = useState(false);
  const resolvedValue = value ?? internalValue;
  const hex = colorToHex(resolvedValue);
  const rgba = colorToRgba(resolvedValue, internalAlpha);

  const commit = useCallback((nextHex: string, nextAlpha: number) => {
    const nextRgba = colorToRgba(nextHex, nextAlpha);
    const output = showAlpha && nextAlpha < 1
      ? `rgba(${nextRgba.r}, ${nextRgba.g}, ${nextRgba.b}, ${Number(nextAlpha.toFixed(2))})`
      : nextHex;
    if (value == null) {
      setInternalValue(output);
      setInternalAlpha(nextAlpha);
    }
    onChange?.(output);
  }, [onChange, showAlpha, value]);

  const surfaceProps: PickerSurfaceProps = {
    hex,
    alpha: internalAlpha,
    format,
    showAlpha,
    showPresets,
    presets,
    showEyeDropper,
    disabled,
    onCommit: commit,
  };

  const displayValue = formatColorValue(hex, format, internalAlpha);

  if (variant === 'swatch') {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {label ? <span className="text-xs font-semibold text-slate-700">{label}</span> : null}
        <PresetSwatches presets={presets} activeHex={hex} disabled={disabled} onSelect={(nextHex) => commit(nextHex, 1)} />
        {helperText ? <p className="text-[11px] text-slate-500">{helperText}</p> : null}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {label ? <span id={fieldId} className="text-xs font-semibold text-slate-700">{label}</span> : null}
        <ColorPickerSurface {...surfaceProps} />
        {helperText ? <p className="text-[11px] text-slate-500">{helperText}</p> : null}
      </div>
    );
  }

  if (variant === 'minimal') {
    const hsl = hexToHsl(hex) ?? { h: 180, s: 50, l: 50 };
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {label ? <span className="text-xs font-semibold text-slate-700">{label}</span> : null}
        <div className="flex items-center gap-2">
          <ColorSwatchButton hex={hex} alpha={internalAlpha} size={size} disabled={disabled} ariaLabel={ariaLabel} />
          <HueSlider hue={hsl.h} disabled={disabled} onChange={(hue) => commit(hslToHex({ ...hsl, h: hue }), internalAlpha)} />
        </div>
        {showInput ? (
          <UiInput
            aiAssist={false}
            autoDir={false}
            size={SIZE_CLASS[size].input}
            value={displayValue}
            disabled={disabled}
            isInvalid={isInvalid}
            onChange={(event) => {
              const parsed = parseColorInput(event.target.value);
              if (parsed) {
                commit(parsed.hex, parsed.alpha);
              }
            }}
            ariaLabel={ariaLabel}
            className="font-mono text-xs"
          />
        ) : null}
        {helperText ? <p className="text-[11px] text-slate-500">{helperText}</p> : null}
      </div>
    );
  }

  if (variant === 'popover') {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {label ? <span className="text-xs font-semibold text-slate-700">{label}</span> : null}
        <ShellResponsivePopover
          open={open}
          onOpenChange={setOpen}
          placement="bottom-start"
          portal
          portalZIndex={COLOR_PICKER_POPOVER_Z_INDEX}
          className={COLOR_PICKER_POPOVER_PANEL_CLASS}
          ariaLabel={ariaLabel}
          trigger={(
            <button
              type="button"
              disabled={disabled}
              aria-label={ariaLabel}
              className={cn(
                'inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <ColorSwatchButton hex={hex} alpha={internalAlpha} size={size} disabled={disabled} ariaLabel="Selected color" />
              <span className="font-mono">{displayValue}</span>
              <Droplet className="size-3.5 text-slate-400" aria-hidden />
            </button>
          )}
        >
          <div className={COLOR_PICKER_POPOVER_SURFACE_CLASS}>
            <ColorPickerSurface {...surfaceProps} />
          </div>
        </ShellResponsivePopover>
        {helperText ? <p className="text-[11px] text-slate-500">{helperText}</p> : null}
      </div>
    );
  }

  return (
    <div className={cn('relative flex flex-col gap-1', className)}>
      {label ? <label htmlFor={fieldId} className="text-xs font-semibold text-slate-700">{label}</label> : null}
      <UiInput
        id={fieldId}
        aiAssist={false}
        autoDir={false}
        type="text"
        size={SIZE_CLASS[size].input}
        value={displayValue}
        placeholder="#RRGGBB"
        disabled={disabled}
        isInvalid={isInvalid}
        onChange={(event) => {
          const parsed = parseColorInput(event.target.value);
          if (parsed) {
            commit(parsed.hex, parsed.alpha);
          } else if (value == null) {
            setInternalValue(event.target.value);
          }
          onChange?.(event.target.value);
        }}
        ariaLabel={ariaLabel}
        startContent={(
          <ShellResponsivePopover
            open={open}
            onOpenChange={setOpen}
            placement="bottom-start"
            portal
            portalZIndex={COLOR_PICKER_POPOVER_Z_INDEX}
            className={COLOR_PICKER_POPOVER_PANEL_CLASS}
            ariaLabel="Open color picker"
            trigger={(
              <button
                type="button"
                disabled={disabled}
                aria-label="Open color picker"
                className={cn('relative flex items-center justify-center', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}
              >
                <span
                  className={cn('rounded-full border border-sky-200', SIZE_CLASS[size].swatch)}
                  style={{ backgroundColor: rgbaToDisplay(rgba) }}
                />
              </button>
            )}
          >
            <div className={COLOR_PICKER_POPOVER_SURFACE_CLASS}>
              <ColorPickerSurface {...surfaceProps} />
            </div>
          </ShellResponsivePopover>
        )}
        startContentClassName="border-e-0 px-1.5"
        className="font-mono text-xs font-semibold text-slate-800"
      />
      {clearable && hex && !disabled ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Clear color"
          onClick={() => commit('', 1)}
          className="absolute end-2 top-[calc(100%-1.65rem)] text-[10px] font-semibold text-slate-400 hover:text-rose-600"
        >
          Clear
        </button>
      ) : null}
      {helperText ? <p className="text-[11px] text-slate-500">{helperText}</p> : null}
    </div>
  );
};
