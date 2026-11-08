import React from 'react';
import type { PlatformRouteBinding } from '../../shared/api/contracts/platform/types';
import { cn } from '../../lib/utils';
import { DynamicOutlet } from './DynamicOutlet';

export type CmsSettingsKeepAliveOutletProps = {
  activeBinding: PlatformRouteBinding;
};

/**
 * Keeps visited CMS Settings section pages mounted (hidden) so left-rail
 * switches reuse the same React trees instead of a full Designer remount.
 * Parent should only render this while the location stays in the settings family.
 */
export const CmsSettingsKeepAliveOutlet: React.FC<CmsSettingsKeepAliveOutletProps> = ({
  activeBinding,
}) => {
  const [cache, setCache] = React.useState<Map<string, PlatformRouteBinding>>(
    () => new Map([[activeBinding.id, activeBinding]]),
  );
  const [refreshNonce, setRefreshNonce] = React.useState(0);

  React.useEffect(() => {
    setRefreshNonce((value) => value + 1);
  }, [activeBinding.id]);

  React.useEffect(() => {
    setCache((prev) => {
      const existing = prev.get(activeBinding.id);
      if (existing === activeBinding) {
        return prev;
      }
      const next = new Map(prev);
      next.set(activeBinding.id, activeBinding);
      return next;
    });
  }, [activeBinding]);

  const entries = React.useMemo(() => [...cache.values()], [cache]);

  return (
    <div
      className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden"
      data-testid="cms-settings-keep-alive"
    >
      {entries.map((binding) => {
        const active = binding.id === activeBinding.id;
        return (
          <div
            key={binding.id}
            className={cn(
              'flex h-full min-h-0 flex-1 flex-col overflow-hidden',
              active ? undefined : 'hidden',
            )}
            aria-hidden={active ? undefined : true}
            data-cms-settings-pane={binding.pageKey}
            data-active={active ? 'true' : 'false'}
          >
            <DynamicOutlet
              key={active ? `${binding.pageKey}-${refreshNonce}` : binding.pageKey}
              binding={binding}
            />
          </div>
        );
      })}
    </div>
  );
};
