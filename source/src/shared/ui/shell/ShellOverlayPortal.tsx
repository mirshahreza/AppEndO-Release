import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Renders overlay chrome on `document.body` so shell overflow/transform cannot clip it. */
export function ShellOverlayPortal({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  if (!active) {
    return <>{children}</>;
  }
  if (typeof document === 'undefined') {
    return null;
  }
  return createPortal(children, document.body);
}
