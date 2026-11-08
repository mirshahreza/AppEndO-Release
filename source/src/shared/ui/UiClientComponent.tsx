import React from 'react';
import {
  clientComponentMeetsMinViewport,
  resolveClientComponentViewportPolicy,
  type ClientComponentBelowMin,
  type ClientComponentMinViewport,
} from '../lib/clientComponentViewport';
import { useViewportTier } from '../lib/useViewportTier';
import { ViewportUnavailablePanel } from './ViewportUnavailablePanel';

export type UiClientComponentProps = {
  /** Smallest viewport that keeps the full component. Omit or `always` to show at every size. */
  minViewport?: ClientComponentMinViewport | 'always' | 'phone' | '';
  /**
   * What to do when the live viewport is below `minViewport`.
   * `continue` still renders children so the component can adapt its own layout.
   */
  belowMin?: ClientComponentBelowMin;
  title?: string;
  message?: string;
  unavailableAction?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
};

export const UiClientComponent: React.FC<UiClientComponentProps> = ({
  minViewport,
  belowMin,
  title,
  message,
  unavailableAction,
  className,
  children,
}) => {
  const tier = useViewportTier();
  const policy = resolveClientComponentViewportPolicy({ minViewport, belowMin });
  const meets = clientComponentMeetsMinViewport(tier, policy.minViewport);

  if (meets || policy.belowMin === 'continue') {
    return <>{children}</>;
  }

  if (policy.belowMin === 'hide') {
    return null;
  }

  return (
    <ViewportUnavailablePanel
      title={title}
      message={message}
      action={unavailableAction}
      className={className}
    />
  );
};
