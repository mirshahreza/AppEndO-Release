export const APP_TABLE_GRID_OVERLAY_SCROLLBAR_SIZE_PX = 7;
export const APP_TABLE_GRID_OVERLAY_SCROLLBAR_MIN_THUMB_PX = 20;

export type OverlayScrollbarAxisMetrics = {
  visible: boolean;
  thumbSize: number;
  thumbOffset: number;
};

export function computeOverlayScrollbarAxisMetrics(
  scrollSize: number,
  clientSize: number,
  scrollOffset: number,
  minThumbPx = APP_TABLE_GRID_OVERLAY_SCROLLBAR_MIN_THUMB_PX,
): OverlayScrollbarAxisMetrics {
  if (!Number.isFinite(scrollSize) || !Number.isFinite(clientSize) || clientSize <= 0) {
    return { visible: false, thumbSize: 0, thumbOffset: 0 };
  }
  if (scrollSize <= clientSize + 1) {
    return { visible: false, thumbSize: 0, thumbOffset: 0 };
  }
  const thumbSize = Math.max(minThumbPx, (clientSize / scrollSize) * clientSize);
  const maxThumbOffset = Math.max(0, clientSize - thumbSize);
  const scrollRange = scrollSize - clientSize;
  const thumbOffset = scrollRange > 0
    ? (scrollOffset / scrollRange) * maxThumbOffset
    : 0;
  return {
    visible: true,
    thumbSize,
    thumbOffset,
  };
}

export function scrollOffsetFromThumbDrag(
  pointerDelta: number,
  trackSize: number,
  thumbSize: number,
  scrollSize: number,
  clientSize: number,
  startScrollOffset: number,
): number {
  const scrollRange = scrollSize - clientSize;
  const thumbTrack = Math.max(1, trackSize - thumbSize);
  if (scrollRange <= 0 || thumbTrack <= 0) {
    return startScrollOffset;
  }
  return startScrollOffset + (pointerDelta / thumbTrack) * scrollRange;
}
