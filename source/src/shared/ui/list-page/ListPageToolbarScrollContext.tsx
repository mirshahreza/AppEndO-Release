import React, { createContext, useContext, type UIEvent } from 'react';
import { useListPageToolbarScroll } from '../../lib/useListPageToolbarScroll';

export type ListPageToolbarScrollContextValue = {
  listToolbarCollapsed: boolean;
  handleGridScroll: (event: UIEvent<HTMLDivElement>) => void;
};

const ListPageToolbarScrollContext = createContext<ListPageToolbarScrollContextValue | null>(null);

export type ListPageToolbarScrollProviderProps = {
  children: React.ReactNode;
  /** Optional extra scroll handler (infinite load, presentation.handleScrollEnd, …). */
  onGridScroll?: (event: UIEvent<HTMLDivElement>) => void;
};

/** Wires collapsing toolbar state once per full-height list page. */
export function ListPageToolbarScrollProvider({
  children,
  onGridScroll,
}: ListPageToolbarScrollProviderProps) {
  const scroll = useListPageToolbarScroll(onGridScroll);
  return (
    <ListPageToolbarScrollContext.Provider value={scroll}>
      {children}
    </ListPageToolbarScrollContext.Provider>
  );
}

export function useListPageToolbarScrollContext(): ListPageToolbarScrollContextValue | null {
  return useContext(ListPageToolbarScrollContext);
}

