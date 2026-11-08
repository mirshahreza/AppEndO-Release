import React, { useEffect } from 'react';
import { setPageLoadProfilePageKey } from '../../../shared/lib/pageLoadProfile/store';
import { useStudioToolsGate } from '../hooks/useStudioToolsGate';

export const PageLoadProfilePageKeyBridge: React.FC<{ pageKey?: string | null }> = ({ pageKey }) => {
  const gate = useStudioToolsGate();
  useEffect(() => {
    if (!gate) {
      return;
    }
    setPageLoadProfilePageKey(pageKey ?? null);
  }, [gate, pageKey]);
  return null;
};
