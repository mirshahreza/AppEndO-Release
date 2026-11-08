import React, { createContext, useContext } from 'react';
import { useOptionalCulture } from '../../core/culture/CultureContext';

const AppTableGridCultureDirectionContext = createContext<'ltr' | 'rtl'>('ltr');

export function resolveFallbackGridCultureDirection(): 'ltr' | 'rtl' {
  if (typeof document === 'undefined') {
    return 'ltr';
  }
  const htmlDir = document.documentElement.getAttribute('dir');
  return htmlDir === 'rtl' ? 'rtl' : 'ltr';
}

/**
 * Grid header/body `dir` must match `document.documentElement` (CultureProvider sets it).
 * When React context and `<html dir>` disagree — e.g. package UI on a separate module graph —
 * prefer the document so split headers and inner column grids stay aligned in RTL.
 */
export function resolveAppTableGridCultureDirection(culture: ReturnType<typeof useOptionalCulture>): 'ltr' | 'rtl' {
  const htmlDirection = resolveFallbackGridCultureDirection();
  const cultureDirection = culture?.direction;
  if (cultureDirection && cultureDirection !== htmlDirection) {
    return htmlDirection;
  }
  return cultureDirection ?? htmlDirection;
}

export function AppTableGridCultureDirectionProvider({ children }: { children: React.ReactNode }) {
  const culture = useOptionalCulture();
  const cultureDirection = resolveAppTableGridCultureDirection(culture);
  return (
    <AppTableGridCultureDirectionContext.Provider value={cultureDirection}>
      {children}
    </AppTableGridCultureDirectionContext.Provider>
  );
}

export function useAppTableGridCultureDirection(): 'ltr' | 'rtl' {
  return useContext(AppTableGridCultureDirectionContext);
}
