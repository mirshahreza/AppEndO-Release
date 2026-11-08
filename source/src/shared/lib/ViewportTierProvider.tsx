import { createContext, useEffect, useState, type ReactNode } from 'react';
import { resolveViewportTier, type ViewportTier } from './viewportTokens';

export const ViewportTierContext = createContext<ViewportTier | null>(null);

function readViewportTier(): ViewportTier {
  if (typeof window === 'undefined') {
    return 'desktop';
  }
  return resolveViewportTier(window.innerWidth);
}

export function ViewportTierProvider({ children }: { children: ReactNode }) {
  const [tier, setTier] = useState<ViewportTier>(readViewportTier);

  useEffect(() => {
    const update = () => {
      setTier(readViewportTier());
    };

    update();
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <ViewportTierContext.Provider value={tier}>
      {children}
    </ViewportTierContext.Provider>
  );
}
