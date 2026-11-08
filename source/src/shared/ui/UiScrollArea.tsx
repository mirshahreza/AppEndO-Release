import * as React from 'react';
import { cn } from '../../lib/utils';

export const UI_SCROLL_AREA_VARIANTS = ['bar', 'hidden', 'nudge'] as const;
export const UI_SCROLL_AREA_AXES = ['vertical', 'horizontal'] as const;
export const UI_SCROLL_AREA_BAR_SIDES = ['direction', 'left', 'right'] as const;
export const UI_SCROLL_AREA_NUDGE_REVEAL = ['always', 'pointer'] as const;
export const UI_SCROLL_AREA_NUDGE_PLACEMENT = ['reserve', 'overlay'] as const;
export const UI_SCROLL_AREA_NUDGE_SLOT = ['band', 'icons'] as const;
export const UI_SCROLL_AREA_NUDGE_MARKS = ['icon', 'button'] as const;
export const UI_SCROLL_AREA_NUDGE_MARK_SHAPES = ['circle', 'square'] as const;
export const UI_SCROLL_AREA_NUDGE_OPACITY = [0.35, 0.55, 0.75, 1] as const;
export const UI_SCROLL_AREA_NUDGE_ICON_SIZE_MIN = 6;
export const UI_SCROLL_AREA_NUDGE_ICON_SIZE_MAX = 18;
export const UI_SCROLL_AREA_NUDGE_ICON_SIZE_DEFAULT = 18;
export const UI_SCROLL_AREA_NUDGE_ICON_SIZES = [
  6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
] as const;

export type UiScrollAreaVariant = (typeof UI_SCROLL_AREA_VARIANTS)[number];
export type UiScrollAreaAxis = (typeof UI_SCROLL_AREA_AXES)[number];
export type UiScrollAreaBarSide = (typeof UI_SCROLL_AREA_BAR_SIDES)[number];
export type UiScrollAreaDirection = 'ltr' | 'rtl';
export type UiScrollAreaNudgeReveal = (typeof UI_SCROLL_AREA_NUDGE_REVEAL)[number];
export type UiScrollAreaNudgePlacement = (typeof UI_SCROLL_AREA_NUDGE_PLACEMENT)[number];
export type UiScrollAreaNudgeSlot = (typeof UI_SCROLL_AREA_NUDGE_SLOT)[number];
export type UiScrollAreaNudgeMark = (typeof UI_SCROLL_AREA_NUDGE_MARKS)[number];
export type UiScrollAreaNudgeMarkShape = (typeof UI_SCROLL_AREA_NUDGE_MARK_SHAPES)[number];

export const UI_SCROLL_AREA_DEFAULT_STEP_PX = 72;
export const UI_SCROLL_AREA_DRAG_THRESHOLD_PX = 4;

const NUDGE_REPEAT_DELAY_MS = 280;
const NUDGE_REPEAT_MS = 36;

export type UiScrollAreaProps = {
  children: React.ReactNode;
  className?: string;
  viewportClassName?: string;
  variant?: UiScrollAreaVariant;
  axis?: UiScrollAreaAxis;
  /** Grab-to-pan the canvas. Defaults to on for `nudge`, off otherwise. */
  drag?: boolean;
  stepPx?: number;
  /** When `nudge`, whether the marks stay on or appear while the pointer is over the host. */
  nudgeReveal?: UiScrollAreaNudgeReveal;
  /** When `nudge`, reserved end bands or overlay marks. */
  nudgePlacement?: UiScrollAreaNudgePlacement;
  /** When `nudge`, show the slot band or only the icons. */
  nudgeSlot?: UiScrollAreaNudgeSlot;
  /** Overlay mark opacity from 0.2–1. Ignored when placement is `reserve`. */
  nudgeOpacity?: number;
  /** When `nudge`, caret size in pixels (6–18). */
  nudgeIconSize?: number;
  /** When `nudge`, a bare caret or a button chip. */
  nudgeMark?: UiScrollAreaNudgeMark;
  /** Button chip shape. Ignored when `nudgeMark` is `icon`. */
  nudgeMarkShape?: UiScrollAreaNudgeMarkShape;
  /** When `bar`, which physical edge holds the thumb. `direction` follows LTR→right, RTL→left. */
  barSide?: UiScrollAreaBarSide;
  dir?: UiScrollAreaDirection;
  'aria-label'?: string;
};

