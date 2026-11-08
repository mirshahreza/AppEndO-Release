import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const STORAGE_KEY = 'appendo-base-components-properties-docked';

type BaseComponentsPropertiesDockContextValue = {
  docked: boolean;
  setDocked: (docked: boolean) => void;
};

const BaseComponentsPropertiesDockContext = createContext<BaseComponentsPropertiesDockContextValue | null>(null);

function readDockedPreference(): boolean {
  if (typeof sessionStorage === 'undefined') return true;
  try {
    return sessionStorage.getItem(STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

function writeDockedPreference(docked: boolean) {
  try {
    sessionStorage.setItem(STORAGE_KEY, docked ? '1' : '0');
  } catch {
    // Private mode / quota — keep in-memory preference only.
  }
}

export const BaseComponentsPropertiesDockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [docked, setDockedState] = useState(readDockedPreference);
  const setDocked = useCallback((next: boolean) => {
    setDockedState(next);
    writeDockedPreference(next);
  }, []);
  const value = useMemo(() => ({ docked, setDocked }), [docked, setDocked]);

  return (
    <BaseComponentsPropertiesDockContext.Provider value={value}>
      {children}
    </BaseComponentsPropertiesDockContext.Provider>
  );
};

export function useBaseComponentsPropertiesDock(): BaseComponentsPropertiesDockContextValue {
  const context = useContext(BaseComponentsPropertiesDockContext);
  const [localDocked, setLocalDocked] = useState(true);

  if (context) return context;
  return { docked: localDocked, setDocked: setLocalDocked };
}
