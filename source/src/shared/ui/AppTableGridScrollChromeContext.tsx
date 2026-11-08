import React, { createContext, useContext } from 'react';

export type AppTableGridScrollChromeContextValue = {
  /** Extra inline padding on the last column (overlay scrollbar clearance). */
  lastColumnOverlayInset: boolean;
};

const AppTableGridScrollChromeContext = createContext<AppTableGridScrollChromeContextValue>({
  lastColumnOverlayInset: false,
});

export function AppTableGridScrollChromeProvider({
  lastColumnOverlayInset,
  children,
}: {
  lastColumnOverlayInset: boolean;
  children: React.ReactNode;
}) {
  return (
    <AppTableGridScrollChromeContext.Provider value={{ lastColumnOverlayInset }}>
      {children}
    </AppTableGridScrollChromeContext.Provider>
  );
}

export function useAppTableGridScrollChrome(): AppTableGridScrollChromeContextValue {
  return useContext(AppTableGridScrollChromeContext);
}
