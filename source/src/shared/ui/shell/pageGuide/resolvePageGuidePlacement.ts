import {
  PAGE_GUIDE_ANCHOR_SIZE_PX,
  PAGE_GUIDE_BUBBLE_HEAD_GAP_PX,
  PAGE_GUIDE_COMPANION_HEIGHT_PX,
  PAGE_GUIDE_COMPANION_WIDTH_PX,
  PAGE_GUIDE_HOLE_PAD_PX,
  PAGE_GUIDE_HOTSPOT_CLEAR_PX,
  PAGE_GUIDE_MAX_HOLE_HEIGHT_PX,
  PAGE_GUIDE_MAX_HOLE_WIDTH_PX,
  PAGE_GUIDE_VIEWPORT_MARGIN_PX,
  type PageGuidePoint,
  type PageGuideRect,
} from './pageGuide.types';

const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, value))
);

export const padPageGuideRect = (rect: DOMRect | PageGuideRect, pad = PAGE_GUIDE_HOLE_PAD_PX): PageGuideRect => ({
  x: rect.x - pad,
  y: rect.y - pad,
  width: rect.width + pad * 2,
  height: rect.height + pad * 2,
});

export const clampPageGuideRect = (
  rect: PageGuideRect,
  viewportWidth: number,
  viewportHeight: number,
  margin = PAGE_GUIDE_VIEWPORT_MARGIN_PX,
): PageGuideRect => {
  const width = Math.min(rect.width, Math.max(8, viewportWidth - margin * 2));
  const height = Math.min(rect.height, Math.max(8, viewportHeight - margin * 2));
  return {
    x: clamp(rect.x, margin, viewportWidth - width - margin),
    y: clamp(rect.y, margin, viewportHeight - height - margin),
    width,
    height,
  };
};

/** Tiny point around an element's center — the tour marks a dot, not a box. */
export const pointPageGuideAnchor = (rect: DOMRect | PageGuideRect): PageGuideRect => ({
  x: rect.x + rect.width / 2 - PAGE_GUIDE_ANCHOR_SIZE_PX / 2,
  y: rect.y + rect.height / 2 - PAGE_GUIDE_ANCHOR_SIZE_PX / 2,
  width: PAGE_GUIDE_ANCHOR_SIZE_PX,
  height: PAGE_GUIDE_ANCHOR_SIZE_PX,
});

/** Keep the spotlight on a compact window — never a full rail or page. */
export const fitPageGuideHole = (
  rect: DOMRect | PageGuideRect,
  viewportWidth: number,
  viewportHeight: number,
): PageGuideRect => {
  const padded = padPageGuideRect(rect);
  const maxWidth = Math.min(PAGE_GUIDE_MAX_HOLE_WIDTH_PX, viewportWidth * 0.72);
  const maxHeight = Math.min(PAGE_GUIDE_MAX_HOLE_HEIGHT_PX, viewportHeight * 0.42);
  const isStrip = padded.height <= 96;
  let { x, y, width, height } = padded;
  if (!isStrip && width > maxWidth) {
    x += (width - maxWidth) / 2;
    width = maxWidth;
  }
  if (height > maxHeight) {
    y += (height - maxHeight) / 2;
    height = maxHeight;
  }
  return clampPageGuideRect({ x, y, width, height }, viewportWidth, viewportHeight);
};

export type PageGuideSpeechCluster = {
  companion: PageGuidePoint;
  bubble: PageGuidePoint;
  tailOffset: number;
};

export const pageGuideRectsOverlap = (left: PageGuideRect, right: PageGuideRect): boolean => (
  left.x < right.x + right.width
  && left.x + left.width > right.x
  && left.y < right.y + right.height
  && left.y + left.height > right.y
);

const withPad = (rect: PageGuideRect, pad: number): PageGuideRect => ({
  x: rect.x - pad,
  y: rect.y - pad,
  width: rect.width + pad * 2,
  height: rect.height + pad * 2,
});

