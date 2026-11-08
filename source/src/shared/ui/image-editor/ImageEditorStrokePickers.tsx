import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  IMAGE_EDITOR_STROKE_WIDTH_PRESETS,
  svgStrokeDasharray,
  type ImageEditorLineStyle,
} from '../../lib/imageEditorAnnotations';
import { ShellResponsivePopover } from '../shell-foundation/ShellResponsivePopover';

/** Above deep-nested image editor modal (`z-[130]`). */
const IMAGE_EDITOR_POPOVER_Z_INDEX = 1400;

const PREVIEW_COLOR = '#334155';

type StrokePreviewLineProps = {
  width: number;
  lineStyle?: ImageEditorLineStyle;
  color?: string;
  className?: string;
};

export const StrokePreviewLine: React.FC<StrokePreviewLineProps> = ({
  width,
  lineStyle = 'solid',
  color = PREVIEW_COLOR,
  className,
}) => (
  <svg viewBox="0 0 88 20" className={cn('h-5 w-[5.5rem] shrink-0', className)} aria-hidden>
    <line
      x1="6"
      y1="10"
      x2="82"
      y2="10"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeDasharray={svgStrokeDasharray(lineStyle, width)}
    />
  </svg>
);

const pickerTriggerClass = cn(
  'flex h-9 min-w-[7rem] items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5',
  'text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200',
);

type ImageEditorStrokeWidthPickerProps = {
  value: number;
  color?: string;
  onChange: (width: number) => void;
};

export const ImageEditorStrokeWidthPicker: React.FC<ImageEditorStrokeWidthPickerProps> = ({
  value,
  color,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const previewColor = color ?? PREVIEW_COLOR;

  return (
    <ShellResponsivePopover
      open={open}
      onOpenChange={setOpen}
      portal
      portalZIndex={IMAGE_EDITOR_POPOVER_Z_INDEX}
      placement="bottom-start"
      ariaLabel="Stroke width"
      className="w-[12.5rem] rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg"
      trigger={(
        <button
          type="button"
          title="Stroke width"
          aria-label="Stroke width"
          className={pickerTriggerClass}
        >
          <StrokePreviewLine width={value} lineStyle="solid" color={previewColor} />
          <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
        </button>
      )}
    >
      <ul
        className="flex flex-col gap-0.5"
        role="listbox"
        aria-label="Stroke width options"
        onPointerDown={(event) => event.stopPropagation()}
      >
        {IMAGE_EDITOR_STROKE_WIDTH_PRESETS.map((width) => {
          const selected = width === value;
          return (
            <li key={width}>
              <button
                type="button"
                role="option"
                aria-selected={selected}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start transition-colors',
                  selected ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50',
                )}
                onClick={() => {
                  onChange(width);
                  setOpen(false);
                }}
              >
                <StrokePreviewLine width={width} lineStyle="solid" color={previewColor} />
                <span className="ms-auto text-xs tabular-nums text-slate-500">{width}px</span>
              </button>
            </li>
          );
        })}
      </ul>
    </ShellResponsivePopover>
  );
};

const LINE_STYLE_OPTIONS: Array<{ id: ImageEditorLineStyle; label: string }> = [
  { id: 'solid', label: 'Solid' },
  { id: 'dashed', label: 'Dashed' },
  { id: 'dotted', label: 'Dotted' },
];

type ImageEditorStrokeStylePickerProps = {
  value: ImageEditorLineStyle;
  strokeWidth: number;
  color?: string;
  onChange: (lineStyle: ImageEditorLineStyle) => void;
};

export const ImageEditorStrokeStylePicker: React.FC<ImageEditorStrokeStylePickerProps> = ({
  value,
  strokeWidth,
  color,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const previewColor = color ?? PREVIEW_COLOR;

  return (
    <ShellResponsivePopover
      open={open}
      onOpenChange={setOpen}
      portal
      portalZIndex={IMAGE_EDITOR_POPOVER_Z_INDEX}
      placement="bottom-start"
      ariaLabel="Line style"
      className="w-[12.5rem] rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg"
      trigger={(
        <button
          type="button"
          title="Line style"
          aria-label="Line style"
          className={pickerTriggerClass}
        >
          <StrokePreviewLine width={Math.max(2, strokeWidth)} lineStyle={value} color={previewColor} />
          <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
        </button>
      )}
    >
      <ul
        className="flex flex-col gap-0.5"
        role="listbox"
        aria-label="Line style options"
        onPointerDown={(event) => event.stopPropagation()}
      >
        {LINE_STYLE_OPTIONS.map((option) => {
          const selected = option.id === value;
          return (
            <li key={option.id}>
              <button
                type="button"
                role="option"
                aria-selected={selected}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start transition-colors',
                  selected ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50',
                )}
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
              >
                <StrokePreviewLine
                  width={Math.max(2, strokeWidth)}
                  lineStyle={option.id}
                  color={previewColor}
                />
                <span className="text-xs font-medium text-slate-600">{option.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </ShellResponsivePopover>
  );
};
