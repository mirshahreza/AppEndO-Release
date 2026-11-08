import React, { createContext, useContext } from 'react';

export type StudioPageToolsContextValue = {
  pageKey: string | null;
  pageTitle: string;
};

const StudioPageToolsContext = createContext<StudioPageToolsContextValue | null>(null);

export type StudioPageToolsProviderProps = {
  pageKey: string | null | undefined;
  pageTitle: string;
  children: React.ReactNode;
};

export function StudioPageToolsProvider({
  pageKey,
  pageTitle,
  children,
}: StudioPageToolsProviderProps): React.ReactElement {
  const value = React.useMemo(
    () => ({
      pageKey: pageKey?.trim() ? pageKey.trim() : null,
      pageTitle: pageTitle.trim() || 'Page',
    }),
    [pageKey, pageTitle],
  );
  return (
    <StudioPageToolsContext.Provider value={value}>
      {children}
    </StudioPageToolsContext.Provider>
  );
}

export function useOptionalStudioPageTools(): StudioPageToolsContextValue | null {
  return useContext(StudioPageToolsContext);
}
