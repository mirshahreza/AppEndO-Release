import { useCallback, type UIEvent } from 'react';
import { useCollapsingListToolbar } from './useCollapsingListToolbar';

/** Used by `ListPageShell` provider only — features must not call this directly. */
export function useListPageToolbarScroll(
  onScroll?: (event: UIEvent<HTMLDivElement>) => void,
) {
  const { listToolbarCollapsed, onListBodyScroll } = useCollapsingListToolbar();

  const handleGridScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    onListBodyScroll(event.currentTarget.scrollTop, event.currentTarget);
    onScroll?.(event);
  }, [onListBodyScroll, onScroll]);

  return { listToolbarCollapsed, handleGridScroll };
}
