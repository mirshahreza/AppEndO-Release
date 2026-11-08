import React, { createContext, useContext } from 'react';
import type { ResolvedPortalPath } from './PortalUrlResolver';

export type PortalContextValue = ResolvedPortalPath;

const PortalContext = createContext<PortalContextValue | null>(null);

export type PortalContextProviderProps = {
  value: PortalContextValue;
  children: React.ReactNode;
};

export const PortalContextProvider: React.FC<PortalContextProviderProps> = ({
  value,
  children,
}) => (
  <PortalContext.Provider value={value}>
    {children}
  </PortalContext.Provider>
);

export function useOptionalPortal(): PortalContextValue | null {
  return useContext(PortalContext);
}

export function usePortal(): PortalContextValue {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error('usePortal must be used within PortalHost.');
  }

  return context;
}
