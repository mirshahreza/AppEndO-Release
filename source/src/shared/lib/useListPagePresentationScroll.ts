import type { UIEvent } from 'react';

type PresentationScroll = {
  handleScrollEnd: (event: UIEvent<HTMLDivElement>) => void;
};

/** Optional `ListPageShell` `onGridScroll` — infinite/paging scroll only (toolbar collapse is in the shell). */
export function useListPagePresentationScroll(
  presentation: PresentationScroll | null | undefined,
): ((event: UIEvent<HTMLDivElement>) => void) | undefined {
  if (!presentation) {
    return undefined;
  }
  return presentation.handleScrollEnd;
}
