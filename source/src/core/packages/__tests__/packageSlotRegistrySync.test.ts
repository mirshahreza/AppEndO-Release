import { describe, it, expect, beforeEach } from 'vitest';
import type { ComponentType } from 'react';
import { slotRegistry } from '../../slots/SlotRegistry';
import { syncPluginSlotRegistry } from '../packageSlotRegistrySync';

const StubWidget: ComponentType = () => null;

describe('packageSlotRegistrySync', () => {
  beforeEach(() => {
    slotRegistry.unregisterByPackage('alpha-pack');
    slotRegistry.unregisterByPackage('beta-pack');
  });

  it('registers dynamically imported package components into SlotRegistry', async () => {
    const { pluginIds: nextPluginIds } = await syncPluginSlotRegistry(
      [
        {
          slotId: 'core.dashboard.widgets',
          packageId: 'alpha-pack',
          componentKey: 'summary-widget',
          order: 10,
          version: '1.0.0',
          moduleUrl: '/api/packages/alpha-pack/ui/summary-widget',
        },
      ],
      new Set(),
      async () => ({ default: StubWidget }),
    );

    expect(nextPluginIds).toEqual(new Set(['alpha-pack']));
    const components = slotRegistry.getComponents('core.dashboard.widgets');
    expect(components).toHaveLength(1);
    expect(components[0]?.packageId).toBe('alpha-pack');
    expect(components[0]?.component).toBe(StubWidget);
  });

  it('unregisters package slot components when they are no longer active', async () => {
    const dynamicImport = async () => ({ default: StubWidget });

    await syncPluginSlotRegistry(
      [
        {
          slotId: 'core.dashboard.widgets',
          packageId: 'alpha-pack',
          componentKey: 'summary-widget',
          order: 10,
          version: '1.0.0',
          moduleUrl: '/api/packages/alpha-pack/ui/summary-widget',
        },
      ],
      new Set(),
      dynamicImport,
    );

    await syncPluginSlotRegistry([], new Set(['alpha-pack']), dynamicImport);

    expect(slotRegistry.getComponents('core.dashboard.widgets')).toHaveLength(0);
  });
});
