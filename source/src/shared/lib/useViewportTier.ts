import { useContext, useEffect, useState } from 'react';
import { ViewportTierContext } from './ViewportTierProvider';
import { resolveViewportTier, type ViewportTier } from './viewportTokens';

function readViewportTier(): ViewportTier {
  if (typeof window === 'undefined') {
    return 'desktop';
  }
  return resolveViewportTier(window.innerWidth);
}

export { ViewportTierProvider } from './ViewportTierProvider';

export function useViewportTier(): ViewportTier {
  const fromProvider = useContext(ViewportTierContext);
  const [fallbackTier, setFallbackTier] = useState<ViewportTier>(readViewportTier);

  useEffect(() => {
    if (fromProvider !== null) {
      return;
    }

    const update = () => {
      setFallbackTier(readViewportTier());
    };

    update();
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
    };
  }, [fromProvider]);

  return fromProvider ?? fallbackTier;
}
