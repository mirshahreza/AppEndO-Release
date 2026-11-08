import React, { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';

type BaseComponentsPageHeaderContextValue = {
  actions: React.ReactNode;
  setActions: (actions: React.ReactNode) => void;
};

const BaseComponentsPageHeaderContext = createContext<BaseComponentsPageHeaderContextValue | null>(null);

export const BaseComponentsPageHeaderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [actions, setActionsState] = useState<React.ReactNode>(null);
  const setActions = useCallback((next: React.ReactNode) => {
    setActionsState(next);
  }, []);

  const value = useMemo(
    () => ({ actions, setActions }),
    [actions, setActions],
  );

  return (
    <BaseComponentsPageHeaderContext.Provider value={value}>
      {children}
    </BaseComponentsPageHeaderContext.Provider>
  );
};

export function useBaseComponentsPageHeader(): BaseComponentsPageHeaderContextValue {
  const context = useContext(BaseComponentsPageHeaderContext);
  if (!context) {
    throw new Error('useBaseComponentsPageHeader must be used within BaseComponentsPageHeaderProvider');
  }
  return context;
}

type BaseComponentsHeaderActionsProps = {
  children: React.ReactNode;
};

export const BaseComponentsHeaderActions: React.FC<BaseComponentsHeaderActionsProps> = ({ children }) => {
  const { setActions } = useBaseComponentsPageHeader();

  useLayoutEffect(() => {
    setActions(children);
    return () => setActions(null);
  }, [children, setActions]);

  return null;
};
