import React, { createContext, useCallback, useContext, useMemo } from 'react';
import type { SessionContextMap } from '../shared/api/contracts/attributes/types';

export type ClientContextValue = {
  clientContext: SessionContextMap;
  patchClientContext: (patch: SessionContextMap) => void;
};

const ClientContextContext = createContext<ClientContextValue | null>(null);

export const ClientContextProvider = ({
  clientContext,
  patchClientContext,
  children,
}: ClientContextValue & { children: React.ReactNode }) => {
  const value = useMemo(
    () => ({ clientContext, patchClientContext }),
    [clientContext, patchClientContext],
  );

  return (
    <ClientContextContext.Provider value={value}>
      {children}
    </ClientContextContext.Provider>
  );
};

export const useClientContext = (): ClientContextValue => {
  const context = useContext(ClientContextContext);
  if (!context) {
    throw new Error('useClientContext must be used within AuthProvider.');
  }
  return context;
};

export const useOptionalClientContext = (): ClientContextValue | null =>
  useContext(ClientContextContext);

export const usePatchClientContext = (): ((patch: SessionContextMap) => void) => {
  const context = useContext(ClientContextContext);
  return useCallback(
    (patch: SessionContextMap) => {
      context?.patchClientContext(patch);
    },
    [context],
  );
};
