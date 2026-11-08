import { useEffect, useState } from 'react';

const HEADER_ACTION_SLOT_ID = 'header-action-slot';

export function useHeaderActionSlotActive(): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let slotObserver: MutationObserver | null = null;

    const attachToSlot = (slot: HTMLElement) => {
      slotObserver?.disconnect();
      const sync = () => {
        setActive(slot.dataset.active === 'true');
      };
      sync();
      slotObserver = new MutationObserver(sync);
      slotObserver.observe(slot, { attributes: true, attributeFilter: ['data-active'] });
    };

    const resolveSlot = () => {
      const slot = document.getElementById(HEADER_ACTION_SLOT_ID);
      if (slot) {
        attachToSlot(slot);
        return true;
      }
      setActive(false);
      return false;
    };

    if (!resolveSlot()) {
      const rootObserver = new MutationObserver(() => {
        resolveSlot();
      });
      rootObserver.observe(document.body, { childList: true, subtree: true });
      return () => {
        rootObserver.disconnect();
        slotObserver?.disconnect();
      };
    }

    return () => {
      slotObserver?.disconnect();
    };
  }, []);

  return active;
}
