import { useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePlatformConfig } from '../../app/platform/PlatformConfigProvider';
import { slotRegistry } from '../../core/slots/SlotRegistry';
import { DASHBOARD_WIDGETS_SLOT_ID } from '../../domain/component-designer/DesignerRuntimeRegisteredSlotFill';
import {
  buildHomeWidgetRegistry,
  filterHomeWidgetRegistryForUser,
  type PackageDashboardSlotBinding,
} from './homeWidgetRegistry';

function subscribeSlotRegistry(listener: () => void): () => void {
  return slotRegistry.subscribe(listener);
}

function readDashboardPackageSlotBindings(): PackageDashboardSlotBinding[] {
  return slotRegistry.getComponents(DASHBOARD_WIDGETS_SLOT_ID).map((entry) => {
    const colon = entry.id.indexOf(':');
    const componentKey = colon >= 0 ? entry.id.slice(colon + 1) : entry.id;
    return {
      packageId: entry.packageId,
      componentKey,
      order: entry.order,
    };
  });
}

let cachedPackageBindings: PackageDashboardSlotBinding[] = [];
let cachedPackageBindingsKey = '';

function readStableDashboardPackageSlotBindings(): PackageDashboardSlotBinding[] {
  const next = readDashboardPackageSlotBindings();
  const key = next.map((item) => `${item.packageId}:${item.componentKey}:${item.order}`).join('|');
  if (key === cachedPackageBindingsKey) {
    return cachedPackageBindings;
  }
  cachedPackageBindingsKey = key;
  cachedPackageBindings = next;
  return cachedPackageBindings;
}

export function useHomeWidgetRegistry() {
  const { config } = usePlatformConfig();
  const { currentUser } = useAuth();
  const packageBindings = useSyncExternalStore(
    subscribeSlotRegistry,
    readStableDashboardPackageSlotBindings,
    readStableDashboardPackageSlotBindings,
  );

  return useMemo(() => {
    const registry = buildHomeWidgetRegistry({
      pageModules: config.pageModules,
      packageBindings,
    });
    return filterHomeWidgetRegistryForUser(registry, currentUser, config.pageModules);
  }, [config.pageModules, currentUser, packageBindings]);
}
