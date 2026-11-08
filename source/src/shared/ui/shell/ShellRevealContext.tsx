import React, { createContext, useContext } from 'react';

export type ShellRevealContextValue = {
  /** False while the shell chrome cover is still up (first surface reveal). */
  surfaceReady: boolean;
};

const ShellRevealContext = createContext<ShellRevealContextValue>({ surfaceReady: true });

export const ShellRevealProvider: React.FC<{
  surfaceReady: boolean;
  children: React.ReactNode;
}> = ({ surfaceReady, children }) => (
  <ShellRevealContext.Provider value={{ surfaceReady }}>{children}</ShellRevealContext.Provider>
);

export function useShellReveal(): ShellRevealContextValue {
  return useContext(ShellRevealContext);
}
