import { useCallback, type UIEvent, type UIEventHandler } from 'react';
import { useListPageToolbarScrollContext } from '../ui/list-page/ListPageToolbarScrollContext';

/** Merges optional page `onScroll` with list-page toolbar collapse scroll from context. */
export function useComposeListPageGridScroll(
  onScroll?: UIEventHandler<HTMLDivElement>,
): UIEventHandler<HTMLDivElement> | undefined {
  const listScroll = useListPageToolbarScrollContext();

  const composed = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      listScroll?.handleGridScroll(event);
      onScroll?.(event);
    },
    [listScroll, onScroll],
  );

  if (!listScroll && !onScroll) {
    return undefined;
  }

  return composed;
}