/** Pointer-reveal overlay carets — Base Components Scroll Area living sample. */
export const UI_SCROLL_AREA_POINTER_NUDGE_PROPS = {
  variant: 'nudge',
  axis: 'vertical',
  drag: true,
  stepPx: UI_SCROLL_AREA_DEFAULT_STEP_PX,
  nudgeReveal: 'pointer',
  nudgePlacement: 'overlay',
  nudgeSlot: 'band',
  nudgeIconSize: UI_SCROLL_AREA_NUDGE_ICON_SIZE_DEFAULT,
  nudgeMark: 'button',
  nudgeMarkShape: 'circle',
  nudgeOpacity: 1,
} as const satisfies Pick<
  UiScrollAreaProps,
  | 'variant'
  | 'axis'
  | 'drag'
  | 'stepPx'
  | 'nudgeReveal'
  | 'nudgePlacement'
  | 'nudgeSlot'
  | 'nudgeIconSize'
  | 'nudgeMark'
  | 'nudgeMarkShape'
  | 'nudgeOpacity'
>;

export function clampScrollOffset(offset: number, max: number): number {
  if (!Number.isFinite(offset) || max <= 0) return 0;
  return Math.min(max, Math.max(0, offset));
}

export function applyUiScrollAreaStep(
  offset: number,
  direction: 1 | -1,
  stepPx: number,
  max: number,
): number {
  const step = Number.isFinite(stepPx) && stepPx > 0 ? stepPx : UI_SCROLL_AREA_DEFAULT_STEP_PX;
  return clampScrollOffset(offset + direction * step, max);
}

export function applyUiScrollAreaDrag(offset: number, pointerDelta: number, max: number): number {
  return clampScrollOffset(offset - pointerDelta, max);
}

const UI_SCROLL_AREA_PAN_IGNORE = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'option',
  'label',
  'summary',
  '[role="button"]',
  '[role="slider"]',
  '[role="checkbox"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="option"]',
  '[role="switch"]',
  '[role="radio"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[contenteditable="true"]',
  '[data-ui-scroll-nudge]',
].join(',');

/** Grab-to-pan must not steal pointer from form controls or nav links. */
export function uiScrollAreaTargetAllowsPan(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  return target.closest(UI_SCROLL_AREA_PAN_IGNORE) == null;
}

export function resolveUiScrollAreaNudgeState(offset: number, max: number) {
  return {
    canDecrease: offset > 0.5,
    canIncrease: max > 0.5 && offset < max - 0.5,
  };
}

export function resolveUiScrollAreaNudgeEdgeVisibility(
  chromeVisible: boolean,
  canDecrease: boolean,
  canIncrease: boolean,
) {
  return {
    showDecrease: chromeVisible && canDecrease,
    showIncrease: chromeVisible && canIncrease,
  };
}

export function hidesUiScrollAreaThumb(variant: UiScrollAreaVariant): boolean {
  return variant === 'hidden' || variant === 'nudge';
}

export function resolveUiScrollAreaContentDir(dir?: UiScrollAreaDirection): UiScrollAreaDirection {
  if (dir === 'ltr' || dir === 'rtl') return dir;
  if (typeof document !== 'undefined' && document.documentElement.dir === 'rtl') return 'rtl';
  return 'ltr';
}