/** True when the speech card or character would hide the hotspot dot. */
export const pageGuideClusterCoversHole = (
  cluster: PageGuideSpeechCluster,
  hole: PageGuideRect,
  bubbleWidth: number,
  bubbleHeight: number,
  clearPad = PAGE_GUIDE_HOTSPOT_CLEAR_PX,
): boolean => {
  const keep = withPad(hole, clearPad);
  return pageGuideRectsOverlap(keep, {
    x: cluster.bubble.x,
    y: cluster.bubble.y,
    width: bubbleWidth,
    height: bubbleHeight,
  }) || pageGuideRectsOverlap(keep, {
    x: cluster.companion.x,
    y: cluster.companion.y,
    width: PAGE_GUIDE_COMPANION_WIDTH_PX,
    height: PAGE_GUIDE_COMPANION_HEIGHT_PX,
  });
};

const clusterFitsViewport = (
  cluster: PageGuideSpeechCluster,
  bubbleHeight: number,
  viewportHeight: number,
  margin: number,
): boolean => (
  cluster.bubble.y >= margin
  && cluster.companion.y + PAGE_GUIDE_COMPANION_HEIGHT_PX <= viewportHeight - margin
  && cluster.companion.y >= cluster.bubble.y + bubbleHeight + PAGE_GUIDE_BUBBLE_HEAD_GAP_PX
);

export const stackPageGuideBubbleAboveHead = (
  companion: PageGuidePoint,
  bubbleWidth: number,
  bubbleHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): PageGuideSpeechCluster => {
  const margin = PAGE_GUIDE_VIEWPORT_MARGIN_PX;
  const maxCompanionX = viewportWidth - PAGE_GUIDE_COMPANION_WIDTH_PX - margin;
  const maxBubbleX = viewportWidth - bubbleWidth - margin;
  let companionX = clamp(companion.x, margin, Math.max(margin, maxCompanionX));
  let companionY = companion.y;
  let bubbleX = clamp(companionX + 6, margin, Math.max(margin, maxBubbleX));
  let bubbleY = companionY - bubbleHeight - PAGE_GUIDE_BUBBLE_HEAD_GAP_PX;

  if (bubbleY < margin) {
    companionY += margin - bubbleY;
    bubbleY = margin;
  }

  // Never slide the character under the bubble. Clip the feet before covering the head.
  companionY = Math.max(companionY, bubbleY + bubbleHeight + PAGE_GUIDE_BUBBLE_HEAD_GAP_PX);

  const overflow = companionY + PAGE_GUIDE_COMPANION_HEIGHT_PX - (viewportHeight - margin);
  if (overflow > 0 && bubbleY - overflow >= margin) {
    bubbleY -= overflow;
    companionY -= overflow;
  }

  companionX = clamp(companionX, margin, Math.max(margin, maxCompanionX));
  bubbleX = clamp(bubbleX, margin, Math.max(margin, maxBubbleX));
  const headCenterX = companionX + PAGE_GUIDE_COMPANION_WIDTH_PX / 2;
  const tailOffset = clamp(headCenterX - bubbleX - 6, 16, Math.max(16, bubbleWidth - 28));

  return {
    companion: { x: companionX, y: companionY },
    bubble: { x: bubbleX, y: bubbleY },
    tailOffset,
  };
};

const slideClusterBelowHole = (
  cluster: PageGuideSpeechCluster,
  hole: PageGuideRect,
  bubbleWidth: number,
  bubbleHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): PageGuideSpeechCluster => {
  if (!pageGuideClusterCoversHole(cluster, hole, bubbleWidth, bubbleHeight)) {
    return cluster;
  }

  const clearBottom = hole.y + hole.height + PAGE_GUIDE_HOTSPOT_CLEAR_PX;
  const shift = clearBottom - cluster.bubble.y;
  if (shift <= 0) {
    return cluster;
  }

  return stackPageGuideBubbleAboveHead(
    { x: cluster.companion.x, y: cluster.companion.y + shift },
    bubbleWidth,
    bubbleHeight,
    viewportWidth,
    viewportHeight,
  );
};

/**
 * Speech bubble is always above the companion's head. The pair is then parked
 * beside / below / above the spotlight without covering the character.
 */
