export type RtlHorizontalScrollType = 'default' | 'negative' | 'reverse';

const rtlHorizontalScrollTypeCache = new WeakMap<HTMLElement, RtlHorizontalScrollType>();

/** Detect RTL horizontal scrollLeft semantics (Blink negative vs Firefox reverse). */
export function detectRtlHorizontalScrollType(element: HTMLElement): RtlHorizontalScrollType {
  const cached = rtlHorizontalScrollTypeCache.get(element);
  if (cached) {
    return cached;
  }

  if (element.scrollLeft < 0) {
    rtlHorizontalScrollTypeCache.set(element, 'negative');
    return 'negative';
  }

  const { scrollWidth, clientWidth } = element;
  if (scrollWidth <= clientWidth + 1) {
    rtlHorizontalScrollTypeCache.set(element, 'negative');
    return 'negative';
  }

  const initial = element.scrollLeft;
  element.scrollLeft = 1;
  const probe = element.scrollLeft;
  element.scrollLeft = initial;

  let type: RtlHorizontalScrollType;
  if (probe === 0) {
    type = 'negative';
  } else if (probe > 0) {
    type = 'reverse';
  } else {
    type = 'default';
  }
  rtlHorizontalScrollTypeCache.set(element, type);
  return type;
}

/** Logical horizontal scroll offset (0 at start, increases toward far columns). */
export function normalizeAppTableGridHorizontalScrollOffset(element: HTMLElement): number {
  const { scrollLeft, scrollWidth, clientWidth } = element;
  if (getComputedStyle(element).direction !== 'rtl') {
    return Math.max(0, scrollLeft);
  }

  if (scrollLeft < 0) {
    rtlHorizontalScrollTypeCache.set(element, 'negative');
    return Math.abs(scrollLeft);
  }

  const max = Math.max(0, scrollWidth - clientWidth);
  if (max <= 0) {
    return 0;
  }

  switch (detectRtlHorizontalScrollType(element)) {
    case 'negative':
      return Math.abs(scrollLeft);
    case 'reverse':
      return max - scrollLeft;
    default:
      return Math.max(0, scrollLeft);
  }
}

export function applyAppTableGridHorizontalScrollOffset(
  element: HTMLElement,
  normalizedOffset: number,
): void {
  const { scrollWidth, clientWidth } = element;
  const max = Math.max(0, scrollWidth - clientWidth);
  const clamped = Math.max(0, Math.min(max, normalizedOffset));

  if (getComputedStyle(element).direction !== 'rtl') {
    element.scrollLeft = clamped;
    return;
  }

  switch (detectRtlHorizontalScrollType(element)) {
    case 'negative':
      element.scrollLeft = -clamped;
      break;
    case 'reverse':
      element.scrollLeft = max - clamped;
      break;
    default:
      element.scrollLeft = clamped;
  }
}

export function resolveSplitTableHeaderTransform(scrollHost: HTMLElement): string {
  const offset = normalizeAppTableGridHorizontalScrollOffset(scrollHost);
  if (offset === 0) {
    return '';
  }
  const rtl = getComputedStyle(scrollHost).direction === 'rtl';
  // Split header sits outside the scrollport; RTL scrollLeft semantics mirror LTR on the X axis.
  return rtl ? `translateX(${offset}px)` : `translateX(${-offset}px)`;
}

/** Screen X delta is not mirrored; RTL overlay thumbs move on the inline-start edge. */
export function resolveHorizontalThumbDragDelta(
  element: HTMLElement,
  pointerDeltaX: number,
): number {
  return getComputedStyle(element).direction === 'rtl' ? -pointerDeltaX : pointerDeltaX;
}
