import React, { Suspense, lazy, useEffect, useId, useState } from 'react';
import type { AiPageContext } from '../shared/api/contracts/ai/pageContext';
import { claimAppEndooHost, releaseAppEndooHost } from '../shared/ui/shell/appendooHostRegistry';

export type LazyAppEndooPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  pageContext?: AiPageContext;
  /** Higher priority wins when multiple hosts mount (global host uses 100). */
  hostPriority?: number;
};

const AppEndooPanelLazy = lazy(async () => {
  const module = await import('./AppEndooPanel');
  return { default: module.AppEndooPanel };
});

export const LazyAppEndooPanel = ({
  isOpen,
  onClose,
  pageContext,
  hostPriority = 0,
}: LazyAppEndooPanelProps) => {
  const hostId = useId();
  const [isHostOwner, setIsHostOwner] = useState(false);

  useEffect(() => {
    const ownsHost = claimAppEndooHost(hostId, hostPriority);
    setIsHostOwner(ownsHost);
    return () => {
      releaseAppEndooHost(hostId);
      setIsHostOwner(false);
    };
  }, [hostId, hostPriority]);

  if (!isHostOwner || !isOpen) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <AppEndooPanelLazy isOpen={isOpen} onClose={onClose} pageContext={pageContext} />
    </Suspense>
  );
};
