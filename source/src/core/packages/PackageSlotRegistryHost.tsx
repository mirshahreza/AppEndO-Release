import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../app/guards/roleAccess';
import { ensurePackageUiRuntime } from './ensurePackageUiRuntime';
import { syncPluginSlotRegistry } from './packageSlotRegistrySync';
import { useSlotsCatalogQuery } from '../../shared/api/queries/slots';
import { isPackedStudioPageSlotBinding } from '../../shared/api/contracts/slots/catalog';
import { AppToast } from '../../shared/ui/AppToast';

export const PackageSlotRegistryHost: React.FC = () => {
  const { isAuthenticated, currentUser } = useAuth();
  const canLoadPluginSlots = isAuthenticated && isAdminUser(currentUser);
  const slotsQuery = useSlotsCatalogQuery(canLoadPluginSlots);
  const loadedPluginIdsRef = React.useRef<Set<string>>(new Set());
  const syncGenerationRef = React.useRef(0);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!canLoadPluginSlots) {
      if (loadedPluginIdsRef.current.size > 0) {
        void syncPluginSlotRegistry([], loadedPluginIdsRef.current).then(({ pluginIds }) => {
          loadedPluginIdsRef.current = pluginIds;
        });
      }
      return;
    }

    const active = (slotsQuery.data?.active ?? []).filter(
      (binding) => !isPackedStudioPageSlotBinding(binding),
    );
    const generation = syncGenerationRef.current + 1;
    syncGenerationRef.current = generation;

    let cancelled = false;
    void (async () => {
      if (active.length > 0) {
        try {
          await ensurePackageUiRuntime();
        } catch {
          if (!cancelled && syncGenerationRef.current === generation) {
            setLoadError('Package UI runtime failed to load.');
          }
          return;
        }
      }
      if (cancelled || syncGenerationRef.current !== generation) {
        return;
      }

      const { pluginIds, failures } = await syncPluginSlotRegistry(active, loadedPluginIdsRef.current);
      if (cancelled || syncGenerationRef.current !== generation) {
        return;
      }
      loadedPluginIdsRef.current = pluginIds;

      if (failures.length > 0) {
        const first = failures[0];
        const extra = failures.length > 1 ? ` (+${failures.length - 1} more)` : '';
        const detail = first.error?.trim() ? ` ${first.error}` : '';
        setLoadError(
          `Package UI "${first.binding.componentKey}" (${first.binding.packageId}) failed to load.${extra}${detail}`,
        );
        return;
      }
      setLoadError(null);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    canLoadPluginSlots,
    slotsQuery.data?.active,
    slotsQuery.dataUpdatedAt,
  ]);

  if (!loadError) {
    return null;
  }

  return <AppToast type="error" text={loadError} onDismiss={() => setLoadError(null)} />;
};
