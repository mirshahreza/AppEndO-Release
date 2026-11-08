/** Shared contract for list-page toolbar hide/show while the grid scrolls (all list/CRUD pages). */

/** Desktop single-row toolbar height (`lg:h-14` / `index.css` lock). */
export const LIST_PAGE_TOOLBAR_EXPANDED_HEIGHT_PX = 56;

/** Near-top scroll offset — toolbar always expanded at or above this `scrollTop`. */
export const LIST_PAGE_TOOLBAR_TOP_REVEAL_PX = 24;

/**
 * After collapse/expand, ignore opposite-direction scroll deltas caused by layout
 * (grid client resize + browser scrollTop clamp / scroll anchoring).
 */
export const LIST_PAGE_TOOLBAR_LAYOUT_SETTLE_MS = 380;

/** Collapse / expand motion — pair with `index.css` `.list-page-toolbar-scroll-host`. */
export const LIST_PAGE_TOOLBAR_COLLAPSE_MOTION_MS = 360;

/** Host grid row animation (see `ListPageToolbarScrollHost`). */
export const LIST_PAGE_TOOLBAR_SCROLL_HOST_CLASS = 'list-page-toolbar-scroll-host shrink-0';
