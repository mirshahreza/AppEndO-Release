import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setInlineTranslationCaptureActive } from '../../../core/culture/inlineTranslationCapture';
import { useStudioToolsGate } from '../hooks/useStudioToolsGate';
import { InlineTranslationOverlay } from './InlineTranslationOverlay';
import { clearLegacyInlineTranslationSessionFlags } from './inlineTranslationSession';

type InlineTranslationContextValue = {
  active: boolean;
  setActive: (value: boolean) => void;
  toggle: () => void;
};

const InlineTranslationContext = createContext<InlineTranslationContextValue | null>(null);

export const InlineTranslationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const gate = useStudioToolsGate();
  const [active, setActiveState] = useState(false);

  useEffect(() => {
    clearLegacyInlineTranslationSessionFlags();
    setInlineTranslationCaptureActive(false);
  }, []);

  const setActive = useCallback((value: boolean) => {
    if (!gate) {
      setActiveState(false);
      setInlineTranslationCaptureActive(false);
      return;
    }
    setActiveState(value);
    setInlineTranslationCaptureActive(value);
  }, [gate]);

  const toggle = useCallback(() => {
    setActive(!active);
  }, [active, setActive]);

  useEffect(() => {
    if (!gate) {
      setActiveState(false);
      setInlineTranslationCaptureActive(false);
    }
  }, [gate]);

  useEffect(() => () => {
    setInlineTranslationCaptureActive(false);
  }, []);

  const value = useMemo(
    () => ({
      active: gate && active,
      setActive,
      toggle,
    }),
    [active, gate, setActive, toggle],
  );

  return (
    <InlineTranslationContext.Provider value={value}>
      {children}
      {gate && value.active ? (
        <InlineTranslationOverlay
          active
          onFinish={() => setActive(false)}
        />
      ) : null}
    </InlineTranslationContext.Provider>
  );
};

export function useInlineTranslation(): InlineTranslationContextValue {
  const context = useContext(InlineTranslationContext);
  if (!context) {
    throw new Error('useInlineTranslation must be used within InlineTranslationProvider.');
  }
  return context;
}

export function useOptionalInlineTranslation(): InlineTranslationContextValue | null {
  return useContext(InlineTranslationContext);
}
