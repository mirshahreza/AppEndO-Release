import React, { createContext, useContext, useMemo } from 'react';
import type { EuaContextNeighborField } from '../../api/contracts/ai/euaFieldAssist';

export type AiFieldAssistSectionContextValue = {
  sectionTitle?: string;
  sectionDescription?: string;
  neighborFields?: EuaContextNeighborField[];
};

const AiFieldAssistSectionContext = createContext<AiFieldAssistSectionContextValue | null>(null);

export type AiFieldAssistSectionProviderProps = {
  sectionTitle?: string;
  sectionDescription?: string;
  neighborFields?: EuaContextNeighborField[];
  children: React.ReactNode;
};

export const AiFieldAssistSectionProvider: React.FC<AiFieldAssistSectionProviderProps> = ({
  sectionTitle,
  sectionDescription,
  neighborFields,
  children,
}) => {
  const value = useMemo(
    () => ({ sectionTitle, sectionDescription, neighborFields }),
    [neighborFields, sectionDescription, sectionTitle],
  );

  return (
    <AiFieldAssistSectionContext.Provider value={value}>
      {children}
    </AiFieldAssistSectionContext.Provider>
  );
};

export function useAiFieldAssistSectionContext(): AiFieldAssistSectionContextValue {
  return useContext(AiFieldAssistSectionContext) ?? {};
}
