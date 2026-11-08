export type ComponentType = any; // Representing React Component
import { LogMethod, logger } from '../logging/Logger';

export interface SlotComponent {
  id: string;
  packageId: string;
  target: string;
  component: ComponentType;
  order: number;
}

class SlotRegistry {
  private slots: Map<string, SlotComponent[]> = new Map();
  private listeners: Set<() => void> = new Set();
  private emptyArray: SlotComponent[] = [];

  @LogMethod({ id: 'SlotRegistry.register' })
  register(item: SlotComponent) {
    const current = this.slots.get(item.target) || [];
    // Replace if exists (HMR support)
    const filtered = current.filter(c => c.id !== item.id);
    this.slots.set(item.target, [...filtered, item].sort((a, b) => a.order - b.order));
    logger.info('SlotRegistry', 'Slot registered', { id: item.id, target: item.target, packageId: item.packageId });
    this.notify();
  }

  @LogMethod({ id: 'SlotRegistry.unregisterByPackage' })
  unregisterByPackage(packageId: string) {
    let changed = false;
    for (const [target, items] of this.slots.entries()) {
      const filtered = items.filter(i => i.packageId !== packageId);
      if (filtered.length !== items.length) {
        this.slots.set(target, filtered);
        changed = true;
      }
    }
    if (changed) this.notify();
  }

  @LogMethod({ id: 'SlotRegistry.getComponents' })
  getComponents(target: string): SlotComponent[] {
    return this.slots.get(target) || this.emptyArray;
  }

  @LogMethod({ id: 'SlotRegistry.subscribe' })
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  @LogMethod({ id: 'SlotRegistry.notify' })
  private notify() {
    this.listeners.forEach(l => l());
  }
}

export const slotRegistry = new SlotRegistry();
