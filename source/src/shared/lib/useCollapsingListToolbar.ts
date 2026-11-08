import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  LIST_PAGE_TOOLBAR_LAYOUT_SETTLE_MS,
  LIST_PAGE_TOOLBAR_TOP_REVEAL_PX,
} from '../ui/list-page/listPageToolbarScrollChrome';

export { LIST_PAGE_TOOLBAR_EXPANDED_HEIGHT_PX as LIST_PAGE_TOOLBAR_COLLAPSE_HEIGHT_PX } from '../ui/list-page/listPageToolbarScrollChrome';

/**
 * List-page toolbar chrome: hide while scrolling down into the grid, reveal on scroll up
 * (Material 3 collapsing top app bar / iOS Safari pattern). Does not touch admin-shell geometry.
 *
 * Scroll intent: any downward tick collapses (after layout settle); any upward tick reveals.
 * Short settle windows absorb layout-driven scrollTop jumps — see ui-responsive.md §List page scroll chrome.
 */
export function useCollapsingListToolbar() {
  const [collapsed, setCollapsed] = useState(false);
  const lastScrollTopRef = useRef(0);
  const scrollElRef = useRef<HTMLDivElement | null>(null);
  /** Ignore upward deltas right after collapse (browser scrollTop clamp). */
  const suppressRevealUntilRef = useRef(0);
  /** Ignore downward deltas right after expand (layout / scroll anchoring). */
  const suppressCollapseUntilRef = useRef(0);

  useLayoutEffect(() => {
    const el = scrollElRef.current;
    if (el) {
      lastScrollTopRef.current = el.scrollTop;
    }
  }, [collapsed]);

  const onListBodyScroll = useCallback((scrollTop: number, scrollEl?: HTMLDivElement | null) => {
    if (scrollEl) {
      scrollElRef.current = scrollEl;
    }

    const now = performance.now();
    const last = lastScrollTopRef.current;
    const delta = scrollTop - last;

    if (scrollTop <= LIST_PAGE_TOOLBAR_TOP_REVEAL_PX) {
      lastScrollTopRef.current = scrollTop;
      suppressCollapseUntilRef.current = now + LIST_PAGE_TOOLBAR_LAYOUT_SETTLE_MS;
      setCollapsed(false);
      return;
    }

    if (delta < 0) {
      if (now < suppressRevealUntilRef.current) {
        lastScrollTopRef.current = scrollTop;
        return;
      }
      lastScrollTopRef.current = scrollTop;
      suppressCollapseUntilRef.current = now + LIST_PAGE_TOOLBAR_LAYOUT_SETTLE_MS;
      setCollapsed(false);
      return;
    }

    if (delta > 0) {
      if (now < suppressCollapseUntilRef.current) {
        lastScrollTopRef.current = scrollTop;
        return;
      }
      lastScrollTopRef.current = scrollTop;
      suppressRevealUntilRef.current = now + LIST_PAGE_TOOLBAR_LAYOUT_SETTLE_MS;
      setCollapsed(true);
      return;
    }

    lastScrollTopRef.current = scrollTop;
  }, []);

  return { listToolbarCollapsed: collapsed, onListBodyScroll };
}
