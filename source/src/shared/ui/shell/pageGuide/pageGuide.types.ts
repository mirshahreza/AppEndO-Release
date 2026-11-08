export type PageGuidePoint = {
  x: number;
  y: number;
};

export type PageGuideRect = PageGuidePoint & {
  width: number;
  height: number;
};

export type PageGuideTopic = 'page' | 'navigation' | 'capabilities';

export const PAGE_GUIDE_TOPICS: readonly PageGuideTopic[] = [
  'page',
  'navigation',
  'capabilities',
];

export type PageGuideStop = {
  id: string;
  title: string;
  hint: string;
  priority: number;
  scope: 'chrome' | 'local';
  topic: PageGuideTopic;
  element: HTMLElement;
};

export const PAGE_GUIDE_COMPANION_WIDTH_PX = 112;
export const PAGE_GUIDE_COMPANION_HEIGHT_PX = 128;
export const PAGE_GUIDE_HOLE_PAD_PX = 10;
export const PAGE_GUIDE_MAX_HOLE_WIDTH_PX = 520;
export const PAGE_GUIDE_MAX_HOLE_HEIGHT_PX = 240;
export const PAGE_GUIDE_ANCHOR_SIZE_PX = 16;
export const PAGE_GUIDE_VIEWPORT_MARGIN_PX = 12;
export const PAGE_GUIDE_BUBBLE_HEAD_GAP_PX = 6;
/** Keep this much air around the hotspot so the bubble cannot sit on the dot. */
export const PAGE_GUIDE_HOTSPOT_CLEAR_PX = 14;
export const PAGE_GUIDE_TRAVEL_MS = 720;
export const PAGE_GUIDE_ARC_MAX_PX = 96;
export const PAGE_GUIDE_AUTOPLAY_MS = 8_000;