export function resolveUiScrollAreaBarPhysicalSide(
  side: UiScrollAreaBarSide,
  dir: UiScrollAreaDirection,
): 'left' | 'right' {
  if (side === 'left' || side === 'right') return side;
  return dir === 'rtl' ? 'left' : 'right';
}

/** Native thumbs sit on the end edge of the overflow element’s `dir`. */
export function resolveUiScrollAreaBarViewportDir(
  side: UiScrollAreaBarSide,
  contentDir: UiScrollAreaDirection,
): UiScrollAreaDirection {
  return resolveUiScrollAreaBarPhysicalSide(side, contentDir) === 'left' ? 'rtl' : 'ltr';
}

export function clampUiScrollAreaNudgeIconSize(value: number): number {
  if (!Number.isFinite(value)) return UI_SCROLL_AREA_NUDGE_ICON_SIZE_DEFAULT;
  return Math.min(
    UI_SCROLL_AREA_NUDGE_ICON_SIZE_MAX,
    Math.max(UI_SCROLL_AREA_NUDGE_ICON_SIZE_MIN, Math.round(value)),
  );
}

export function resolveUiScrollAreaNudgeIconStroke(size: number): number {
  const clamped = clampUiScrollAreaNudgeIconSize(size);
  return Math.round((0.85 + clamped * 0.083) * 100) / 100;
}

export function resolveUiScrollAreaNudgeMark(mark?: UiScrollAreaNudgeMark): UiScrollAreaNudgeMark {
  return mark === 'button' ? 'button' : 'icon';
}

export function resolveUiScrollAreaNudgeMarkShape(
  shape?: UiScrollAreaNudgeMarkShape,
): UiScrollAreaNudgeMarkShape {
  return shape === 'square' ? 'square' : 'circle';
}

export function resolveUiScrollAreaNudgeMarkHitSize(size: number, mark: UiScrollAreaNudgeMark): number {
  const icon = clampUiScrollAreaNudgeIconSize(size);
  return mark === 'button' ? icon + 12 : icon + 4;
}

export function clampUiScrollAreaNudgeOpacity(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0.2, Math.round(value * 100) / 100));
}

export function resolveUiScrollAreaNudgeChrome(input: {
  reveal?: UiScrollAreaNudgeReveal;
  placement?: UiScrollAreaNudgePlacement;
  slot?: UiScrollAreaNudgeSlot;
  opacity?: number;
  pointerActive?: boolean;
}) {
  const reveal = input.reveal ?? 'always';
  const placement = input.placement ?? 'reserve';
  const slot = input.slot ?? 'band';
  const overlayOpacity = clampUiScrollAreaNudgeOpacity(input.opacity ?? 0.75);
  const visible = reveal === 'always' || Boolean(input.pointerActive);
  return {
    reveal,
    placement,
    slot,
    occupy: placement === 'reserve',
    overlay: placement === 'overlay',
    showBand: slot === 'band',
    visible,
    opacity: visible ? (placement === 'overlay' ? overlayOpacity : 1) : 0,
  };
}

export function resolveUiScrollAreaViewportClass(
  variant: UiScrollAreaVariant,
  axis: UiScrollAreaAxis,
): string {
  const overflow = axis === 'horizontal'
    ? 'overflow-x-auto overflow-y-hidden'
    : 'overflow-y-auto overflow-x-hidden';
  const hide = hidesUiScrollAreaThumb(variant) ? 'ui-scroll-area-hide-thumb' : '';
  return cn(overflow, hide);
}

const SELECTION_LOCK_PROPERTIES = ['user-select', '-webkit-user-select'] as const;

