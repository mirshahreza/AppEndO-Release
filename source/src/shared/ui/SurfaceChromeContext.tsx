import React, { createContext, useContext, useMemo } from 'react';
import {
  resolveSurfaceChrome,
  type SurfaceChromeOptions,
  type SurfaceChromeTokens,
} from './surfaceChromeClasses';

const SurfaceChromeContext = createContext<SurfaceChromeTokens | null>(null);

export type SurfaceChromeProviderProps = SurfaceChromeOptions & {
  children: React.ReactNode;
};

export const SurfaceChromeProvider: React.FC<SurfaceChromeProviderProps> = ({
  colorSource,
  tone,
  customColorHex,
  children,
}) => {
  const chrome = useMemo(
    () => resolveSurfaceChrome({ colorSource, tone, customColorHex }),
    [colorSource, customColorHex, tone],
  );

  return (
    <SurfaceChromeContext.Provider value={chrome}>
      {children}
    </SurfaceChromeContext.Provider>
  );
};

export function useSurfaceChrome(): SurfaceChromeTokens {
  return useContext(SurfaceChromeContext) ?? resolveSurfaceChrome();
}

export type SurfaceChromeProps = SurfaceChromeOptions;
