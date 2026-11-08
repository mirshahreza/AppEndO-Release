import React, { useEffect } from 'react';
import type { EuaAssistSurface } from '../../api/contracts/ai/euaFieldAssist';
import { useAuth } from '../../../contexts/AuthContext';
import { ensureEuaStatusLoaded } from './euaStatusCache';

export type AiFieldAssistProviderProps = {
  children: React.ReactNode;
  defaultSurface?: EuaAssistSurface;
};

/** Warms EUA status cache for authenticated sessions. */
export const AiFieldAssistProvider: React.FC<AiFieldAssistProviderProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading || !isAuthenticated) {
      return;
    }

    void ensureEuaStatusLoaded();
  }, [isAuthenticated, isLoading]);

  return <>{children}</>;
};
