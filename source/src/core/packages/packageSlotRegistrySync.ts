import type { ComponentType } from 'react';
import type { SlotCatalogResponse } from '../../shared/api/contracts/slots/catalog';
import { importPackageUiModule } from '../../shared/packages/importPackageUiModule';
import { resolvePackageUiModuleExport } from '../../shared/packages/packageUiModuleExport';
import { logger } from '../logging/Logger';
import { slotRegistry } from '../slots/SlotRegistry';

export type ActiveSlotBinding = SlotCatalogResponse['active'][number];

export type PluginSlotDynamicImport = (moduleUrl: string) => Promise<{ default?: unknown }>;

const pluginSlotDynamicImport: PluginSlotDynamicImport = (moduleUrl) => (
  importPackageUiModule(moduleUrl)
);

const buildSlotComponentId = (binding: ActiveSlotBinding): string => (
  `${binding.packageId}:${binding.componentKey}`
);

async function loadPluginSlotComponent(
  binding: ActiveSlotBinding,
  dynamicImport: PluginSlotDynamicImport = pluginSlotDynamicImport,
): Promise<{ component: ComponentType | null; error?: string }> {
  try {
    const module = await dynamicImport(binding.moduleUrl);
    const Component = resolvePackageUiModuleExport(module as Record<string, unknown>);
    if (typeof Component !== 'function') {
      logger.warn('PackageSlotRegistry', 'Package UI module has no default export', {
        packageId: binding.packageId,
        componentKey: binding.componentKey,
        moduleUrl: binding.moduleUrl,
      });
      return { component: null, error: 'Package UI module has no default export.' };
    }
    return { component: Component as ComponentType };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown import error';
    logger.error('PackageSlotRegistry', 'Failed to dynamically import package UI module', {
      packageId: binding.packageId,
      componentKey: binding.componentKey,
      moduleUrl: binding.moduleUrl,
      error: message,
    });
    return { component: null, error: message };
  }
}

export type SlotSyncFailure = {
  binding: ActiveSlotBinding;
  error: string;
};

export type SlotSyncResult = {
  pluginIds: Set<string>;
  failures: SlotSyncFailure[];
};

export async function syncPluginSlotRegistry(
  active: ActiveSlotBinding[],
  previousPluginIds: ReadonlySet<string>,
  dynamicImport: PluginSlotDynamicImport = pluginSlotDynamicImport,
): Promise<SlotSyncResult> {
  const nextPluginIds = new Set(active.map((binding) => binding.packageId));
  const failures: SlotSyncFailure[] = [];

  for (const packageId of previousPluginIds) {
    if (!nextPluginIds.has(packageId)) {
      slotRegistry.unregisterByPackage(packageId);
    }
  }

  await Promise.all(active.map(async (binding) => {
    const loaded = await loadPluginSlotComponent(binding, dynamicImport);
    if (!loaded.component) {
      failures.push({
        binding,
        error: loaded.error || 'Dynamic import returned no component.',
      });
      return;
    }

    slotRegistry.register({
      id: buildSlotComponentId(binding),
      packageId: binding.packageId,
      target: binding.slotId,
      component: loaded.component,
      order: binding.order,
    });
  }));

  return { pluginIds: nextPluginIds, failures };
}