/** Clears the current range and blocks new text selection until the returned unlock runs. */
export function lockUiScrollAreaTextSelection(): () => void {
  if (typeof document === 'undefined') return () => {};
  window.getSelection()?.removeAllRanges();
  const body = document.body;
  const previous = SELECTION_LOCK_PROPERTIES.map((property) => [
    property,
    body.style.getPropertyValue(property),
  ] as const);
  for (const property of SELECTION_LOCK_PROPERTIES) {
    body.style.setProperty(property, 'none');
  }
  const blockSelectStart = (event: Event) => {
    event.preventDefault();
  };
  document.addEventListener('selectstart', blockSelectStart);
  return () => {
    for (const [property, value] of previous) {
      if (value) body.style.setProperty(property, value);
      else body.style.removeProperty(property);
    }
    document.removeEventListener('selectstart', blockSelectStart);
  };
}

type NudgeCaretProps = {
  direction: 'decrease' | 'increase';
  axis: UiScrollAreaAxis;
  size: number;
};

const NudgeCaret: React.FC<NudgeCaretProps> = ({ direction, axis, size }) => {
  const rotate = axis === 'horizontal'
    ? (direction === 'decrease' ? '-90deg' : '90deg')
    : (direction === 'increase' ? '180deg' : '0deg');

  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      aria-hidden
      style={{ transform: `rotate(${rotate})` }}
    >
      <path
        d="M5.2 12.7 L10 7.1 L14.8 12.7"
        fill="none"
        stroke="currentColor"
        strokeWidth={resolveUiScrollAreaNudgeIconStroke(size)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const NudgeSlot: React.FC<{
  edge: 'decrease' | 'increase';
  axis: UiScrollAreaAxis;
  occupy: boolean;
  overlay: boolean;
  showBand: boolean;
  opacity: number;
  hitSize: number;
  children: React.ReactNode;
}> = ({ edge, axis, occupy, overlay, showBand, opacity, hitSize, children }) => {
  const vertical = axis === 'vertical';
  const occupyPx = Math.max(28, hitSize + 4);
  return (
    <div
      data-ui-scroll-nudge-slot={edge}
      data-nudge-band={showBand ? '' : undefined}
      className={cn(
        'flex items-center justify-center motion-safe:transition-opacity motion-safe:duration-200',
        occupy && 'shrink-0',
        occupy && (vertical ? 'w-full' : 'h-full'),
        overlay && 'pointer-events-none absolute z-[1]',
        overlay && vertical && 'inset-x-0',
        overlay && vertical && edge === 'decrease' && 'top-0',
        overlay && vertical && edge === 'increase' && 'bottom-0',
        overlay && !vertical && 'inset-y-0',
        overlay && !vertical && edge === 'decrease' && 'start-0',
        overlay && !vertical && edge === 'increase' && 'end-0',
        showBand && vertical && edge === 'decrease' && 'border-b border-slate-100',
        showBand && vertical && edge === 'increase' && 'border-t border-slate-100',
        showBand && !vertical && edge === 'decrease' && 'border-e border-slate-100',
        showBand && !vertical && edge === 'increase' && 'border-s border-slate-100',
        showBand && overlay && 'bg-white/70',
      )}
      style={{
        opacity,
        ...(occupy || overlay ? (vertical ? { height: occupyPx } : { width: occupyPx }) : {}),
      }}
    >
      {children}
    </div>
  );
};

/** Overflow host with a default overlay thumb, a fully hidden bar, or reserved end marks. */
export const UiScrollArea: React.FC<UiScrollAreaProps> = ({
  children,
  className,
  viewportClassName,
  variant = 'bar',
  axis = 'vertical',
  drag,
  stepPx = UI_SCROLL_AREA_DEFAULT_STEP_PX,
  nudgeReveal = 'always',
  nudgePlacement = 'reserve',
  nudgeSlot = 'band',
  nudgeOpacity = 0.75,
  nudgeIconSize = UI_SCROLL_AREA_NUDGE_ICON_SIZE_DEFAULT,
  nudgeMark = 'icon',
  nudgeMarkShape = 'circle',
  barSide = 'direction',
  dir,
  'aria-label': ariaLabel = 'Scrollable region',
}) => {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<{
    pointerId: number;
    last: number;
    origin: number;
    dragging: boolean;
  } | null>(null);
  const repeatRef = React.useRef<number | null>(null);
  const unlockSelectionRef = React.useRef<(() => void) | null>(null);
  const [metrics, setMetrics] = React.useState({ offset: 0, max: 0 });
  const [dragActive, setDragActive] = React.useState(false);
  const [pointerActive, setPointerActive] = React.useState(false);
  const dragEnabled = drag ?? variant === 'nudge';
  const nudge = variant === 'nudge';
  const vertical = axis === 'vertical';
  const chrome = resolveUiScrollAreaNudgeChrome({
    reveal: nudgeReveal,
    placement: nudgePlacement,
    slot: nudgeSlot,
    opacity: nudgeOpacity,
    pointerActive,
  });
  const occupyMarks = nudge && chrome.occupy;
  const iconSize = clampUiScrollAreaNudgeIconSize(nudgeIconSize);
  const mark = resolveUiScrollAreaNudgeMark(nudgeMark);
  const markShape = resolveUiScrollAreaNudgeMarkShape(nudgeMarkShape);
  const markHitSize = resolveUiScrollAreaNudgeMarkHitSize(iconSize, mark);
  const contentDir = resolveUiScrollAreaContentDir(dir);
  const barPhysicalSide = resolveUiScrollAreaBarPhysicalSide(barSide, contentDir);
  const forceBarViewport = variant === 'bar' && vertical && barSide !== 'direction';
  const barViewportDir = forceBarViewport
    ? resolveUiScrollAreaBarViewportDir(barSide, contentDir)
    : undefined;
  const nudgeState = resolveUiScrollAreaNudgeState(metrics.offset, metrics.max);
  const edgeVisibility = resolveUiScrollAreaNudgeEdgeVisibility(
    chrome.visible,
    nudgeState.canDecrease,
    nudgeState.canIncrease,
  );
  const occupyVisibleMarks = occupyMarks && (edgeVisibility.showDecrease || edgeVisibility.showIncrease);

  const readAxisOffset = React.useCallback((node: HTMLDivElement) => (
    vertical ? { offset: node.scrollTop, max: node.scrollHeight - node.clientHeight }
      : { offset: node.scrollLeft, max: node.scrollWidth - node.clientWidth }
  ), [vertical]);

  const syncMetrics = React.useCallback(() => {
    const node = viewportRef.current;
    if (!node) return;
    setMetrics(readAxisOffset(node));
  }, [readAxisOffset]);

  const writeOffset = React.useCallback((next: number) => {
    const node = viewportRef.current;
    if (!node) return;
    if (vertical) node.scrollTop = next;
    else node.scrollLeft = next;
    setMetrics((current) => ({ ...current, offset: next }));
  }, [vertical]);

  const stepBy = React.useCallback((direction: 1 | -1) => {
    const node = viewportRef.current;
    if (!node) return;
    const { offset, max } = readAxisOffset(node);
    writeOffset(applyUiScrollAreaStep(offset, direction, stepPx, max));
  }, [readAxisOffset, stepPx, writeOffset]);

  React.useLayoutEffect(() => {
    syncMetrics();
  }, [syncMetrics, children, axis, variant]);

  React.useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(syncMetrics);
    observer?.observe(node);
    node.addEventListener('scroll', syncMetrics, { passive: true });
    return () => {
      observer?.disconnect();
      node.removeEventListener('scroll', syncMetrics);
    };
  }, [syncMetrics]);

  const stopRepeat = React.useCallback(() => {
    if (repeatRef.current != null) {
      window.clearTimeout(repeatRef.current);
      repeatRef.current = null;
    }
  }, []);

  const setPointerOver = React.useCallback((over: boolean) => {
    if (!nudge || nudgeReveal !== 'pointer') return;
    setPointerActive(over);
  }, [nudge, nudgeReveal]);

  const startRepeat = React.useCallback((direction: 1 | -1) => {
    stopRepeat();
    stepBy(direction);
    repeatRef.current = window.setTimeout(() => {
      const tick = () => {
        stepBy(direction);
        repeatRef.current = window.setTimeout(tick, NUDGE_REPEAT_MS);
      };
      tick();
    }, NUDGE_REPEAT_DELAY_MS);
  }, [stepBy, stopRepeat]);

  const unlockSelection = React.useCallback(() => {
    unlockSelectionRef.current?.();
    unlockSelectionRef.current = null;
    setDragActive(false);
  }, []);

  React.useEffect(() => () => {
    stopRepeat();
    unlockSelectionRef.current?.();
    unlockSelectionRef.current = null;
  }, [stopRepeat]);

  const pointerCoord = (event: React.PointerEvent) => (vertical ? event.clientY : event.clientX);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragEnabled || event.button !== 0) return;
    if (!uiScrollAreaTargetAllowsPan(event.target)) return;
    const node = viewportRef.current;
    if (!node) return;
    dragRef.current = {
      pointerId: event.pointerId,
      last: pointerCoord(event),
      origin: pointerCoord(event),
      dragging: false,
    };
    if (!unlockSelectionRef.current) {
      unlockSelectionRef.current = lockUiScrollAreaTextSelection();
    }
    setDragActive(true);
    if (typeof node.setPointerCapture === 'function') {
      node.setPointerCapture(event.pointerId);
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragRef.current;
    const node = viewportRef.current;
    if (!dragState || !node || event.pointerId !== dragState.pointerId) return;
    const coord = pointerCoord(event);
    if (!dragState.dragging) {
      if (Math.abs(coord - dragState.origin) < UI_SCROLL_AREA_DRAG_THRESHOLD_PX) return;
      dragState.dragging = true;
    }
    event.preventDefault();
    const { offset, max } = readAxisOffset(node);
    writeOffset(applyUiScrollAreaDrag(offset, coord - dragState.last, max));
    dragState.last = coord;
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragRef.current;
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    dragRef.current = null;
    unlockSelection();
    const node = viewportRef.current;
    if (node && typeof node.hasPointerCapture === 'function' && node.hasPointerCapture(event.pointerId)) {
      node.releasePointerCapture(event.pointerId);
    }
  };

  const decreaseLabel = vertical ? 'Scroll up' : 'Scroll start';
  const increaseLabel = vertical ? 'Scroll down' : 'Scroll end';

  const decreaseButton = nudge && edgeVisibility.showDecrease ? (
    <NudgeSlot
      edge="decrease"
      axis={axis}
      occupy={chrome.occupy}
      overlay={chrome.overlay}
      showBand={chrome.showBand}
      opacity={chrome.opacity}
      hitSize={markHitSize}
    >
      <NudgeButton
        label={decreaseLabel}
        disabled={!nudgeState.canDecrease}
        direction="decrease"
        axis={axis}
        size={iconSize}
        hitSize={markHitSize}
        mark={mark}
        shape={markShape}
        interactive={chrome.visible}
        onPressStart={() => startRepeat(-1)}
        onPressEnd={stopRepeat}
      />
    </NudgeSlot>
  ) : null;
  const increaseButton = nudge && edgeVisibility.showIncrease ? (
    <NudgeSlot
      edge="increase"
      axis={axis}
      occupy={chrome.occupy}
      overlay={chrome.overlay}
      showBand={chrome.showBand}
      opacity={chrome.opacity}
      hitSize={markHitSize}
    >
      <NudgeButton
        label={increaseLabel}
        disabled={!nudgeState.canIncrease}
        direction="increase"
        axis={axis}
        size={iconSize}
        hitSize={markHitSize}
        mark={mark}
        shape={markShape}
        interactive={chrome.visible}
        onPressStart={() => startRepeat(1)}
        onPressEnd={stopRepeat}
      />
    </NudgeSlot>
  ) : null;

  return (
    <div
      className={cn(
        'relative min-h-0 min-w-0 overflow-hidden',
        occupyVisibleMarks && (vertical ? 'flex flex-col' : 'flex flex-row'),
        className,
      )}
      data-ui-scroll-area=""
      data-variant={variant}
      data-axis={axis}
      data-bar-side={variant === 'bar' && vertical ? barSide : undefined}
      data-bar-edge={variant === 'bar' && vertical ? barPhysicalSide : undefined}
      dir={contentDir}
      data-nudge-placement={nudge ? chrome.placement : undefined}
      data-nudge-reveal={nudge ? chrome.reveal : undefined}
      data-nudge-slot={nudge ? chrome.slot : undefined}
      data-nudge-icon-size={nudge ? iconSize : undefined}
      data-nudge-mark={nudge ? mark : undefined}
      data-nudge-shape={nudge && mark === 'button' ? markShape : undefined}
      data-nudge-decrease={nudge && edgeVisibility.showDecrease ? '' : undefined}
      data-nudge-increase={nudge && edgeVisibility.showIncrease ? '' : undefined}
      data-nudge-visible={nudge && chrome.visible ? '' : undefined}
      onPointerEnter={nudge && nudgeReveal === 'pointer' ? () => setPointerOver(true) : undefined}
      onPointerLeave={nudge && nudgeReveal === 'pointer' ? () => setPointerOver(false) : undefined}
    >
      {decreaseButton}
      <div
        ref={viewportRef}
        className={cn(
          'min-h-0 min-w-0',
          occupyVisibleMarks ? 'flex-1' : 'h-full',
          resolveUiScrollAreaViewportClass(variant, axis),
          dragEnabled && 'cursor-grab active:cursor-grabbing',
          dragActive && 'select-none',
          viewportClassName,
        )}
        tabIndex={0}
        aria-label={ariaLabel}
        dir={barViewportDir}
        data-hide-thumb={hidesUiScrollAreaThumb(variant) ? '' : undefined}
        data-dragging={dragActive ? '' : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {forceBarViewport ? (
          <div dir={contentDir} className="min-h-min w-full">
            {children}
          </div>
        ) : children}
      </div>
      {increaseButton}
    </div>
  );
};

