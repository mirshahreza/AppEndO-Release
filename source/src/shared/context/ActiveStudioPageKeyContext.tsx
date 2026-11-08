import React, { createContext, useContext } from 'react';

const ActiveStudioPageKeyContext = createContext<string | null>(null);

export function ActiveStudioPageKeyProvider({
  pageKey,
  children,
}: {
  pageKey: string;
  children: React.ReactNode;
}) {
  return (
    <ActiveStudioPageKeyContext.Provider value={pageKey}>
      {children}
    </ActiveStudioPageKeyContext.Provider>
  );
}

export function useOptionalActiveStudioPageKey(): string | null {
  return useContext(ActiveStudioPageKeyContext);
}
