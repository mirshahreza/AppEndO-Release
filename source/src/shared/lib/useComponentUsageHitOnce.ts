import * as React from 'react';
import type { ComponentUsageHitKind } from '../api/contracts/component-usage/hit';
import { postComponentUsageHit } from '../api/componentUsageHit';

/** One hit per stable `identity` while `enabled` (survives StrictMode remount via ref). */
export function useComponentUsageHitOnce(
  identity: string,
  name: string,
  kind: ComponentUsageHitKind,
  enabled: boolean,
): void {
  const reportedRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!enabled) {
      return;
    }
    const trimmedName = name.trim();
    const trimmedIdentity = identity.trim();
    if (!trimmedName || !trimmedIdentity) {
      return;
    }
    if (reportedRef.current === trimmedIdentity) {
      return;
    }
    reportedRef.current = trimmedIdentity;
    postComponentUsageHit({ name: trimmedName, kind });
  }, [enabled, identity, kind, name]);
}
