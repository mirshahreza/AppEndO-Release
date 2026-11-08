import React, { useCallback, useEffect, useId, useState } from 'react';
import { cn } from '../../lib/utils';

export type UiComparisonSliderProps = {
  beforeSrc?: string;
  afterSrc?: string;
  beforeLabel?: string;
  afterLabel?: string;
  position?: number;
  className?: string;
};

const clampPosition = (value: number) => Math.min(100, Math.max(0, value));

const Panel: React.FC<{
  src?: string;
  label: string;
  toneClass: string;
  labelClass: string;
}> = ({ src, label, toneClass, labelClass }) => (
  src ? (
    <img src={src} alt={label} className="h-full w-full object-cover" />
  ) : (
    <div className={cn('flex h-full w-full items-end p-3', toneClass)}>
      <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', labelClass)}>{label}</span>
    </div>
  )
);

/** Before/after comparison with a draggable clip divider. */
export const UiComparisonSlider: React.FC<UiComparisonSliderProps> = ({
  beforeSrc,
  afterSrc,
  beforeLabel = 'Before',
  afterLabel = 'After',
  position: positionProp = 50,
  className,
}) => {
  const labelId = useId();
  const [position, setPosition] = useState(() => clampPosition(positionProp));

  useEffect(() => {
    setPosition(clampPosition(positionProp));
  }, [positionProp]);

  const updateFromClientX = useCallback((clientX: number, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }
    const rtl = getComputedStyle(target).direction === 'rtl';
    const ratio = (clientX - rect.left) / rect.width;
    setPosition(clampPosition(Math.round((rtl ? 1 - ratio : ratio) * 100)));
  }, []);

  return (
    <div
      className={cn(
        'relative h-48 w-full max-w-xl overflow-hidden rounded-lg border border-slate-200 bg-slate-100',
        className,
      )}
      onPointerDown={(event) => {
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        updateFromClientX(event.clientX, event.currentTarget);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          updateFromClientX(event.clientX, event.currentTarget);
        }
      }}
    >
      <Panel
        src={afterSrc}
        label={afterLabel}
        toneClass="bg-indigo-100"
        labelClass="bg-indigo-600 text-white"
      />
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <Panel
          src={beforeSrc}
          label={beforeLabel}
          toneClass="bg-slate-200"
          labelClass="bg-slate-700 text-white"
        />
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 w-px bg-white shadow-[0_0_0_1px_rgb(15_23_42_/_0.2)]"
        style={{ left: `${position}%` }}
      >
        <span className="absolute top-1/2 start-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white shadow-sm" />
      </div>
      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={position}
        className="absolute inset-0 cursor-ew-resize"
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
            event.preventDefault();
            setPosition((current) => clampPosition(current - 2));
          }
          if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
            event.preventDefault();
            setPosition((current) => clampPosition(current + 2));
          }
          if (event.key === 'Home') {
            event.preventDefault();
            setPosition(0);
          }
          if (event.key === 'End') {
            event.preventDefault();
            setPosition(100);
          }
        }}
      />
      <span id={labelId} className="sr-only">Comparison position</span>
    </div>
  );
};
