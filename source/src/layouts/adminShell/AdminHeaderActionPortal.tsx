import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const HEADER_ACTION_SLOT_ID = 'header-action-slot';

export const AdminHeaderActionPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const slot = document.getElementById(HEADER_ACTION_SLOT_ID);
    if (!slot) {
      return undefined;
    }

    slot.dataset.active = 'true';
    setTarget(slot);

    return () => {
      delete slot.dataset.active;
    };
  }, []);

  if (!target) {
    return null;
  }

  return createPortal(children, target);
};
