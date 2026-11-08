import { afterEach, describe, expect, it } from 'vitest';
import { slotRegistry } from '../SlotRegistry';

describe('SlotRegistry', () => {
  afterEach(() => {
    // Reset state via internal undocumented, or carefully unregister
    slotRegistry.unregisterByPackage('test-package');
    slotRegistry.unregisterByPackage('other-package');
  });

  it('should register a component and return it by target', () => {
    slotRegistry.register({
      id: 'test-comp-1',
      packageId: 'test-package',
      target: 'sidebar',
      order: 10,
      component: () => 'Test Component'
    });

    const items = slotRegistry.getComponents('sidebar');
    expect(items.length).toBe(1);
    expect(items[0].id).toBe('test-comp-1');
  });

  it('should order components correctly', () => {
    slotRegistry.register({
      id: 'comp-high-order',
      packageId: 'test-package',
      target: 'dashboard',
      order: 99,
      component: () => 'A'
    });

    slotRegistry.register({
      id: 'comp-low-order',
      packageId: 'test-package',
      target: 'dashboard',
      order: 1,
      component: () => 'B'
    });

    const items = slotRegistry.getComponents('dashboard');
    expect(items[0].id).toBe('comp-low-order');
    expect(items[1].id).toBe('comp-high-order');
  });

  it('should unregister all components of a specific package', () => {
    slotRegistry.register({
      id: 'comp-1',
      packageId: 'test-package',
      target: 'sidebar',
      order: 1,
      component: () => 'A'
    });

    slotRegistry.register({
      id: 'comp-2',
      packageId: 'other-package',
      target: 'sidebar',
      order: 2,
      component: () => 'B'
    });

    slotRegistry.unregisterByPackage('test-package');

    const items = slotRegistry.getComponents('sidebar');
    expect(items.length).toBe(1);
    expect(items[0].packageId).toBe('other-package');
  });
});