type NudgeButtonProps = {
  label: string;
  disabled: boolean;
  direction: 'decrease' | 'increase';
  axis: UiScrollAreaAxis;
  size: number;
  hitSize: number;
  mark: UiScrollAreaNudgeMark;
  shape: UiScrollAreaNudgeMarkShape;
  interactive: boolean;
  onPressStart: () => void;
  onPressEnd: () => void;
};

const NudgeButton: React.FC<NudgeButtonProps> = ({
  label,
  disabled,
  direction,
  axis,
  size,
  hitSize,
  mark,
  shape,
  interactive,
  onPressStart,
  onPressEnd,
}) => (
  <button
    type="button"
    data-ui-scroll-nudge={direction}
    data-nudge-mark={mark}
    data-nudge-shape={shape}
    aria-label={label}
    disabled={disabled || !interactive}
    tabIndex={interactive ? 0 : -1}
    className={cn(
      'ui-scroll-area-nudge pointer-events-auto',
      'motion-safe:transition-[opacity,color,background-color,border-color] motion-safe:duration-150',
      disabled && 'opacity-28',
    )}
    style={{ width: hitSize, height: hitSize }}
    onPointerDown={(event) => {
      if (disabled || !interactive || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      onPressStart();
    }}
    onPointerUp={onPressEnd}
    onPointerLeave={onPressEnd}
    onPointerCancel={onPressEnd}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onPressStart();
      }
    }}
    onKeyUp={onPressEnd}
    onBlur={onPressEnd}
  >
    <NudgeCaret direction={direction} axis={axis} size={size} />
  </button>
);