export const resolvePageGuideSpeechCluster = (
  hole: PageGuideRect,
  bubbleWidth: number,
  bubbleHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  isRtl: boolean,
): PageGuideSpeechCluster => {
  const gap = 16;
  const margin = PAGE_GUIDE_VIEWPORT_MARGIN_PX;
  const midY = hole.y + hole.height / 2 - PAGE_GUIDE_COMPANION_HEIGHT_PX / 2;
  const preferEnd = isRtl
    ? hole.x - PAGE_GUIDE_COMPANION_WIDTH_PX - gap
    : hole.x + hole.width + gap;
  const preferStart = isRtl
    ? hole.x + hole.width + gap
    : hole.x - PAGE_GUIDE_COMPANION_WIDTH_PX - gap;
  const centerX = hole.x + hole.width / 2 - PAGE_GUIDE_COMPANION_WIDTH_PX / 2;
  const stackHeight = bubbleHeight + PAGE_GUIDE_BUBBLE_HEAD_GAP_PX + PAGE_GUIDE_COMPANION_HEIGHT_PX;
  const belowHoleY = hole.y + hole.height + gap + bubbleHeight + PAGE_GUIDE_BUBBLE_HEAD_GAP_PX;
  const wide = hole.width > viewportWidth * 0.5;
  const nearTop = hole.y < viewportHeight * 0.28;
  const aboveY = hole.y - stackHeight - gap + bubbleHeight + PAGE_GUIDE_BUBBLE_HEAD_GAP_PX;

  const sideSeeds: PageGuidePoint[] = [
    { x: preferEnd, y: midY },
    { x: preferStart, y: midY },
  ];
  const belowSeeds: PageGuidePoint[] = [
    { x: centerX, y: belowHoleY },
    { x: preferEnd, y: belowHoleY },
    { x: preferStart, y: belowHoleY },
  ];
  const aboveSeeds: PageGuidePoint[] = [
    { x: centerX, y: aboveY },
    { x: preferEnd, y: aboveY },
  ];
  const seeds: PageGuidePoint[] = nearTop || wide
    ? [...belowSeeds, ...sideSeeds, ...aboveSeeds]
    : [...sideSeeds, ...belowSeeds, ...aboveSeeds];

  const clusters = seeds.map((seed) => (
    slideClusterBelowHole(
      stackPageGuideBubbleAboveHead(seed, bubbleWidth, bubbleHeight, viewportWidth, viewportHeight),
      hole,
      bubbleWidth,
      bubbleHeight,
      viewportWidth,
      viewportHeight,
    )
  ));

  const uncovered = clusters.find((cluster) => (
    clusterFitsViewport(cluster, bubbleHeight, viewportHeight, margin)
    && !pageGuideClusterCoversHole(cluster, hole, bubbleWidth, bubbleHeight)
  ));
  if (uncovered) {
    return uncovered;
  }

  return clusters.find((cluster) => clusterFitsViewport(cluster, bubbleHeight, viewportHeight, margin))
    ?? clusters[0]!;
};

export const resolvePageGuideCompanionPoint = (
  hole: PageGuideRect,
  viewportWidth: number,
  viewportHeight: number,
  isRtl: boolean,
): PageGuidePoint => (
  resolvePageGuideSpeechCluster(hole, 288, 148, viewportWidth, viewportHeight, isRtl).companion
);

/** Park the companion and bubble as one stack in the middle of the viewport. */
export const resolvePageGuideCenterCluster = (
  bubbleWidth: number,
  bubbleHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): PageGuideSpeechCluster => {
  const stackHeight = bubbleHeight + PAGE_GUIDE_BUBBLE_HEAD_GAP_PX + PAGE_GUIDE_COMPANION_HEIGHT_PX;
  const stackTop = (viewportHeight - stackHeight) / 2;
  return stackPageGuideBubbleAboveHead(
    {
      x: viewportWidth / 2 - PAGE_GUIDE_COMPANION_WIDTH_PX / 2,
      y: stackTop + bubbleHeight + PAGE_GUIDE_BUBBLE_HEAD_GAP_PX,
    },
    bubbleWidth,
    bubbleHeight,
    viewportWidth,
    viewportHeight,
  );
};

export const clampPageGuideHotspot = (
  point: PageGuidePoint,
  viewportWidth: number,
  viewportHeight: number,
): PageGuidePoint => ({
  x: clamp(point.x, 18, viewportWidth - 18),
  y: clamp(point.y, 22, viewportHeight - 22),
});
